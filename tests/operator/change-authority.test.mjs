import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {ServiceNowAuthority} from '../../ui/netclaw-visual/src/management/change-authority.js';
import {verifyChangeApproval} from '../../ui/netclaw-visual/src/management/policy.js';

function fixture(t){
  const f=installationFixture(t),binding=bindInstallation(f),change='a'.repeat(32),approver='b'.repeat(32),executor='c'.repeat(32),ci='d'.repeat(32),actionDigest='e'.repeat(64),approval='f'.repeat(32);
  const config={schemaVersion:1,installationId:f.installationId,origin:'https://fixture.service-now.com',executorPrincipalId:binding.principal.principalId,executorUserSysId:executor,
    credential:{tokenRef:'NETCLAW_CHANGE_AUTH_TOKEN'},implementState:'-1',changeDigestField:'u_netclaw_action_digest',approvalDigestField:'u_netclaw_action_digest',targetCis:{[f.installationId]:[ci]}};
  const file=path.join(f.statePath,'change-authority.json');fs.writeFileSync(file,JSON.stringify(config),{mode:0o600});fs.appendFileSync(binding.envPath,'NETCLAW_CHANGE_AUTH_TOKEN=synthetic-read-only-token\n');
  const rows={change_request:[{sys_id:change,number:'CHG0000123',state:'-1',approval:'approved',active:'true',cmdb_ci:ci,u_netclaw_action_digest:actionDigest}],
    task_ci:[],sysapproval_approver:[{sys_id:approval,sysapproval:change,approver,state:'approved',u_netclaw_action_digest:actionDigest}],incident:[]};
  const calls=[];let hook=()=>{};
  const fetcher=async(url,options)=>{
    const parsed=new URL(url);calls.push({url:parsed,options});hook(parsed);
    return Response.json({result:rows[parsed.pathname.split('/').at(-1)]});
  };
  const authority=new ServiceNowAuthority(binding,{fetcher});
  const intent={changeClass:'production',action:'service.stop',targets:[f.installationId],actionDigest};
  return {...f,binding,file,config,rows,calls,authority,intent,verify:()=>verifyChangeApproval(binding.principal,intent,'CHG0000123',authority),setHook:fn=>{hook=fn;}};
}

test('exact independent live approval and incident precheck use only bounded fixed GETs',async t=>{
  const f=fixture(t),value=await f.verify();assert.equal(value.verified,true);assert.equal(value.state,'Implement');
  assert.ok(f.calls.length>=4);assert.ok(f.calls.every(c=>c.options.method==='GET'&&c.options.redirect==='error'&&c.url.origin==='https://fixture.service-now.com'));
  assert.ok(f.calls.every(c=>!c.url.href.includes('synthetic-read-only-token')));assert.ok(!JSON.stringify(value).includes('synthetic-read-only-token'));
  f.rows.change_request[0].state='0';await assert.rejects(f.verify(),{code:'DENIED'});
});
test('self approval, changed digest, missing target CI, pending approval and active P1/P2 all refuse',async t=>{
  for(const mutation of ['self','digest','ci','pending','incident']){
    const f=fixture(t);
    if(mutation==='self')f.rows.sysapproval_approver[0].approver=f.config.executorUserSysId;
    if(mutation==='digest')f.rows.sysapproval_approver[0].u_netclaw_action_digest='0'.repeat(64);
    if(mutation==='ci')f.rows.change_request[0].cmdb_ci='';
    if(mutation==='pending')f.rows.sysapproval_approver[0].state='requested';
    if(mutation==='incident')f.rows.incident.push({sys_id:'1'.repeat(32),active:'true',priority:'1',cmdb_ci:f.config.targetCis[f.installationId][0]});
    await assert.rejects(f.verify(),{code:'DENIED'});
  }
});
test('unconfigured authority, unsafe origin, query injection and missing API fields fail closed',async t=>{
  const f=fixture(t);await assert.rejects(f.authority.verify('CHG0000123^ORactive=true',f.intent));assert.equal(f.calls.length,0);
  fs.writeFileSync(f.file,JSON.stringify({...f.config,origin:'http://fixture.service-now.com'}));await assert.rejects(f.verify());assert.equal(f.calls.length,0);
  fs.writeFileSync(f.file,JSON.stringify(f.config));delete f.rows.change_request[0].approval;await assert.rejects(f.verify());
  fs.unlinkSync(f.file);await assert.rejects(f.verify(),{code:'UNQUALIFIED'});
});
test('binding changes or withdrawal during API reads cannot produce an approval receipt',async t=>{
  const f=fixture(t);f.setHook(url=>{if(url.pathname.endsWith('/incident'))fs.writeFileSync(f.file,JSON.stringify({...f.config,implementState:'0'}));});
  await assert.rejects(f.verify(),{code:'STALE_REVISION'});
  fs.writeFileSync(f.file,JSON.stringify(f.config));let changes=0;
  f.setHook(url=>{if(url.pathname.endsWith('/change_request')&&++changes===2)f.rows.change_request[0].state='0';});
  await assert.rejects(f.verify(),{code:'DENIED'});
});
test('an individual approver withdrawal during the incident check is re-read before issuing authority',async t=>{
  const f=fixture(t);f.setHook(url=>{if(url.pathname.endsWith('/incident'))f.rows.sysapproval_approver[0].state='rejected';});
  await assert.rejects(f.verify(),{code:'DENIED'});
});
test('oversized, truncated and ambiguous authority results do not become absence of incidents',async t=>{
  const f=fixture(t);f.rows.sysapproval_approver=Array.from({length:101},()=>f.rows.sysapproval_approver[0]);await assert.rejects(f.verify());
  const authority=new ServiceNowAuthority(f.binding,{fetcher:async()=>new Response('x'.repeat(1024*1024+1))});
  await assert.rejects(authority.verify('CHG0000123',f.intent));
});

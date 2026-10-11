import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture,nonce,auditFixture,authoritativeApproval} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {Journal} from '../../ui/netclaw-visual/src/management/journal.js';
import {TerminalIntent,intentDevices} from '../../ui/netclaw-visual/src/management/intent.js';
import {createLocalChangePolicy} from '../../ui/netclaw-visual/terminal-change-policy.js';

const report={status:'completed',requestKind:'read-only',outcome:'answered',summary:'Synthetic observation; no device contacted.',actions:[],verification:[]};
const response=value=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}),{headers:{'content-type':'application/json'}});
function fixture(t){
  const f=installationFixture(t),binding=bindInstallation(f),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const testbed=path.join(f.home,'testbed.yaml');fs.writeFileSync(testbed,'devices:\n  LAB-A:\n    os: iosxe\n    credentials:\n      default: {username: admin, password: SYNTHETIC_PRIVATE_PASSWORD}\n    connections:\n      cli: {protocol: ssh, ip: 192.0.2.1, port: 22}\n  PROD:\n    connections:\n      ssh: {protocol: ssh, ip: 192.0.2.2, port: 22}\n',{mode:0o600});
  fs.writeFileSync(f.configPath,JSON.stringify({gateway:{port:18789,auth:{mode:'token',token:'${OPENCLAW_GATEWAY_TOKEN}'},http:{endpoints:{chatCompletions:{enabled:true}}}}}));
  fs.appendFileSync(binding.envPath,`PYATS_TESTBED_PATH=${testbed}\nOPENCLAW_GATEWAY_TOKEN=fixture-token\n`);
  const audit=auditFixture(),authority=authoritativeApproval(),starts=[],calls=[];
  const intent=new TerminalIntent({binding,journal,audit,authority,runtime:{readiness:async()=>({ready:true})},start:async id=>starts.push(id),clean:value=>structuredClone(value),fetcher:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return response(report);}});
  const policy=createLocalChangePolicy({directory:path.join(f.home,'netclaw-changes'),listDevices:()=>intentDevices(binding).devices});
  const base=()=>({nonce:nonce(),request:'Inspect LAB-A.',requestKind:'read-only',changeMode:'production',targetDeviceIds:['LAB-A'],expectedRevision:intent.revision()});
  return {...f,binding,journal,audit,authority,intent,policy,base,calls,starts,testbed};
}
const lab=f=>{const value=f.policy.save({enabled:true,confirmLab:true,deviceIds:['LAB-A'],revision:f.policy.state().revision});return {...f.base(),changeMode:'local-lab',policyRevision:value.revision};};

test('operator intent retains owned report, dispatch reference and nonce without automatic replay',async t=>{
  const f=fixture(t),input=f.base(),operation=await f.intent.submit(f.binding.principal,input);assert.equal(f.calls.length,0);assert.equal(f.starts.length,1);
  const finished=await f.intent.run(operation.operationId);assert.equal(finished.state,'succeeded');assert.equal(finished.result.verifiedNetworkOutcome,false);
  assert.equal(f.calls.length,1);assert.match(f.calls[0].body.messages[0].content,/explicitly selected READ-ONLY/);
  const saved=f.intent.read(f.binding.principal,operation.operationId);assert.equal(saved.execution.status,'completed');assert.ok(saved.operation.externalReference);
  assert.equal((await f.intent.submit(f.binding.principal,input)).operationId,operation.operationId);await f.intent.run(operation.operationId);assert.equal(f.calls.length,1);
  assert.ok(!JSON.stringify(f.intent.state(f.binding.principal)).includes('SYNTHETIC_PRIVATE_PASSWORD'));
});
test('assistant principals, missing CRs, stale configuration and undesignated Local/Lab targets never dispatch',async t=>{
  const f=fixture(t),input=lab(f);
  await assert.rejects(f.intent.submit({...f.binding.principal,surface:'assistant',grantId:'forged'},input),{code:'DENIED'});
  await assert.rejects(f.intent.submit(f.binding.principal,{...input,nonce:nonce(),requestKind:'change',changeMode:'production'}),{code:'DENIED'});
  await assert.rejects(f.intent.submit(f.binding.principal,{...input,nonce:nonce(),targetDeviceIds:['PROD']}));
  fs.appendFileSync(f.testbed,'# inventory changed\n');await assert.rejects(f.intent.submit(f.binding.principal,input),{code:'STALE_REVISION'});
  assert.equal(f.starts.length,0);assert.equal(f.calls.length,0);
});
test('Local/Lab requires API-created private artifacts before APPLY and keeps actual hashes in its own record',async t=>{
  const f=fixture(t),input={...lab(f),request:'Configure the explicitly requested lab setting.',requestKind:'change'};let operation,count=0;
  f.intent.fetcher=async(_url,options)=>{
    count++;const body=JSON.parse(options.body),change=f.policy.get(operation.operationId);
    if(count===1){
      assert.equal(change.phase,'prepare');
      for(const device of change.devices){fs.writeFileSync(device.baselinePath,'SYNTHETIC TEST BASELINE ONLY',{mode:0o600});fs.writeFileSync(device.rollbackPath,'SYNTHETIC TEST ROLLBACK ONLY',{mode:0o600});}
      return response({status:'prepared',requestKind:'change',outcome:'pending',summary:'Synthetic artifacts only.',actions:[],baseline:[{device:'LAB-A',summary:'Synthetic baseline'}],rollback:[{device:'LAB-A',summary:'Synthetic rollback'}]});
    }
    assert.match(body.messages.at(-1).content,/APPLY PHASE/);assert.equal(change.phase,'apply');assert.equal(change.artifacts.length,2);assert.ok(change.artifacts.every(row=>/^[a-f\d]{64}$/.test(row.sha256)));
    return response({status:'completed',requestKind:'change',outcome:'changed',summary:'Synthetic fixture reports verified.',actions:[{device:'LAB-A',kind:'configuration',summary:'Synthetic action'}],verification:[{device:'LAB-A',summary:'Synthetic check'}]});
  };
  operation=await f.intent.submit(f.binding.principal,input);const result=await f.intent.run(operation.operationId);assert.equal(result.state,'succeeded');assert.equal(result.result.verifiedNetworkOutcome,false);assert.equal(count,2);
  assert.equal(f.journal.events(f.binding.principal,operation.operationId).filter(row=>row.type==='intent-dispatch').length,2);
});
test('read-only selection cannot promote a prepared model report to APPLY; uncertain requests block new admission',async t=>{
  const f=fixture(t),input=lab(f);let count=0;
  f.intent.fetcher=async()=>{count++;return response({status:'prepared',requestKind:'change',outcome:'pending',summary:'Model tried to authorize a change.',actions:[]});};
  const operation=await f.intent.submit(f.binding.principal,input),result=await f.intent.run(operation.operationId);assert.equal(result.state,'unknown');assert.equal(count,1);assert.equal(f.policy.get(operation.operationId).phase,'prepare');
  await assert.rejects(f.intent.submit(f.binding.principal,{...input,nonce:nonce()}),{code:'BUSY'});assert.equal(count,1);
});
test('missing, public or linked lab artifacts stop before APPLY without claiming network verification',async t=>{
  for(const variant of ['missing','public','linked']){
    const f=fixture(t),input={...lab(f),requestKind:'change'};let operation,count=0;
    f.intent.fetcher=async()=>{
      count++;const record=f.policy.get(operation.operationId),device=record.devices[0];
      if(variant==='public'){fs.writeFileSync(device.baselinePath,'SYNTHETIC baseline',{mode:0o644});fs.writeFileSync(device.rollbackPath,'SYNTHETIC rollback',{mode:0o600});}
      if(variant==='linked'){fs.symlinkSync(f.testbed,device.baselinePath);fs.writeFileSync(device.rollbackPath,'SYNTHETIC rollback',{mode:0o600});}
      return response({status:'prepared',requestKind:'change',outcome:'pending',summary:'Synthetic missing/unsafe artifacts.',actions:[],baseline:[{device:'LAB-A',summary:'Claim only'}],rollback:[{device:'LAB-A',summary:'Claim only'}]});
    };
    operation=await f.intent.submit(f.binding.principal,input);const result=await f.intent.run(operation.operationId);assert.equal(result.state,'failed');assert.equal(count,1);assert.equal(f.policy.get(operation.operationId).phase,'prepare');
  }
});
test('live policy revocation and production CR withdrawal prevent the next segment and retain unknown outcome',async t=>{
  for(const variant of ['local','production']){
    const f=fixture(t),input=variant==='local'?{...lab(f),requestKind:'change'}:{...f.base(),requestKind:'change',approvalReference:'CHG-fixture'};let count=0;
    f.intent.fetcher=async()=>{count++;if(variant==='local')f.policy.save({enabled:false,deviceIds:[],revision:f.policy.state().revision});else f.authority.withdraw();return response({status:'in_progress',requestKind:'change',outcome:'pending',summary:'Synthetic progress only.',actions:[]});};
    const operation=await f.intent.submit(f.binding.principal,input),result=await f.intent.run(operation.operationId);assert.equal(result.state,'unknown');assert.equal(count,1);
  }
});
test('audit loss is allowed only after the exact local API record exists, while production fails before dispatch',async t=>{
  const production=fixture(t),first=await production.intent.submit(production.binding.principal,production.base());production.audit.available=false;
  assert.equal((await production.intent.run(first.operationId)).state,'failed');assert.equal(production.calls.length,0);
  const local=fixture(t),second=await local.intent.submit(local.binding.principal,lab(local));local.audit.available=false;
  assert.equal((await local.intent.run(second.operationId)).state,'succeeded');assert.equal(local.calls.length,1);assert.ok(local.policy.get(second.operationId));
  assert.ok(local.journal.events(local.binding.principal,second.operationId).some(event=>event.type==='gait-unavailable'));
});
test('cancel before worker prevents dispatch; cancellation during a segment never promises upstream termination',async t=>{
  const f=fixture(t),first=await f.intent.submit(f.binding.principal,f.base());
  const cancelled=await f.intent.cancel(f.binding.principal,{nonce:nonce(),operationId:first.operationId});assert.equal(cancelled.state,'cancelled');await f.intent.run(first.operationId);assert.equal(f.calls.length,0);
  let count=0,operation;
  f.intent.fetcher=async()=>{count++;await f.intent.cancel(f.binding.principal,{nonce:nonce(),operationId:operation.operationId});return response(report);};
  operation=await f.intent.submit(f.binding.principal,f.base());assert.equal((await f.intent.run(operation.operationId)).state,'unknown');assert.equal(count,1);
});

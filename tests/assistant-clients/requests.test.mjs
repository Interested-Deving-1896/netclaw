import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce,auditFixture} from '../operator/fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
import {assistantCall} from '../../mcp-servers/netclaw-assistant-mcp/server.mjs';
import {ProtectedAssistantRuntime} from '../../ui/netclaw-visual/src/management/assistant-requests.js';

async function setup(t,disclosure=['summary','conversation']){
  const f=installationFixture(t),service=new ManagementService({...f,root:fileURLToPath(new URL('../../',import.meta.url)),audit:auditFixture()});t.after(()=>service.close());
  const owner=service.binding.principal,calls=[];let state='succeeded';
  service.assistants.start=async id=>calls.push(['start',id]);
  service.assistants.runtime={readiness:async()=>({ready:true,grantEnforced:true}),submit:async id=>{calls.push(['submit',id]);},observe:async id=>({state,output:'synthetic scoped result',conversationId:id,source:'Fixture protected runtime'}),cancel:async id=>{calls.push(['cancel',id]);}};
  const grant=async()=>{
    const p=await service.clients.prepare(owner,{nonce:nonce(),client:'codex',actions:['inspect','delegate','cancel','evidence'],targets:[f.installationId],disclosure,expiresAt:Date.now()+3600000});
    return (await service.clients.apply(owner,{nonce:nonce(),proposalId:p.proposalId,expectedRevision:p.expectedRevision})).result;
  };
  const g=await grant();return {...f,service,owner,calls,grant,g,setState:value=>{state=value;},request:args=>assistantCall(service,g.credentialRef,'netclaw_request',{nonce:nonce(),prompt:'Calculate 192.0.2.0/24',...args})};
}
test('assistant admission freezes authority and a retained nonce never dispatches inference twice',async t=>{
  const f=await setup(t),n=nonce(),op=await f.request({nonce:n});
  const saved=JSON.parse(f.service.journal._row(op.operationId).input);assert.equal(saved.authority.grantId,f.g.grantId);assert.equal(saved.authority.surface,'assistant');
  await f.service.assistants.run(op.operationId);assert.equal(f.service.journal.get(f.owner,op.operationId).state,'succeeded');
  const again=await f.request({nonce:n});assert.equal(again.operationId,op.operationId);assert.equal(again.state,'succeeded');assert.equal(f.calls.filter(([name])=>name==='submit').length,1);
  await f.service.assistants.run(op.operationId);assert.equal(f.calls.filter(([name])=>name==='submit').length,1);
});
test('foreign grants cannot resume or cancel a conversation and operator contexts cannot be borrowed',async t=>{
  const f=await setup(t),other=await f.grant(),op=await f.request();
  await assert.rejects(assistantCall(f.service,other.credentialRef,'netclaw_request',{nonce:nonce(),prompt:'borrow',conversationId:op.operationId}),{code:'DENIED'});
  await assert.rejects(assistantCall(f.service,other.credentialRef,'netclaw_cancel',{nonce:nonce(),requestId:op.operationId}),{code:'DENIED'});
  await assert.rejects(f.request({contextIds:[op.operationId]}),{code:'UNQUALIFIED'});
});
test('continuing the initial conversation cannot overlap its first running or unknown request',async t=>{
  const f=await setup(t),op=await f.request();
  await assert.rejects(f.request({conversationId:op.operationId}),{code:'BUSY'});
  f.service.journal.claim(op.operationId,{pid:process.pid,start:'fixture'});
  f.service.journal.transition(op.operationId,'unknown',{code:'UNKNOWN_OUTCOME'});
  await assert.rejects(f.request({conversationId:op.operationId}),{code:'UNKNOWN_OUTCOME'});
});
test('summary-only grants cannot retrieve answer text via status, repeated nonce or cancel',async t=>{
  const f=await setup(t,['summary']),n=nonce(),op=await f.request({nonce:n});await f.service.assistants.run(op.operationId);
  const cancelNonce=nonce();
  for(const result of [await f.request({nonce:n}),await assistantCall(f.service,f.g.credentialRef,'netclaw_request_status',{requestId:op.operationId}),
    await assistantCall(f.service,f.g.credentialRef,'netclaw_cancel',{nonce:cancelNonce,requestId:op.operationId}),
    await assistantCall(f.service,f.g.credentialRef,'netclaw_cancel',{nonce:cancelNonce,requestId:op.operationId})]){
    assert.equal(JSON.stringify(result).includes('synthetic scoped result'),false);assert.ok(result.result.summary);
  }
  const inventory=await assistantCall(f.service,f.g.credentialRef,'netclaw_inventory',{kind:'overview'});
  assert.equal(JSON.stringify(inventory).includes('synthetic scoped result'),false);
  assert.ok(inventory.operations.every(row=>row.result?.usage===undefined));
  assert.equal(f.service.journal.get(f.owner,op.operationId).result.output,'synthetic scoped result');
});
test('the human operator can cancel an assistant request after its grant is revoked',async t=>{
  const f=await setup(t),op=await f.request();await f.service.clients.revoke(f.owner,{grantId:f.g.grantId,nonce:nonce()});
  const result=await f.service.call('operator_cancel_request',{nonce:nonce(),operationId:op.operationId});assert.equal(result.state,'cancelled');
  await assert.rejects(assistantCall(f.service,f.g.credentialRef,'netclaw_cancel',{nonce:nonce(),requestId:op.operationId}),{code:'DENIED'});
});
test('revocation before worker dispatch prevents any runtime submission',async t=>{
  const f=await setup(t),op=await f.request();await f.service.clients.revoke(f.owner,{grantId:f.g.grantId,nonce:nonce()});
  await f.service.assistants.run(op.operationId);assert.equal(f.service.journal.get(f.owner,op.operationId).state,'failed');assert.equal(f.calls.filter(([name])=>name==='submit').length,0);
});
test('lost submit response stays unknown until authoritative observation without retry',async t=>{
  const f=await setup(t),n=nonce(),op=await f.request({nonce:n});let submits=0;
  f.service.assistants.runtime.submit=async()=>{submits++;throw Error('lost receipt');};
  await f.service.assistants.run(op.operationId);assert.equal(f.service.journal.get(f.owner,op.operationId).state,'unknown');
  assert.equal((await f.request({nonce:n})).state,'unknown');assert.equal(submits,1);
  const resolved=await assistantCall(f.service,f.g.credentialRef,'netclaw_request_status',{requestId:op.operationId});assert.equal(resolved.state,'succeeded');assert.equal(submits,1);
});
test('cancel before dispatch never submits and active cancellation is not reported as confirmed',async t=>{
  const f=await setup(t),op=await f.request();
  const cancelled=await assistantCall(f.service,f.g.credentialRef,'netclaw_cancel',{nonce:nonce(),requestId:op.operationId});assert.equal(cancelled.state,'cancelled');
  await f.service.assistants.run(op.operationId);assert.equal(f.calls.filter(([name])=>name==='submit').length,0);
  const active=await f.request();f.service.journal.claim(active.operationId,{pid:process.pid,start:'fixture'});
  const pending=await assistantCall(f.service,f.g.credentialRef,'netclaw_cancel',{nonce:nonce(),requestId:active.operationId});assert.equal(pending.state,'cancellation-requested');assert.equal(f.calls.filter(([name])=>name==='cancel').length,1);
});
test('OpenClaw or absent protected broker cannot fall back to an ordinary operator runtime',async t=>{
  const f=await setup(t);let sent=0;
  const runtime=new ProtectedAssistantRuntime(f.service.binding,{fetcher:async()=>{sent++;throw Error('unexpected request');}});
  assert.equal((await runtime.readiness()).ready,false);assert.equal(sent,0);
  const hermes=installationFixture(t,'hermes');fs.writeFileSync(hermes.configPath,'model: fixture\n');
  const service=new ManagementService({...hermes,root:fileURLToPath(new URL('../../',import.meta.url)),audit:auditFixture()});t.after(()=>service.close());
  assert.equal((await service.assistants.runtime.readiness()).ready,false);assert.equal(fs.existsSync(path.join(hermes.home,'netclaw-federation/broker.json')),false);
});

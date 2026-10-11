import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { installationFixture, nonce, auditFixture } from './fixtures.mjs';
import { bindInstallation } from '../../ui/netclaw-visual/src/management/identity.js';
import { Journal } from '../../ui/netclaw-visual/src/management/journal.js';
import { Conversations } from '../../ui/netclaw-visual/src/management/conversations.js';
import {projectGatewayEvent,validateConversationSelection} from '../../ui/netclaw-visual/src/management/chat-runtime.js';

function fixture(t, kind) {
  const f=installationFixture(t,kind),binding=bindInstallation(f);
  const journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const calls=[];let status={state:'succeeded',output:'Actual fixture response',usage:{totalTokens:17}};
  const runtime={kind,async readiness(){return {ready:true,grantEnforced:false};},
    async open(){calls.push('open');},async submit(value){calls.push('submit');return {reference:value.requestId};},
    async observe(){calls.push('observe');return status;},async cancel(){calls.push('cancel');return {requested:true,confirmed:false};},async close(){}};
  const audit=auditFixture(),started=[];
  const service=new Conversations({binding,journal,audit,runtime,start:async id=>started.push(id),clean:v=>v});
  return {f,binding,journal,runtime,audit,calls,service,started,setStatus:value=>{status=value;}};
}

for(const kind of ['openclaw','hermes'])test(`${kind}: opening and view switches do not dispatch, nonce and resume preserve owned work`,async t=>{
  const f=fixture(t,kind),owner=f.binding.principal;
  const opened=await f.service.open(owner,{nonce:nonce(),view:'chat'});
  await f.service.open(owner,{nonce:nonce(),view:'canvas',conversationId:opened.conversationId});
  assert.equal(f.calls.length,0);
  const input={nonce:nonce(),conversationId:opened.conversationId,prompt:'Inspect fixture',contextIds:[]};
  const admitted=await f.service.submit(owner,input);
  assert.equal((await f.service.submit(owner,input)).operationId,admitted.operationId);
  assert.equal(f.started.length,1);
  await assert.rejects(f.service.submit(owner,{...input,prompt:'changed'}),{code:'NONCE_CONFLICT'});
  const finished=await f.service.run(admitted.operationId);
  assert.equal(finished.state,'succeeded');assert.equal(finished.result.output,'Actual fixture response');
  assert.equal(f.calls.filter(c=>c==='submit').length,1);
  const replay=await f.service.submit(owner,input);assert.equal(replay.state,'succeeded');assert.equal(f.started.length,1);
  assert.ok(f.journal.events(owner,admitted.operationId).some(e=>e.type==='runtime-observation'));
});

test('audit loss refuses dispatch and unqualified assistants cannot borrow operator authority',async t=>{
  const f=fixture(t,'hermes'),owner=f.binding.principal;
  const conversation=await f.service.open(owner,{nonce:nonce(),view:'chat'});
  f.audit.available=false;
  await assert.rejects(f.service.submit(owner,{nonce:nonce(),conversationId:conversation.conversationId,prompt:'x',contextIds:[]}));
  assert.equal(f.started.length,0);assert.equal(f.calls.length,0);
  const assistant={principalId:'client',surface:'assistant',grantId:randomUUID(),generation:1,targets:[f.f.installationId],actions:['delegate'],expiresAt:Date.now()+60000};
  await assert.rejects(f.service.open(assistant,{nonce:nonce(),view:'chat'}),{code:'UNQUALIFIED'});
});

test('lost admission receipt remains unknown and never retries the runtime',async t=>{
  const f=fixture(t,'openclaw'),owner=f.binding.principal;
  const c=await f.service.open(owner,{nonce:nonce(),view:'chat'});
  f.runtime.submit=async()=>{f.calls.push('submit');throw Error('connection lost after dispatch');};
  const input={nonce:nonce(),conversationId:c.conversationId,prompt:'x',contextIds:[]};
  const op=await f.service.submit(owner,input);assert.equal((await f.service.run(op.operationId)).state,'unknown');
  assert.equal((await f.service.submit(owner,input)).state,'unknown');assert.equal(f.calls.filter(c=>c==='submit').length,1);
  await assert.rejects(f.service.submit(owner,{...input,nonce:nonce()}),{code:'UNKNOWN_OUTCOME'});
});

test('context must be explicitly staged and cancellation acknowledgment is not cancellation',async t=>{
  const f=fixture(t,'hermes'),owner=f.binding.principal;
  const c=await f.service.open(owner,{nonce:nonce(),view:'chat'});
  await assert.rejects(f.service.submit(owner,{nonce:nonce(),conversationId:c.conversationId,prompt:'x',contextIds:[randomUUID()]}),{code:'DENIED'});
  const op=await f.service.submit(owner,{nonce:nonce(),conversationId:c.conversationId,prompt:'x',contextIds:[]});
  f.journal.claim(op.operationId,{pid:process.pid});
  f.journal.attachReference(op.operationId,f.journal._row(op.operationId).lease,op.operationId);
  const result=await f.service.cancel(owner,{operationId:op.operationId,nonce:nonce()});
  assert.equal(result.state,'cancellation-requested');assert.equal(f.journal.get(owner,op.operationId).state,'cancellation-requested');
});

test('cancellation while opening a runtime prevents a later dispatch',async t=>{
  const f=fixture(t,'openclaw'),owner=f.binding.principal;
  const c=await f.service.open(owner,{nonce:nonce(),view:'chat'});
  const op=await f.service.submit(owner,{nonce:nonce(),conversationId:c.conversationId,prompt:'must not dispatch',contextIds:[]});
  f.runtime.open=async()=>{await f.service.cancel(owner,{operationId:op.operationId,nonce:nonce()});};
  const result=await f.service.run(op.operationId);
  assert.equal(result.state,'cancelled');assert.equal(f.calls.includes('submit'),false);
});

test('gateway progress excludes other runs, private reasoning and tool arguments',()=>{
  const requestId=randomUUID(),frame={type:'event',event:'agent',payload:{runId:requestId,seq:1,stream:'assistant',data:{text:'Public answer',reasoning:'private thought'}}};
  assert.equal(projectGatewayEvent(frame,requestId).output,'Public answer');
  assert.equal(projectGatewayEvent(frame,randomUUID()),null);
  assert.equal(projectGatewayEvent({...frame,payload:{...frame.payload,stream:'thinking'}},requestId),null);
  assert.equal(projectGatewayEvent({...frame,payload:{...frame.payload,seq:'1'}},requestId),null);
  const tool=projectGatewayEvent({...frame,payload:{...frame.payload,stream:'tool',data:{name:'read-only-tool',phase:'result',arguments:{secret:'hidden'},result:'private result'}}},requestId);
  assert.equal(tool.tool,'read-only-tool');assert.ok(!JSON.stringify(tool).includes('hidden'));assert.ok(!JSON.stringify(tool).includes('private'));
  const large=projectGatewayEvent({...frame,payload:{...frame.payload,data:{text:'x'.repeat(40000)}}},requestId);
  assert.equal(large.output.length,30000);assert.equal(large.truncated,true);
});

test('stream progress survives transport loss and reconnect without replaying inference',async t=>{
  const f=fixture(t,'openclaw'),owner=f.binding.principal;
  const c=await f.service.open(owner,{nonce:nonce(),view:'chat'});
  f.runtime.submit=async input=>{f.calls.push('submit');input.onProgress({runtime:'openclaw',source:'fixture public stream',sourceSequence:1,kind:'answer',output:'Partial answer',partial:true});throw Error('transport dropped');};
  const input={nonce:nonce(),conversationId:c.conversationId,prompt:'Inspect fixture',contextIds:[]},op=await f.service.submit(owner,input);
  assert.equal((await f.service.run(op.operationId)).state,'unknown');
  const persisted=f.journal.latestProgress(owner,op.operationId);assert.equal(persisted.output,'Partial answer');
  assert.ok(persisted.observedAt);assert.equal(persisted.partial,true);
  assert.equal((await f.service.submit(owner,input)).state,'unknown');assert.equal(f.calls.filter(c=>c==='submit').length,1);
  const other={...owner,surface:'assistant',principalId:'other',grantId:randomUUID()};
  assert.throws(()=>f.journal.latestProgress(other,op.operationId),{code:'DENIED'});
});

test('Hermes tool evidence is durable and does not change request completion semantics',async t=>{
  const f=fixture(t,'hermes'),owner=f.binding.principal,c=await f.service.open(owner,{nonce:nonce(),view:'chat'});
  f.runtime.progress=async()=>[{runtime:'hermes',source:'fixture tool ledger',sourceSequence:2,kind:'tool',tool:'subnet_calculator',state:'completed'}];
  const op=await f.service.submit(owner,{nonce:nonce(),conversationId:c.conversationId,prompt:'Inspect subnet',contextIds:[]});
  assert.equal((await f.service.run(op.operationId)).state,'succeeded');
  assert.equal(f.journal.latestProgress(owner,op.operationId).tool,'subnet_calculator');
});

test('conversation selection is restricted to configured models and declared effort; opening stays inference-free',async t=>{
  const f=fixture(t,'openclaw'),owner=f.binding.principal;
  fs.writeFileSync(f.f.configPath,JSON.stringify({models:{providers:{fixture:{models:[{id:'reasoning',reasoning:true},{id:'plain'}]}}}}));
  f.runtime.validateSelection=input=>validateConversationSelection(f.binding,input);
  const input={nonce:nonce(),view:'chat',model:'fixture/reasoning',effort:'low'};
  const c=await f.service.open(owner,input);assert.deepEqual(f.journal.record('conversation',c.conversationId,owner).selection,{model:input.model,effort:'low'});assert.equal(f.calls.length,0);
  await assert.rejects(f.service.open(owner,{nonce:nonce(),view:'chat',conversationId:c.conversationId,model:'fixture/plain'}),{code:'DENIED'});
  for(const selection of [{model:'external/unconfigured'},{model:'fixture/plain',effort:'low'},{model:input.model,effort:'max'},{effort:'high'}])await assert.rejects(f.service.open(owner,{nonce:nonce(),view:'chat',...selection}),{code:'UNQUALIFIED'});
  fs.writeFileSync(f.f.configPath,'{}');assert.equal((await f.service.open(owner,input)).conversationId,c.conversationId,'lost receipt is recovered before configuration revalidation');
  assert.throws(()=>validateConversationSelection({...f.binding,kind:'hermes'},input),{code:'UNQUALIFIED'});
});

test('missing audit prevents creation of a saved conversation and does not dispatch',async t=>{
  const f=fixture(t,'hermes'),owner=f.binding.principal;f.audit.available=false;
  const input={nonce:nonce(),view:'chat'};
  await assert.rejects(f.service.open(owner,input));assert.equal(f.journal.records('conversation',owner).length,0);
  await assert.rejects(f.service.open(owner,input),{code:'UNKNOWN_OUTCOME'});assert.equal(f.calls.length,0);
});

test('short streamed answers survive lifecycle coalescing and event floods remain bounded',async t=>{
  const f=fixture(t,'openclaw'),owner=f.binding.principal,c=await f.service.open(owner,{nonce:nonce(),view:'chat'});
  f.runtime.submit=async input=>{
    input.onProgress({kind:'lifecycle',state:'start',source:'fixture'});
    input.onProgress({kind:'answer',output:'Fast public answer',source:'fixture'});
    input.onProgress({kind:'lifecycle',state:'end',source:'fixture'});
    for(let i=0;i<1100;i++)input.onProgress({kind:'tool',tool:'fixture',state:'completed',source:'fixture'});
  };
  const op=await f.service.submit(owner,{nonce:nonce(),conversationId:c.conversationId,prompt:'x',contextIds:[]});
  assert.equal((await f.service.run(op.operationId)).state,'succeeded');
  assert.equal(f.journal.latestProgress(owner,op.operationId).output,'Fast public answer');
  assert.equal(f.journal.latestProgress(owner,op.operationId).eventLimitReached,true);
  assert.equal(f.journal.db.prepare("SELECT count(*) n FROM events WHERE operation=? AND type='runtime-progress'").get(op.operationId).n,1000);
});

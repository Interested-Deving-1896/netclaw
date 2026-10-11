import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce,auditFixture} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
function fixture(t,kind='openclaw'){
  const f=installationFixture(t,kind),audit=auditFixture(),service=new ManagementService({...f,root,audit}),calls=[],starts=[];t.after(()=>service.close());
  const view={format:1,installationId:f.installationId,harness:kind,peer:'as65002-2.2.2.2',available:true,profiles:[{mode:'tool'},{mode:'skill'}],revision:'a'.repeat(64),scope:'Synthetic existing channel'};
  let result={state:'succeeded',peer:view.peer,result:{response:{content:[{type:'text',text:'synthetic calculation'}]},trust:'remote-untrusted'}};
  service.peerExecution.start=async id=>starts.push(id);
  service.peerExecution.client.call=async(action,args)=>{calls.push({action,args});return action==='snapshot'?{...view}:{operationId:args.operationId,...result};};
  return {...f,service,audit,calls,starts,view,setResult:value=>{result=value;}};
}
async function review(f,mode='tool'){const selection={peer:f.view.peer,mode,cidr:'192.0.2.0/24'},value=(await f.service.call('operator_workspace',{action:'peer-execution-preview',args:selection})).data;return {value,input:{action:'peer-execution-submit',nonce:nonce(),args:{reviewId:value.reviewId}}};}
test('exact read-only review runs once on both selected harnesses and survives receipt lookup',async t=>{
  for(const kind of ['openclaw','hermes'])for(const mode of ['tool','skill']){
    const f=fixture(t,kind),{value,input}=await review(f,mode);assert.equal(value.selection.mode,mode);assert.equal(f.starts.length,0);
    const operation=await f.service.call('operator_workspace',input),done=await f.service.peerExecution.run(operation.operationId);assert.equal(done.state,'succeeded');
    assert.deepEqual(Object.keys(f.calls.find(row=>row.action==='start').args).sort(),['lease','operationId']);
    assert.equal((await f.service.call('operator_workspace',input)).operationId,operation.operationId);assert.equal(f.starts.length,1);
    const list=(await f.service.call('operator_workspace',{action:'peer-execution-list',args:{}})).data;assert.equal(list.operations.length,1);assert.equal(list.operations[0].result,undefined);
  }
});
test('arbitrary arguments, broad CIDRs, assistant authority, stale identity and stale review refuse',async t=>{
  const f=fixture(t),base={peer:f.view.peer,mode:'tool',cidr:'192.0.2.0/24'};
  for(const cidr of ['0.0.0.0/0','192.0.2.0/31','::/24','999.0.2.0/24','192.0.2.0/24;exec','192.0.2.0/24/25'])await assert.rejects(f.service.call('operator_workspace',{action:'peer-execution-preview',args:{...base,cidr}}),{code:'INVALID_INPUT'});
  await assert.rejects(f.service.call('operator_workspace',{action:'peer-execution-preview',args:{...base,tool:'shell'}}),{code:'INVALID_INPUT'});
  const {value,input}=await review(f);await assert.rejects(f.service.peerExecution.submit({...f.service.binding.principal,surface:'assistant'},input),{code:'DENIED'});
  await assert.rejects(f.service.call('operator_workspace',{...input,args:{...input.args,cidr:'198.51.100.0/24'}}),{code:'INVALID_INPUT'});
  f.view.revision='b'.repeat(64);await assert.rejects(f.service.call('operator_workspace',input),{code:'STALE_REVISION'});
  f.view.revision=value.revision;f.service.journal.put('peer-execution-review',value.reviewId,f.service.binding.principal,{...value,expiresAt:0},{replace:true});
  await assert.rejects(f.service.call('operator_workspace',input),{code:'EXPIRED'});assert.equal(f.starts.length,0);
});
test('uncertain admission blocks another peer request beyond recent-list bounds and only reconciles status',async t=>{
  const f=fixture(t),{input}=await review(f),operation=await f.service.call('operator_workspace',input),call=f.service.peerExecution.client.call;
  f.service.peerExecution.client.call=async(action,args)=>{if(action==='start'){f.calls.push({action,args});throw Error('Lost receipt');}return call(action,args);};
  assert.equal((await f.service.peerExecution.run(operation.operationId)).state,'unknown');
  for(let i=0;i<110;i++)f.service.journal.admit(f.service.binding.principal,nonce(),'unrelated',{});
  const next=await review(f);await assert.rejects(f.service.call('operator_workspace',next.input),{code:'BUSY'});
  assert.equal((await f.service.call('operator_operation_get',{operationId:operation.operationId})).state,'succeeded');assert.equal(f.calls.filter(row=>row.action==='start').length,1);
});
test('audit failure and pre-dispatch cancellation send nothing; wrong-peer receipts remain unknown',async t=>{
  const f=fixture(t),one=await review(f);f.audit.available=false;await assert.rejects(f.service.call('operator_workspace',one.input));assert.equal(f.starts.length,0);f.audit.available=true;
  const two=await review(f),op=await f.service.call('operator_workspace',two.input);await f.service.call('operator_cancel_request',{operationId:op.operationId,nonce:nonce()});assert.equal(await f.service.peerExecution.run(op.operationId),undefined);
  assert.equal(f.calls.filter(row=>row.action==='start').length,0);
  const three=await review(f),next=await f.service.call('operator_workspace',three.input);f.setResult({state:'succeeded',peer:'wrong',result:{}});assert.equal((await f.service.peerExecution.run(next.operationId)).state,'unknown');
});
test('recipient denial and error outcomes remain failed; large Unicode receipts are visibly bounded',async t=>{
  for(const state of ['denied','failed','succeeded']){
    const f=fixture(t),{input}=await review(f),operation=await f.service.call('operator_workspace',input);
    f.setResult({state,peer:f.view.peer,result:{responseText:'🦞\u0000'.repeat(30000)}});
    const result=await f.service.peerExecution.run(operation.operationId);assert.equal(result.state,state==='denied'?'failed':state);
    assert.ok(Buffer.byteLength(JSON.stringify(result.result))<=60000);assert.equal(result.result.result.truncated,true);assert.ok(!result.result.result.responseText.includes('\ufffd'));
  }
});

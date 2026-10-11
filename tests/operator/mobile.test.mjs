import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {installationFixture,auditFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

function fixture(t,kind='openclaw'){
  const f=installationFixture(t,kind),audit=auditFixture(),service=new ManagementService({...f,root:path.resolve('.'),audit});t.after(()=>service.close());
  const calls=[],started=[],content=Buffer.from('synthetic media'),sha256=createHash('sha256').update(content).digest('hex');
  const row={id:'risk/phone',label:'Fixture phone',enrolled:true,connected:true,capabilities:['camera.capture'],enrollmentRevision:'a'.repeat(64)};
  let result={state:'succeeded',decision:'captured',media:{sha256,bytes:content.length,contentType:'image'}};
  service.mobile.start=async id=>started.push(id);
  service.mobile.client.call=async(action,args)=>{calls.push({action,args});if(action==='inventory')return {installationId:f.installationId,harness:kind,captureSupported:kind==='openclaw',items:[row]};if(action==='content')return {content:content.toString('base64'),offset:0,nextOffset:null,sha256,bytes:content.length,contentType:'image'};return {operationId:args.operationId,...result};};
  return {...f,service,audit,calls,started,row,content,setResult:value=>{result=value;}};
}
async function request(f){const preview=await f.service.call('operator_workspace',{action:'mobile-capture-preview',args:{id:'risk/phone',capability:'camera.capture'}});return {action:'mobile-capture-request',nonce:nonce(),args:{id:'risk/phone',capability:'camera.capture',consentReference:preview.data.consentReference}};}
test('capture review and admission retain exact device/capability; worker and content remain owned and non-replaying',async t=>{
  const f=fixture(t),input=await request(f);assert.equal(f.calls.some(row=>row.action==='start'),false);
  const op=await f.service.call('operator_workspace',input);assert.equal(f.started.length,1);
  const result=await f.service.mobile.run(op.operationId);assert.equal(result.state,'succeeded');assert.equal(result.result.decision,'captured');
  assert.equal((await f.service.call('operator_workspace',input)).operationId,op.operationId);assert.equal(f.calls.filter(row=>row.action==='start').length,1);
  assert.equal(f.calls.find(row=>row.action==='start').args.operationId,op.operationId);assert.ok(f.calls.find(row=>row.action==='start').args.lease);
  const captured=await f.service.call('operator_workspace',{action:'mobile-capture-content',args:{id:op.operationId,offset:0}});assert.equal(Buffer.from(captured.data.content,'base64').toString(),f.content.toString());
  await assert.rejects(f.service.mobile.content({...f.service.binding.principal,surface:'assistant'},{id:op.operationId}),{code:'DENIED'});
});
test('Hermes, disconnected device, unadvertised capability and changed review cannot dispatch',async t=>{
  const hermes=fixture(t,'hermes');await assert.rejects(request(hermes),{code:'UNSUPPORTED'});
  const f=fixture(t);f.row.connected=false;await assert.rejects(request(f),{code:'UNQUALIFIED'});f.row.connected=true;
  await assert.rejects(f.service.call('operator_workspace',{action:'mobile-capture-preview',args:{id:'risk/phone',capability:'audio.record'}}),{code:'UNQUALIFIED'});
  const input=await request(f);await assert.rejects(f.service.call('operator_workspace',{...input,args:{...input.args,id:'another-phone'}}),{code:'DENIED'});
  f.audit.available=false;await assert.rejects(f.service.call('operator_workspace',input));assert.equal(f.started.length,0);
});
test('decline stays explicit and cancellation before dispatch sends no capture request',async t=>{
  const f=fixture(t),input=await request(f),op=await f.service.call('operator_workspace',input);
  f.setResult({state:'denied',decision:'declined',reason:'permission_denied'});const result=await f.service.mobile.run(op.operationId);
  assert.equal(result.state,'failed');assert.equal(result.result.decision,'declined');
  await assert.rejects(f.service.call('operator_workspace',{action:'mobile-capture-content',args:{id:op.operationId}}),{code:'DENIED'});
  const next=await f.service.call('operator_workspace',await request(f));await f.service.call('operator_cancel_request',{operationId:next.operationId,nonce:nonce()});
  assert.equal(await f.service.mobile.run(next.operationId),undefined);assert.equal(f.calls.filter(row=>row.action==='start').length,1);
});
test('lost capture receipt is reconciled by operation ID; it is never resubmitted',async t=>{
  const f=fixture(t),input=await request(f),op=await f.service.call('operator_workspace',input),call=f.service.mobile.client.call;
  f.service.mobile.client.call=async(action,args)=>{if(action==='start'){f.calls.push({action,args});throw Error('lost receipt');}return call(action,args);};
  assert.equal((await f.service.mobile.run(op.operationId)).state,'unknown');
  assert.equal((await f.service.call('operator_operation_get',{operationId:op.operationId})).state,'succeeded');assert.equal(f.calls.filter(row=>row.action==='start').length,1);
});

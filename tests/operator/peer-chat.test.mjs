import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce,auditFixture} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
function fixture(t,kind='openclaw'){
  const f=installationFixture(t,kind),audit=auditFixture(),service=new ManagementService({...f,root,audit}),calls=[],starts=[];t.after(()=>service.close());
  const view={format:1,installationId:f.installationId,harness:kind,peer:'as65002-2.2.2.2',available:true,revision:'a'.repeat(64),scope:'Synthetic existing authenticated channel'};
  let result={state:'succeeded',result:{text:'remote fixture answer',trust:'remote-untrusted'}};
  service.peerConversations.start=async id=>starts.push(id);
  service.peerConversations.client.call=async(action,args)=>{calls.push({action,args});return action==='snapshot'?{...view}:{operationId:args.operationId,...result};};
  return {...f,service,audit,calls,starts,view,setResult:value=>{result=value;}};
}
async function reviewed(f,conversationId){const args={peer:f.view.peer,text:'Explicit synthetic question',...(conversationId?{conversationId}:{})};const review=await f.service.call('operator_workspace',{action:'peer-chat-preview',args});return {review:review.data,input:{action:'peer-chat-submit',nonce:nonce(),args:{peer:args.peer,text:args.text,reviewId:review.data.reviewId}}};}
test('operator peer chat binds the reviewed content/destination and keeps reconnect receipts without replay',async t=>{
  for(const kind of ['openclaw','hermes']){
    const f=fixture(t,kind),{review,input}=await reviewed(f);assert.ok(review.disclosure);assert.ok(!f.calls.some(row=>row.action==='start'));
    const op=await f.service.call('operator_workspace',input);assert.equal(f.starts.length,1);
    const result=await f.service.peerConversations.run(op.operationId);assert.equal(result.state,'succeeded');assert.equal(result.result.result.text,'remote fixture answer');
    const dispatched=f.calls.find(row=>row.action==='start');assert.deepEqual(Object.keys(dispatched.args).sort(),['lease','operationId']);
    assert.equal((await f.service.call('operator_workspace',input)).operationId,op.operationId);assert.equal(f.calls.filter(row=>row.action==='start').length,1);
    const next=await reviewed(f,review.conversationId);assert.equal(next.review.conversationId,review.conversationId);
    const list=await f.service.call('operator_workspace',{action:'peer-chat-list',args:{}});assert.equal(list.data.conversations.length,1);assert.equal(list.data.operations.length,1);
    const history=await f.service.call('operator_workspace',{action:'peer-chat-read',args:{id:review.conversationId}});assert.equal(history.data.messages.length,1);assert.equal(history.data.messages[0].text,input.args.text);assert.equal(history.data.messages[0].operation.operationId,op.operationId);
  }
});
test('retained peer history pages independently of unrelated operations and never contacts the peer',async t=>{
  const f=fixture(t),{review,input}=await reviewed(f),principal=f.service.binding.principal;
  f.service.journal.put('peer-conversation',review.conversationId,principal,{installationId:f.installationId,peer:f.view.peer});
  const ids=[];for(let i=0;i<25;i++)ids.push(f.service.journal.admit(principal,nonce(),'peer-chat',{...input,nonce:nonce()}).operationId);
  for(let i=0;i<110;i++)f.service.journal.admit(principal,nonce(),'unrelated',{});
  f.calls.length=0;
  const read=cursor=>f.service.call('operator_workspace',{action:'peer-chat-read',args:{id:review.conversationId},limit:500,...(cursor?{cursor}:{})});
  const first=(await read()).data,next=(await read(first.nextCursor)).data;
  assert.equal(first.messages.length,20);assert.equal(next.messages.length,5);assert.equal(next.nextCursor,undefined);
  assert.deepEqual([...first.messages,...next.messages].map(row=>row.operation.operationId),ids.reverse());assert.equal(f.calls.length,0);
  await assert.rejects(read('not-a-cursor'),{code:'INVALID_INPUT'});
});
test('large peer answers page before the aggregate response bound instead of hiding history',async t=>{
  const f=fixture(t),{review,input}=await reviewed(f),principal=f.service.binding.principal;
  f.service.journal.put('peer-conversation',review.conversationId,principal,{installationId:f.installationId,peer:f.view.peer});
  for(let i=0;i<20;i++){
    const operation=f.service.journal.admit(principal,nonce(),'peer-chat',input),lease=f.service.journal.claim(operation.operationId,{pid:process.pid});
    f.service.journal.finish(operation.operationId,lease,'succeeded',{result:{text:'x'.repeat(60000)}});
  }
  const page=await f.service.call('operator_workspace',{action:'peer-chat-read',args:{id:review.conversationId}});
  assert.ok(page.data.messages.length>0&&page.data.messages.length<20);assert.ok(page.data.nextCursor);assert.ok(Buffer.byteLength(JSON.stringify(page))<1024*1024);
});
test('large Unicode and JSON-escaped responses finish with visible bounded truncation',async t=>{
  for(const text of ['\u0000'.repeat(65536),'🦞'.repeat(32768)]){
    const f=fixture(t),{input}=await reviewed(f),operation=await f.service.call('operator_workspace',input);f.setResult({state:'succeeded',result:{text,trust:'remote-untrusted'}});
    const result=await f.service.peerConversations.run(operation.operationId);
    assert.equal(result.state,'succeeded');assert.equal(result.result.result.truncated,true);assert.ok(Buffer.byteLength(JSON.stringify(result.result))<=60000);assert.ok(result.result.result.text.length<text.length);
    assert.ok(!result.result.result.text.includes('\ufffd'));
  }
});
test('peer/content substitution, expired review, lost channel and assistant origin refuse before dispatch',async t=>{
  const f=fixture(t),{input}=await reviewed(f),p=f.service.binding.principal;
  for(const args of [{...input.args,peer:'other'},{...input.args,text:'Changed message'}])await assert.rejects(f.service.call('operator_workspace',{...input,args}),{code:'DENIED'});
  await assert.rejects(f.service.peerConversations.submit({...p,surface:'assistant'},input),{code:'DENIED'});
  f.view.revision='b'.repeat(64);await assert.rejects(f.service.call('operator_workspace',input),{code:'STALE_REVISION'});
  f.view.available=false;await assert.rejects(reviewed(f),{code:'UNQUALIFIED'});f.view.available=true;
  const fresh=await reviewed(f),saved=f.service.journal.record('peer-chat-review',fresh.review.reviewId,p);f.service.journal.put('peer-chat-review',fresh.review.reviewId,p,{...saved,expiresAt:0},{replace:true});
  await assert.rejects(f.service.call('operator_workspace',fresh.input),{code:'EXPIRED'});assert.equal(f.starts.length,0);
});
test('lost peer-chat admission response reconciles only owned status and blocks concurrent uncertain follow-up',async t=>{
  const f=fixture(t),{review,input}=await reviewed(f),op=await f.service.call('operator_workspace',input),call=f.service.peerConversations.client.call;
  f.service.peerConversations.client.call=async(action,args)=>{if(action==='start'){f.calls.push({action,args});throw Error('synthetic lost receipt');}return call(action,args);};
  assert.equal((await f.service.peerConversations.run(op.operationId)).state,'unknown');
  const follow=await reviewed(f,review.conversationId);await assert.rejects(f.service.call('operator_workspace',follow.input),{code:'BUSY'});
  assert.equal((await f.service.call('operator_operation_get',{operationId:op.operationId})).state,'succeeded');assert.equal(f.calls.filter(row=>row.action==='start').length,1);
  await assert.rejects(f.service.peerConversations.preview(f.service.binding.principal,{peer:'another',text:'question',conversationId:review.conversationId}),{code:'DENIED'});
});
test('audit loss and cancellation before dispatch produce no peer message; explicit recipient denial stays failed',async t=>{
  const f=fixture(t),first=await reviewed(f);f.audit.available=false;await assert.rejects(f.service.call('operator_workspace',first.input));assert.equal(f.starts.length,0);f.audit.available=true;
  const second=await reviewed(f),op=await f.service.call('operator_workspace',second.input);await f.service.call('operator_cancel_request',{operationId:op.operationId,nonce:nonce()});assert.equal(await f.service.peerConversations.run(op.operationId),undefined);assert.equal(f.calls.filter(row=>row.action==='start').length,0);
  const third=await reviewed(f),next=await f.service.call('operator_workspace',third.input);f.setResult({state:'denied',result:{decision:'denied',reason:'Recipient denied'}});
  const result=await f.service.peerConversations.run(next.operationId);assert.equal(result.state,'failed');assert.equal(result.result.state,'denied');
});

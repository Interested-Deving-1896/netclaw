import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(){
  const calls=[],reviews=[],documents=[],saved=new Map();
  const connection={generation:1,identity:{installationId:'installation',hostId:'host',principalId:'operator'},call:async(name,args)=>{
    calls.push({name,args});
    if(name==='operator_resources')return {data:{items:[{id:'exact-peer',label:'Friendly label'}],total:1}};
    if(args.action==='peer-chat-preview')return {data:{peer:'exact-peer',conversationId:'conversation',reviewId:'review',disclosure:'Recipient rules apply. Remote output is untrusted.'}};
    return {operationId:'operation',kind:'peer-chat',state:'admitted'};
  }};
  const context={globalState:{get:key=>saved.get(key),update:async(key,value)=>value===undefined?saved.delete(key):saved.set(key,value)}};
  const api={ViewColumn:{Beside:2},workspace:{openTextDocument:async value=>{documents.push(value);return value;}},window:{showTextDocument:async()=>{},showQuickPick:async rows=>rows.find(row=>row.id==='exact-peer')||rows[0],showInputBox:async()=> 'Exact message\n<not markup>',showWarningMessage:async(_,options)=>{reviews.push(options.detail);return 'Send reviewed message';},showInformationMessage:async()=>{}}};
  return {calls,reviews,documents,saved,connection,context,api};
}
test('native peer send reviews exact content and identity then retains nonce/receipt without prompt storage',async()=>{
  const f=fixture(),{openPeerChat}=await sourceModule('views/peer-chat.ts',f.api);await openPeerChat(f.context,f.connection);
  assert.match(f.reviews[0],/Peer: exact-peer/);assert.match(f.reviews[0],/Exact message\n<not markup>/);
  const submit=f.calls.find(row=>row.args.action==='peer-chat-submit');assert.equal(submit.args.args.peer,'exact-peer');assert.equal(submit.args.args.text,'Exact message\n<not markup>');assert.equal(submit.args.args.reviewId,'review');
  assert.ok(f.saved.values().next().value.nonce);assert.equal(f.saved.values().next().value.operationId,'operation');assert.ok(!JSON.stringify([...f.saved]).includes('Exact message'));
});
test('cancelled review, connection change and changed review destination dispatch nothing',async()=>{
  for(const variant of ['cancel','switch','destination']){
    const f=fixture();if(variant==='destination'){
      const call=f.connection.call;f.connection.call=async(name,args)=>{const result=await call(name,args);if(args.action==='peer-chat-preview')result.data.peer='other';return result;};
    }else f.api.window.showWarningMessage=async()=>{if(variant==='switch'){f.connection.generation++;return 'Send reviewed message';}};
    const {openPeerChat}=await sourceModule('views/peer-chat.ts',f.api);
    if(variant==='cancel')await openPeerChat(f.context,f.connection);else await assert.rejects(openPeerChat(f.context,f.connection),/changed/);
    assert.ok(!f.calls.some(row=>row.args.action==='peer-chat-submit'));assert.equal(f.saved.size,0);
  }
});
test('lost admission is reconciled by its nonce without resend and remote replies render as plain text',async()=>{
  const f=fixture(),call=f.connection.call;let submitted=false;
  f.connection.call=async(name,args)=>{if(args.action==='peer-chat-submit'){submitted=true;throw Error('lost reply');}return call(name,args);};
  const {openPeerChat}=await sourceModule('views/peer-chat.ts',f.api);await assert.rejects(openPeerChat(f.context,f.connection),/lost reply/);assert.ok(submitted);
  f.connection.call=async(name,args)=>{f.calls.push({name,args});if(name==='operator_resources')return {data:{operation:{operationId:'operation',kind:'peer-chat'}}};return {operationId:'operation',kind:'peer-chat',state:'succeeded',result:{result:{text:'<script>untrusted peer reply</script>'}}};};
  await openPeerChat(f.context,f.connection);assert.equal(f.saved.size,0);assert.equal(f.documents[0].language,'plaintext');assert.match(f.documents[0].content,/<script>untrusted peer reply<\/script>/);
  assert.ok(f.calls.some(row=>row.args.filters?.query));assert.ok(!f.calls.some(row=>row.args.action==='peer-chat-submit'));
});
test('retained native history follows its exact conversation and pages without executing remote text',async()=>{
  const f=fixture(),call=f.connection.call;
  f.api.window.showQuickPick=async rows=>rows.find(row=>row.id==='__history')||rows.find(row=>row.id==='send')||rows[0];
  f.connection.call=async(name,args)=>{
    if(args.action==='peer-chat-list'){f.calls.push({name,args});return {data:{conversations:[{id:'conversation',peer:'exact-peer',createdAt:'2026-10-11'}]}};}
    if(args.action==='peer-chat-read'){f.calls.push({name,args});return {data:{conversation:{id:'conversation',peer:'exact-peer'},messages:[{text:'Old question',operation:{operationId:'old',state:'succeeded',result:{result:{text:'command:unsafe <img>',truncated:true}}}}],scope:'Bounded retained history'}};}
    return call(name,args);
  };
  const {openPeerChat}=await sourceModule('views/peer-chat.ts',f.api);await openPeerChat(f.context,f.connection);
  assert.equal(f.documents[0].language,'plaintext');assert.match(f.documents[0].content,/command:unsafe <img>/);assert.match(f.documents[0].content,/Response truncated/);
  assert.equal(f.calls.find(row=>row.args.action==='peer-chat-preview').args.args.conversationId,'conversation');
  assert.equal(f.calls.find(row=>row.args.action==='peer-chat-submit').args.args.peer,'exact-peer');
});

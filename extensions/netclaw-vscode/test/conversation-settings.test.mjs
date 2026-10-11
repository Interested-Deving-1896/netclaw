import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';

test('conversation model review only reads settings and cancellation creates no backend work',async()=>{
  const calls=[],connection={generation:1,call:async(name)=>{calls.push(name);return {data:{conversation:{models:[{id:'fixture/reasoning',efforts:['low','medium','high']}]}}};}};
  let choice=0;
  const {chooseConversationSettings}=await sourceModule('views/conversation-settings.ts',{window:{showQuickPick:async items=>choice++===0?items[1]:'low'}});
  const result=await chooseConversationSettings(connection);assert.equal(result.model,'fixture/reasoning');assert.equal(result.effort,'low');assert.deepEqual(calls,['operator_snapshot']);
  const cancelled=await sourceModule('views/conversation-settings.ts',{window:{showQuickPick:async()=>undefined}});
  assert.equal(await cancelled.chooseConversationSettings(connection),undefined);assert.ok(calls.every(name=>name==='operator_snapshot'));
});

test('switching installation during native model selection invalidates the review',async()=>{
  const connection={generation:1,call:async()=>({data:{conversation:{models:[]}}})};
  const {chooseConversationSettings}=await sourceModule('views/conversation-settings.ts',{window:{showQuickPick:async items=>{connection.generation++;return items[0];}}});
  await assert.rejects(chooseConversationSettings(connection),/Connection changed/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseOperatorInput} from '../../mcp-servers/netclaw-operator-mcp/schemas.mjs';
import {parseAssistantInput} from '../../mcp-servers/netclaw-assistant-mcp/schemas.mjs';
import {nonce} from './fixtures.mjs';

test('managed changes accept only the fields of the selected action on both interfaces',()=>{
  const base={nonce:nonce(),targets:['installation'],expectedRevision:randomUUID()};
  for(const parse of [v=>parseOperatorInput('operator_change_prepare',v),v=>parseAssistantInput('netclaw_propose_change',v)]){
    assert.doesNotThrow(()=>parse({...base,action:'integration.configure',patch:{fields:[{key:'ANTHROPIC_API_KEY',intent:'keep'}]}}));
    for(const [action,patch] of [
      ['service.stop',{serviceId:'gateway',provider:'unrelated'}],
      ['integration.configure',{fields:[{key:'ANTHROPIC_API_KEY',intent:'keep'}],role:'border'}],
      ['runtime.select',{}],['settings.patch',{}],
      ['risk.role',{role:'border',runtimeId:'hermes'}],
      ['budget.patch',{dailyLimit:1,enabled:true}],
    ])assert.throws(()=>parse({...base,action,patch}),{code:'INVALID_INPUT'});
  }
});

test('workspace arguments and nonce requirements are specific to each action',()=>{
  const parse=v=>parseOperatorInput('operator_workspace',v);
  assert.doesNotThrow(()=>parse({action:'rag-search',args:{query:'selected document',k:3}}));
  assert.doesNotThrow(()=>parse({action:'rag-list',args:{}}));
  assert.doesNotThrow(()=>parse({action:'rag-context',nonce:nonce(),args:{id:'search',indices:[0]}}));
  for(const input of [
    {action:'rag-search',args:{}},
    {action:'rag-search',args:{query:'   '}},
    {action:'rag-search',args:{query:'x'.repeat(4001)}},
    {action:'rag-list',args:{content:'unrelated'}},
    {action:'rag-upload',args:{name:'a.md',content:'YQ=='}},
    {action:'rag-index',nonce:nonce(),args:{id:'upload',query:'unrelated'}},
    {action:'rag-context',nonce:nonce(),args:{id:'search',indices:[0,0]}},
    {action:'mobile-capture-request',nonce:nonce(),args:{id:'edge',capability:'camera.capture'}},
  ])assert.throws(()=>parse(input),{code:'INVALID_INPUT'});
});

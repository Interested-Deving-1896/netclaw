import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateOperatorOutput,validateAssistantOutput} from '../../mcp-servers/netclaw-operator-mcp/responses.mjs';
import {bounded,redactor} from '../../ui/netclaw-visual/src/management/evidence.js';

const envelope=data=>({contractVersion:1,installationId:randomUUID(),source:'Observed fixture',observedAt:new Date().toISOString(),data,freshness:'observed',warnings:[]});
test('responses enforce versioned read envelopes and fixed admission shapes',()=>{
  const value=envelope({items:[],total:0});
  assert.deepEqual(validateOperatorOutput('operator_resources',{},value),value);
  for(const invalid of [{...value,contractVersion:2},{...value,source:undefined},{...value,approved:true},{...value,observedAt:'yesterday'}])
    assert.throws(()=>validateOperatorOutput('operator_resources',{},invalid),{code:'SOURCE_UNAVAILABLE'});
  const operation={operationId:randomUUID(),kind:'conversation-request',state:'admitted',sequence:1,admittedAt:new Date().toISOString()};
  assert.deepEqual(validateOperatorOutput('operator_request_submit',{},operation),operation);
  assert.throws(()=>validateOperatorOutput('operator_request_submit',{}, {...operation,state:'success-ish'}),{code:'SOURCE_UNAVAILABLE'});
  assert.throws(()=>validateOperatorOutput('operator_request_submit',{}, {...operation,sequence:-1}),{code:'SOURCE_UNAVAILABLE'});
});
test('output boundary rejects unknown methods, oversized and non-JSON adapter results',()=>{
  assert.throws(()=>validateAssistantOutput('operator_identity',{},{}),{code:'DENIED'});
  for(const data of [{value:NaN},{value:()=>{}},{value:1n},{value:undefined},JSON.parse('{"__proto__":{"injected":true}}')])
    assert.throws(()=>validateOperatorOutput('operator_snapshot',{},envelope(data)),{code:'SOURCE_UNAVAILABLE'});
  assert.throws(()=>validateOperatorOutput('operator_snapshot',{},envelope({value:'x'.repeat(1024*1024)})),{code:'SOURCE_UNAVAILABLE'});
});
test('bounded responses retain identity and operation receipts while making truncation explicit',()=>{
  const value=envelope({items:Array.from({length:500},()=>({text:'x'.repeat(4000)})),total:500,nextCursor:'500'});
  const limited=bounded(value);
  assert.equal(limited.installationId,value.installationId);assert.equal(limited.contractVersion,1);
  assert.equal(limited.data.truncated,true);assert.ok(Buffer.byteLength(JSON.stringify(limited))<=1024*1024);
  assert.doesNotThrow(()=>validateOperatorOutput('operator_resources',{},limited));
  const op={operationId:randomUUID(),kind:'conversation-request',state:'succeeded',sequence:3,admittedAt:new Date().toISOString(),result:{output:'x'.repeat(1024*1024)}};
  const receipt=bounded(op);assert.equal(receipt.operationId,op.operationId);assert.equal(receipt.state,'succeeded');assert.equal(receipt.result.truncated,true);
});
test('redaction reports content loss instead of presenting a silently incomplete source',()=>{
  const projected=redactor(['synthetic-private-value'])({text:'x'.repeat(65537),rows:Array(501).fill('synthetic-private-value')});
  assert.equal(projected.truncation.strings,1);assert.equal(projected.truncation.arrays,1);
  assert.ok(!JSON.stringify(projected).includes('synthetic-private-value'));
});

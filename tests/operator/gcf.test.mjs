import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture,auditFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

test('GCF measures only an explicitly selected owned context; estimates stay separate from provider usage',async t=>{
  const f=installationFixture(t),service=new ManagementService({...f,root:path.resolve('.'),audit:auditFixture()});t.after(()=>service.close());
  fs.appendFileSync(path.join(f.home,'.env'),'\nNETCLAW_GCF_MODE=off\n');
  const content=JSON.stringify([{name:'r1',state:'up'},{name:'r2',state:'up'}]);
  const staged=await service.call('operator_workspace',{action:'rag-stage',nonce:nonce(),args:{name:'Selected data',content}});
  const listing=await service.call('operator_workspace',{action:'gcf-read',args:{}});assert.equal(listing.data.contexts.length,1);
  const result=await service.call('operator_workspace',{action:'gcf-read',args:{id:staged.contextId}});
  assert.equal(result.data.measurement.selectedCharacters,content.length);assert.equal(result.data.measurement.selectedUtf8Bytes,Buffer.byteLength(content));assert.equal(result.data.estimates.savings_tokens,0);assert.equal(result.data.providerUsage,null);assert.equal(result.data.fallbackUsed,true);assert.equal(result.data.profile,'json');assert.match(result.data.estimateMethod,/not a model tokenizer/);
  await assert.rejects(service.call('operator_workspace',{action:'gcf-read',args:{id:'not-owned'}}),{code:'DENIED'});
  assert.equal(JSON.stringify(result).includes('"state":"up"'),false);
});

test('GCF context pages stay bounded and do not duplicate contexts when new selections arrive',async t=>{
  const f=installationFixture(t),service=new ManagementService({...f,root:path.resolve('.'),audit:auditFixture()});t.after(()=>service.close());
  const principal=service.binding.principal;
  for(let i=0;i<5;i++)service.journal.put('context',`context-${i}`,principal,{name:'Context',size:1});
  const first=await service.call('operator_workspace',{action:'gcf-read',args:{},limit:2});assert.equal(first.data.contexts.length,2);
  service.journal.put('context','new',principal,{name:'New',size:1});
  const second=await service.call('operator_workspace',{action:'gcf-read',args:{},limit:2,cursor:first.data.nextCursor});
  assert.equal(second.data.contexts.length,2);assert.equal(new Set([...first.data.contexts,...second.data.contexts].map(row=>row.id)).size,4);
});

test('actual pinned GCF serializer compresses explicitly selected text without session state or billed usage',{skip:!process.env.NETCLAW_TEST_GCF_PY},async t=>{
  const f=installationFixture(t),service=new ManagementService({...f,root:path.resolve('.'),audit:auditFixture()});t.after(()=>service.close());
  fs.appendFileSync(path.join(f.home,'.env'),`\nNETCLAW_PY=${process.env.NETCLAW_TEST_GCF_PY}\nNETCLAW_GCF_MODE=full\n`);
  const content=JSON.stringify({interfaces:Array.from({length:20},(_,i)=>({ifname:`eth${i}`,state:'up',mtu:9000}))});
  const staged=await service.call('operator_workspace',{action:'rag-stage',nonce:nonce(),args:{name:'Selected interfaces',content}});
  const first=(await service.call('operator_workspace',{action:'gcf-read',args:{id:staged.contextId}})).data;
  const second=(await service.call('operator_workspace',{action:'gcf-read',args:{id:staged.contextId}})).data;
  assert.equal(first.fallbackUsed,false);assert.equal(first.profile,'generic');assert.ok(first.estimates.savings_tokens>0);assert.equal(first.providerUsage,null);assert.deepEqual(first.measurement,second.measurement);assert.equal(first.analysisSettings.session,false);assert.equal(first.analysisSettings.delta,false);
});

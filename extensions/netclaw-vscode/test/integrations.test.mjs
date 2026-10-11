import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';

test('native inventory pages through 1000 distinct resources and preserves source context',async()=>{
  const rows=Array.from({length:1000},(_,i)=>({id:`integration-${i}`,source:'synthetic catalog',registered:false,reachable:null})),calls=[];
  const connection={generation:1,call:async(name,args)=>{calls.push({name,args});const offset=Number(args.cursor||0);return {data:{items:rows.slice(offset,offset+250),total:rows.length,...(offset+250<rows.length?{nextCursor:String(offset+250)}:{})},source:'configured inventory',observedAt:'2026-10-10T12:00:00Z',warnings:[]};}};
  const {readResourcePages}=await sourceModule('views/integrations.ts',{}),result=await readResourcePages(connection,'integration');
  assert.equal(result.items.length,1000);assert.equal(calls.length,4);assert.equal(result.partial,false);assert.equal(result.source,'configured inventory');
  assert.equal(result.items[0].reachable,null);assert.ok(calls.every(call=>call.name==='operator_resources'));
});

test('inventory paging refuses duplicate identities and cannot loop on empty pages',async()=>{
  const {readResourcePages}=await sourceModule('views/integrations.ts',{});
  let calls=0;
  const repeated={generation:1,call:async()=>({data:{items:[{id:'same'}],total:3,nextCursor:String(++calls)},source:'test',warnings:[]})};
  await assert.rejects(readResourcePages(repeated,'skill'),/Inventory changed/);assert.equal(calls,2);
  calls=0;const empty={generation:1,call:async()=>({data:{items:[],total:100,nextCursor:String(++calls)},source:'test',warnings:[]})};
  assert.equal((await readResourcePages(empty,'skill')).partial,true);assert.equal(calls,8);
});

for(const intent of ['replace','clear','keep'])test(`secret ${intent} records only reviewed intent and never prompts for a value during preparation`,async()=>{
  const calls=[],commands=[];
  const connection={generation:1,identity:{installationId:'installation'},call:async(name,args)=>{calls.push({name,args});return name==='operator_snapshot'?{data:{revision:'revision',environment:{managedFields:[{key:'ANTHROPIC_API_KEY',secret:true},{key:'OTHER',secret:false}]}}}:{proposalId:'proposal'};}};
  const api={window:{showQuickPick:async items=>typeof items[0]==='string'?intent:items[0],showInputBox:async()=>{throw Error('A secret value must not be requested in preparation');},showInformationMessage:async()=>{}},commands:{executeCommand:async(...args)=>commands.push(args)}};
  const {prepareEnvironmentChange}=await sourceModule('views/configuration.ts',api);await prepareEnvironmentChange(connection,['ANTHROPIC_API_KEY']);
  if(intent==='keep'){assert.equal(calls.length,1);assert.equal(commands.length,0);}
  else{assert.equal(calls[1].name,'operator_change_prepare');assert.equal(calls[1].args.patch.fields[0].key,'ANTHROPIC_API_KEY');assert.equal(calls[1].args.patch.fields[0].intent,intent);assert.equal(Object.hasOwn(calls[1].args.patch.fields[0],'value'),false);assert.equal(commands[0][0],'netclaw.reviewProposal');}
});

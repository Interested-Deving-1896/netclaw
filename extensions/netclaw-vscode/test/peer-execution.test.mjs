import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(){
  const calls=[],reviews=[],documents=[],saved=new Map();
  const connection={generation:1,identity:{installationId:'installation',hostId:'host',principalId:'operator'},call:async(name,args)=>{
    calls.push({name,args});if(name==='operator_resources')return {data:{items:[{id:'exact-peer',label:'Friendly peer'}],total:1}};
    if(args.action==='peer-execution-snapshot')return {data:{peer:'exact-peer',profiles:[{mode:'tool',target:'subnet-calc-mcp/subnet_calculator'}]}};
    if(args.action==='peer-execution-preview')return {data:{installationId:'installation',selection:{peer:'exact-peer',mode:'tool',cidr:'192.0.2.0/24'},reviewId:'review',scope:'Read-only',disclosure:'Peer may refuse'}};
    return {operationId:'operation',kind:'peer-execution',state:'admitted'};
  }};
  const context={globalState:{get:key=>saved.get(key),update:async(key,value)=>value===undefined?saved.delete(key):saved.set(key,value)}};
  const api={ViewColumn:{Beside:2},workspace:{openTextDocument:async value=>{documents.push(value);return value;}},window:{showTextDocument:async()=>{},showQuickPick:async rows=>rows.find(row=>row.id==='exact-peer')||rows[0],showInputBox:async()=> '192.0.2.0/24',showWarningMessage:async(_,options)=>{reviews.push(options.detail);return 'Run reviewed calculation';},showInformationMessage:async()=>{}}};
  return {calls,reviews,documents,saved,connection,context,api};
}
test('native calculation review shows exact peer/CIDR and submits only its reviewed reference',async()=>{
  const f=fixture(),{openPeerExecution}=await sourceModule('views/peer-execution.ts',f.api);await openPeerExecution(f.context,f.connection);
  assert.match(f.reviews[0],/Peer: exact-peer/);assert.match(f.reviews[0],/CIDR: 192.0.2.0\/24/);
  assert.equal(JSON.stringify(f.calls.find(row=>row.args.action==='peer-execution-submit').args.args),JSON.stringify({reviewId:'review'}));assert.equal(f.saved.values().next().value.operationId,'operation');assert.ok(!JSON.stringify([...f.saved]).includes('192.0.2.0'));
});
test('cancelled or switched review and substituted calculation never submit',async()=>{
  for(const fault of ['cancel','switch','substitute','invalid']){
    const f=fixture();if(fault==='substitute'){const call=f.connection.call;f.connection.call=async(name,args)=>{const result=await call(name,args);if(args.action==='peer-execution-preview')result.data.selection.cidr='198.51.100.0/24';return result;};}
    else if(fault==='invalid')f.api.window.showInputBox=async()=> '0.0.0.0/0';
    else f.api.window.showWarningMessage=async()=>{if(fault==='switch'){f.connection.generation++;return 'Run reviewed calculation';}};
    const {openPeerExecution}=await sourceModule('views/peer-execution.ts',f.api);
    if(fault==='cancel')await openPeerExecution(f.context,f.connection);else await assert.rejects(openPeerExecution(f.context,f.connection));
    assert.ok(!f.calls.some(row=>row.args.action==='peer-execution-submit'));assert.equal(f.saved.size,0);
  }
});
test('lost admission resolves by nonce without resend; hostile returned results are plain text',async()=>{
  const f=fixture(),call=f.connection.call;
  f.connection.call=async(name,args)=>{if(args.action==='peer-execution-submit')throw Error('lost reply');return call(name,args);};
  const {openPeerExecution}=await sourceModule('views/peer-execution.ts',f.api);await assert.rejects(openPeerExecution(f.context,f.connection),/lost reply/);
  f.calls.length=0;f.connection.call=async(name,args)=>{f.calls.push({name,args});if(name==='operator_resources')return {data:{operation:{operationId:'operation',kind:'peer-execution'}}};return {operationId:'operation',kind:'peer-execution',state:'succeeded',result:{text:'<img> command:unsafe'}};};
  await openPeerExecution(f.context,f.connection);assert.equal(f.saved.size,0);assert.equal(f.documents[0].language,'plaintext');assert.match(f.documents[0].content,/<img> command:unsafe/);assert.ok(f.calls.some(row=>row.args.filters?.query));assert.ok(!f.calls.some(row=>row.args.action==='peer-execution-submit'));
});

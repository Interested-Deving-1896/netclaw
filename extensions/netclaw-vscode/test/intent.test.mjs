import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(){
  const state=new Map(),calls=[],panels=[];
  const connection={generation:1,identity:{installationId:'installation',hostId:'host',principalId:'principal',harness:{type:'openclaw'}},call:async(name,args)=>{
    calls.push({name,args});
    if(args.action==='intent-state')return {data:{available:true,revision:'revision',scope:'Operator-only scope',devices:[{id:'LAB-A',name:'Lab A',host:'192.0.2.1',port:22,protocol:'ssh',supported:true}],policy:{enabled:true,revision:'policy-revision',devices:[{id:'LAB-A',valid:true}]},operations:[]}};
    if(args.action==='intent-preview')return {data:{scope:'Exact endpoints; no broader approval.',approval:null}};
    if(args.action==='intent-submit')return {operationId:'owned-operation'};
    return {data:{operation:{operationId:'owned-operation',state:'running'}}};
  }};
  const api={ViewColumn:{One:1},Uri:{joinPath:(...parts)=>parts.join('/')},workspace:{isTrusted:true},window:{
    showQuickPick:async(rows,options)=>options?.canPickMany?rows:rows.find(row=>row.value==='read-only')||rows.find(row=>row.value==='local-lab')||rows[0],
    showInputBox:async()=>'Inspect LAB-A',showWarningMessage:async()=>'Submit scoped request',
    createWebviewPanel:()=>{const panel={onDidDispose:()=>{},webview:{cspSource:'fixture',asWebviewUri:value=>value,onDidReceiveMessage:()=>{},postMessage:async value=>{panels.push(value);}}};return panel;},
  }};
  const context={extensionUri:'/extension',workspaceState:{get:key=>state.get(key),update:async(key,value)=>{if(value===undefined)state.delete(key);else state.set(key,value);}}};
  return {state,calls,panels,connection,api,context};
}
test('native intent previews exact selection and submits once after explicit review without persisting request text',async()=>{
  const f=fixture(),saved=[],update=f.context.workspaceState.update;f.context.workspaceState.update=async(key,value)=>{saved.push(value);return update(key,value);};
  const {openIntent}=await sourceModule('views/intent.ts',f.api);await openIntent(f.context,f.connection);
  const submits=f.calls.filter(row=>row.args.action==='intent-submit');assert.equal(submits.length,1);
  assert.equal(submits[0].args.args.requestKind,'read-only');assert.equal(submits[0].args.args.changeMode,'local-lab');assert.equal(submits[0].args.args.policyRevision,'policy-revision');
  assert.deepEqual(JSON.parse(JSON.stringify(submits[0].args.args.targetDeviceIds)),['LAB-A']);
  assert.equal(saved[0].installationId,'installation');assert.equal(saved[0].request,undefined);assert.equal(f.state.size,0);
});
test('cancel and changed connection during intent review cannot dispatch',async()=>{
  for(const mode of ['cancel','switch']){
    const f=fixture();f.api.window.showWarningMessage=async()=>{if(mode==='switch'){f.connection.generation++;return 'Submit scoped request';}};
    const {openIntent}=await sourceModule('views/intent.ts',f.api);
    if(mode==='cancel')await openIntent(f.context,f.connection);else await assert.rejects(openIntent(f.context,f.connection),/Connection changed/);
    assert.equal(f.calls.some(row=>row.args.action==='intent-submit'),false);assert.equal(f.state.size,0);
  }
});
test('lost submission response retains nonce and reconnect only looks up the original admission',async()=>{
  const f=fixture(),call=f.connection.call;f.connection.call=async(name,args)=>{if(args.action==='intent-submit'){f.calls.push({name,args});throw Error('Lost response');}return call(name,args);};
  const {openIntent}=await sourceModule('views/intent.ts',f.api);await assert.rejects(openIntent(f.context,f.connection),/Lost response/);
  const pending=f.state.get('netclaw.intent.pending');assert.ok(pending.nonce);
  f.connection.call=call;await openIntent(f.context,f.connection);
  assert.equal(f.calls.filter(row=>row.args.action==='intent-submit').length,1);
  assert.equal(f.calls.find(row=>row.name==='operator_resources').args.filters.query,pending.nonce);assert.equal(f.state.size,0);
});

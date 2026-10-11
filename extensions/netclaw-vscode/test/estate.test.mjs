import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
const api={EventEmitter:class{event=()=>({dispose(){}});fire(){}dispose(){}},TreeItem:class{constructor(label,state){this.label=label;this.collapsibleState=state;}},ThemeIcon:class{constructor(id){this.id=id;}},TreeItemCollapsibleState:{None:0,Collapsed:1}};
test('native estate separates local, internal, external, edge and advice roles',async()=>{
  const {EstateTree}=await sourceModule('views/estate.ts',api);
  const connection={generation:1,identity:{harness:{type:'hermes'},role:'border'},profile:{label:'Synthetic Border'},call:async()=>{throw Error('must remain lazy');}};
  const tree=new EstateTree(connection),rows=await tree.getChildren();
  assert.equal(rows[0].description,'hermes · border');assert.deepEqual(Array.from(rows.slice(1,5),row=>row.group),['member','peer','edge','advisor']);
  assert.equal(tree.getTreeItem(rows[1]).collapsibleState,1);assert.equal(tree.getTreeItem(rows[0]).command.command,'netclaw.openOverview');
});
test('native estate retains 100 same-label distinct identities and isolates one failed source',async()=>{
  const {EstateTree}=await sourceModule('views/estate.ts',api),rows=Array.from({length:100},(_,i)=>({id:`member-${i}`,label:'Same label',harness:{type:i%2?'hermes':'openclaw'},state:'active'}));
  const connection={generation:1,identity:{harness:{type:'hermes'}},call:async(_name,args)=>{if(args.kind==='peer')throw Error('peer unavailable');return {data:{items:rows,total:100},source:'membership',observedAt:'2026-10-10T00:00:00Z',warnings:[]};}};
  const tree=new EstateTree(connection),groups=await tree.getChildren(),members=await tree.getChildren(groups[1]);
  assert.equal(members.length,100);assert.equal(new Set(members.map(row=>row.resource.id)).size,100);
  assert.equal((await tree.getChildren(groups[2]))[0].label,'Source unavailable');assert.equal((await tree.getChildren(groups[1])).length,100);
  connection.generation++;assert.match((await tree.getChildren(groups[1]))[0].label,/Connection changed/);
});
test('late estate responses and old inspector nodes cannot cross installation changes',async()=>{
  const {EstateTree,inspectEstateResource}=await sourceModule('views/estate.ts',api);
  let finish;const connection={generation:1,identity:{harness:{type:'openclaw'}},call:()=>new Promise(resolve=>{finish=resolve;})};
  const tree=new EstateTree(connection),groups=await tree.getChildren(),pending=tree.getChildren(groups[1]);
  connection.generation++;finish({data:{items:[],total:0},warnings:[]});assert.equal((await pending).length,0);
  assert.throws(()=>inspectEstateResource({},connection,{generation:1,resource:{id:'old'}}),/Connection changed/);
});
test('estate inspector refreshes only its exact bound resource and fails when it disappears',async()=>{
  const posted=[],calls=[];let receive;
  const panel={webview:{cspSource:'fixture:',asWebviewUri:value=>value,onDidReceiveMessage:fn=>{receive=fn;},postMessage:async value=>{posted.push(value);}},onDidDispose(){}};
  const mock={...api,window:{createWebviewPanel:()=>panel},ViewColumn:{One:1},Uri:{joinPath:(...parts)=>parts.join('/')},workspace:{isTrusted:true}};
  const {inspectEstateResource}=await sourceModule('views/estate.ts',mock);
  const connection={generation:1,identity:{harness:{type:'hermes'}},call:async(name,input)=>{calls.push({name,input});return {data:{items:calls.length===1?[{id:'peer',inventory:{detail:true}}]:[]},source:'fresh cache',observedAt:'fixture-time',warnings:[]};}};
  inspectEstateResource({extensionUri:'fixture'},connection,{label:'Peer',generation:1,resource:{id:'peer'},resourceKind:'peer'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{name:'operator_resources',input:{kind:'peer',resourceId:'peer',limit:1}});assert.equal(posted[0].data.resource.inventory.detail,true);
  receive({type:'refresh',viewId:posted[0].viewId,requestId:'2'});await new Promise(resolve=>setImmediate(resolve));
  assert.match(posted[1].error,/no longer present/);assert.equal(calls.length,2);
  connection.generation++;receive({type:'refresh',viewId:posted[0].viewId,requestId:'3'});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,2);
});

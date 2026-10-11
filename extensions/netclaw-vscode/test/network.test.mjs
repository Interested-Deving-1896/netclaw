import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {sourceModule} from './bundle-fixture.mjs';
const require=createRequire(new URL('../../../ui/netclaw-visual/package.json',import.meta.url)),{JSDOM}=require('jsdom');
async function fixture(){
  const calls=[],posts=[],commands=[];let receive,changed,dispose;
  const panel={webview:{cspSource:'test',asWebviewUri:value=>String(value),onDidReceiveMessage:fn=>{receive=fn;},postMessage:async value=>{posts.push(value);}},onDidDispose:fn=>{dispose=fn;}};
  const api={Uri:{joinPath:(...parts)=>parts.join('/')},ViewColumn:{One:1},workspace:{isTrusted:true},window:{createWebviewPanel:()=>panel},commands:{executeCommand:async name=>commands.push(name)}};
  const connection={ready:true,generation:1,identity:{installationId:'selected',harness:{type:'hermes'}},profile:{label:'<img onerror=evil()>'},changed:{event:fn=>{changed=fn;return {dispose(){}};}},call:async(name,args)=>{calls.push({name,args});return {source:'Bound fixture',observedAt:'2026-10-11T00:00:00Z',data:{items:[{id:'R1'}],nextCursor:args.cursor?undefined:'200'}};}};
  const {openNetwork}=await sourceModule('views/network.ts',api);openNetwork({extensionUri:'extension'},connection);
  const dom=new JSDOM(panel.webview.html,{runScripts:'outside-only'}),requests=[];dom.window.acquireVsCodeApi=()=>({postMessage:value=>requests.push(value)});
  dom.window.eval(fs.readFileSync(new URL('../resources/network.js',import.meta.url),'utf8'));
  const message=(type,extra={})=>({viewId:dom.window.document.body.dataset.viewId,requestId:'test',type,...extra});
  return {calls,posts,commands,connection,api,dom,requests,message,receive:value=>receive(value),changed:()=>changed(),dispose:()=>{dispose();dom.window.close();}};
}
test('network host binds layer reads and pagination, denies injected authority and exposes only explicit Intent entry',async t=>{
  const f=await fixture();t.after(f.dispose);
  await f.receive(f.message('ready'));assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].args)),{kind:'network',sourceKind:'configured',limit:200});
  await f.receive(f.message('more'));assert.equal(f.calls[1].args.cursor,'200');
  await f.receive(f.message('layer',{layer:'historical'}));assert.equal(f.calls.at(-1).args.sourceKind,'historical');assert.equal(f.calls.at(-1).args.cursor,undefined);
  await f.receive(f.message('layer',{layer:'peer'}));assert.equal(f.calls.at(-1).args.kind,'peer');
  const count=f.calls.length;
  for(const m of [f.message('shell'),f.message('layer',{layer:'live'}),f.message('refresh',{approved:true}),f.message('ready',{viewId:'other'})])await f.receive(m);
  assert.equal(f.calls.length,count);assert.equal(f.commands.length,0);await f.receive(f.message('intent'));assert.deepEqual(f.commands,['netclaw.openIntent']);
  f.connection.generation++;f.changed();await f.receive(f.message('refresh'));assert.equal(f.calls.length,count);assert.equal(f.posts.at(-1).type,'invalidated');
});
test('network script keeps hostile source text inert and graph subtraction local with explicit provenance',async t=>{
  const f=await fixture();t.after(f.dispose);const d=f.dom.window.document;
  const data={available:true,sourceKind:'historical',scope:'Historical; no live health',nodes:[{id:'one',label:'<img src=x onerror=evil()>',kind:'collector-device',observedAt:1,stale:true,sourceReference:{sourceId:'collector'}},{id:'two',label:'Advertised neighbor',kind:'neighbor-advertisement',observedAt:1,stale:true}],edges:[{from:'one',to:'two',protocol:'CDP',stale:true,sourceReference:{sourceId:'cdp',observedAt:1}}],observations:[],truncated:true,omitted:7};
  const emit=message=>f.dom.window.dispatchEvent(new f.dom.window.MessageEvent('message',{data:{viewId:d.body.dataset.viewId,type:'source',installationId:'selected',source:'fixture',...message}}));
  emit({layer:'simulated',data});assert.equal(d.querySelectorAll('img').length,0);assert.match(d.getElementById('nodes').textContent,/<img/);assert.match(d.getElementById('status').textContent,/SIMULATED/);assert.match(d.getElementById('counts').textContent,/7 records omitted/);
  const before=f.requests.length;d.getElementById('removed').value='one';d.getElementById('removed').dispatchEvent(new f.dom.window.Event('change'));
  assert.equal(f.requests.length,before);assert.match(d.getElementById('counts').textContent,/1 incident relationships/);assert.equal(d.querySelectorAll('#network-graph line').length,0);
  emit({layer:'configured',data:{items:[{id:'R1',os:'iosxe'}],total:10000,nextCursor:'200'}});assert.match(d.getElementById('nodes').textContent,/Live state unknown/);assert.equal(d.querySelectorAll('#network-graph line').length,0);assert.equal(d.getElementById('more').hidden,false);
  emit({layer:'peer',data:{items:[{id:'peer1',label:'External Claw',state:'active',harness:{type:'hermes'}}]}});assert.match(d.getElementById('provenance').textContent,/no physical cable or device health/);assert.match(d.getElementById('edges').textContent,/Peering record/);
  emit({type:'invalidated',message:'Connection changed'});assert.equal(d.getElementById('nodes').children.length,0);assert.equal(d.getElementById('intent').disabled,true);assert.equal(f.requests.length,before);
});

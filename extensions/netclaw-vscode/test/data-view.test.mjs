import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {sourceModule} from './bundle-fixture.mjs';
const require=createRequire(new URL('../../../ui/netclaw-visual/package.json',import.meta.url)),{JSDOM}=require('jsdom');
function browser(t){
  const calls=[],dom=new JSDOM('<body data-view-id="view"><button id="refresh">Refresh</button><label for="filter">Filter loaded entries</label><input id="filter"><p id="status" role="status"></p><div id="content"></div></body>',{runScripts:'outside-only'});t.after(()=>dom.window.close());
  dom.window.TextEncoder=TextEncoder;dom.window.acquireVsCodeApi=()=>({postMessage:value=>calls.push(value)});dom.window.eval(fs.readFileSync(new URL('../resources/data.js',import.meta.url),'utf8'));
  const send=data=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:{viewId:'view',...data}}));return {dom,document:dom.window.document,calls,send};
}
test('loaded thousand-row inventory is paged and locally filtered without another backend read',async t=>{
  const f=browser(t),rows=Array.from({length:1000},(_,i)=>({id:'tool-'+i,advertised:true,executionVerified:null}));f.send({data:{source:'Received cache; execution unknown',items:rows}});
  assert.equal(f.document.querySelectorAll('article').length,50);assert.match(f.document.getElementById('content').textContent,/1–50 of 1000/);
  [...f.document.querySelectorAll('button')].find(button=>button.textContent==='Next entries').click();assert.match(f.document.getElementById('content').textContent,/51–100 of 1000/);assert.equal(f.document.activeElement.textContent,'Next entries');
  const input=f.document.getElementById('filter');input.value='tool-999';input.dispatchEvent(new f.dom.window.Event('input'));await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(f.document.querySelectorAll('article').length,1);assert.match(f.document.getElementById('content').textContent,/Received cache; execution unknown/);assert.match(f.document.getElementById('content').textContent,/tool-999/);
  assert.deepEqual(f.calls.map(row=>row.type),['ready']);
});
test('hostile strings, falsey values and zero matches render as text with source metadata',async t=>{
  const f=browser(t);f.send({data:{source:'<script>evil()</script>',enabled:false,count:0,value:null,items:[{name:'<img src=x onerror=evil()>',link:'command:unsafe'}]}});
  assert.equal(f.document.querySelectorAll('script,img,a').length,0);assert.match(f.document.getElementById('content').textContent,/false/);assert.match(f.document.getElementById('content').textContent,/Unknown/);
  const input=f.document.getElementById('filter');input.value='no match';input.dispatchEvent(new f.dom.window.Event('input'));await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(f.document.querySelectorAll('article').length,0);assert.match(f.document.getElementById('content').textContent,/No loaded entries match/);assert.match(f.document.getElementById('content').textContent,/<script>evil\(\)<\/script>/);
});
test('oversized and deep data are bounded; invalidated views cannot restore stale results',t=>{
  const f=browser(t);f.send({data:{text:'x'.repeat(1024*1024)}});assert.match(f.document.getElementById('status').textContent,/exceeds/);assert.equal(f.document.getElementById('content').textContent,'');
  let value='deep';for(let i=0;i<30;i++)value={child:value};f.send({data:value});assert.match(f.document.getElementById('content').textContent,/Display limit reached/);
  f.send({error:'Connection changed',invalidated:true});f.send({data:{source:'stale result'}});assert.equal(f.document.getElementById('content').textContent,'');assert.equal(f.document.getElementById('refresh').disabled,true);assert.equal(f.document.getElementById('filter').disabled,true);assert.deepEqual(f.calls.map(row=>row.type),['ready']);
});
test('inspection bridge waits for ready and drops forged, repeated and late cross-binding messages',async()=>{
  let receive,change,dispose,resolve;const messages=[];let loads=0,subscriptionDisposed=false;
  const panel={webview:{cspSource:'fixture:',asWebviewUri:value=>value,onDidReceiveMessage:fn=>{receive=fn;},postMessage:async message=>{messages.push(message);}},onDidDispose:fn=>{dispose=fn;}};
  const api={window:{createWebviewPanel:()=>panel},ViewColumn:{One:1},Uri:{joinPath:(...parts)=>parts.join('/')},workspace:{isTrusted:true}};
  const connection={generation:1,changed:{event:fn=>{change=fn;return {dispose:()=>{subscriptionDisposed=true;}};}},identity:{harness:{type:'hermes'}},profile:{label:'<hostile label>'}};
  const {openDataView}=await sourceModule('webview/bridge.ts',api);openDataView({extensionUri:'fixture'},connection,{title:'<title>',kind:'fixture',load:async()=>{loads++;return new Promise(finish=>{resolve=finish;});}});
  const viewId=panel.webview.html.match(/data-view-id="([^"]+)"/)[1];assert.equal(loads,0);assert.ok(panel.webview.html.includes('&lt;title&gt;'));
  for(const message of [{type:'ready',viewId:'wrong',requestId:'1'},{type:'apply',viewId,requestId:'1'},{type:'ready',viewId,requestId:'1',approved:true}])receive(message);assert.equal(loads,0);
  receive({type:'ready',viewId,requestId:'1'});receive({type:'ready',viewId,requestId:'1'});assert.equal(loads,1);
  connection.generation++;change();resolve({private:'old observation'});await new Promise(done=>setImmediate(done));assert.equal(messages.length,1);assert.equal(messages[0].invalidated,true);
  receive({type:'refresh',viewId,requestId:'2'});assert.equal(loads,1);dispose();assert.equal(subscriptionDisposed,true);
});
test('ready after an early connection change receives the invalidation without reading the new target',async()=>{
  let receive,change;const messages=[];let loads=0;
  const panel={webview:{cspSource:'fixture:',asWebviewUri:value=>value,onDidReceiveMessage:fn=>{receive=fn;},postMessage:async message=>{messages.push(message);}},onDidDispose:()=>{}};
  const api={window:{createWebviewPanel:()=>panel},ViewColumn:{One:1},Uri:{joinPath:(...parts)=>parts.join('/')},workspace:{isTrusted:true}};
  const connection={generation:1,changed:{event:fn=>{change=fn;return {dispose:()=>{}};}},identity:{harness:{type:'hermes'}},profile:{label:'first'}};
  const {openDataView}=await sourceModule('webview/bridge.ts',api);openDataView({extensionUri:'fixture'},connection,{title:'Overview',kind:'fixture',load:async()=>{loads++;return {};}});
  const viewId=panel.webview.html.match(/data-view-id="([^"]+)"/)[1];connection.generation++;change();messages.length=0;
  receive({type:'ready',viewId,requestId:'1'});await new Promise(done=>setImmediate(done));
  assert.equal(loads,0);assert.equal(messages.length,1);assert.equal(messages[0].invalidated,true);assert.match(messages[0].error,/Connection changed/);
});

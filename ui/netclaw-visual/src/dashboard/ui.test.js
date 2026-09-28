import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
const output = await build({ entryPoints: [new URL('./main.jsx',import.meta.url).pathname], bundle:true, write:false, outfile:'ui.js', format:'iife', define:{'process.env.NODE_ENV':'"production"'} });
const js=output.outputFiles.find(f=>f.path.endsWith('.js')).text;
const settle=()=>new Promise(resolve=>setTimeout(resolve,30));
async function app(t, preview=true, fetcher){const errors=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});dom.window.NETCLAW_PREVIEW=preview;if(fetcher)dom.window.fetch=fetcher;dom.window.AbortSignal=AbortSignal;dom.window.AbortController=AbortController;dom.window.eval(js);t.after(()=>dom.window.close());await settle();return {document:dom.window.document,window:dom.window,errors};}
function click(document,label){const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label || b.textContent.trim().startsWith(label));assert.ok(button,`button ${label}`);button.click();}
test('production dashboard renders and Basic/Advanced retains navigation without errors',async t=>{const {document,errors}=await app(t);assert.match(document.body.textContent,/SYNTHETIC PREVIEW/);assert.match(document.body.textContent,/Execution members/);click(document,'Advanced');await settle();assert.equal(document.querySelector('button[aria-pressed=true]').textContent,'Advanced');for(const label of ['Risk of Claws','External neighbours','Mobile devices','Science Officer','Network','Knowledge','Operations','Integrations','Settings','RAG','Configuration','Canvas','Tokenomics','Documentation','Logs','Security']){const button=[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes(label));assert.ok(button,label);button.click();await settle();assert.match(document.querySelector('h1').textContent,new RegExp(label));}assert.deepEqual(errors,[]);});
test('member inspector uses exact identity; Three.js not required for selection',async t=>{const {document,errors}=await app(t);click(document,'03Risk of Claws');await settle();document.querySelector('button[aria-label="Inspect Network Claw"]').click();await settle();assert.match(document.querySelector('.inspector').textContent,/demo\/network/);assert.match(document.querySelector('.inspector').textContent,/Execution member/);assert.equal(document.querySelector('canvas'),null);assert.deepEqual(errors,[]);});
test('typed assessment comparison shows Noul probability, Choice answer and Score separately',async t=>{const {document,errors}=await app(t);click(document,'06Science Officer');await settle();click(document,'Inspect synthetic original');await settle();assert.equal(document.querySelectorAll('.assessment').length,2);assert.match(document.body.textContent,/0.72/);assert.match(document.body.textContent,/interfaces/);assert.match(document.body.textContent,/Rubric position/);assert.match(document.body.textContent,/not network health/);assert.match(document.body.textContent,/Border's interpretation/);assert.deepEqual(errors,[]);});

test('Canvas tab mounts real canvas.html once and preserves iframe across navigation and mode changes',async t=>{
  const {document,errors}=await app(t,false,async()=>({ok:true,json:async()=>({})}));
  click(document,'02Canvas');await settle();const frame=document.querySelector('iframe');
  assert.ok(frame);assert.equal(frame.getAttribute('src'),'/canvas.html?embedded=1');
  assert.equal(document.querySelector('.canvas-workspace').hidden,false);
  click(document,'01Overview');await settle();assert.equal(document.querySelector('.canvas-workspace').hidden,true);
  click(document,'Advanced');await settle();click(document,'02Canvas');await settle();
  assert.equal(document.querySelector('iframe'),frame);assert.equal(document.querySelector('.canvas-workspace').hidden,false);
  assert.ok(document.querySelector('a[href="/canvas.html"]'));assert.doesNotMatch(document.body.textContent,/Adam's/);assert.deepEqual(errors,[]);
});
test('RAG and configuration are available in Basic; preview never uploads or reads credentials',async t=>{
  const {document,errors}=await app(t);
  click(document,'12RAG');await settle();assert.match(document.body.textContent,/Collections & ingestion/);
  assert.equal(document.querySelector('input[type=file]').disabled,true);
  assert.match(document.body.textContent,/Branch routing runbook/);
  click(document,'13Configuration');await settle();assert.match(document.body.textContent,/TYPESAFE_API_KEY/);
  assert.match(document.body.textContent,/Values stay masked/);assert.deepEqual(errors,[]);
});
test('RAG retrieval uses selected collection and passes cited results to Canvas draft review',async t=>{
  const calls=[];
  const fetcher=async(url,options={})=>{calls.push([url,options]);return {ok:true,json:async()=>url==='/api/rag/search'?{collection:'documents',results:[{chunk_id:'c1',title:'Runbook',chunk_text:'Check counters',citation:'[Runbook p.2]',score:0.8}]}:url==='/api/rag/documents'?{documents:[],snapshots:[],replicas:[]}:url==='/api/rag/stats'?{collections:['documents']}: {}};};
  const {document,window,errors}=await app(t,false,fetcher);click(document,'12RAG');await settle();
  const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(input,'routing');input.dispatchEvent(new window.Event('input',{bubbles:true}));await settle();
  input.closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
  const request=calls.find(([url])=>url==='/api/rag/search');assert.ok(request);assert.deepEqual(JSON.parse(request[1].body),{query:'routing',collection:'documents',k:5});
  assert.match(document.body.textContent,/Runbook p.2/);click(document,'Use evidence in Canvas');await settle();
  assert.match(document.querySelector('.context-review').textContent,/Runbook p.2/);assert.match(document.querySelector('h1').textContent,/Canvas/);assert.deepEqual(errors,[]);
});
test('RAG upload submits multipart fields and treats 202 as pending rather than ready',async t=>{
  const calls=[];const fetcher=async(url,options={})=>{calls.push([url,options]);return {ok:true,json:async()=>url==='/api/rag/upload'?{status:'pending'}:url==='/api/rag/documents'?{documents:[],snapshots:[],replicas:[]}: {}};};
  const {document,window,errors}=await app(t,false,fetcher);click(document,'12RAG');await settle();
  const form=document.querySelector('input[type=file]').closest('form');form.querySelector('[name=title]').value='Upload regression';
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
  const upload=calls.find(([url])=>url==='/api/rag/upload');assert.ok(upload);assert.equal(upload[1].method,'POST');assert.equal(upload[1].body.get('title'),'Upload regression');assert.equal(upload[1].body.get('doc_type'),'other');assert.ok(upload[1].body.has('file'));assert.equal(upload[1].headers,undefined);assert.match(document.body.textContent,/Ingestion is pending/);assert.deepEqual(errors,[]);
});
test('RAG failures stay visible without reporting empty collections or successful uploads',async t=>{
  const {document,window}=await app(t,false,async url=>({ok:!url.startsWith('/api/rag'),status:503,json:async()=>({})}));click(document,'12RAG');await settle();
  assert.match(document.querySelector('[role=alert]').textContent,/could not complete/);assert.doesNotMatch(document.body.textContent,/No documents reported/);
  document.querySelector('input[type=file]').closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.match(document.querySelector('[role=status]').textContent,/could not complete/);assert.doesNotMatch(document.body.textContent,/Upload accepted/);
});

test('Claw inspector shows exact reported MCP tools and model, not generic capabilities',async t=>{
  const {document}=await app(t);click(document,'03Risk of Claws');await settle();document.querySelector('button[aria-label="Inspect Network Claw"]').click();await settle();const detail=document.querySelector('.inspector');assert.match(detail.textContent,/example\/network-model/);assert.match(detail.textContent,/pyats_run_show_command/);assert.match(detail.textContent,/tool list not reported/);
});
test('Tokenomics distinguishes recorded usage, heuristics, cache and separate Jev budgets',async t=>{
  const {document}=await app(t);click(document,'14Tokenomics');await settle();assert.match(document.body.textContent,/42,000/);assert.match(document.body.textContent,/Cache read/);assert.match(document.body.textContent,/\$0.17 per assistant turn/);assert.match(document.body.textContent,/not added together/);
});
test('Documentation includes Sean guide, CLI flags, MCP reference and real OpenAPI routes',async t=>{
  const {document}=await app(t);click(document,'15Documentation');await settle();assert.ok(document.querySelector('a[href="https://www.seanmahoney.ai/guides/netclaw-overview/"]'));click(document,'CLI reference');await settle();assert.match(document.body.textContent,/scripts\/netclaw/);assert.match(document.body.textContent,/--edge/);click(document,'MCP reference');await settle();assert.match(document.body.textContent,/rag_search/);click(document,'HTTP API');await settle();assert.match(document.body.textContent,/GET \/api\/hud\/logs/);
});
test('Logs filters synthetic tail and hands exact selected evidence to Canvas without executing commands',async t=>{
  const {document,window}=await app(t);click(document,'16Logs');await settle();const select=[...document.querySelectorAll('select')].find(s=>s.textContent.includes('warning'));select.value='warning';select.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();assert.equal(document.querySelectorAll('tbody tr').length,1);assert.match(document.querySelector('tbody').textContent,/heartbeat delayed/);click(document,'Investigate ↗');await settle();assert.match(document.querySelector('.context-review').textContent,/heartbeat delayed/);assert.match(document.querySelector('h1').textContent,/Canvas/);
});

test('Overview labels LAB separately and Security distinguishes DefenseClaw, OpenShell and host confinement',async t=>{
  const {document}=await app(t);assert.match(document.body.textContent,/LAB bypass enabled/);click(document,'Inspect Security');await settle();assert.match(document.body.textContent,/Host member confinement/);assert.match(document.body.textContent,/OpenShell is not required/);assert.match(document.body.textContent,/Observe mode/);click(document,'DefenseClaw logs');await settle();assert.equal(document.querySelector('select').value,'defenseclaw');assert.match(document.body.textContent,/tail -n 200 ~\/\.defenseclaw\/gateway.log/);
});

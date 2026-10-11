import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce,auditFixture} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
function fixture(t,kind='openclaw'){
  const f=installationFixture(t,kind),audit=auditFixture(),service=new ManagementService({...f,root,audit}),starts=[],scans=[];t.after(()=>service.close());
  const state={source:'a'.repeat(64),binding:'bound'},probe={versions:{defenseclaw:'fixture'}};
  service.defenseScans.scanner={read:()=>({probe,binding:state.binding}),verify:async()=>{},skill:name=>({revision:state.source,source:{name,manifest:[{path:'SKILL.md',sha256:state.source}],bytes:10,omittedEntries:1}}),scan:async(record,selection)=>{scans.push(selection);return {data:{profile:'fixture',findingCount:1,findings:[{title:'<untrusted skill finding>'}],enforcementPerformed:false}};}};
  service.defenseScans.start=async id=>starts.push(id);
  const review=async(name='fixture')=>{const {data}=await service.call('operator_workspace',{action:'security-scan-preview',args:{name}});return {review:data,input:{action:'security-scan-submit',nonce:nonce(),args:{reviewId:data.reviewId}}};};
  return {...f,service,audit,starts,scans,state,review};
}
test('reviewed scan keeps owned report and nonce receipt for both harness selections without replay',async t=>{
  for(const kind of ['openclaw','hermes']){
    const f=fixture(t,kind),{review,input}=await f.review();assert.equal(f.scans.length,0);assert.equal(review.files[0].path,'SKILL.md');assert.ok(review.disclosure);
    const operation=await f.service.call('operator_workspace',input),result=await f.service.defenseScans.run(operation.operationId);
    assert.equal(result.state,'succeeded');assert.equal(result.result.result.findingCount,1);
    assert.equal((await f.service.call('operator_workspace',input)).operationId,operation.operationId);assert.equal(f.scans.length,1);
    assert.equal(await f.service.defenseScans.run(operation.operationId),undefined);
    const list=(await f.service.call('operator_workspace',{action:'security-scan-list',args:{}})).data;
    assert.equal(list.reports.length,1);assert.equal(list.reports[0].result,undefined);assert.equal(list.operations[0].result,undefined);
    const report=(await f.service.call('operator_workspace',{action:'security-scan-read',args:{id:operation.operationId}})).data;
    assert.equal(report.sourceRevision,review.sourceRevision);assert.equal(report.result.enforcementPerformed,false);
  }
});
test('source, scanner and expiry changes plus assistant calls refuse scan admission',async t=>{
  const f=fixture(t),p=f.service.binding.principal,{input,review}=await f.review();
  await assert.rejects(f.service.defenseScans.submit({...p,surface:'assistant'},input),{code:'DENIED'});
  await assert.rejects(f.service.call('operator_workspace',{...input,args:{...input.args,python:'/tmp/evil'}}),{code:'INVALID_INPUT'});
  f.state.source='b'.repeat(64);await assert.rejects(f.service.call('operator_workspace',input),{code:'STALE_REVISION'});f.state.source='a'.repeat(64);
  f.state.binding='changed';await assert.rejects(f.service.call('operator_workspace',input),{code:'STALE_REVISION'});f.state.binding='bound';
  const saved=f.service.journal.record('defense-scan-review',review.reviewId,p);f.service.journal.put('defense-scan-review',review.reviewId,p,{...saved,expiresAt:0},{replace:true});
  await assert.rejects(f.service.call('operator_workspace',input),{code:'EXPIRED'});assert.equal(f.starts.length,0);assert.equal(f.scans.length,0);
});
test('same-skill uncertainty and two active scans bound admission even beyond 100 unrelated requests',async t=>{
  const f=fixture(t),p=f.service.binding.principal,first=await f.review(),operation=await f.service.call('operator_workspace',first.input);
  const lease=f.service.journal.claim(operation.operationId,{pid:process.pid});f.service.journal.finish(operation.operationId,lease,'unknown',{});
  for(let i=0;i<110;i++)f.service.journal.admit(p,nonce(),'unrelated',{});
  await assert.rejects(f.service.call('operator_workspace',(await f.review()).input),{code:'BUSY'});
  await f.service.call('operator_workspace',(await f.review('second')).input);await f.service.call('operator_workspace',(await f.review('third')).input);
  await assert.rejects(f.service.call('operator_workspace',(await f.review('fourth')).input),{code:'BUSY'});assert.equal(f.starts.length,3);
});
test('audit failure and pre-launch cancellation prevent scanning',async t=>{
  const f=fixture(t),first=await f.review();f.audit.available=false;await assert.rejects(f.service.call('operator_workspace',first.input));assert.equal(f.starts.length,0);f.audit.available=true;
  const second=await f.review(),operation=await f.service.call('operator_workspace',second.input);
  await f.service.call('operator_cancel_request',{operationId:operation.operationId,nonce:nonce()});assert.equal(await f.service.defenseScans.run(operation.operationId),undefined);assert.equal(f.scans.length,0);
});
test('cancellation waits for confirmed scanner exit and retains its completion receipt',async t=>{
  const f=fixture(t),{input}=await f.review(),operation=await f.service.call('operator_workspace',input);let launched;
  const ready=new Promise(resolve=>{launched=resolve;});
  f.service.defenseScans.scanner.scan=async(record,selection,{signal})=>{launched();return new Promise(resolve=>signal.addEventListener('abort',()=>resolve({cancelled:true,confirmedExited:true}),{once:true}));};
  const running=f.service.defenseScans.run(operation.operationId);await ready;
  const request=await f.service.call('operator_cancel_request',{operationId:operation.operationId,nonce:nonce()});assert.equal(request.state,'cancellation-requested');
  const timer=setInterval(()=>{},100);try{const result=await running;assert.equal(result.state,'cancelled');assert.equal(result.result.result.confirmedExited,true);}finally{clearInterval(timer);}
});
test('confirmed child failure stays failed while uncertain dispatch is never restarted',async t=>{
  for(const confirmedExited of [true,false]){
    const f=fixture(t),{input}=await f.review(),operation=await f.service.call('operator_workspace',input);let attempts=0;
    f.service.defenseScans.scanner.scan=async()=>{attempts++;throw Object.assign(Error('private error'),{confirmedExited});};
    assert.equal((await f.service.defenseScans.run(operation.operationId)).state,confirmedExited?'failed':'unknown');
    assert.equal((await f.service.call('operator_operation_get',{operationId:operation.operationId})).state,confirmedExited?'failed':'unknown');
    await f.service.call('operator_workspace',input);assert.equal(attempts,1);assert.equal(f.starts.length,1);
  }
});
test('final audit loss reconciles a retained child completion without running the scanner again',async t=>{
  const f=fixture(t),{input}=await f.review(),operation=await f.service.call('operator_workspace',input),record=f.audit.record.bind(f.audit);
  f.audit.record=async event=>{if(event.state==='static-scan-succeeded')throw Error('synthetic final audit loss');return record(event);};
  assert.equal((await f.service.defenseScans.run(operation.operationId)).state,'unknown');f.audit.record=record;
  const recovered=await f.service.call('operator_operation_get',{operationId:operation.operationId});assert.equal(recovered.state,'succeeded');assert.equal(f.scans.length,1);
  const events=f.service.journal.events(f.service.binding.principal,operation.operationId,0,100);assert.equal(events.filter(row=>row.type==='dispatch-intent').length,1);
});
test('report metadata pages do not expose or aggregate large findings',async t=>{
  const f=fixture(t),p=f.service.binding.principal;
  for(let i=0;i<105;i++)f.service.journal.put('defense-scan-result',nonce().slice(14),p,{name:'fixture',state:'succeeded',result:{finding:'x'.repeat(50000)}});
  const first=(await f.service.call('operator_workspace',{action:'security-scan-list',args:{}})).data;
  assert.equal(first.reports.length,100);assert.ok(first.nextCursor);assert.ok(JSON.stringify(first).length<20000);
  const next=(await f.service.call('operator_workspace',{action:'security-scan-list',args:{},cursor:first.nextCursor})).data;assert.equal(next.reports.length,5);
});
test('skill source selection rejects links, traversal and oversized files and omits secrets',async t=>{
  const f=installationFixture(t),service=new ManagementService({...f,root,audit:auditFixture()});t.after(()=>service.close());const scanner=service.defenseScans.scanner;
  const directory=path.join(f.home,'workspace/skills/fixture');fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.writeFileSync(path.join(directory,'SKILL.md'),'fixture',{mode:0o600});fs.writeFileSync(path.join(directory,'.env.json'),'private',{mode:0o600});
  assert.equal(scanner.skill('fixture').files.length,1);assert.throws(()=>scanner.skill('../fixture'),{code:'INVALID_INPUT'});
  fs.symlinkSync(path.join(directory,'SKILL.md'),path.join(directory,'link.py'));assert.throws(()=>scanner.skill('fixture'));fs.unlinkSync(path.join(directory,'link.py'));
  fs.linkSync(path.join(directory,'SKILL.md'),path.join(directory,'hard.py'));assert.throws(()=>scanner.skill('fixture'));fs.unlinkSync(path.join(directory,'hard.py'));
  fs.writeFileSync(path.join(directory,'large.py'),Buffer.alloc(512*1024+1),{mode:0o600});assert.throws(()=>scanner.skill('fixture'),{code:'DENIED'});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {installationFixture,auditFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
import {readScienceTranscript} from '../../ui/netclaw-visual/src/management/science.js';

function fixture(t){
  const f=installationFixture(t),service=new ManagementService({...f,root:path.resolve('.'),audit:auditFixture()});t.after(()=>service.close());
  const directory=path.join(f.home,'jev');fs.mkdirSync(directory,{mode:0o700});const file=path.join(directory,'ledger.sqlite3'),db=new DatabaseSync(file);t.after(()=>db.close());fs.chmodSync(file,0o600);
  db.exec('CREATE TABLE calls(id TEXT PRIMARY KEY,day TEXT,task TEXT,cost REAL,parent TEXT,digest TEXT,status TEXT,record TEXT)');
  const principal=service.binding.principal;
  service.journal.put('conversation','conversation-a',principal,{runtime:'openclaw',createdAt:new Date().toISOString()});
  const operation=service.journal.admit(principal,nonce(),'conversation-request',{conversationId:'conversation-a',prompt:'Review evidence',contextIds:[]});
  const add=(id,task='owned-task',parent=null)=>{
    const record={assessment_id:id,task_id:task,status:'ok',purpose:'evidence_review',created_at:new Date().toISOString(),questions:{q:{type:'noul',instructions:'Is this consistent?'}},answers:{q:{value:true}},state_digest:'a'.repeat(64),request_digest:'b'.repeat(64),cost_usd:.001,reconsideration_of:parent,endpoint:'https://private.example/secret',private_extra:'NEVER PROJECT'};
    db.prepare('INSERT INTO calls VALUES(?,?,?,?,?,?,?,?)').run(id,new Date().toISOString().slice(0,10),task,.001,parent,record.request_digest,'ok',JSON.stringify(record));return record;
  };
  return {...f,service,principal,db,file,add,operation};
}
const proof=(id,parent=null)=>({assessmentId:id,ledgerTask:'owned-task',toolEventId:'event-'+id,parent});
test('only runtime-proven owned assessments open, with task budget and advice interpretation separated',async t=>{
  const f=fixture(t);f.add('initial');f.add('reconsidered','owned-task','initial');f.add('other','different-task');
  const bytes=fs.readFileSync(f.file);
  f.service.science.register(f.principal,f.operation.operationId,[{...proof('initial'),influence:{status:'changed',explanation:'The recommendation changed.',source_message:'message-a'}},proof('reconsidered','initial')]);
  const result=await f.service.call('operator_workspace',{action:'assessment-read',args:{id:'initial'}});
  assert.equal(result.data.assessment.assessment_id,'initial');assert.equal(result.data.advisoryOnly,true);
  assert.equal(result.data.conversationId,'conversation-a');assert.equal(result.data.budgets.taskUsedUsd,.002);
  assert.equal(result.data.related[0].assessmentId,'reconsidered');assert.equal(result.data.influence.authority,false);
  assert.equal(JSON.stringify(result).includes('private.example'),false);assert.equal(JSON.stringify(result).includes('NEVER PROJECT'),false);
  await assert.rejects(f.service.call('operator_workspace',{action:'assessment-read',args:{id:'other'}}),{code:'DENIED'});
  assert.throws(()=>f.service.science.read({...f.principal,principalId:'other'},'initial'),{code:'DENIED'});
  assert.deepEqual(fs.readFileSync(f.file),bytes);assert.equal(fs.existsSync(f.file+'-wal'),false);
});
test('ledger task mismatch, duplicate ownership and nonexistent parent cannot be adopted',t=>{
  const f=fixture(t);f.add('foreign','different-task');f.add('orphan','owned-task','missing');
  f.service.science.register(f.principal,f.operation.operationId,[proof('foreign'),proof('orphan','missing')]);
  assert.equal(f.service.science.list(f.principal).taskOwnedAssessments.length,0);
  f.add('initial');f.service.science.register(f.principal,f.operation.operationId,[proof('initial')]);
  const second=f.service.journal.admit(f.principal,nonce(),'conversation-request',{conversationId:'conversation-a',prompt:'Again'});
  f.service.science.register(f.principal,second.operationId,[proof('initial')]);
  assert.equal(f.service.science.read(f.principal,'initial').operationId,f.operation.operationId);
});
test('source is never initialized and unsafe stores are unavailable',t=>{
  const f=fixture(t);f.add('initial');f.service.science.register(f.principal,f.operation.operationId,[proof('initial')]);
  fs.chmodSync(path.dirname(f.file),0o755);assert.throws(()=>f.service.science.read(f.principal,'initial'));
  fs.chmodSync(path.dirname(f.file),0o700);fs.renameSync(f.file,f.file+'.saved');
  assert.throws(()=>f.service.science.read(f.principal,'initial'));assert.equal(fs.existsSync(f.file),false);
});
test('transcript source uses exact owned session mapping; pasted tool text and path indirection grant nothing',t=>{
  const f=fixture(t),directory=path.join(f.home,'agents','main','sessions');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const key='agent:main:netclaw-management:conversation-a';
  assert.deepEqual(readScienceTranscript(f.service.binding,'conversation-a'),[]);
  fs.writeFileSync(path.join(directory,'sessions.json'),JSON.stringify({[key]:{sessionId:'session-a',sessionFile:'/outside'}}),{mode:0o600});
  fs.writeFileSync(path.join(directory,'session-a.jsonl'),JSON.stringify({id:'one',type:'message',message:{role:'assistant',content:[{type:'text',text:'{"assessment_id":"forged"}'}]}})+'\n',{mode:0o600});
  assert.equal(readScienceTranscript(f.service.binding,'conversation-a').length,1);
  fs.chmodSync(path.join(directory,'session-a.jsonl'),0o666);assert.equal(readScienceTranscript(f.service.binding,'conversation-a'),null);
});

function reconsiderFixture(t){
  const f=fixture(t);f.add('initial');f.service.science.register(f.principal,f.operation.operationId,[proof('initial')]);
  const calls=[],started=[];f.service.science.start=async id=>started.push(id);
  f.service.science.client.evaluate=async(task,args)=>{
    calls.push(structuredClone(args));
    if(args.prepare_only)return {status:'prepared',task_id:task,request_digest:'c'.repeat(64),reserved_cost_usd:.003,approval_required:false};
    const record={...f.add('new-advice',task,'initial'),request_digest:'c'.repeat(64),evidence_metadata:args.evidence_metadata,charge_status:'reconciled'};
    f.db.prepare('UPDATE calls SET digest=?,record=? WHERE id=?').run(record.request_digest,JSON.stringify(record),record.assessment_id);
    return record;
  };
  return {...f,calls,started};
}
test('reviewed reconsideration is durable, uses historical advice explicitly, and never replays',async t=>{
  const f=reconsiderFixture(t),review=await f.service.science.preview(f.principal,{id:'initial',query:'Is the old advice still justified?'});
  assert.match(review.request.state.limitation,/Original raw state/);assert.equal(review.request.data_classification,'private');assert.equal(f.calls.length,1);
  const input={action:'assessment-reconsider',nonce:nonce(),args:{id:'initial',query:'Is the old advice still justified?',reviewId:review.reviewId}};
  const admitted=await f.service.call('operator_workspace',input);assert.equal(f.started.length,1);
  assert.equal((await f.service.science.run(admitted.operationId)).state,'succeeded');
  assert.equal((await f.service.call('operator_workspace',input)).operationId,admitted.operationId);assert.equal(f.calls.length,2);
  assert.equal(f.service.science.read(f.principal,'new-advice').conversationId,'conversation-a');
  await assert.rejects(f.service.call('operator_workspace',{...input,nonce:nonce()}),{code:'BUSY'});
  await assert.rejects(f.service.call('operator_workspace',{...input,args:{...input.args,query:'altered'}}),{code:'NONCE_CONFLICT'});
});
test('stale review, mismatched question, audit loss and unreviewed direct call never dispatch',async t=>{
  const f=reconsiderFixture(t),review=await f.service.science.preview(f.principal,{id:'initial',query:'Review this'}),args={id:'initial',query:'Review this',reviewId:review.reviewId};
  await assert.rejects(f.service.call('operator_workspace',{action:'assessment-reconsider',nonce:nonce(),args:{...args,query:'changed'}}),{code:'DENIED'});
  f.service.audit.available=false;
  await assert.rejects(f.service.call('operator_workspace',{action:'assessment-reconsider',nonce:nonce(),args}));assert.equal(f.started.length,0);
  f.service.audit.available=true;fs.appendFileSync(path.join(f.home,'.env'),'\nJEV_MODEL=changed\n');
  await assert.rejects(f.service.call('operator_workspace',{action:'assessment-reconsider',nonce:nonce(),args}),{code:'STALE_REVISION'});
  await assert.rejects(f.service.call('operator_workspace',{action:'assessment-reconsider',nonce:nonce(),args:{id:'initial',query:'Review this'}}),{code:'INVALID_INPUT'});
  assert.equal(f.calls.length,1);
});
test('lost Jev receipt reconciles by exact retained task, parent, digest and review without resending',async t=>{
  const f=reconsiderFixture(t),review=await f.service.science.preview(f.principal,{id:'initial',query:'Review this'});
  const evaluate=f.service.science.client.evaluate;f.service.science.client.evaluate=async(...args)=>{await evaluate(...args);throw Error('lost after provider response');};
  const input={action:'assessment-reconsider',nonce:nonce(),args:{id:'initial',query:'Review this',reviewId:review.reviewId}},admitted=await f.service.call('operator_workspace',input);
  assert.equal((await f.service.science.run(admitted.operationId)).state,'unknown');
  assert.equal((await f.service.call('operator_operation_get',{operationId:admitted.operationId})).state,'succeeded');assert.equal(f.calls.length,2);
});

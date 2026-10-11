import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

test('actual Jev MCP and detached reconsideration worker preserve task, budgets, ledger and no-replay after facade exit',{
  skip:!process.env.NETCLAW_TEST_JEV_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:90000,
},async t=>{
  const f=installationFixture(),root=fileURLToPath(new URL('../../',import.meta.url)),received=[];
  const provider=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const payload=JSON.parse(Buffer.concat(chunks));received.push(payload);
    const answers=Object.fromEntries(Object.entries(payload.questions).map(([key,q])=>[key,q.type==='noul'?{type:'noul',noul:.8}:{type:'choice',choice:'insufficient',confidence:.9,probabilities:{retain:0,revise:0,insufficient:1}}]));
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({model:payload.model,answers,usage:{input_tokens:100,output_tokens:10}}));
  });await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
  fs.mkdirSync(path.join(f.home,'jev'),{mode:0o700});fs.symlinkSync(path.dirname(path.dirname(process.env.NETCLAW_TEST_JEV_PYTHON)),path.join(f.home,'jev-venv'));
  fs.appendFileSync(path.join(f.home,'.env'),`\nJEV_ENABLED=true\nJEV_BASE_URL=http://127.0.0.1:${provider.address().port}/v1/systemone\nJEV_MODEL=fixture-jev\nJEV_INPUT_PRICE_PER_MILLION=.042\n`);
  let service=new ManagementService({...f,root}),worker;
  t.after(async()=>{await service.close();await new Promise(resolve=>provider.close(resolve));if(worker){const deadline=Date.now()+5000;while(Date.now()<deadline){try{process.kill(worker,0);}catch{break;}await new Promise(resolve=>setTimeout(resolve,50));}}f.cleanup();});
  const principal=service.binding.principal,task='science-process-fixture',revision=service.science.client.configuration(task).revision;
  const original=await service.science.client.evaluate(task,{state:'A synthetic historical link observation.',questions:{q:{type:'noul',instructions:'Does the evidence describe a link observation?'}},purpose:'evidence_review',evidence_metadata:[{source:'synthetic-process-test'}]},revision);
  assert.equal(original.status,'ok',JSON.stringify(original));assert.equal(received.length,1);
  // This test qualifies the real Jev boundary and worker. The originating
  // OpenClaw transcript proof is deliberately synthetic, not runtime acceptance.
  service.journal.put('conversation','science-conversation',principal,{runtime:'openclaw',createdAt:new Date().toISOString()});
  const initial=service.journal.admit(principal,nonce(),'conversation-request',{conversationId:'science-conversation',prompt:'Synthetic original request'});
  service.science.register(principal,initial.operationId,[{assessmentId:original.assessment_id,ledgerTask:task,toolEventId:'fixture-proof',parent:null}]);
  const ledger=path.join(f.home,'jev','ledger.sqlite3'),before=fs.readFileSync(ledger);
  const detail=await service.call('operator_workspace',{action:'assessment-read',args:{id:original.assessment_id}});assert.deepEqual(fs.readFileSync(ledger),before);assert.equal(detail.data.budgets.taskUsedUsd,100*.042/1_000_000);
  const query='Is a historical link report sufficient to assess current application health?';
  const preview=await service.call('operator_workspace',{action:'assessment-preview',args:{id:original.assessment_id,query}});
  assert.equal(received.length,1);assert.equal(preview.data.prepared.approval_required,false);assert.equal(preview.data.prepared.reserved_cost_usd,65536*.042/1_000_000);
  const input={action:'assessment-reconsider',nonce:nonce(),args:{id:original.assessment_id,query,reviewId:preview.data.reviewId}};
  const admitted=await service.call('operator_workspace',input);await service.close();service=new ManagementService({...f,root});
  let result;const deadline=Date.now()+60000;
  do{result=await service.call('operator_operation_get',{operationId:admitted.operationId});if(['succeeded','failed','unknown'].includes(result.state))break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);
  worker=JSON.parse(service.journal._row(admitted.operationId).worker||'null')?.pid;
  assert.equal(result.state,'succeeded',JSON.stringify(result));assert.equal(received.length,2);
  assert.equal((await service.call('operator_workspace',input)).operationId,admitted.operationId);assert.equal(received.length,2);
  const reconsidered=await service.call('operator_workspace',{action:'assessment-read',args:{id:result.result.assessmentId}});
  assert.equal(reconsidered.data.assessment.reconsideration_of,original.assessment_id);assert.equal(reconsidered.data.conversationId,'science-conversation');assert.equal(reconsidered.data.budgets.taskUsedUsd,2*(100*.042/1_000_000));
  assert.equal(reconsidered.data.assessment.answers.reconsider.choice,'insufficient');assert.equal((await service.audit.log()).ok,true);
  // A second direct tool evaluation remains barred by the actual Jev ledger.
  const repeated=await service.science.client.evaluate(task,preview.data.request,revision);assert.equal(repeated.status,'invalid_request');assert.equal(received.length,2);
  const budgetFile=path.join(f.home,'jev','settings.json');fs.writeFileSync(budgetFile,JSON.stringify({daily_limit_usd:0}),{mode:0o600});
  const nextRevision=service.science.client.configuration(task).revision;
  const denied=await service.science.client.evaluate(task,{state:'Synthetic new advice',questions:{q:{type:'noul',instructions:'Enough evidence?'}},purpose:'evidence_review',evidence_metadata:[]},nextRevision);
  assert.equal(denied.status,'budget_exhausted');assert.equal(received.length,2);
});

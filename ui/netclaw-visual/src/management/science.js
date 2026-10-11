import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ownedDirectory,readOwned} from './files.js';
import {environment} from './configuration.js';
import {withSqliteSnapshot} from './sqlite-snapshot.js';
import {invariant,safeError} from './errors.js';
import {projectAssessment,safeId} from '../hud-server/bindings.js';
import {gatewayAgentId} from '../hud-server/gateway-agent.js';
import {JevClient} from './jev-client.js';

/** Only an owned runtime transcript's exact session mapping is a proof source.
 * Missing initial mapping is empty; unreadable/unsafe history is unqualified. */
export function readScienceTranscript(binding,conversationId){
  if(binding.kind!=='openclaw')return null;
  try{
    binding.assertCurrent();invariant(safeId(conversationId));
    const agent=gatewayAgentId(JSON.parse(readOwned(binding.configPath)));
    const directory=path.join(binding.home,'agents',agent,'sessions');ownedDirectory(directory);
    const bytes=readOwned(path.join(directory,'sessions.json'),{limit:8*1024*1024,missing:true});if(!bytes)return [];
    const session=JSON.parse(bytes)[`agent:${agent}:netclaw-management:${conversationId}`];if(!session)return [];
    invariant(safeId(session.sessionId)&&!session.sessionId.includes('..'),'SOURCE_UNAVAILABLE');
    const transcript=readOwned(path.join(directory,session.sessionId+'.jsonl'),{limit:8*1024*1024});
    const events=transcript.toString().split('\n').filter(Boolean);invariant(events.length<=20000,'SOURCE_UNAVAILABLE');
    return events.map(line=>JSON.parse(line));
  }catch(error){if(error.code==='IDENTITY_CHANGED')throw error;return null;}
}
const validTask=value=>typeof value==='string'&&/^[A-Za-z0-9_.:/-]{1,128}$/.test(value);
const finite=value=>{invariant(typeof value==='number'&&Number.isFinite(value)&&value>=0,'INCOMPATIBLE');return value;};

export class ScienceOfficer{
  constructor({binding,journal,root,audit,start,clean=value=>value}){Object.assign(this,{binding,journal,audit,start,clean});this.client=new JevClient(binding,root);}
  authority(principal){this.binding.assertCurrent();invariant(principal.surface==='operator'&&principal.principalId===this.binding.principal.principalId,'DENIED');}
  directory(){
    const configured=environment(this.binding).JEV_DATA_DIR||path.join(this.binding.home,'jev');
    invariant(path.isAbsolute(configured)&&!/[\0\r\n]/.test(configured),'INCOMPATIBLE');ownedDirectory(configured);return configured;
  }
  ledger(id,task){
    invariant(safeId(id)&&validTask(task),'DENIED');const directory=this.directory(),env=environment(this.binding);
    const settingsBytes=readOwned(path.join(directory,'settings.json'),{missing:true,limit:1024*1024}),settings=settingsBytes?JSON.parse(settingsBytes):{};
    invariant(settings&&typeof settings==='object'&&!Array.isArray(settings),'INCOMPATIBLE');
    const dailyLimitUsd=finite(Object.hasOwn(settings,'daily_limit_usd')?settings.daily_limit_usd:Number(env.JEV_DAILY_LIMIT_USD??5));
    const taskLimitUsd=finite(settings.case_overrides&&Object.hasOwn(settings.case_overrides,task)?settings.case_overrides[task]:Object.hasOwn(settings,'case_limit_usd')?settings.case_limit_usd:Number(env.JEV_CASE_LIMIT_USD??.25));
    return withSqliteSnapshot(this.binding,path.join(directory,'ledger.sqlite3'),db=>{
      invariant(db.prepare("SELECT type FROM sqlite_master WHERE name='calls'").get()?.type==='table','INCOMPATIBLE');
      const row=db.prepare('SELECT record FROM calls WHERE id=? AND task=? AND length(record)<=262144').get(id,task);invariant(row,'DENIED');
      const record=JSON.parse(row.record);invariant(record.assessment_id===id&&record.task_id===task,'DENIED');
      const dailyUsedUsd=db.prepare('SELECT coalesce(sum(cost),0) AS total FROM calls WHERE day=?').get(new Date().toISOString().slice(0,10)).total;
      const taskUsedUsd=db.prepare('SELECT coalesce(sum(cost),0) AS total FROM calls WHERE task=?').get(task).total;
      return {record,budgets:{dailyLimitUsd,taskLimitUsd,dailyUsedUsd:finite(dailyUsedUsd),taskUsedUsd:finite(taskUsedUsd),source:'Jev ledger charges, including retained reservations; UTC daily total and originating task total'}};
    });
  }
  register(principal,operationId,proofs){
    this.authority(principal);
    const operation=this.journal._row(operationId);this.journal._owned(principal,operation);
    invariant(['conversation-request','assessment-reconsider'].includes(operation.kind),'DENIED');
    const input=JSON.parse(operation.input),conversationId=input.conversationId||this.journal.record('assessment',input.args.id,principal).conversationId;
    this.journal.record('conversation',conversationId,principal);
    const existing=this.journal.records('assessment',principal),registered=[];
    for(const proof of (Array.isArray(proofs)?proofs:[]).slice(0,64)){
      if(!safeId(proof.assessmentId)||!validTask(proof.ledgerTask)||!safeId(proof.toolEventId)||existing.some(row=>row.id===proof.assessmentId))continue;
      try{
        const {record}=this.ledger(proof.assessmentId,proof.ledgerTask);
        invariant((record.reconsideration_of||null)===(proof.parent||null),'DENIED');
        if(proof.parent){const parent=this.journal.record('assessment',proof.parent,principal);invariant(parent.conversationId===conversationId&&parent.ledgerTask===proof.ledgerTask&&!parent.parent&&!existing.some(row=>row.parent===proof.parent),'DENIED');}
        const influence=proof.influence&&['supported','challenged','changed','unavailable'].includes(proof.influence.status)&&typeof proof.influence.explanation==='string'?{status:proof.influence.status,explanation:proof.influence.explanation.slice(0,4000),sourceMessage:String(proof.influence.source_message||'').slice(0,128),source:'Runtime-authored interpretation; not an assessment proof or approval',authority:false}:null;
        const value={assessmentId:proof.assessmentId,conversationId,operationId,ledgerTask:proof.ledgerTask,toolEventId:proof.toolEventId,parent:proof.parent||null,influence,registeredAt:new Date().toISOString()};
        this.journal.put('assessment',proof.assessmentId,principal,value);existing.push({id:proof.assessmentId,...value});registered.push(proof.assessmentId);
      }catch(error){if(error.code==='IDENTITY_CHANGED')throw error;/* Unverifiable tool output creates no ownership. */}
    }return registered;
  }
  list(principal){
    this.authority(principal);
    return {enabled:['true','1','yes'].includes((environment(this.binding).JEV_ENABLED||'').toLowerCase()),role:'advice-only',
      taskOwnedAssessments:this.journal.records('assessment',principal).map(({ledgerTask,...row})=>row),
      source:'Management-owned runtime tool-result proofs, resolved against the originating Jev task ledger',
      qualification:this.binding.kind==='hermes'?'Protected Hermes does not yet expose qualified Jev assessment proofs. No global latest assessment is adopted.':'Only new Jev tool calls with matching retained ledger records create an assessment link. Prose, imported Canvas and unrelated HUD sessions cannot create ownership.'};
  }
  read(principal,id){
    this.authority(principal);const ref=this.journal.record('assessment',id,principal);
    const {record,budgets}=this.ledger(id,ref.ledgerTask);
    invariant((record.reconsideration_of||null)===ref.parent,'IDENTITY_CHANGED');
    const related=this.journal.records('assessment',principal).filter(row=>row.conversationId===ref.conversationId&&(row.parent===id||ref.parent===row.id)).map(row=>({assessmentId:row.id,parent:row.parent,operationId:row.operationId}));
    return {assessment:projectAssessment(record),conversationId:ref.conversationId,operationId:ref.operationId,advisoryOnly:true,budgets,related,influence:ref.influence,
      evidenceSource:'Retained Jev ledger; ownership established by the exact originating runtime tool result. Assessment advice cannot approve or execute changes.'};
  }
  async preview(principal,{id,query}){
    this.authority(principal);invariant(typeof query==='string'&&query.trim()&&query.length<=4000);
    const ref=this.journal.record('assessment',id,principal),original=this.read(principal,id);
    invariant(!ref.parent&&original.assessment.status==='ok'&&original.related.length===0,'DENIED');
    const reviewId=randomUUID(),configuration=this.client.configuration(ref.ledgerTask);
    // Historical typed advice is the explicit evidence for this new question.
    // Do not pretend the original raw network state was retained by Jev.
    const args={state:{previousAssessment:original.assessment,operatorQuestion:query,limitation:'Reviewing retained typed advice and the new question. Original raw state and current network observations are not included.'},
      questions:{reconsider:{type:'choice',instructions:'Given this limited historical evidence and the operator question, should the earlier advice be retained, revised, or treated as insufficient?',criteria:{retain:'Retain the earlier advice',revise:'Revise the earlier advice',insufficient:'The supplied evidence is insufficient'}}},
      purpose:'answer_review',evidence_metadata:[{source:'Management-owned retained Jev assessment',assessmentId:id,conversationId:ref.conversationId,reviewId}],data_classification:'private',reconsideration_of:id};
    const prepared=await this.client.evaluate(ref.ledgerTask,{...args,prepare_only:true},configuration.revision);this.authority(principal);
    invariant(prepared.status==='prepared'&&prepared.task_id===ref.ledgerTask&&typeof prepared.request_digest==='string','SOURCE_UNAVAILABLE');
    invariant(this.client.configuration(ref.ledgerTask).revision===configuration.revision,'STALE_REVISION');
    this.journal.put('assessment-review',reviewId,principal,{id,query,args,configurationRevision:configuration.revision,requestDigest:prepared.request_digest,expiresAt:Date.now()+900000});
    return {reviewId,assessmentId:id,conversationId:ref.conversationId,advisoryOnly:true,request:args,prepared,budgets:original.budgets,
      notice:'At most one reconsideration is admitted by Jev. Its result is advice only. A remote destination requires the exact local disclosure grant shown by Jev; confirming this view cannot grant it.'};
  }
  reviewed(principal,input){
    this.authority(principal);const review=this.journal.record('assessment-review',input.args.reviewId,principal);
    invariant(review.id===input.args.id&&review.query===input.args.query,'DENIED');invariant(review.expiresAt>Date.now(),'EXPIRED');
    const ref=this.journal.record('assessment',review.id,principal);
    invariant(this.client.configuration(ref.ledgerTask).revision===review.configurationRevision,'STALE_REVISION');
    return {review,ref};
  }
  async reconsider(principal,input){
    this.authority(principal);
    if(this.journal.byNonce(principal,input.nonce))return this.journal.admit(principal,input.nonce,'assessment-reconsider',input);
    this.reviewed(principal,input);const lock=this.journal.lock('assessment:'+input.args.id,principal.principalId);let operation;
    try{
      const active=this.journal.list(principal).some(row=>row.kind==='assessment-reconsider'&&!['failed','cancelled','denied','expired'].includes(row.state)&&JSON.parse(this.journal._row(row.operationId).input).args.id===input.args.id);
      invariant(!active,'BUSY');
      operation=this.journal.admit(principal,input.nonce,'assessment-reconsider',input);
      await this.audit.record({operationId:operation.operationId,state:'assessment-reconsider-admitted'});this.reviewed(principal,input);
      await this.start(operation.operationId);return this.journal.get(principal,operation.operationId);
    }catch(error){if(operation&&this.journal.get(principal,operation.operationId).state==='admitted')this.journal.transition(operation.operationId,'failed',safeError(error));throw error;}
    finally{this.journal.unlock('assessment:'+input.args.id,lock);}
  }
  async run(operationId){
    const principal=this.binding.principal;this.authority(principal);
    const lease=this.journal.claim(operationId,{pid:process.pid,start:new Date().toISOString()});if(!lease)return;
    let dispatched=false,heartbeatFailed=false;const timer=setInterval(()=>{try{this.journal.renew(operationId,lease);}catch{heartbeatFailed=true;}},5000);timer.unref();
    try{
      const input=this.journal.input(operationId,lease);invariant(this.journal._row(operationId).kind==='assessment-reconsider','DENIED');
      const {review,ref}=this.reviewed(principal,input);
      await this.audit.record({operationId,state:'before-assessment-reconsider'});this.reviewed(principal,input);invariant(!heartbeatFailed,'UNKNOWN_OUTCOME');
      this.journal.attachReference(operationId,lease,input.args.reviewId);this.journal.event(operationId,'dispatch-intent',{source:'Existing Jev evaluation tool'});dispatched=true;
      const value=await this.client.evaluate(ref.ledgerTask,review.args,review.configurationRevision);this.authority(principal);invariant(!heartbeatFailed,'UNKNOWN_OUTCOME');
      const terminal=this.result(principal,operationId,review,ref,value);
      await this.audit.record({operationId,state:'assessment-reconsider-'+terminal.state});
      return this.journal.finish(operationId,lease,terminal.state,this.clean(terminal.result));
    }catch(error){return this.journal.finish(operationId,lease,dispatched?'unknown':'failed',dispatched?{code:'UNKNOWN_OUTCOME'}:safeError(error));}
    finally{clearInterval(timer);}
  }
  result(principal,operationId,review,ref,value){
    if(!value.assessment_id){
      invariant(['approval_required','disabled','budget_exhausted','invalid_request','incompatible_provider','stale_configuration'].includes(value.status),'UNKNOWN_OUTCOME');
      return {state:'failed',result:{status:value.status,advisoryOnly:true,message:typeof value.message==='string'?value.message:'Jev declined the request before provider dispatch.'}};
    }
    invariant(value.task_id===ref.ledgerTask&&value.request_digest===review.requestDigest&&value.reconsideration_of===review.id&&value.status!=='pending','UNKNOWN_OUTCOME');
    const ids=this.register(principal,operationId,[{assessmentId:value.assessment_id,ledgerTask:ref.ledgerTask,parent:review.id,toolEventId:'management:'+operationId}]);
    invariant(ids.includes(value.assessment_id)||this.journal.record('assessment',value.assessment_id,principal).operationId===operationId,'UNKNOWN_OUTCOME');
    return {state:value.status==='ok'?'succeeded':'failed',result:{assessmentId:value.assessment_id,status:value.status,advisoryOnly:true,source:'Existing Jev tool and matching task ledger',chargeStatus:value.charge_status||'unknown'}};
  }
  async reconcile(principal,operationId){
    this.authority(principal);const operation=this.journal.get(principal,operationId);
    if(operation.kind!=='assessment-reconsider'||operation.state!=='unknown'||!operation.externalReference)return operation;
    const input=JSON.parse(this.journal._row(operationId).input),review=this.journal.record('assessment-review',input.args.reviewId,principal),ref=this.journal.record('assessment',review.id,principal);
    // Do not resend on transport loss. Only a matching parent/task/digest and
    // review ID in the authoritative ledger can settle this exact operation.
    let rows;try{rows=withSqliteSnapshot(this.binding,path.join(this.directory(),'ledger.sqlite3'),db=>db.prepare('SELECT record FROM calls WHERE task=? AND parent=? AND digest=? AND length(record)<=262144 LIMIT 2').all(ref.ledgerTask,review.id,review.requestDigest));}catch{return operation;}
    if(rows.length!==1)return operation;const record=JSON.parse(rows[0].record);
    if(record.status==='pending'||!record.evidence_metadata?.some(item=>item.reviewId===input.args.reviewId))return operation;
    const terminal=this.result(principal,operationId,review,ref,record);await this.audit.record({operationId,state:'assessment-reconsider-reconciled'});this.authority(principal);
    return this.journal.reconcile(operationId,operation.externalReference,terminal.state,this.clean(terminal.result));
  }
}

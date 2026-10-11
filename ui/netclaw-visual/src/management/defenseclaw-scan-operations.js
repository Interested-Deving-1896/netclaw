import {randomUUID} from 'node:crypto';
import {digest} from './journal.js';
import {invariant,safeError} from './errors.js';
import {SCAN_PROFILE} from './defenseclaw-scanner.js';

export class DefenseScans{
  constructor({binding,journal,audit,scanner,start,clean=value=>value}){Object.assign(this,{binding,journal,audit,scanner,start,clean});}
  authority(principal){this.binding.assertCurrent();invariant(principal.surface==='operator'&&principal.principalId===this.binding.principal.principalId&&principal.installationId===this.binding.installationId,'DENIED');}
  status(){
    this.binding.assertCurrent();
    try{const record=this.scanner.read();return {bound:true,profile:SCAN_PROFILE,versions:record.probe.versions,scope:'Existing scanner binding; package/source validation runs during explicit preview and dispatch. Local installed skills only; other scanner families and platform release acceptance remain separate.'};}
    catch(error){if(error.code==='IDENTITY_CHANGED')throw error;return {bound:false,reason:'Bind the existing supported scanner environment on the backend before requesting a scan.'};}
  }
  list(principal,input){
    this.authority(principal);const scanner=this.status();
    const page=this.journal.recordPage('defense-scan-result',principal,input);
    return {scanner,reports:page.items.map(({result,...metadata})=>metadata),...(page.nextCursor?{nextCursor:page.nextCursor}:{}),operations:this.journal.list(principal).filter(row=>row.kind==='defense-scan').map(({result,...metadata})=>metadata),scope:'Owned completed scan report metadata and scan requests among the latest 100 management operations. No scanner starts when this view opens.'};
  }
  read(principal,id){this.authority(principal);return this.journal.record('defense-scan-result',id,principal);}
  reviewed(principal,reviewId,{live=true}={}){
    this.authority(principal);const review=this.journal.record('defense-scan-review',reviewId,principal);
    invariant(review.installationId===this.binding.installationId&&review.profile===SCAN_PROFILE,'IDENTITY_CHANGED');
    if(live)invariant(review.expiresAt>Date.now(),'EXPIRED');return review;
  }
  async preview(principal,{name}){
    this.authority(principal);const record=this.scanner.read();await this.scanner.verify(record);this.authority(principal);
    const selected=this.scanner.skill(name),reviewId=randomUUID(),review={installationId:this.binding.installationId,profile:SCAN_PROFILE,name,scannerRevision:digest(record),sourceRevision:selected.revision,source:selected.source,expiresAt:Date.now()+300000};
    this.journal.put('defense-scan-review',reviewId,principal,review);
    return {reviewId,name,profile:SCAN_PROFILE,sourceRevision:review.sourceRevision,files:selected.source.manifest.map(file=>({path:file.path,sha256:file.sha256})),bytes:selected.source.bytes,omittedEntries:selected.source.omittedEntries,expiresAt:review.expiresAt,
      disclosure:'Scan a private snapshot of these installed skill files using the bundled balanced static profile. Ignored directories, environment files and unsupported file types are omitted. No model, external scanner, skill execution, custom rule pack, installation, quarantine, rule edit or enforcement is requested. Findings are analysis, not proof of safety. Cancelling stops only this owned scanner process.'};
  }
  async validate(principal,reviewId){
    const review=this.reviewed(principal,reviewId),record=this.scanner.read();invariant(digest(record)===review.scannerRevision,'STALE_REVISION');
    await this.scanner.verify(record);this.reviewed(principal,reviewId);
    const selected=this.scanner.skill(review.name);invariant(selected.revision===review.sourceRevision,'STALE_REVISION');return {review,record,selected};
  }
  async submit(principal,input){
    this.authority(principal);const existing=this.journal.byNonce(principal,input.nonce);
    if(existing){
      const operation=this.journal.admit(principal,input.nonce,'defense-scan',input);
      if(operation.state==='admitted'){await this.validate(principal,input.args.reviewId);await this.audit.record({operationId:operation.operationId,state:'resume-owned-scan-admission'});await this.start(operation.operationId);}
      return this.journal.get(principal,operation.operationId);
    }
    const {review}=await this.validate(principal,input.args.reviewId),lock=this.journal.lock('defense-scan-admission',principal.principalId);let operation;
    try{
      const active="o.kind='defense-scan' AND o.state IN ('admitted','running','cancellation-requested','unknown')";
      const sameSkill=this.journal.db.prepare(`SELECT 1 FROM operations o JOIN records r ON r.kind='defense-scan-review' AND r.id=json_extract(o.input,'$.args.reviewId') WHERE ${active} AND json_extract(r.value,'$.name')=? LIMIT 1`).get(review.name);
      const count=this.journal.db.prepare(`SELECT count(*) AS total FROM operations o WHERE ${active} AND o.state!='unknown'`).get().total;
      invariant(!sameSkill&&count<2,'BUSY');
      operation=this.journal.admit(principal,input.nonce,'defense-scan',input);
      await this.audit.record({operationId:operation.operationId,state:'scan-admitted',profile:SCAN_PROFILE,sourceRevision:review.sourceRevision});this.reviewed(principal,input.args.reviewId);
      await this.start(operation.operationId);return this.journal.get(principal,operation.operationId);
    }catch(error){if(operation&&this.journal.get(principal,operation.operationId).state==='admitted')this.journal.transition(operation.operationId,'failed',safeError(error));throw error;}
    finally{this.journal.unlock('defense-scan-admission',lock);}
  }
  async run(id){
    const principal=this.binding.principal;this.authority(principal);const lease=this.journal.claim(id,{pid:process.pid,start:new Date().toISOString()});if(!lease)return;
    const control=new AbortController();let lostLease=false,dispatched=false;
    const heartbeat=setInterval(()=>{try{this.journal.renew(id,lease);}catch{lostLease=true;control.abort();}},5000);heartbeat.unref();
    const cancel=setInterval(()=>{try{if(this.journal.get(principal,id).state==='cancellation-requested')control.abort();}catch{control.abort();}},250);cancel.unref();
    try{
      invariant(this.journal._row(id).kind==='defense-scan','DENIED');const input=this.journal.input(id,lease),{review,record,selected}=await this.validate(principal,input.args.reviewId);
      await this.audit.record({operationId:id,state:'before-static-scan',sourceRevision:review.sourceRevision});this.reviewed(principal,input.args.reviewId);invariant(!lostLease,'UNKNOWN_OUTCOME');
      if(control.signal.aborted||this.journal.get(principal,id).state==='cancellation-requested')return this.journal.finish(id,lease,'cancelled',{profile:SCAN_PROFILE,source:'Cancelled before scanner launch'});
      this.journal.attachReference(id,lease,id);this.journal.event(id,'dispatch-intent',{profile:SCAN_PROFILE});dispatched=true;
      let state,result;
      try{
        const response=await this.scanner.scan(record,selected,{signal:control.signal});
        state=response.cancelled?'cancelled':'succeeded';result=response.cancelled?{profile:SCAN_PROFILE,confirmedExited:response.confirmedExited,source:'Owned scanner stopped'}:response.data;
      }catch(error){if(!error.confirmedExited)throw error;state='failed';result={profile:SCAN_PROFILE,...safeError(error),confirmedExited:true};}
      this.authority(principal);invariant(!lostLease,'UNKNOWN_OUTCOME');
      const receipt=this.clean({operationId:id,reviewId:input.args.reviewId,name:review.name,sourceRevision:review.sourceRevision,files:review.source.manifest.length,bytes:review.source.bytes,omittedEntries:review.source.omittedEntries,state,result});
      invariant(Buffer.byteLength(JSON.stringify(receipt))<=60000,'SOURCE_UNAVAILABLE');
      this.journal.put('defense-scan-result',id,principal,receipt);
      await this.audit.record({operationId:id,state:'static-scan-'+state});this.authority(principal);
      return this.journal.finish(id,lease,state,receipt);
    }catch(error){return this.journal.finish(id,lease,dispatched?'unknown':'failed',dispatched?{code:'UNKNOWN_OUTCOME'}:safeError(error));}
    finally{clearInterval(heartbeat);clearInterval(cancel);control.abort();}
  }
  async reconcile(principal,id){
    this.authority(principal);const operation=this.journal.get(principal,id);
    if(operation.kind!=='defense-scan'||operation.state!=='unknown'||operation.externalReference!==id)return operation;
    const row=this.journal.db.prepare("SELECT id FROM records WHERE kind='defense-scan-result' AND id=?").get(id);if(!row)return operation;
    const receipt=this.journal.record('defense-scan-result',id,principal),input=JSON.parse(this.journal._row(id).input),review=this.reviewed(principal,input.args.reviewId,{live:false});
    invariant(receipt.operationId===id&&receipt.reviewId===input.args.reviewId&&receipt.sourceRevision===review.sourceRevision&&['succeeded','failed','cancelled'].includes(receipt.state),'DENIED');
    await this.audit.record({operationId:id,state:'static-scan-reconciled'});this.authority(principal);return this.journal.reconcile(id,id,receipt.state,receipt);
  }
  async cancel(principal,input){
    this.authority(principal);invariant(this.journal.get(principal,input.operationId).kind==='defense-scan','DENIED');const cancel=this.journal.admit(principal,input.nonce,'defense-scan-cancel',input);if(cancel.result)return cancel.result;
    this.journal.transition(cancel.operationId,'running');
    try{
      await this.audit.record({operationId:input.operationId,state:'static-scan-cancellation-requested'});this.authority(principal);const state=this.journal.get(principal,input.operationId).state;
      if(state==='admitted')this.journal.transition(input.operationId,'cancelled',{source:'Cancelled before scanner worker claim'});else if(state==='running')this.journal.transition(input.operationId,'cancellation-requested');
      const result=this.journal.get(principal,input.operationId);this.journal.transition(cancel.operationId,'succeeded',result);return result;
    }catch(error){this.journal.transition(cancel.operationId,'failed',safeError(error));throw error;}
  }
}

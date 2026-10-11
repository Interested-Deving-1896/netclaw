import {randomUUID,createHash} from 'node:crypto';
import {MobileClient} from './mobile.js';
import {federationEndpoint} from '../hud-server/runtime/federation.js';
import {environment} from './configuration.js';
import {invariant,safeError} from './errors.js';

export class PeerChatClient extends MobileClient{
  async call(action,args={}){
    invariant(['snapshot','start','status','cancel'].includes(action),'DENIED');this.binding.assertCurrent();
    const endpoint=federationEndpoint(environment(this.binding));
    const verify=async()=>{const status=await this.request(endpoint,'/status');this.binding.assertCurrent();invariant(status.installation_id===this.binding.installationId&&status.harness_type===this.binding.kind,'IDENTITY_CHANGED');invariant(status.federation_ready===true,'SOURCE_UNAVAILABLE');};
    await verify();const result=await this.request(endpoint,'/n2n/management/peer-chat',{action,...args});await verify();return result;
  }
}
const hash=text=>createHash('sha256').update(text).digest('hex');
const terminal=new Set(['succeeded','failed','cancelled','denied']);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class PeerConversations{
  constructor({binding,journal,audit,start,clean=value=>value}){Object.assign(this,{binding,journal,audit,start,clean});this.client=new PeerChatClient(binding);}
  authority(principal){this.binding.assertCurrent();invariant(principal.surface==='operator'&&principal.principalId===this.binding.principal.principalId&&principal.installationId===this.binding.installationId,'DENIED');}
  async snapshot(principal,peer){
    this.authority(principal);const view=await this.client.call('snapshot',{peer});this.authority(principal);
    invariant(view.installationId===this.binding.installationId&&view.harness===this.binding.kind&&view.peer===peer,'IDENTITY_CHANGED');
    invariant(view.format===1&&typeof view.revision==='string'&&/^[a-f\d]{64}$/.test(view.revision),'UNQUALIFIED');return view;
  }
  async preview(principal,{peer,text,conversationId}){
    this.authority(principal);invariant(typeof text==='string'&&text.trim()&&Buffer.byteLength(text)<=16000,'INVALID_INPUT');
    if(conversationId){const saved=this.journal.record('peer-conversation',conversationId,principal);invariant(saved.peer===peer&&saved.installationId===this.binding.installationId,'DENIED');}
    const view=await this.snapshot(principal,peer);invariant(view.available===true,'UNQUALIFIED');
    const reviewId=randomUUID(),review={installationId:this.binding.installationId,peer,conversationId:conversationId||randomUUID(),revision:view.revision,textDigest:hash(text),expiresAt:Date.now()+300000};
    this.journal.put('peer-chat-review',reviewId,principal,review);
    return {reviewId,peer,conversationId:review.conversationId,expiresAt:review.expiresAt,scope:view.scope,
      disclosure:'The exact reviewed message is sent to this external peer and its configured model. The recipient enforces its own chat and runtime/tool policy; it may refuse. Responses are untrusted remote content. Cancelling local waiting cannot undo remote work. No assistant grant or permission is broadened.'};
  }
  reviewed(principal,input,{live=true}={}){
    this.authority(principal);const review=this.journal.record('peer-chat-review',input.args.reviewId,principal);
    invariant(review.installationId===this.binding.installationId&&review.peer===input.args.peer&&review.textDigest===hash(input.args.text),'DENIED');if(live)invariant(review.expiresAt>Date.now(),'EXPIRED');return review;
  }
  receipt(value){
    const result=this.clean(value),size=()=>Buffer.byteLength(JSON.stringify(result));
    // The event journal bounds each encoded receipt at 64 KiB. A remote
    // string's UTF-8/JSON size can be much larger than its character count.
    if(size()>60000&&typeof result.result?.text==='string'){
      const characters=Array.from(result.result.text);result.result.truncated=true;
      let low=0,high=characters.length;
      while(low<high){const middle=Math.ceil((low+high)/2);result.result.text=characters.slice(0,middle).join('');if(size()<=60000)low=middle;else high=middle-1;}
      result.result.text=characters.slice(0,low).join('');
    }
    invariant(size()<=65536,'SOURCE_UNAVAILABLE');return result;
  }
  async submit(principal,input){
    this.authority(principal);if(this.journal.byNonce(principal,input.nonce))return this.journal.admit(principal,input.nonce,'peer-chat',input);
    const review=this.reviewed(principal,input),lock=this.journal.lock('peer-conversation:'+review.conversationId,principal.principalId);let operation;
    try{
      const active=this.journal.db.prepare("SELECT o.id FROM operations o JOIN records r ON r.kind='peer-chat-review' AND r.id=json_extract(o.input,'$.args.reviewId') WHERE o.kind='peer-chat' AND o.state IN ('admitted','running','cancellation-requested','unknown') AND json_extract(r.value,'$.conversationId')=? LIMIT 1").get(review.conversationId);
      invariant(!active,'BUSY');
      const view=await this.snapshot(principal,review.peer);invariant(view.available===true&&view.revision===review.revision,'STALE_REVISION');this.reviewed(principal,input);
      const existing=this.journal.db.prepare("SELECT id FROM records WHERE kind='peer-conversation' AND id=?").get(review.conversationId);
      if(!existing)this.journal.put('peer-conversation',review.conversationId,principal,{installationId:this.binding.installationId,peer:review.peer,createdAt:new Date().toISOString()});
      operation=this.journal.admit(principal,input.nonce,'peer-chat',input);
      await this.audit.record({operationId:operation.operationId,state:'peer-chat-admitted',peer:review.peer,conversationId:review.conversationId});this.reviewed(principal,input);
      await this.start(operation.operationId);return this.journal.get(principal,operation.operationId);
    }catch(error){if(operation&&this.journal.get(principal,operation.operationId).state==='admitted')this.journal.transition(operation.operationId,'failed',safeError(error));throw error;}
    finally{this.journal.unlock('peer-conversation:'+review.conversationId,lock);}
  }
  async run(operationId){
    const principal=this.binding.principal;this.authority(principal);const lease=this.journal.claim(operationId,{pid:process.pid,start:new Date().toISOString()});if(!lease)return;
    let dispatched=false,heartbeatFailed=false,cancelled=false;const timer=setInterval(()=>{try{this.journal.renew(operationId,lease);}catch{heartbeatFailed=true;}},5000);timer.unref();
    try{
      invariant(this.journal._row(operationId).kind==='peer-chat','DENIED');const input=this.journal.input(operationId,lease);this.reviewed(principal,input);
      await this.audit.record({operationId,state:'before-peer-chat-dispatch'});this.reviewed(principal,input);invariant(!heartbeatFailed,'UNKNOWN_OUTCOME');
      if(this.journal.get(principal,operationId).state==='cancellation-requested')return this.journal.finish(operationId,lease,'cancelled',{source:'Cancelled before dispatch'});
      this.journal.attachReference(operationId,lease,operationId);this.journal.event(operationId,'dispatch-intent',{source:'Reviewed external peer conversation'});dispatched=true;
      let result=await this.client.call('start',{operationId,lease});const deadline=Date.now()+330000;
      while(Date.now()<deadline){
        this.authority(principal);invariant(!heartbeatFailed&&result.operationId===operationId,'UNKNOWN_OUTCOME');
        if(terminal.has(result.state)){await this.audit.record({operationId,state:'peer-chat-'+result.state});return this.journal.finish(operationId,lease,result.state==='denied'?'failed':result.state,this.receipt(result));}
        if(result.state==='unknown')break;
        if(!cancelled&&this.journal.get(principal,operationId).state==='cancellation-requested'){cancelled=true;await this.client.call('cancel',{operationId,lease});}
        await pause(250);result=await this.client.call('status',{operationId});
      }
      return this.journal.finish(operationId,lease,'unknown',{code:'UNKNOWN_OUTCOME',source:'Remote work may have executed; never resend.'});
    }catch(error){return this.journal.finish(operationId,lease,dispatched?'unknown':'failed',dispatched?{code:'UNKNOWN_OUTCOME'}:safeError(error));}
    finally{clearInterval(timer);}
  }
  async reconcile(principal,id){
    this.authority(principal);const operation=this.journal.get(principal,id);
    if(operation.kind!=='peer-chat'||operation.state!=='unknown'||operation.externalReference!==id)return operation;
    const result=await this.client.call('status',{operationId:id});this.authority(principal);invariant(result.operationId===id,'IDENTITY_CHANGED');
    if(!terminal.has(result.state))return operation;
    await this.audit.record({operationId:id,state:'peer-chat-reconciled'});return this.journal.reconcile(id,id,result.state==='denied'?'failed':result.state,this.receipt(result));
  }
  list(principal,input={}){this.authority(principal);const page=this.journal.recordPage('peer-conversation',principal,input);return {conversations:page.items,...(page.nextCursor?{nextCursor:page.nextCursor}:{}),operations:this.journal.list(principal).filter(row=>row.kind==='peer-chat'),scope:'Owned conversation page and peer-chat requests among the 100 most recent management operations.'};}
  read(principal,{id,cursor,limit=20}){
    this.authority(principal);const conversation=this.journal.record('peer-conversation',id,principal);
    invariant(conversation.installationId===this.binding.installationId,'IDENTITY_CHANGED');
    invariant(Number.isInteger(limit)&&limit>0&&limit<=500,'INVALID_INPUT');limit=Math.min(limit,20);
    const before=cursor===undefined?Number.MAX_SAFE_INTEGER:Number(cursor);invariant(Number.isSafeInteger(before)&&before>0,'INVALID_INPUT');
    const rows=this.journal.db.prepare("SELECT o.rowid,o.id,o.input FROM operations o JOIN records r ON r.kind='peer-chat-review' AND r.id=json_extract(o.input,'$.args.reviewId') WHERE o.kind='peer-chat' AND json_extract(r.value,'$.conversationId')=? AND o.rowid<? ORDER BY o.rowid DESC LIMIT ?").all(id,before,limit+1);
    const messages=[];let bytes=0;
    for(const row of rows.slice(0,limit)){
      const message=this.clean({text:JSON.parse(row.input).args.text,operation:this.journal.get(principal,row.id)}),size=Buffer.byteLength(JSON.stringify(message));
      if(messages.length&&bytes+size>512*1024)break;
      messages.push(message);bytes+=size;
    }
    return {conversation:{id,...conversation},messages,
      ...(rows.length>messages.length?{nextCursor:String(rows[messages.length-1].rowid)}:{}),scope:'Most recent retained messages first; at most 20 per page, with earlier pagination for large replies. Redaction and output bounds apply. Unknown outcomes are not resent.'};
  }
  async cancel(principal,input){
    this.authority(principal);invariant(this.journal.get(principal,input.operationId).kind==='peer-chat','DENIED');
    const cancel=this.journal.admit(principal,input.nonce,'peer-chat-cancel',input);if(cancel.result)return cancel.result;this.journal.transition(cancel.operationId,'running');
    try{
      await this.audit.record({operationId:input.operationId,state:'peer-chat-cancellation-requested'});this.authority(principal);
      const state=this.journal.get(principal,input.operationId).state;
      if(state==='admitted')this.journal.transition(input.operationId,'cancelled',{source:'Cancelled before worker admission'});
      else if(state==='running')this.journal.transition(input.operationId,'cancellation-requested');
      const result=this.journal.get(principal,input.operationId);this.journal.transition(cancel.operationId,'succeeded',result);return result;
    }catch(error){this.journal.transition(cancel.operationId,'failed',safeError(error));throw error;}
  }
}

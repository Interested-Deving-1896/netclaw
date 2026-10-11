import {randomUUID} from 'node:crypto';
import {isIPv4} from 'node:net';
import {MobileClient} from './mobile.js';
import {federationEndpoint} from '../hud-server/runtime/federation.js';
import {environment} from './configuration.js';
import {invariant,safeError} from './errors.js';

const terminal=new Set(['succeeded','failed','cancelled','denied']);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function subnetSelection(value){
  invariant(value&&Object.keys(value).sort().join(',')==='cidr,mode,peer'&&['tool','skill'].includes(value.mode),'INVALID_INPUT');
  const [address,prefix,...extra]=String(value.cidr).split('/');
  invariant(typeof value.cidr==='string'&&isIPv4(address)&&/^(2[4-9]|30)$/.test(prefix||'')&&!extra.length,'INVALID_INPUT');
  invariant(typeof value.peer==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value.peer)&&!value.peer.includes('..'),'INVALID_INPUT');
  return {peer:value.peer,mode:value.mode,cidr:value.cidr};
}
export class PeerExecutionClient extends MobileClient{
  async call(action,args={}){
    invariant(['snapshot','start','status','cancel'].includes(action),'DENIED');this.binding.assertCurrent();
    const endpoint=federationEndpoint(environment(this.binding));
    const verify=async()=>{const status=await this.request(endpoint,'/status');this.binding.assertCurrent();invariant(status.installation_id===this.binding.installationId&&status.harness_type===this.binding.kind,'IDENTITY_CHANGED');invariant(status.federation_ready===true,'SOURCE_UNAVAILABLE');};
    await verify();const result=await this.request(endpoint,'/n2n/management/peer-execution',{action,...args});await verify();return result;
  }
}
export class PeerExecution{
  constructor({binding,journal,audit,start,clean=value=>value}){Object.assign(this,{binding,journal,audit,start,clean});this.client=new PeerExecutionClient(binding);}
  authority(principal){this.binding.assertCurrent();invariant(principal.surface==='operator'&&principal.principalId===this.binding.principal.principalId&&principal.installationId===this.binding.installationId,'DENIED');}
  async snapshot(principal,peer){
    this.authority(principal);const view=await this.client.call('snapshot',{peer});this.authority(principal);
    invariant(view.installationId===this.binding.installationId&&view.harness===this.binding.kind&&view.peer===peer,'IDENTITY_CHANGED');
    invariant(view.format===1&&/^[a-f\d]{64}$/.test(view.revision)&&Array.isArray(view.profiles)&&view.profiles.length<=2&&view.profiles.every(row=>['tool','skill'].includes(row.mode)),'UNQUALIFIED');return view;
  }
  async preview(principal,selection){
    this.authority(principal);selection=subnetSelection(selection);const view=await this.snapshot(principal,selection.peer);
    invariant(view.available===true&&view.profiles.some(row=>row.mode===selection.mode),'UNQUALIFIED');
    const reviewId=randomUUID(),review={installationId:this.binding.installationId,selection,revision:view.revision,expiresAt:Date.now()+300000};
    this.journal.put('peer-execution-review',reviewId,principal,review);
    return {reviewId,...review,scope:view.scope,disclosure:'The exact CIDR goes to the selected external peer. Tool mode runs a subnet calculator without inference. Skill mode requests its protected Hermes subnet skill and may incur provider usage. The recipient can deny the request. Local cancellation cannot prove remote work stopped; unknown results are never resent.'};
  }
  reviewed(principal,input,{live=true}={}){
    this.authority(principal);invariant(input.args&&Object.keys(input.args).join(',')==='reviewId','INVALID_INPUT');
    const review=this.journal.record('peer-execution-review',input.args.reviewId,principal);subnetSelection(review.selection);
    invariant(review.installationId===this.binding.installationId,'IDENTITY_CHANGED');if(live)invariant(review.expiresAt>Date.now(),'EXPIRED');return review;
  }
  async submit(principal,input){
    this.authority(principal);if(this.journal.byNonce(principal,input.nonce))return this.journal.admit(principal,input.nonce,'peer-execution',input);
    const review=this.reviewed(principal,input),lock=this.journal.lock('peer-execution:'+review.selection.peer,principal.principalId);let operation;
    try{
      const active=this.journal.db.prepare("SELECT o.id FROM operations o JOIN records r ON r.kind='peer-execution-review' AND r.id=json_extract(o.input,'$.args.reviewId') WHERE o.kind='peer-execution' AND o.state IN ('admitted','running','cancellation-requested','unknown') AND json_extract(r.value,'$.selection.peer')=? LIMIT 1").get(review.selection.peer);
      invariant(!active,'BUSY');const view=await this.snapshot(principal,review.selection.peer);
      invariant(view.available&&view.revision===review.revision&&view.profiles.some(row=>row.mode===review.selection.mode),'STALE_REVISION');this.reviewed(principal,input);
      operation=this.journal.admit(principal,input.nonce,'peer-execution',input);
      await this.audit.record({operationId:operation.operationId,state:'peer-execution-admitted',peer:review.selection.peer,mode:review.selection.mode});this.reviewed(principal,input);
      await this.start(operation.operationId);return this.journal.get(principal,operation.operationId);
    }catch(error){if(operation&&this.journal.get(principal,operation.operationId).state==='admitted')this.journal.transition(operation.operationId,'failed',safeError(error));throw error;}
    finally{this.journal.unlock('peer-execution:'+review.selection.peer,lock);}
  }
  receipt(value,review){
    invariant(value.peer===review.selection.peer&&terminal.has(value.state),'IDENTITY_CHANGED');
    const result=this.clean(value);
    if(Buffer.byteLength(JSON.stringify(result))>60000&&result.result){
      const text=Array.from(JSON.stringify(result.result));let low=0,high=text.length;
      result.result={truncated:true,responseText:''};
      while(low<high){const middle=Math.ceil((low+high)/2);result.result.responseText=text.slice(0,middle).join('');if(Buffer.byteLength(JSON.stringify(result))<=60000)low=middle;else high=middle-1;}
      result.result.responseText=text.slice(0,low).join('');
    }
    invariant(Buffer.byteLength(JSON.stringify(result))<=65536,'SOURCE_UNAVAILABLE');return result;
  }
  async run(operationId){
    const principal=this.binding.principal;this.authority(principal);const lease=this.journal.claim(operationId,{pid:process.pid,start:new Date().toISOString()});if(!lease)return;
    let dispatched=false,heartbeatFailed=false,cancelled=false;const timer=setInterval(()=>{try{this.journal.renew(operationId,lease);}catch{heartbeatFailed=true;}},5000);timer.unref();
    try{
      invariant(this.journal._row(operationId).kind==='peer-execution','DENIED');const input=this.journal.input(operationId,lease),review=this.reviewed(principal,input);
      await this.audit.record({operationId,state:'before-peer-execution-dispatch'});this.reviewed(principal,input);invariant(!heartbeatFailed,'UNKNOWN_OUTCOME');
      if(this.journal.get(principal,operationId).state==='cancellation-requested')return this.journal.finish(operationId,lease,'cancelled',{source:'Cancelled before dispatch'});
      this.journal.attachReference(operationId,lease,operationId);this.journal.event(operationId,'dispatch-intent',{source:'Reviewed external subnet calculation'});dispatched=true;
      let result=await this.client.call('start',{operationId,lease});const deadline=Date.now()+330000;
      while(Date.now()<deadline){
        this.authority(principal);invariant(!heartbeatFailed&&result.operationId===operationId,'UNKNOWN_OUTCOME');
        if(terminal.has(result.state)){const receipt=this.receipt(result,review);await this.audit.record({operationId,state:'peer-execution-'+result.state});return this.journal.finish(operationId,lease,result.state==='denied'?'failed':result.state,receipt);}
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
    if(operation.kind!=='peer-execution'||operation.state!=='unknown'||operation.externalReference!==id)return operation;
    const review=this.reviewed(principal,JSON.parse(this.journal._row(id).input),{live:false});
    const result=await this.client.call('status',{operationId:id});this.authority(principal);invariant(result.operationId===id,'IDENTITY_CHANGED');
    if(!terminal.has(result.state))return operation;const receipt=this.receipt(result,review);
    await this.audit.record({operationId:id,state:'peer-execution-reconciled'});return this.journal.reconcile(id,id,result.state==='denied'?'failed':result.state,receipt);
  }
  list(principal){this.authority(principal);return {operations:this.journal.list(principal).filter(row=>row.kind==='peer-execution').map(({result,...row})=>row),scope:'Peer execution requests among the 100 most recent management operations. Read a request by ID for its retained result.'};}
  async cancel(principal,input){
    this.authority(principal);invariant(this.journal.get(principal,input.operationId).kind==='peer-execution','DENIED');
    const cancel=this.journal.admit(principal,input.nonce,'peer-execution-cancel',input);if(cancel.result)return cancel.result;this.journal.transition(cancel.operationId,'running');
    try{
      await this.audit.record({operationId:input.operationId,state:'peer-execution-cancellation-requested'});this.authority(principal);
      const state=this.journal.get(principal,input.operationId).state;
      if(state==='admitted')this.journal.transition(input.operationId,'cancelled',{source:'Cancelled before worker admission'});
      else if(state==='running')this.journal.transition(input.operationId,'cancellation-requested');
      const result=this.journal.get(principal,input.operationId);this.journal.transition(cancel.operationId,'succeeded',result);return result;
    }catch(error){this.journal.transition(cancel.operationId,'failed',safeError(error));throw error;}
  }
}

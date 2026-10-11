import {randomUUID} from 'node:crypto';
import {federationEndpoint} from '../hud-server/runtime/federation.js';
import {environment} from './configuration.js';
import {invariant,safeError} from './errors.js';

export class MobileClient{
  constructor(binding,fetcher=fetch){Object.assign(this,{binding,fetcher});}
  async request(endpoint,route,body){
    const response=await this.fetcher(endpoint+route,{method:body?'POST':'GET',...(body?{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}:{}),redirect:'error',signal:AbortSignal.timeout(10000)});
    invariant(response.ok&&response.body,'SOURCE_UNAVAILABLE');const reader=response.body.getReader(),chunks=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;invariant(size<=1024*1024,'SOURCE_UNAVAILABLE');chunks.push(Buffer.from(value));}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    return JSON.parse(Buffer.concat(chunks));
  }
  async call(action,args={}){
    invariant(['inventory','start','status','cancel','content','meetings'].includes(action),'DENIED');this.binding.assertCurrent();
    const endpoint=federationEndpoint(environment(this.binding));
    const verify=async()=>{const status=await this.request(endpoint,'/status');this.binding.assertCurrent();invariant(status.installation_id===this.binding.installationId&&status.harness_type===this.binding.kind,'IDENTITY_CHANGED');invariant(status.federation_ready===true,'SOURCE_UNAVAILABLE');};
    await verify();const result=await this.request(endpoint,action==='inventory'?'/n2n/management/mobile':action==='meetings'?'/n2n/management/meetings':'/n2n/management/capture',action==='inventory'?undefined:action==='meetings'?args:{action,...args});await verify();return result;
  }
}

const terminal=new Set(['succeeded','failed','cancelled','denied']);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class MobileWorkspace{
  constructor({binding,journal,audit,start,clean=value=>value}){Object.assign(this,{binding,journal,audit,start,clean});this.client=new MobileClient(binding);}
  authority(principal){this.binding.assertCurrent();invariant(principal.surface==='operator'&&principal.principalId===this.binding.principal.principalId,'DENIED');}
  async inventory(principal){this.authority(principal);const result=await this.client.call('inventory');this.authority(principal);invariant(result.installationId===this.binding.installationId&&result.harness===this.binding.kind&&Array.isArray(result.items),'IDENTITY_CHANGED');return result;}
  async preview(principal,{id,capability}){
    this.authority(principal);invariant(['camera.capture','audio.record'].includes(capability));
    const inventory=await this.inventory(principal);invariant(inventory.captureSupported===true&&this.binding.kind==='openclaw','UNSUPPORTED');
    const member=inventory.items.find(row=>row.id===id);invariant(member?.enrolled===true&&member.connected===true&&member.capabilities.includes(capability),'UNQUALIFIED');
    invariant(/^[a-f0-9]{64}$/.test(member.enrollmentRevision),'SOURCE_UNAVAILABLE');
    const consentReference=randomUUID(),consent={installationId:this.binding.installationId,memberId:id,capability,enrollmentRevision:member.enrollmentRevision,expiresAt:Date.now()+300000};
    this.journal.put('capture-consent',consentReference,principal,consent);
    return {consentReference,...consent,label:member.label,notice:'Request this exact enrolled phone’s native consent. It may decline or cancel. No notification, quarantine, provider request or automatic sharing occurs. Captured media remains in the private backend result store until you explicitly save a copy.'};
  }
  reviewed(principal,input){
    this.authority(principal);const value=this.journal.record('capture-consent',input.args.consentReference,principal);
    invariant(value.installationId===this.binding.installationId&&value.memberId===input.args.id&&value.capability===input.args.capability,'DENIED');invariant(value.expiresAt>Date.now(),'EXPIRED');return value;
  }
  async submit(principal,input){
    this.authority(principal);if(this.journal.byNonce(principal,input.nonce))return this.journal.admit(principal,input.nonce,'mobile-capture',input);
    this.reviewed(principal,input);invariant(this.binding.kind==='openclaw','UNSUPPORTED');
    const lock=this.journal.lock('mobile:'+input.args.id,principal.principalId);let operation;
    try{
      invariant(!this.journal.list(principal).some(row=>row.kind==='mobile-capture'&&!terminal.has(row.state)&&JSON.parse(this.journal._row(row.operationId).input).args.id===input.args.id),'BUSY');
      operation=this.journal.admit(principal,input.nonce,'mobile-capture',input);
      await this.audit.record({operationId:operation.operationId,state:'capture-admitted'});this.reviewed(principal,input);await this.start(operation.operationId);
      return this.journal.get(principal,operation.operationId);
    }catch(error){if(operation&&this.journal.get(principal,operation.operationId).state==='admitted')this.journal.transition(operation.operationId,'failed',safeError(error));throw error;}
    finally{this.journal.unlock('mobile:'+input.args.id,lock);}
  }
  async run(operationId){
    const principal=this.binding.principal;this.authority(principal);const lease=this.journal.claim(operationId,{pid:process.pid,start:new Date().toISOString()});if(!lease)return;
    let dispatched=false,heartbeatFailed=false;const timer=setInterval(()=>{try{this.journal.renew(operationId,lease);}catch{heartbeatFailed=true;}},5000);timer.unref();
    try{
      const input=this.journal.input(operationId,lease);invariant(this.journal._row(operationId).kind==='mobile-capture','DENIED');this.reviewed(principal,input);
      await this.audit.record({operationId,state:'before-capture-dispatch'});this.reviewed(principal,input);invariant(!heartbeatFailed,'UNKNOWN_OUTCOME');
      if(this.journal.get(principal,operationId).state==='cancellation-requested')return this.journal.finish(operationId,lease,'cancelled',{source:'Cancelled before dispatch'});
      this.journal.attachReference(operationId,lease,operationId);this.journal.event(operationId,'dispatch-intent',{source:'Selected enrolled mobile native consent'});dispatched=true;
      let result=await this.client.call('start',{operationId,lease});const deadline=Date.now()+150000;
      while(Date.now()<deadline){
        this.authority(principal);invariant(!heartbeatFailed&&result.operationId===operationId,'UNKNOWN_OUTCOME');
        if(terminal.has(result.state)){
          await this.audit.record({operationId,state:'capture-'+result.state});return this.journal.finish(operationId,lease,result.state==='denied'?'failed':result.state,this.clean(result));
        }
        if(result.state==='unknown')break;
        if(this.journal.get(principal,operationId).state==='cancellation-requested')await this.client.call('cancel',{operationId,lease});
        await pause(300);result=await this.client.call('status',{operationId});
      }
      return this.journal.finish(operationId,lease,'unknown',{code:'UNKNOWN_OUTCOME',source:'Capture may have been requested; never resend.'});
    }catch(error){return this.journal.finish(operationId,lease,dispatched?'unknown':'failed',dispatched?{code:'UNKNOWN_OUTCOME'}:safeError(error));}
    finally{clearInterval(timer);}
  }
  async reconcile(principal,operationId){
    this.authority(principal);const operation=this.journal.get(principal,operationId);
    if(operation.kind!=='mobile-capture'||operation.state!=='unknown'||!operation.externalReference)return operation;
    const result=await this.client.call('status',{operationId});this.authority(principal);invariant(result.operationId===operationId,'IDENTITY_CHANGED');
    if(!terminal.has(result.state))return operation;
    await this.audit.record({operationId,state:'capture-reconciled'});return this.journal.reconcile(operationId,operation.externalReference,result.state==='denied'?'failed':result.state,this.clean(result));
  }
  async cancel(principal,input){
    this.authority(principal);const original=this.journal.get(principal,input.operationId);invariant(original.kind==='mobile-capture','DENIED');
    const cancel=this.journal.admit(principal,input.nonce,'mobile-cancel',input);if(cancel.result)return cancel.result;
    this.journal.transition(cancel.operationId,'running');
    try{
      await this.audit.record({operationId:input.operationId,state:'capture-cancellation-requested'});this.authority(principal);
      const state=this.journal.get(principal,input.operationId).state;
      if(state==='admitted')this.journal.transition(input.operationId,'cancelled',{source:'Cancelled before worker admission'});
      else if(state==='running')this.journal.transition(input.operationId,'cancellation-requested');
      const result=this.journal.get(principal,input.operationId);this.journal.transition(cancel.operationId,'succeeded',result);return result;
    }catch(error){this.journal.transition(cancel.operationId,'failed',safeError(error));throw error;}
  }
  async content(principal,{id,offset=0}){
    this.authority(principal);const operation=this.journal.get(principal,id);
    invariant(operation.kind==='mobile-capture'&&operation.state==='succeeded'&&operation.result?.decision==='captured','DENIED');
    const chunk=await this.client.call('content',{operationId:id,offset});this.authority(principal);
    invariant(chunk.offset===offset&&chunk.sha256===operation.result.media.sha256&&chunk.bytes===operation.result.media.bytes,'IDENTITY_CHANGED');return chunk;
  }
}

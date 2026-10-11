import path from 'node:path';
import {readOwned} from './files.js';
import {authorize,freezeAuthority} from './policy.js';
import {invariant,safeError} from './errors.js';

const terminal=new Set(['succeeded','failed','cancelled']);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** Talks only to the already running, installation-owned private NCFED broker.
 * No runtime, listener, credential or management grant is created here. */
export class ProtectedAssistantRuntime {
  constructor(binding,{fetcher=fetch}={}){Object.assign(this,{binding,fetcher});}
  async call(operation,request){
    this.binding.assertCurrent();invariant(this.binding.kind==='hermes','UNQUALIFIED');
    const file=path.join(this.binding.home,'netclaw-federation/broker.json');
    const bytes=readOwned(file,{missing:true,limit:8192});invariant(bytes,'UNQUALIFIED');
    const record=JSON.parse(bytes);
    invariant(record.installationId===this.binding.installationId&&Number.isInteger(record.port)&&record.port>=1024&&record.port<=65535&&typeof record.key==='string'&&record.key.length>=32,'IDENTITY_CHANGED');
    invariant(['status','submit','observe','cancel'].includes(operation));
    if(operation!=='status')invariant(/^[a-f\d-]{36}$/.test(request||''));
    const response=await this.fetcher(`http://127.0.0.1:${record.port}/assistant`,{method:'POST',headers:{Authorization:`Bearer ${record.key}`,'Content-Type':'application/json'},
      body:JSON.stringify({operation,...(request?{request}:{})}),redirect:'error',signal:AbortSignal.timeout(15000)});
    invariant(response.ok&&!response.redirected&&response.body,'UNQUALIFIED');
    const reader=response.body.getReader(),parts=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;invariant(size<=1024*1024,'SOURCE_UNAVAILABLE');parts.push(Buffer.from(value));}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    this.binding.assertCurrent();invariant(readOwned(file,{limit:8192}).equals(bytes),'IDENTITY_CHANGED');
    let result;try{result=JSON.parse(Buffer.concat(parts));}catch{invariant(false,'SOURCE_UNAVAILABLE');}
    invariant(result&&typeof result==='object'&&!Array.isArray(result),'SOURCE_UNAVAILABLE');
    if(operation==='status')invariant(result.installationId===this.binding.installationId&&result.runtime==='hermes'&&result.profile==='subnet'&&result.grantEnforced===true,'UNQUALIFIED');
    else invariant(['admitted','running','cancellation-requested','succeeded','failed','cancelled','unknown'].includes(result.state),'SOURCE_UNAVAILABLE');
    return result;
  }
  async readiness(){
    try{return await this.call('status');}
    catch(error){if(error.code==='IDENTITY_CHANGED')throw error;return {ready:false,grantEnforced:false,reason:'Requires this installation’s running qualified Hermes federation companion and private management broker. OpenClaw scoped execution remains unqualified.'};}
  }
  submit(id){return this.call('submit',id);}
  observe(id){return this.call('observe',id);}
  cancel(id){return this.call('cancel',id);}
}

export class AssistantRequests {
  constructor({binding,journal,audit,clients,runtime,start,clean}){Object.assign(this,{binding,journal,audit,clients,runtime,start,clean});}
  authority(principal,action='delegate'){
    this.binding.assertCurrent();this.clients.validate(principal);authorize(principal,action,[this.binding.installationId]);
    invariant(principal.surface==='assistant','DENIED');
  }
  async submit(principal,input){
    this.authority(principal);
    const payload={...input,contextIds:input.contextIds||[],authority:freezeAuthority(principal)};
    if(this.journal.byNonce(principal,input.nonce))return this.journal.admit(principal,input.nonce,'assistant-request',payload);
    invariant(typeof input.prompt==='string'&&input.prompt.trim()&&Buffer.byteLength(input.prompt)<=65536);
    invariant(payload.contextIds.length===0,'UNQUALIFIED');
    if(input.conversationId)this.journal.record('assistant-conversation',input.conversationId,principal);
    const ready=await this.runtime.readiness();invariant(ready.ready===true&&ready.grantEnforced===true,'UNQUALIFIED');this.authority(principal);
    const lock=input.conversationId?this.journal.lock(`assistant-conversation:${input.conversationId}`,principal.principalId):null;
    let operation;
    try{
      if(input.conversationId){
        const active=this.journal.db.prepare("SELECT owner,state FROM operations WHERE kind='assistant-request' AND COALESCE(json_extract(input,'$.conversationId'),id)=? AND state IN ('admitted','running','cancellation-requested','unknown') LIMIT 1").get(input.conversationId);
        invariant(!active,active?.state==='unknown'?'UNKNOWN_OUTCOME':'BUSY');
      }
      operation=this.journal.admit(principal,input.nonce,'assistant-request',payload);
      if(!input.conversationId)this.journal.put('assistant-conversation',operation.operationId,principal,{runtime:this.binding.kind,createdAt:new Date().toISOString()});
      await this.audit.record({operationId:operation.operationId,state:'assistant-request-admitted'});this.authority(principal);
      await this.start(operation.operationId);return this.journal.get(principal,operation.operationId);
    }catch(error){
      if(operation&&this.journal.get(principal,operation.operationId).state==='admitted')this.journal.transition(operation.operationId,'failed',safeError(error));throw error;
    }finally{if(lock)this.journal.unlock(`assistant-conversation:${input.conversationId}`,lock);}
  }
  async run(operationId){
    const row=this.journal._row(operationId);invariant(row.kind==='assistant-request');
    const principal=freezeAuthority(JSON.parse(row.input).authority);this.journal._owned(principal,row);
    const lease=this.journal.claim(operationId,{pid:process.pid,start:new Date().toISOString()});if(!lease)return;
    let dispatched=false,heartbeatFailed=false,cancelled=false;
    const timer=setInterval(()=>{try{this.journal.renew(operationId,lease);}catch{heartbeatFailed=true;}},5000);timer.unref();
    try{
      this.authority(principal);this.journal.input(operationId,lease);
      await this.audit.record({operationId,state:'before-assistant-dispatch'});this.authority(principal);
      invariant(!heartbeatFailed,'UNKNOWN_OUTCOME');
      this.journal.attachReference(operationId,lease,operationId);this.journal.event(operationId,'dispatch-intent',{runtime:this.binding.kind,scope:'Protected local assistant profile'});dispatched=true;
      await this.runtime.submit(operationId);
      const deadline=Date.now()+330000;
      while(Date.now()<deadline){
        this.binding.assertCurrent();invariant(!heartbeatFailed,'UNKNOWN_OUTCOME');
        const current=this.journal.get(principal,operationId);
        if(current.state==='cancellation-requested'&&!cancelled){cancelled=true;await this.runtime.cancel(operationId);}
        const result=await this.runtime.observe(operationId);this.binding.assertCurrent();
        if(terminal.has(result.state)){
          await this.audit.record({operationId,state:`assistant-${result.state}`});
          return this.journal.finish(operationId,lease,result.state,this.clean(result));
        }
        if(result.state==='unknown')break;
        await pause(250);
      }
      return this.journal.finish(operationId,lease,'unknown',{code:'UNKNOWN_OUTCOME'});
    }catch(error){return this.journal.finish(operationId,lease,dispatched?'unknown':'failed',dispatched?{code:'UNKNOWN_OUTCOME'}:safeError(error));}
    finally{clearInterval(timer);}
  }
  async reconcile(principal,id){
    this.binding.assertCurrent();const current=this.journal.get(principal,id);
    if(principal.surface==='assistant')this.authority(principal,'inspect');
    if(current.kind!=='assistant-request'||current.state!=='unknown'||current.externalReference!==id)return current;
    const result=await this.runtime.observe(id);this.binding.assertCurrent();
    if(principal.surface==='assistant')this.authority(principal,'inspect');
    if(!terminal.has(result.state))return current;
    await this.audit.record({operationId:id,state:'assistant-reconciled'});this.binding.assertCurrent();
    return this.journal.reconcile(id,id,result.state,this.clean(result));
  }
  async cancel(principal,input){
    const check=()=>{if(principal.surface==='assistant')this.authority(principal,'cancel');else{this.binding.assertCurrent();invariant(principal.principalId===this.binding.principal.principalId&&principal.installationId===this.binding.installationId&&principal.surface==='operator','DENIED');authorize(principal,'cancel',[]);}};
    check();const current=this.journal.get(principal,input.requestId);invariant(current.kind==='assistant-request','DENIED');
    const operation=this.journal.admit(principal,input.nonce,'assistant-cancel',input);if(operation.state!=='admitted')return operation.state==='succeeded'?operation.result:operation;
    try{
      await this.audit.record({operationId:input.requestId,state:'assistant-cancel-requested'});check();
      this.journal.transition(operation.operationId,'running');
      const fresh=this.journal.get(principal,input.requestId);
      if(fresh.state==='admitted')this.journal.transition(input.requestId,'cancelled',{source:'Cancelled before dispatch'});
      else if(['running','cancellation-requested','unknown'].includes(fresh.state)){
        if(fresh.state==='running')this.journal.transition(input.requestId,'cancellation-requested');
        await this.runtime.cancel(input.requestId);
      }
      const result=this.journal.get(principal,input.requestId);this.journal.transition(operation.operationId,'succeeded',result);return result;
    }catch(error){
      const state=this.journal.get(principal,operation.operationId).state;
      if(state==='admitted'||state==='running')this.journal.transition(operation.operationId,'failed',safeError(error));throw error;
    }
  }
}

import path from 'node:path';
import yaml from 'js-yaml';
import {createLocalChangePolicy} from '../../terminal-change-policy.js';
import {createIntentExecutionService} from '../../terminal-intent-execution.js';
import {createTranscriptActivityReader} from '../../terminal-intent-live.js';
import {pickDeviceConnection} from '../../terminal-profiles.js';
import {environment,configurationFiles} from './configuration.js';
import {readOwned,ownedDirectory,ownedFile} from './files.js';
import {gatewayAgentId} from '../hud-server/gateway-agent.js';
import {authorize,verifyChangeApproval} from './policy.js';
import {digest} from './journal.js';
import {invariant,safeError} from './errors.js';

/** A read-only inventory projection from the selected private pyATS source.
 * Credential values and unrelated connections never enter the intent context. */
export function intentDevices(binding){
  const file=environment(binding).PYATS_TESTBED_PATH;invariant(typeof file==='string'&&path.isAbsolute(file),'SOURCE_UNAVAILABLE');
  const bytes=readOwned(file,{limit:2*1024*1024}),testbed=yaml.load(bytes.toString());
  invariant(testbed?.devices&&typeof testbed.devices==='object'&&!Array.isArray(testbed.devices),'SOURCE_UNAVAILABLE');
  const devices=Object.entries(testbed.devices);invariant(devices.length<=1000,'SOURCE_UNAVAILABLE');
  const short=value=>typeof value==='string'?value.slice(0,200):'';
  const result=devices.map(([id,value])=>{
    invariant(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(id),'SOURCE_UNAVAILABLE');
    invariant(value&&typeof value==='object'&&!Array.isArray(value)&&(!value.connections||typeof value.connections==='object'&&!Array.isArray(value.connections)),'SOURCE_UNAVAILABLE');
    const selected=pickDeviceConnection(value),connection=selected?.connection,protocol=String(connection?.protocol||selected?.name||'none').toLowerCase();
    const raw=typeof connection?.ip==='string'?connection.ip:typeof connection?.host==='string'?connection.host:'';
    const host=raw.trim().replace(/^(['"])(.*)\1$/,'$2'),port=Number(connection?.port??22);
    const supported=protocol==='ssh'&&Boolean(host)&&host.length<=253&&!/[\s\r\n\0/@%{}]/.test(host)&&Number.isInteger(port)&&port>0&&port<=65535;
    return {id,name:short(value?.alias)||id,alias:short(value?.alias)||id,os:short(value?.os),platform:short(value?.platform),host:host.slice(0,253),port,supported,protocol};
  });
  return {devices:result,revision:digest(bytes.toString('base64')),file};
}

function gatewayConfiguration(binding){
  invariant(binding.kind==='openclaw','UNQUALIFIED');const config=JSON.parse(readOwned(binding.configPath)),env=environment(binding);
  const gateway=config.gateway||{},port=gateway.port??18789;invariant(Number.isInteger(port)&&port>0&&port<=65535);
  invariant(!gateway.tls?.enabled&&gateway.auth?.mode!=='password'&&gateway.http?.endpoints?.chatCompletions?.enabled===true,'UNQUALIFIED');
  const reference=gateway.auth?.token;
  invariant(reference===undefined||typeof reference==='string'&&/^\$\{[A-Z][A-Z0-9_]*\}$/.test(reference),'UNAUTHENTICATED');
  const token=reference?env[reference.slice(2,-1)]:env.OPENCLAW_GATEWAY_TOKEN;invariant(token,'UNAUTHENTICATED');
  return {port,token,agentId:gatewayAgentId(config),chatCompletionsEnabled:true};
}

/** The same API-created Local/Lab records as the HUD, with private filesystem
 * ownership checks at each entry. No managed call designates endpoints or turns
 * a collector grant into configuration authority. */
export function managedIntentPolicy(binding,listDevices){
  const directory=path.join(binding.home,'netclaw-changes');
  function check(change){
    binding.assertCurrent();
    const inspectDir=file=>{try{ownedDirectory(file);}catch(error){if(error.code!=='ENOENT')throw error;}};
    inspectDir(directory);readOwned(path.join(directory,'policy.json'),{missing:true,limit:65536});
    if(change?.id){
      invariant(/^[a-f\d-]{36}$/.test(change.id));
      const records=path.join(directory,'records'),record=path.join(records,change.id);inspectDir(records);inspectDir(record);
      readOwned(path.join(record,'record.json'),{missing:true,limit:1024*1024});readOwned(path.join(record,'events.jsonl'),{missing:true,limit:4*1024*1024});
    }
  }
  const policy=createLocalChangePolicy({directory,listDevices});
  return {
    state(){check();return policy.state();},
    resolve(input){check();return policy.resolve(input);},
    begin(id,input,scope){check({id});const result=policy.begin(id,input,scope);check(result);return result;},
    validate(change){check(change);return policy.validate(change);},
    prepared(change,report){
      check(change);
      for(const device of change.devices)for(const field of ['baselinePath','rollbackPath']){
        const expected=path.join(directory,'records',change.id);invariant(path.dirname(device[field])===expected,'DENIED');
        const bytes=readOwned(device[field],{limit:4*1024*1024});invariant(bytes.length>=8,'DENIED');
      }
      return policy.prepared(change,report);
    },
    record(change,report,status){check(change);return policy.record(change,report,status);},
    get(id){check({id});return policy.get(id);},
  };
}

export class TerminalIntent {
  constructor({binding,journal,audit,runtime,authority,start,clean,fetcher=fetch}){Object.assign(this,{binding,journal,audit,runtime,authority,start,clean,fetcher});}
  owner(principal){this.binding.assertCurrent();invariant(principal.surface==='operator'&&principal.principalId===this.binding.principal.principalId&&principal.installationId===this.binding.installationId,'DENIED');}
  revision(){const inventory=intentDevices(this.binding);return this.journal.revision([...configurationFiles(this.binding),inventory.file]);}
  policy(){return managedIntentPolicy(this.binding,()=>intentDevices(this.binding).devices);}
  state(principal){
    this.owner(principal);
    const operations=this.journal.list(principal,{limit:500}).filter(row=>row.kind==='terminal-intent');
    try{
      gatewayConfiguration(this.binding);const inventory=intentDevices(this.binding),policy=this.policy().state();
      return {available:true,revision:this.revision(),devices:inventory.devices,policy,operations,
        source:'Selected installation configuration and existing Terminal Intent Local/Lab policy',
        scope:'Operator-only Terminal Intent. Existing tool/SSH/change controls remain required. Agent reports are not independent device verification. Cancellation prevents later segments; an in-flight gateway request may continue. Local/Lab designation is managed through the existing backend Change control workflow.'};
    }catch(error){if(error.code==='IDENTITY_CHANGED')throw error;return {available:false,operations,reason:safeError(error),scope:'Requires OpenClaw token authentication, its enabled chat-completions endpoint and a private existing testbed. Protected Hermes Terminal Intent is not qualified.'};}
  }
  approval(input){return {action:'terminal-intent.apply',targets:input.targetDeviceIds,changeClass:'production',actionDigest:digest({installationId:this.binding.installationId,request:input.request,requestKind:input.requestKind,targets:input.targetDeviceIds,revision:input.expectedRevision})};}
  preview(principal,input){
    this.owner(principal);invariant(this.revision()===input.expectedRevision,'STALE_REVISION');gatewayConfiguration(this.binding);
    const inventory=intentDevices(this.binding),devices=input.targetDeviceIds.map(id=>inventory.devices.find(device=>device.id===id));invariant(devices.length&&devices.every(device=>device?.supported),'DENIED');
    const local=input.changeMode==='local-lab'?this.policy().resolve(input):null;
    return {installationId:this.binding.installationId,request:input.request,requestKind:input.requestKind,changeMode:input.changeMode,devices,
      approval:input.changeMode==='production'&&input.requestKind==='change'?this.approval(input):null,
      localPolicyRevision:local?.revision??null,scope:'Only the selected endpoints and explicit request. Read-only selection never authorizes APPLY. Configuration still requires baseline, rollback, verification and existing tool/SSH controls. Local/Lab uses its API-created record; production changes require live independent ServiceNow approval.'};
  }
  async validate(principal,input){
    invariant(['read-only','change'].includes(input.requestKind)&&['production','local-lab'].includes(input.changeMode)&&typeof input.request==='string'&&input.request.trim()&&input.request.length<=4000);
    this.owner(principal);invariant(this.revision()===input.expectedRevision,'STALE_REVISION');gatewayConfiguration(this.binding);
    const devices=intentDevices(this.binding).devices;
    invariant(input.targetDeviceIds.length&&new Set(input.targetDeviceIds).size===input.targetDeviceIds.length&&input.targetDeviceIds.every(id=>devices.some(device=>device.id===id&&device.supported)),'DENIED');
    if(input.changeMode==='local-lab')this.policy().resolve(input);
    else if(input.requestKind==='change')await verifyChangeApproval(principal,this.approval(input),input.approvalReference,this.authority);
    this.owner(principal);invariant(this.revision()===input.expectedRevision,'STALE_REVISION');
  }
  async submit(principal,input){
    this.owner(principal);authorize(principal,'delegate',[this.binding.installationId]);
    if(this.journal.byNonce(principal,input.nonce))return this.journal.admit(principal,input.nonce,'terminal-intent',input);
    await this.validate(principal,input);invariant((await this.runtime.readiness()).ready===true,'UNQUALIFIED');
    const lock=this.journal.lock('terminal-intent-admission',principal.principalId);let op;
    try{
      invariant(!this.journal.db.prepare("SELECT 1 FROM operations WHERE kind='terminal-intent' AND state IN ('admitted','running','cancellation-requested','unknown')").get(),'BUSY');
      await this.validate(principal,input);op=this.journal.admit(principal,input.nonce,'terminal-intent',input);await this.start(op.operationId);return this.journal.get(principal,op.operationId);
    }catch(error){if(op&&this.journal.get(principal,op.operationId).state==='admitted')this.journal.transition(op.operationId,'failed',safeError(error));throw error;}
    finally{this.journal.unlock('terminal-intent-admission',lock);}
  }
  read(principal,id){this.owner(principal);const operation=this.journal.get(principal,id);invariant(operation.kind==='terminal-intent','DENIED');
    const record=this.journal.db.prepare("SELECT 1 FROM records WHERE kind='terminal-intent' AND id=?").get(id);
    return {operation,...(record?{execution:this.journal.record('terminal-intent',id,principal)}:{}),source:'Owned durable Terminal Intent record. Execution is the last persisted engine snapshot; the operation state takes precedence after worker failure. Unknown outcomes are never replayed.'};}
  async run(id){
    const principal=this.binding.principal;this.owner(principal);const row=this.journal._row(id);invariant(row.kind==='terminal-intent');
    const lease=this.journal.claim(id,{pid:process.pid,start:new Date().toISOString()});if(!lease)return this.journal.get(principal,id);
    const input=this.journal.input(id,lease);let dispatched=false,heartbeatError=false,lastSequence=0;
    const timer=setInterval(()=>{try{this.journal.renew(id,lease);}catch{heartbeatError=true;}},5000);timer.unref();
    const revalidate=async()=>{
      invariant(!heartbeatError,'UNKNOWN_OUTCOME');this.owner(principal);
      const current=this.journal.get(principal,id);invariant(current.state==='running','DENIED');
      await this.validate(principal,input);invariant(this.journal._row(id).lease===lease,'UNKNOWN_OUTCOME');
    };
    const audit=async state=>{
      try{await this.audit.record({operationId:id,action:'terminal-intent',state,changeMode:input.changeMode});}
      catch(error){
        // The exact Local/Lab exception requires an API-created record, not an
        // environment flag or just the caller's requested mode.
        const local=input.changeMode==='local-lab'?this.policy().get(id):null;
        invariant(local?.id===id&&local.mode==='local-lab','AUDIT_UNAVAILABLE');
        this.journal.event(id,'gait-unavailable',{source:'Existing API-created local change record is the scoped audit trail'});
      }
    };
    try{
      await revalidate();const gateway=gatewayConfiguration(this.binding),policy=this.policy();
      const engine=createIntentExecutionService({getGatewayConfig:()=>gateway,
        listDevices:()=>intentDevices(this.binding).devices.filter(device=>input.targetDeviceIds.includes(device.id)),changePolicy:policy,
        createActivityReader:options=>{
          const directory=path.join(this.binding.home,'agents',gateway.agentId,'sessions');
          const check=()=>{this.binding.assertCurrent();ownedDirectory(directory,{privateMode:false});ownedFile(path.join(directory,'sessions.json'));};
          // Missing new sessions are expected. Linked/foreign stores never
          // become transcript evidence, including a swap during execution.
          try{check();}catch(error){if(error.code!=='ENOENT')return {poll:()=>({status:'unavailable',events:[]})};}
          const reader=createTranscriptActivityReader({directory,...options});
          return {poll:()=>{try{check();return reader.poll();}catch{return {status:'unavailable',events:[]};}}};
        },
        onUpdate:job=>{
          this.owner(principal);invariant(!heartbeatError&&this.journal._row(id).lease===lease,'UNKNOWN_OUTCOME');
          const safe=this.clean(job);this.journal.put('terminal-intent',id,principal,safe,{replace:true});
          if(job.steps.length>lastSequence){lastSequence=job.steps.length;this.journal.event(id,'intent-report',this.clean({segment:job.segment,status:job.report?.status,summary:job.report?.summary,source:'Agent-reported Terminal Intent outcome; inspect actual tool evidence'}));}
        },
        beforeDispatch:async job=>{
          await revalidate();await audit('before-segment');await revalidate();
          if(!dispatched)this.journal.attachReference(id,lease,job.sessionId);
          else invariant(this.journal._row(id).external_reference===job.sessionId,'IDENTITY_CHANGED');
          this.journal.event(id,'intent-dispatch',{segment:job.segment,phase:job.changeControl.phase||'production',sessionId:job.sessionId});dispatched=true;
        },
        fetchImpl:async(url,options)=>{
          invariant(url===`http://127.0.0.1:${gateway.port}/v1/chat/completions`,'DENIED');
          const response=await this.fetcher(url,{...options,redirect:'error'});invariant(response.body,'SOURCE_UNAVAILABLE');
          const reader=response.body.getReader(),chunks=[];let size=0;
          try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;invariant(size<=1024*1024,'SOURCE_UNAVAILABLE');chunks.push(Buffer.from(value));}}
          finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
          await revalidate();return {ok:response.ok,status:response.status,json:async()=>JSON.parse(Buffer.concat(chunks).toString())};
        }});
      engine.start({...input,id,deviceId:input.targetDeviceIds[0]});const result=await engine.wait(id);
      this.owner(principal);invariant(!heartbeatError,'UNKNOWN_OUTCOME');
      const state=!dispatched&&this.journal.get(principal,id).state==='cancellation-requested'?'cancelled':result.status==='completed'?'succeeded':result.status==='uncertain'&&dispatched?'unknown':'failed';
      await audit(state);
      return this.journal.finish(id,lease,state,this.clean({status:result.status,report:result.report,source:'Existing Terminal Intent engine; agent reports and actual transcript events remain distinct',verifiedNetworkOutcome:false,executionId:id}));
    }catch(error){return this.journal.finish(id,lease,dispatched?'unknown':'failed',dispatched?{code:'UNKNOWN_OUTCOME',executionId:id}:safeError(error));}
    finally{clearInterval(timer);}
  }
  async cancel(principal,input){
    this.owner(principal);const current=this.journal.get(principal,input.operationId);invariant(current.kind==='terminal-intent','DENIED');
    const request=this.journal.admit(principal,input.nonce,'intent-cancel',input);if(request.result)return request.result;
    this.journal.transition(request.operationId,'running');
    try{
      if(current.state==='admitted')this.journal.transition(input.operationId,'cancelled',{source:'Cancelled before the worker claimed the request'});
      else if(current.state==='running')this.journal.transition(input.operationId,'cancellation-requested',{source:'Stops later segments; in-flight gateway work may continue'});
      const result=this.journal.get(principal,input.operationId);this.journal.transition(request.operationId,'succeeded',result);return result;
    }catch(error){this.journal.transition(request.operationId,'failed',safeError(error));throw error;}
  }
}

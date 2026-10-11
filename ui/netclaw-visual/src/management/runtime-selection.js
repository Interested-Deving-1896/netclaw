import path from 'node:path';
import {readOwned,atomicPrivate,ownedDirectory} from './files.js';
import {bindInstallation} from './identity.js';
import {Journal,digest} from './journal.js';
import {configurationFiles,configurationChangeClass} from './configuration.js';
import {activeManagementWork} from './runtime.js';
import {createManagementRuntime} from './chat-runtime.js';
import {acquireRuntimeSelectionLock} from '../../../../scripts/runtime-selection.mjs';
import {invariant} from './errors.js';

const uuid=value=>typeof value==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(value);
export const runtimeRegistryPath=binding=>path.join(binding.statePath,'management','runtimes.json');
const pack=bytes=>bytes===null?null:bytes.toString('base64');
function descriptor(bytes){
  const value=JSON.parse(bytes);
  invariant(value?.schemaVersion===1&&['openclaw','hermes'].includes(value.kind)&&typeof value.home==='string'&&path.isAbsolute(value.home),'INCOMPATIBLE');
  invariant(Object.keys(value).every(key=>['schemaVersion','kind','home','configPath'].includes(key)),'INCOMPATIBLE');
  const configPath=path.join(value.home,value.kind==='hermes'?'config.yaml':'openclaw.json');
  invariant(value.configPath===undefined||value.configPath===configPath,'UNQUALIFIED');
  return {...value,configPath};
}
const entry=binding=>({installationId:binding.installationId,kind:binding.kind,home:binding.home});

/** Owner-registered, existing installations only. Discovery never scans HOME,
 * creates installation identity or adopts a global selection implicitly. */
export class RuntimeSelection {
  constructor({binding,journal,root,probe}){
    Object.assign(this,{binding,journal,root});this.pending=new Map();
    this.probe=probe|| (async binding=>{const runtime=createManagementRuntime(binding,root);try{return await runtime.readiness();}finally{await runtime.close();}});
  }
  registry(){
    const bytes=readOwned(runtimeRegistryPath(this.binding),{missing:true,limit:65536});if(!bytes)return null;
    const value=JSON.parse(bytes);
    invariant(value.version===1&&value.installationId===this.binding.installationId&&Array.isArray(value.runtimes)&&value.runtimes.length>0&&value.runtimes.length<=20,'DENIED');
    invariant(typeof value.selectorPath==='string'&&path.isAbsolute(value.selectorPath)&&path.basename(value.selectorPath)==='runtime.json','DENIED');
    ownedDirectory(path.dirname(value.selectorPath));
    invariant(new Set(value.runtimes.map(row=>row.installationId)).size===value.runtimes.length,'DENIED');
    for(const row of value.runtimes)invariant(uuid(row.installationId)&&['openclaw','hermes'].includes(row.kind)&&typeof row.home==='string'&&path.isAbsolute(row.home),'DENIED');
    invariant(value.runtimes.some(row=>digest(row)===digest(entry(this.binding))),'IDENTITY_CHANGED');
    return value;
  }
  files(){const registry=this.registry();return [runtimeRegistryPath(this.binding),...(registry?[registry.selectorPath]:[])];}
  bind(row){return bindInstallation({home:row.home,kind:row.kind,expectedInstallationId:row.installationId});}
  existingJournal(binding){return binding.installationId===this.binding.installationId?this.journal:new Journal(path.join(binding.statePath,'management'),binding.installationId,{existingOnly:true});}
  selected(registry){
    const bytes=readOwned(registry.selectorPath,{limit:8192}),value=descriptor(bytes);
    const selected=registry.runtimes.find(row=>row.kind===value.kind&&row.home===value.home);invariant(selected,'IDENTITY_CHANGED');
    this.bind(selected);return {bytes,value,selected};
  }
  async register({selectorPath,home,kind,installationId},{reviewed=false,audit}={}){
    this.binding.assertCurrent();invariant(path.isAbsolute(selectorPath)&&path.basename(selectorPath)==='runtime.json');
    ownedDirectory(path.dirname(selectorPath));
    const current=this.registry();invariant(!current||current.selectorPath===selectorPath,'DENIED');
    const candidate=this.bind({home,kind,installationId}),candidateJournal=this.existingJournal(candidate);
    let release;
    try{
      const old=readOwned(runtimeRegistryPath(this.binding),{missing:true,limit:65536});
      release=acquireRuntimeSelectionLock(selectorPath);
      const previous=readOwned(selectorPath,{limit:8192}),selected=descriptor(previous);
      const runtimes=[...(current?.runtimes||[entry(this.binding)])],found=runtimes.find(row=>row.installationId===candidate.installationId);
      invariant(!found||digest(found)===digest(entry(candidate)),'IDENTITY_CHANGED');
      if(!found)runtimes.push(entry(candidate));invariant(runtimes.length<=20);
      invariant(runtimes.some(row=>row.home===selected.home&&row.kind===selected.kind),'DENIED');
      const before=configurationFiles(candidate).map(file=>pack(readOwned(file,{missing:true,limit:4*1024*1024})));
      const readiness=await this.probe(candidate);invariant(readiness.ready===true,'UNQUALIFIED');
      const preview={selectorPath,candidate:entry(candidate),selected:{kind:selected.kind,home:selected.home},ready:true,source:readiness.source||'Selected runtime health',
        effect:'Register an existing installation as a possible future launch default. Registration changes no runtime selection or process.'};
      if(reviewed){
        await audit.record({action:'runtime-binding',state:'before-save',installationId:this.binding.installationId,targetInstallationId:candidate.installationId});
        this.binding.assertCurrent();candidate.assertCurrent();
        invariant(pack(readOwned(runtimeRegistryPath(this.binding),{missing:true,limit:65536}))===pack(old)&&readOwned(selectorPath).equals(previous),'STALE_REVISION');
        invariant(digest(configurationFiles(candidate).map(file=>pack(readOwned(file,{missing:true,limit:4*1024*1024}))))===digest(before),'STALE_REVISION');
        atomicPrivate(runtimeRegistryPath(this.binding),JSON.stringify({version:1,installationId:this.binding.installationId,selectorPath,runtimes},null,2)+'\n');
        await audit.record({action:'runtime-binding',state:'saved',installationId:this.binding.installationId,targetInstallationId:candidate.installationId});
      }
      return preview;
    }finally{release?.();if(candidateJournal!==this.journal)candidateJournal.close();}
  }
  snapshot(){
    const registry=this.registry();
    if(!registry)return {available:false,choices:[],reason:'Register existing installations and their current runtime selector with netclaw-bind-runtime.mjs first.'};
    const selected=this.selected(registry);
    const choices=registry.runtimes.map(row=>{
      let journal;
      try{
        const binding=this.bind(row);journal=this.existingJournal(binding);
        return {id:row.installationId,harness:row.kind,home:row.home,available:true,selected:selected.selected.installationId===row.installationId,activeWork:activeManagementWork(journal).length};
      }catch(error){return {id:row.installationId,harness:row.kind,home:row.home,available:false,reason:error.code||'UNQUALIFIED'};}
      finally{if(journal&&journal!==this.journal)journal.close();}
    });
    return {available:true,selectorPath:registry.selectorPath,selectedInstallationId:selected.selected.installationId,choices,
      effect:'Changes the default for future NetClaw launches that use this selector. Explicit runtime/home overrides still take precedence. Running services, requests and this connection stay on their original installations. Select another VS Code connection explicitly to manage it.'};
  }
  adapter(){
    const owner=this;
    function acquire(proposal){
      const registry=owner.registry();invariant(registry,'UNQUALIFIED');
      const row=registry.runtimes.find(row=>row.installationId===proposal.patch.runtimeId);invariant(row,'UNQUALIFIED');
      const candidate=owner.bind(row),journal=owner.existingJournal(candidate);let release,token;
      try{
        release=acquireRuntimeSelectionLock(registry.selectorPath);
        if(journal!==owner.journal)token=journal.lock('configuration',proposal.proposalId||'runtime-review',180000);
        return {registry,candidate,journal,release:()=>{try{if(token)journal.unlock('configuration',token);}finally{if(journal!==owner.journal)journal.close();release?.();}}};
      }catch(error){release?.();if(journal!==owner.journal)journal.close();throw error;}
    }
    function capture(scope){
      owner.binding.assertCurrent();scope.candidate.assertCurrent();const selected=owner.selected(scope.registry);
      return {format:1,installationId:owner.binding.installationId,registry:pack(readOwned(runtimeRegistryPath(owner.binding))),selector:pack(selected.bytes),
        target:entry(scope.candidate),sourceFiles:configurationFiles(owner.binding).map(file=>pack(readOwned(file,{missing:true,limit:4*1024*1024}))),
        targetFiles:configurationFiles(scope.candidate).map(file=>pack(readOwned(file,{missing:true,limit:4*1024*1024}))),
        sourceWork:activeManagementWork(owner.journal),targetWork:activeManagementWork(scope.journal)};
    }
    async function validate(proposal,bytes,scope){
      const saved=JSON.parse(bytes);invariant(saved.format===1&&saved.installationId===owner.binding.installationId,'IDENTITY_CHANGED');
      invariant(digest(capture(scope))===digest(saved),'STALE_REVISION');
      const ready=await owner.probe(scope.candidate);invariant(ready.ready===true,'UNQUALIFIED');
      invariant(digest(capture(scope))===digest(saved),'STALE_REVISION');return saved;
    }
    return {qualified:true,resource:'configuration',lockMs:180000,files:()=>owner.files(),
      async prepare(input){
        invariant(input.patch.acknowledgeActiveWork===true,'DENIED');
        const expected=[...new Set([owner.binding.installationId,input.patch.runtimeId])].sort();
        invariant(digest([...input.targets].sort())===digest(expected),'DENIED');
        const scope=acquire(input);
        try{
          const saved=capture(scope),bytes=Buffer.from(JSON.stringify(saved));await validate(input,bytes,scope);
          return {baseline:bytes,rollback:bytes,changeClass:[owner.binding,scope.candidate].some(binding=>configurationChangeClass(binding)==='production')?'production':'operator-local',
            impact:`Select existing ${scope.candidate.kind} installation ${scope.candidate.installationId} as the default for future launches through ${scope.registry.selectorPath}. ${saved.sourceWork.length} active/unknown requests on this installation and ${saved.targetWork.length} on the selected installation stay running; jobs started outside management are unknown. No process, identity, configuration or saved conversation is migrated. Explicit runtime/home overrides retain precedence. This VS Code connection stays bound to ${owner.binding.installationId}; switching profiles is a separate action.`};
        }finally{scope.release();}
      },
      async validate(proposal,{baseline}){
        const scope=acquire(proposal);try{await validate(proposal,baseline,scope);owner.pending.set(proposal.proposalId,{scope});}catch(error){scope.release();throw error;}
      },
      async apply(proposal,{baseline,replacements={},revalidate}){
        invariant(Object.keys(replacements).length===0);const pending=owner.pending.get(proposal.proposalId);invariant(pending,'DENIED');
        await revalidate();await validate(proposal,baseline,pending.scope);
        const candidate=pending.scope.candidate,next=Buffer.from(JSON.stringify({schemaVersion:1,kind:candidate.kind,home:candidate.home,configPath:candidate.configPath},null,2)+'\n');
        pending.before=JSON.parse(baseline).selector;pending.after=pack(next);
        atomicPrivate(pending.scope.registry.selectorPath,next);return {expected:pack(next)};
      },
      async verify(proposal,result){
        const pending=owner.pending.get(proposal.proposalId);invariant(pending,'UNKNOWN_OUTCOME');
        owner.binding.assertCurrent();pending.scope.candidate.assertCurrent();
        return {verified:pack(readOwned(pending.scope.registry.selectorPath))===result.expected,observedState:'Default selected for future launches; existing processes and connection unchanged'};
      },
      async rollback(proposal,bytes){
        const pending=owner.pending.get(proposal.proposalId);invariant(pending,'UNKNOWN_OUTCOME');const saved=JSON.parse(bytes);
        owner.binding.assertCurrent();pending.scope.candidate.assertCurrent();
        const actual=pack(readOwned(pending.scope.registry.selectorPath));invariant(actual===saved.selector||actual===pending.after,'STALE_REVISION');
        atomicPrivate(pending.scope.registry.selectorPath,Buffer.from(saved.selector,'base64'));
        return {verified:pack(readOwned(pending.scope.registry.selectorPath))===saved.selector};
      },
      release(proposal){const pending=owner.pending.get(proposal.proposalId);owner.pending.delete(proposal.proposalId);pending?.scope.release();},
    };
  }
}

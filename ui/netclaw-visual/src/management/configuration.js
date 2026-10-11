import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { parseEnvData } from '../security/private-files.js';
import { ENV_MAP } from '../hud-server/integration-environment.js';
import { configurationInventory } from '../hud-server/configuration.js';
import { readOwned, atomicPrivate } from './files.js';
import { invariant } from './errors.js';
import {patchBudgetConfiguration,budgetFields} from '../hud-server/configuration-mutations.js';
import {gatewayAgentId} from '../hud-server/gateway-agent.js';
import {patchEnvironmentText} from '../security/environment-text.js';

export const secretField = key => /KEY|TOKEN|PASSWORD|SECRET|AUTH|CREDENTIAL/i.test(key);
const providerFields=['ANTHROPIC_API_KEY','OPENAI_API_KEY','OPENROUTER_API_KEY','GEMINI_API_KEY','OPENCLAW_GATEWAY_TOKEN','OPENCLAW_GATEWAY_PASSWORD','NETCLAW_HERMES_HUD_API_KEY'];
const known = new Set([...providerFields,...Object.values(ENV_MAP).flatMap(item=>item.env)]);
const prohibited = /(?:^PATH$|^HOME$|^LD_|^DYLD_|^NODE_|^PYTHON|_PATH$|_DIR$|_SCRIPT$|_COMMAND$|_EXEC|^NETCLAW_LAB_MODE$|^N2N_RISK_MODE$|^N2N_STRICT_ALL$)/;
export function environment(binding) { return parseEnvData((readOwned(binding.envPath,{missing:true}) || Buffer.from('')).toString()); }
export const configurationChangeClass=binding=>(environment(binding).N2N_RISK_MODE||'').trim().toLowerCase()==='production'?'production':'operator-local';
export const configurationFiles = binding => [binding.configPath,binding.envPath,...(binding.kind==='hermes'?[path.join(binding.statePath,'companion-auth.json')]:[])];
export function configuredSecrets(binding){
  const secrets=Object.entries(environment(binding)).filter(([key])=>secretField(key)).map(([,value])=>value);
  const config=configObject(readOwned(binding.configPath,{limit:4*1024*1024}),binding.kind);
  const scan=(value,depth=0)=>{
    invariant(depth<32,'SOURCE_UNAVAILABLE');if(!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)){
      if(secretField(key)&&typeof item==='string'&&!/^\$\{[A-Z][A-Z0-9_]*\}$/.test(item))secrets.push(item);
      else if(item&&typeof item==='object')scan(item,depth+1);
    }
  };scan(config);
  if(binding.kind==='hermes'){
    const auth=readOwned(path.join(binding.statePath,'companion-auth.json'),{missing:true});if(auth){const key=JSON.parse(auth).key;if(typeof key==='string')secrets.push(key);}
  }
  return secrets;
}
export function managedSettingsSnapshot(binding){
  const config=configObject(readOwned(binding.configPath,{limit:4*1024*1024}),binding.kind);
  const literal=value=>typeof value==='string'&&value!==''&&!/^\$\{[A-Z][A-Z0-9_]*\}$/.test(value);
  if(binding.kind==='hermes')return {runtime:binding.kind,providers:[],model:typeof config.model==='string'?config.model:config.model?.default||'',provider:typeof config.model==='object'?config.model?.provider||'':'',
    budget:{supported:false,reason:'Hermes aggregate budget management is not independently qualified.'},legacyCredentials:literal(JSON.parse(readOwned(path.join(binding.statePath,'companion-auth.json'),{missing:true})||'{}').key),effort:{supported:false,reason:'Requires live per-model qualification.'}};
  return {runtime:binding.kind,providers:Object.entries(config.models?.providers||{}).map(([id,value])=>({id,models:(value.models||[]).filter(m=>typeof m.id==='string').map(m=>m.id)})),
    budget:{supported:true,stored:config.agents?.defaults?.budget||{},fields:Object.keys(budgetFields),effective:'unverified',environmentOverrideSet:Boolean(environment(binding).NETCLAW_SESSION_BUDGET_USD)},
    legacyCredentials:literal(config.gateway?.auth?.token)||literal(config.gateway?.auth?.password)||Object.values(config.models?.providers||{}).some(value=>literal(value.apiKey)),
    effort:{supported:false,reason:'Requires live per-model qualification.'}};
}
export function configurationSnapshot(binding) {
  return { ...configurationInventory({...ENV_MAP,providers:{env:providerFields,files:[],notes:'Selected runtime provider credentials.'}},environment(binding),'Selected installation .env'),
    managedFields:[...known].filter(key=>!prohibited.test(key)).map(key=>({key,secret:secretField(key),restartRequired:true})),
    source:'Stored configuration; effective running values require runtime verification.' };
}

/** Preserve all unrelated bytes, including comments/newlines and multiline values. */
export function patchEnvironment(original, updates) {
  for(const key of Object.keys(updates))invariant(/^[A-Z][A-Z0-9_]*$/.test(key));
  return patchEnvironmentText(original,updates,{quoteAll:true});
}
export function configurationAdapters(binding) {
  const pending=new Map();
  const configuration={qualified:true,resource:'configuration',isSecret:secretField,
    async prepare(input) {
      invariant(input.targets.length===1&&input.targets[0]===binding.installationId,'DENIED');
      invariant(input.patch.fields?.length && Object.keys(input.patch).every(key=>key==='fields'));
      invariant(new Set(input.patch.fields.map(f=>f.key)).size===input.patch.fields.length);
      for(const field of input.patch.fields) {
        invariant(known.has(field.key)&&!prohibited.test(field.key),'UNSUPPORTED');
        invariant(!secretField(field.key)||field.value===undefined);
        invariant(field.value===undefined || !/[\r\n\0]/.test(field.value));
      }
      const original=readOwned(binding.envPath,{missing:true});
      const baseline=Buffer.from(JSON.stringify({format:1,exists:original!==null,bytes:(original||Buffer.from('')).toString('base64')}));
      return {baseline,rollback:baseline,changeClass:configurationChangeClass(binding),impact:'Save selected .env fields. Running services are unchanged; restart may be required.'};
    },
    async apply(proposal,{baseline,replacements}) {
      const saved=JSON.parse(baseline);invariant(saved.format===1);
      const updates={};
      const replacementFields=proposal.patch.fields.filter(f=>secretField(f.key)&&f.intent==='replace').map(f=>f.key);
      invariant(Object.keys(replacements).every(key=>replacementFields.includes(key)));
      for(const field of proposal.patch.fields) {
        if(field.intent==='keep')continue;
        if(field.intent==='clear'){updates[field.key]='';continue;}
        const value=secretField(field.key)?replacements[field.key]:field.value;
        // Blank/mask/omission is always keep, never an accidental erase.
        if(value===undefined||value===''||/^[*•]+$/.test(value))continue;
        invariant(typeof value==='string'&&value.length<=65536&&!/[\r\n\0]/.test(value));updates[field.key]=value;
      }
      const actual=readOwned(binding.envPath,{missing:true});
      const current=actual||Buffer.from('');invariant((actual!==null)===saved.exists&&current.equals(Buffer.from(saved.bytes,'base64')),'STALE_REVISION');
      const next=patchEnvironment(current.toString(),updates);pending.set(proposal.proposalId,{before:actual,after:Buffer.from(next)});atomicPrivate(binding.envPath,next);
      return {expected:Buffer.from(next)};
    },
    async verify(_proposal,result){return {verified:readOwned(binding.envPath).equals(result.expected),pendingRestart:true};},
    async rollback(proposal,bytes){
      const saved=JSON.parse(bytes);invariant(saved.format===1);
      const actual=readOwned(binding.envPath,{missing:true}),state=pending.get(proposal.proposalId);
      const same=(a,b)=>a===null?b===null:b!==null&&a.equals(b);
      invariant(state?(same(actual,state.before)||same(actual,state.after)):same(actual,saved.exists?Buffer.from(saved.bytes,'base64'):null),'STALE_REVISION');
      if(!saved.exists){if(readOwned(binding.envPath,{missing:true})!==null)fs.unlinkSync(binding.envPath);return {verified:readOwned(binding.envPath,{missing:true})===null};}
      const original=Buffer.from(saved.bytes,'base64');atomicPrivate(binding.envPath,original);return{verified:readOwned(binding.envPath).equals(original)};
    },
    release:proposal=>pending.delete(proposal.proposalId),
  };
  return {'integration.configure':configuration,
    'settings.patch':fileTransaction(binding,projectSettings),
    ...(binding.kind==='openclaw'?{'budget.patch':fileTransaction(binding,(config,patch)=>patchBudgetConfiguration(config,{budget:patch}))}:{}),
  };
}

function configObject(bytes,kind){
  const value=kind==='hermes'?yaml.load(bytes.toString()):JSON.parse(bytes);
  invariant(value&&typeof value==='object'&&!Array.isArray(value));return value;
}
function projectSettings(config,patch,binding){
  invariant(Object.keys(patch).every(key=>['model','provider','effort','normalizeCredentials'].includes(key)));
  if(patch.effort!==undefined)invariant(false,'UNQUALIFIED'); // Session effort requires a live model capability response.
  if(patch.model!==undefined||patch.provider!==undefined){
    if(binding.kind==='openclaw'){
      const agentId=gatewayAgentId(config);config.agents||={};config.agents.defaults||={};
      const agent=config.agents.entries?.[agentId]||config.agents.list?.find(a=>a.id===agentId)||config.agents.defaults;
      const current=agent.model??config.agents.defaults.model;
      const currentName=typeof current==='string'?current:current?.primary||'';
      const provider=patch.provider||currentName.split('/')[0];
      const model=patch.model||currentName.slice(currentName.indexOf('/')+1);
      invariant(typeof provider==='string'&&/^[\w.-]{1,100}$/.test(provider));
      const short=model.startsWith(provider+'/')?model.slice(provider.length+1):model;
      invariant(config.models?.providers?.[provider]?.models?.some(value=>value.id===short),'UNQUALIFIED');
      agent.model={...(typeof current==='object'?current:{}),primary:provider+'/'+short};
    }else{
      const current=typeof config.model==='string'?{default:config.model}:{...config.model};
      // Hermes provider routing cannot be redirected to a new account/endpoint
      // through a model selection. Existing provider credentials remain bound.
      invariant(!patch.provider||patch.provider===current.provider,'UNQUALIFIED');
      invariant(patch.model===undefined||typeof patch.model==='string'&&/^[\w./:-]{1,200}$/.test(patch.model));
      config.model={...current,...(patch.model?{default:patch.model}:{})};
    }
  }
  return config;
}

/** Private baseline includes exact bytes; the public proposal includes intents only. */
function fileTransaction(binding,project){
  const pending=new Map(),files=configurationFiles(binding);
  const capture=()=>files.map(file=>{const bytes=readOwned(file,{missing:true,limit:4*1024*1024});return {exists:bytes!==null,bytes:bytes?.toString('base64')||''};});
  const unpack=saved=>saved.map(item=>item.exists?Buffer.from(item.bytes,'base64'):null);
  const same=(left,right)=>left===null?right===null:right!==null&&left.equals(right);
  function planned(input,saved){
    const original=unpack(saved),config=project(configObject(original[0],binding.kind),input.patch,binding);
    let env=(original[1]||Buffer.from('')).toString(),companion=original[2];
    if(input.patch.normalizeCredentials){
      const existing=parseEnvData(env),updates={};
      const move=(object,key,reference,remove=false)=>{
        const value=object?.[key];if(value===undefined||value===''||typeof value==='string'&&/^\$\{[A-Z][A-Z0-9_]*\}$/.test(value))return;
        invariant(typeof value==='string'&&!/[\r\n\0]/.test(value));
        invariant(!existing[reference]||existing[reference]===value,'DENIED');
        invariant(!updates[reference]||updates[reference]===value,'DENIED');
        updates[reference]=value;if(remove)delete object[key];else object[key]=`\u0024{${reference}}`;
      };
      if(binding.kind==='openclaw'){
        move(config.gateway?.auth,'token','OPENCLAW_GATEWAY_TOKEN');move(config.gateway?.auth,'password','OPENCLAW_GATEWAY_PASSWORD');
        for(const [name,provider] of Object.entries(config.models?.providers||{})){
          invariant(/^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(name));
          const standard={anthropic:'ANTHROPIC_API_KEY',openai:'OPENAI_API_KEY',openrouter:'OPENROUTER_API_KEY',google:'GEMINI_API_KEY'};
          move(provider,'apiKey',standard[name]||`NETCLAW_PROVIDER_${name.replaceAll('-','_').toUpperCase()}_API_KEY`);
        }
      }else if(companion){
        const auth=JSON.parse(companion);invariant(auth&&typeof auth==='object'&&!Array.isArray(auth));
        invariant(auth.port===undefined||Number.isInteger(auth.port)&&auth.port>0&&auth.port<=65535);
        if(!existing.NETCLAW_HERMES_HUD_PORT&&auth.port!==undefined)updates.NETCLAW_HERMES_HUD_PORT=String(auth.port);
        move(auth,'key','NETCLAW_HERMES_HUD_API_KEY',true);companion=Buffer.from(JSON.stringify(auth,null,2)+'\n');
      }
      if(Object.keys(updates).length)env=patchEnvironment(env,updates);
    }
    return [Buffer.from(binding.kind==='hermes'?yaml.dump(config,{lineWidth:-1,noRefs:true}):JSON.stringify(config,null,2)+'\n'),
      original[1]===null&&env===''?null:Buffer.from(env),...(binding.kind==='hermes'?[companion]:[])];
  }
  return {qualified:true,resource:'configuration',
    async prepare(input){
      invariant(input.targets.length===1&&input.targets[0]===binding.installationId,'DENIED');
      const saved=capture();planned(input,saved);
      const baseline=Buffer.from(JSON.stringify({format:2,files:saved}));
      return {baseline,rollback:baseline,changeClass:configurationChangeClass(binding),impact:'Save reviewed settings in the selected installation. Existing processes keep their current settings until a separately reviewed restart. Credential normalization moves existing bytes to .env references; it never rotates credentials.'};
    },
    async apply(proposal,{baseline,replacements}){
      invariant(Object.keys(replacements||{}).length===0);const saved=JSON.parse(baseline);invariant(saved.format===2);
      const before=unpack(saved.files),after=planned(proposal,saved.files);
      invariant(files.every((file,index)=>same(readOwned(file,{missing:true}),before[index])),'STALE_REVISION');
      pending.set(proposal.proposalId,{before,after});
      // Write env first so references never become visible before their source.
      for(const index of [1,0,...(binding.kind==='hermes'?[2]:[])])if(after[index]!==null&&!same(before[index],after[index]))atomicPrivate(files[index],after[index]);
      return {expected:after};
    },
    async verify(proposal,result){
      const verified=files.every((file,index)=>same(readOwned(file,{missing:true}),result.expected[index]));
      return {verified,pendingRestart:true};
    },
    async rollback(proposal,bytes){
      const saved=JSON.parse(bytes),state=pending.get(proposal.proposalId);invariant(saved.format===2,'UNKNOWN_OUTCOME');
      const original=unpack(saved.files);
      if(!state)return {verified:files.every((file,index)=>same(readOwned(file,{missing:true}),original[index]))};
      invariant(files.every((file,index)=>{const actual=readOwned(file,{missing:true});return same(actual,state.before[index])||same(actual,state.after[index]);}),'STALE_REVISION');
      for(let index=0;index<files.length;index++){
        if(original[index]===null){if(readOwned(files[index],{missing:true})!==null)fs.unlinkSync(files[index]);}
        else atomicPrivate(files[index],original[index]);
      }
      pending.delete(proposal.proposalId);return {verified:files.every((file,index)=>same(readOwned(file,{missing:true}),original[index]))};
    },
    release:proposal=>pending.delete(proposal.proposalId),
  };
}

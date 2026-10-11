import path from 'node:path';
import {securitySettings} from '../hud-server/security-posture.js';
import {environment} from './configuration.js';
import {readOwned} from './files.js';

const unavailable=reason=>({available:false,freshness:'unknown',reason});
/** A daemon observation is evidence about that daemon's federation preflight,
 * never certification of every tool, host process or external client. */
export function projectPosture(value,now=Date.now()){
  if(!value||!['production','testing'].includes(value.mode)||!['enforced','degraded','testing'].includes(value.state)||!Array.isArray(value.controls)||!Number.isFinite(value.computed_at))return unavailable('The selected daemon returned an incompatible posture report.');
  const names=new Set();
  for(const control of value.controls){
    if(!control||typeof control.name!=='string'||names.has(control.name)||typeof control.available!=='boolean')return unavailable('The selected daemon returned ambiguous control observations.');
    names.add(control.name);
  }
  const fresh=stamp=>Number.isFinite(stamp)&&now-stamp*1000>=-5000&&now-stamp*1000<=60000;
  const project=(name,extra=true)=>{
    const control=value.controls.find(item=>item.name===name);
    const state=!control?'unavailable':!fresh(value.computed_at)||!fresh(control.probed_at)?'stale':value.mode!=='production'?'disabled-for-federation':control.available&&extra?'reported-enforced':'degraded';
    return {control:name,state,available:control?.available??null,probedAt:Number.isFinite(control?.probed_at)?new Date(control.probed_at*1000).toISOString():null,
      detail:typeof control?.detail==='string'?control.detail.slice(0,4096):null};
  };
  return {available:true,freshness:fresh(value.computed_at)?'observed':'stale',reportedState:value.state,mode:value.mode,
    computedAt:new Date(value.computed_at*1000).toISOString(),strictAll:value.strict_all===true,
    defenseclaw:project('model-guard',value.model?.guarded===true),hostConfinement:project('sandbox'),audit:project('audit'),
    openshell:{state:'unverified',reason:'The daemon sandbox control reports host-level confinement. It does not identify an OpenShell gateway, sandbox or active policy.'},
    scope:'Selected federation daemon self-report. Freshness is limited to 60 seconds. This does not certify unrelated services, every tool or external assistants.'};
}

export async function securitySnapshot(binding,readFederation){
  binding.assertCurrent();let defense=null,configurationReason;
  try{
    const bytes=readOwned(path.join(binding.home,'config/openclaw.json'),{missing:true,limit:1024*1024});if(bytes)defense=JSON.parse(bytes);
  }catch{configurationReason='The selected installation’s DefenseClaw configuration is unreadable, unsafe or incompatible.';}
  const configured={...securitySettings(environment(binding),defense,null),source:'Selected installation .env and owned config/openclaw.json. No global guard configuration was adopted.',...(configurationReason?{warning:configurationReason}:{})};
  let effective;
  try{const result=await readFederation('posture');binding.assertCurrent();effective={...projectPosture(result.value),source:result.source};}
  catch(error){if(error.code==='IDENTITY_CHANGED')throw error;effective=unavailable('No current posture could be read from this installation’s federation daemon. Stored settings are not evidence of enforcement.');}
  return {configured,effective,controls:{settings:{supported:false,reason:'Guard and confinement mutations need qualified ownership, runtime and rollback adapters.'},scans:{supported:false,reason:'Component scan execution is not qualified for the selected installation.'},
    openshell:{supported:false,reason:'A gateway/sandbox ownership binding and qualified CLI version are required. No installer or ambient gateway command is invoked.'}}};
}

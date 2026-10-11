import path from 'node:path';
import {withManagementConfigurationLock} from '../management/shared-lock.js';
import {readOwned,atomicPrivate} from '../management/files.js';
import {invariant} from '../management/errors.js';

export const budgetFields=Object.freeze({sessionBudgetUsd:[0,1000000],maxToolCallsPerTurn:[0,10000,true],contextWarningTokens:[0,10000000,true],allowOverride:'boolean',overrideIncrementUsd:[0,1000000]});
export function checkedBudget(value){
  invariant(value&&typeof value==='object'&&!Array.isArray(value));
  for(const [key,input] of Object.entries(value)){
    invariant(Object.hasOwn(budgetFields,key),'UNSUPPORTED');const rule=budgetFields[key];
    invariant(rule==='boolean'?typeof input==='boolean':typeof input==='number'&&Number.isFinite(input)&&input>=rule[0]&&input<=rule[1]&&(!rule[2]||Number.isInteger(input)));
  }
  return value;
}
export function patchBudgetConfiguration(config,{budget,interfaceDefaults}){
  invariant(config&&typeof config==='object'&&!Array.isArray(config));
  if(budget)checkedBudget(budget);
  if(interfaceDefaults){
    invariant(typeof interfaceDefaults==='object'&&!Array.isArray(interfaceDefaults));
    for(const [name,value] of Object.entries(interfaceDefaults)){
      invariant(['openai','tui','discord','n2n','alert','explicit','hud'].includes(name),'UNSUPPORTED');
      invariant(value&&typeof value==='object'&&!Array.isArray(value));
      invariant(Object.keys(value).every(key=>['model','thinkingLevel','budget'].includes(key)));
      if(value.model!==undefined)invariant(typeof value.model==='string'&&/^[\w./:-]{1,200}$/.test(value.model));
      if(value.thinkingLevel!==undefined)invariant(['off','minimal','low','medium','high','xhigh','max','ultra'].includes(value.thinkingLevel));
      if(value.budget)checkedBudget(value.budget);
    }
  }
  const result=structuredClone(config);
  result.agents||={};result.agents.defaults||={};
  const defaults=result.agents.defaults;
  if(budget)defaults.budget={...defaults.budget,...budget};
  if(interfaceDefaults){defaults.interfaceDefaults||={};for(const [name,value] of Object.entries(interfaceDefaults))defaults.interfaceDefaults[name]={...defaults.interfaceDefaults[name],...value,...(value.budget?{budget:{...defaults.interfaceDefaults[name]?.budget,...value.budget}}:{})};}
  return result;
}
/** The lock includes the read, merge and write, not just the final rename. */
export function updateBudgetConfiguration(home,patch){
  return withManagementConfigurationLock(home,()=>{
    const file=path.join(home,'openclaw.json'),config=JSON.parse(readOwned(file,{limit:4*1024*1024}));
    const result=patchBudgetConfiguration(config,patch);atomicPrivate(file,JSON.stringify(result,null,2)+'\n');return result;
  });
}

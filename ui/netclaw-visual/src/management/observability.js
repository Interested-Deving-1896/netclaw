import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {createHash} from 'node:crypto';
import {readOwned} from './files.js';
import {invariant} from './errors.js';
import {environment} from './configuration.js';
import {selectLogRows,tailFile} from '../hud-server/logs.js';

export function ownedLogSources(binding){
  return binding.kind==='openclaw'?[
    {id:'gateway',name:'Selected OpenClaw gateway',file:path.join(binding.home,'logs/gateway.log')},
    {id:'gateway-errors',name:'Selected OpenClaw gateway errors',file:path.join(binding.home,'logs/gateway.err.log')},
  ]:[{id:'hermes-companion',name:'Selected Hermes HUD companion',file:path.join(binding.statePath,'companion.log')},
    {id:'hermes-federation',name:'Selected Hermes federation companion',file:path.join(binding.home,'netclaw-federation/companion.log')}];
}
export function installationLogs(binding,input,{cleanText=value=>value}={}){
  binding.assertCurrent();const sources=ownedLogSources(binding);
  if(!input.id)return {sources:sources.map(({file,...value})=>value),scope:'Only logs inside the selected installation. Shared /tmp files and ambient system services are excluded.'};
  const source=sources.find(row=>row.id===input.id);invariant(source,'DENIED');
  try{
    const real=fs.realpathSync(source.file),stat=fs.lstatSync(source.file);
    invariant(real===source.file&&real.startsWith(binding.home+path.sep)&&stat.uid===process.getuid()&&stat.isFile()&&!stat.isSymbolicLink()&&!(stat.mode&0o022),'DENIED');
    const tail=tailFile(source.file,{expected:stat}),selection=selectLogRows(tail.content,{query:input.filters?.query||'',severity:input.filters?.severity||'all',since:input.filters?.since,until:input.filters?.until,cleanText}),rows=selection.rows;
    const offset=Number(input.cursor||0);invariant(Number.isSafeInteger(offset)&&offset>=0);
    const limit=input.limit||100;
    return {available:true,source:source.id,rows:rows.slice(offset,offset+limit),total:rows.length,...(offset+limit<rows.length?{nextCursor:String(offset+limit)}:{}),truncated:tail.truncated||selection.truncated,
      undatedExcluded:selection.undatedExcluded,totalMatches:selection.totalMatches,timeWindow:{since:input.filters?.since||null,until:input.filters?.until||null},
      sourceReference:{sourceId:source.id,fileIdentity:createHash('sha256').update(`${binding.installationId}:${stat.dev}:${stat.ino}`).digest('hex'),byteStart:tail.byteStart,byteEnd:tail.byteEnd,fileSize:tail.fileSize,modifiedAt:tail.modifiedAt},
      readAt:new Date().toISOString(),scope:'Latest 256 KiB and up to 250 filtered rows. Text timestamps require an explicit timezone; numeric timestamps require timestampUnit seconds/milliseconds. Ambiguous or undated rows are shown without a time filter and explicitly excluded with one. Severity is inferred where absent. References identify the observed file/tail; logs may rotate. This is historical evidence, not a health probe.'};
  }catch(error){if(error.code==='DENIED'||error.code==='INVALID_INPUT')throw error;return {available:false,source:source.id,reason:'This installation log is missing, unreadable or not a regular owned file.'};}
}
export function ownedUsage(journal,principal,window){
  const since=window?Date.now()-({day:1,week:7,month:30}[window])*86400000:0;
  const operations=journal.list(principal,{limit:500}).filter(row=>row.kind==='conversation-request'&&Date.parse(row.admittedAt)>=since);
  const completed=operations.filter(row=>row.state==='succeeded'),records=completed.map(row=>({operationId:row.operationId,admittedAt:row.admittedAt,usage:row.result?.usage??null,source:row.result?.source||'Owned request result'}));
  return {available:records.length>0,records,missingUsage:records.filter(row=>row.usage===null).length,scope:'Up to 500 most recent management operations; only completed owned conversation requests are projected. Other HUD/terminal sessions and remote members are excluded.',
    window:window||'retained',windowBasis:'Management admission time',aggregateCostUsd:null,reason:'Raw reported usage is retained. Unknown model pricing and missing counters are not estimated.'};
}
export function configuredNetwork(binding){
  const configured=environment(binding).PYATS_TESTBED_PATH;
  if(!configured)return {available:false,sourceKind:'configured',reason:'No testbed path is configured in this installation. No device has been queried.'};
  invariant(path.isAbsolute(configured)&&!/[\r\n\0]/.test(configured),'INVALID_INPUT');
  try{
    const content=readOwned(configured,{limit:2*1024*1024}),value=yaml.load(content.toString());
    invariant(value&&typeof value==='object'&&!Array.isArray(value)&&value.devices&&typeof value.devices==='object','SOURCE_UNAVAILABLE');
    const entries=Object.entries(value.devices);invariant(entries.length<=10000,'SOURCE_UNAVAILABLE');
    const short=value=>typeof value==='string'?value.slice(0,200):null;
    return {available:true,sourceKind:'configured',devices:entries.map(([id,device])=>({id:id.slice(0,200),os:short(device?.os),platform:short(device?.platform),type:short(device?.type),observedState:null})),
      edges:[],scope:'Configured pyATS testbed names and platforms. Credentials and connection details are excluded. Configuration does not establish live topology or device reachability.'};
  }catch{return {available:false,sourceKind:'configured',reason:'The configured testbed is unavailable or invalid. No device has been queried.'};}
}

import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {parseDocument} from 'yaml';
import {ownedDirectory,readOwned,atomicPrivate} from './files.js';
import {invariant} from './errors.js';
import {digest} from './journal.js';
import {configurationChangeClass} from './configuration.js';
import {redactor} from './evidence.js';

export const defenseBindingPath=binding=>path.join(binding.statePath,'defenseclaw-binding.json');
const unavailable=reason=>({available:false,state:'unavailable',reason});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const samePath=(value,expected)=>typeof value==='string'&&path.isAbsolute(value)&&value===expected;

/** The v8 file adapter never runs DefenseClaw's CLI startup: even `status`
 * initializes/migrates its store. It binds an explicit single-connector home;
 * multi-connector adoption needs separate per-resource ownership evidence. */
export class DefenseClawComponent{
  constructor(binding){this.binding=binding;}
  record(){
    this.binding.assertCurrent();const bytes=readOwned(defenseBindingPath(this.binding),{missing:true,limit:8192});if(!bytes)return null;
    const value=JSON.parse(bytes);
    invariant(value.schemaVersion===1&&value.installationId===this.binding.installationId&&value.hostId===this.binding.hostId&&value.runtime===this.binding.kind,'IDENTITY_CHANGED');
    invariant(Object.keys(value).every(key=>['schemaVersion','installationId','hostId','runtime','directory','registeredAt','format'].includes(key))&&value.format==='defenseclaw-v8','INCOMPATIBLE');return value;
  }
  read(record=this.record()){
    invariant(record,'UNQUALIFIED');ownedDirectory(record.directory);
    const file=path.join(record.directory,'config.yaml'),bytes=readOwned(file,{limit:1024*1024});
    const document=parseDocument(bytes.toString(),{uniqueKeys:true,schema:'core'});invariant(document.errors.length===0,'INCOMPATIBLE');
    const config=document.toJS({maxAliasCount:0});
    invariant(object(config)&&config.config_version===8&&object(config.claw)&&object(config.guardrail),'INCOMPATIBLE');
    invariant(samePath(config.claw.home_dir,this.binding.home)&&samePath(config.claw.config_file,this.binding.configPath),'IDENTITY_CHANGED');
    const connector=config.guardrail.connector||config.claw.mode;
    invariant(connector===this.binding.kind&&config.claw.mode===this.binding.kind,'IDENTITY_CHANGED');
    const connectors=config.guardrail.connectors;
    invariant(connectors===undefined||object(connectors),'INCOMPATIBLE');
    invariant(!connectors||Object.keys(connectors).length===0||Object.keys(connectors).length===1&&Object.hasOwn(connectors,connector),'UNQUALIFIED');
    const override=connectors?.[connector];invariant(override===undefined||object(override),'INCOMPATIBLE');
    const guard=config.guardrail,mode=override?.mode||guard.mode||'observe';
    invariant(typeof guard.enabled==='boolean'&&['observe','action'].includes(mode)&&(!override||override.enabled===undefined||override.enabled===null||typeof override.enabled==='boolean'),'INCOMPATIBLE');
    invariant(['open','closed'].includes(override?.hook_fail_mode||guard.hook_fail_mode||'open'),'INCOMPATIBLE');
    // Relative store paths follow upstream config v8. Paths outside the explicitly
    // bound private component directory are not inherited from ambient settings.
    const configuredStore=config.observability?.local?.path||'audit.db';invariant(typeof configuredStore==='string'&&!configuredStore.includes('\0'),'INCOMPATIBLE');
    const database=path.resolve(record.directory,configuredStore);
    invariant(path.dirname(database)===record.directory,'UNQUALIFIED');
    const secrets=[];const visit=(value,depth=0)=>{
      invariant(depth<24,'INCOMPATIBLE');if(!object(value))return;
      for(const [key,item] of Object.entries(value)){if(/key|token|password|secret|credential/i.test(key)&&typeof item==='string'&&item)secrets.push(item);else if(object(item))visit(item,depth+1);}
    };visit(config);
    const env=readOwned(path.join(record.directory,'.env'),{missing:true,limit:1024*1024});
    if(env)for(const line of env.toString().split('\n')){const at=line.indexOf('=');if(at>0){const value=line.slice(at+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(value)secrets.push(value);}}
    return {record,file,bytes,document,config,connector,database,secrets,configured:{enabled:guard.enabled&&override?.enabled!==false,mode:mode==='action'?'enforce':'observe',
      failMode:override?.hook_fail_mode||guard.hook_fail_mode||'open',schemaVersion:8,source:'Owned DefenseClaw config.yaml; stored policy only'}};
  }
  files(){const record=this.record();return [defenseBindingPath(this.binding),...(record?[path.join(record.directory,'config.yaml')]:[])];}
  assertSame(before){const current=this.read();invariant(digest(current.record)===digest(before.record)&&current.bytes.equals(before.bytes),'STALE_REVISION');return current;}
  async register({directory},{reviewed=false,audit}={}){
    this.binding.assertCurrent();const record={schemaVersion:1,installationId:this.binding.installationId,hostId:this.binding.hostId,runtime:this.binding.kind,directory,format:'defenseclaw-v8'};
    const value=this.read(record),preview={directory,connector:value.connector,format:record.format,configured:value.configured,
      scope:'Explicit single-connector component. Registration does not start a guard, change hooks, scan components or migrate its store.'};
    if(reviewed){
      invariant(audit,'AUDIT_UNAVAILABLE');await audit.record({action:'defenseclaw-binding',state:'before-register'});this.binding.assertCurrent();
      invariant(this.read(record).bytes.equals(value.bytes),'STALE_REVISION');atomicPrivate(defenseBindingPath(this.binding),JSON.stringify({...record,registeredAt:new Date().toISOString()},null,2)+'\n');
    }return preview;
  }
  history(value){
    let directory,db;
    try{
      // Snapshot both database and WAL into management-owned scratch. Opening
      // the original via SQLite can create sidecars even in read-only mode.
      const database=readOwned(value.database,{limit:64*1024*1024}),wal=readOwned(value.database+'-wal',{missing:true,limit:16*1024*1024});
      directory=fs.mkdtempSync(path.join(this.binding.statePath,'.defense-read-'));fs.chmodSync(directory,0o700);
      const snapshot=path.join(directory,'audit.db');fs.writeFileSync(snapshot,database,{mode:0o600});if(wal)fs.writeFileSync(snapshot+'-wal',wal,{mode:0o600});
      const freshWal=readOwned(value.database+'-wal',{missing:true,limit:16*1024*1024});
      invariant(readOwned(value.database,{limit:64*1024*1024}).equals(database)&&(wal===null?freshWal===null:freshWal!==null&&wal.equals(freshWal)),'BUSY');
      db=new DatabaseSync(snapshot,{readOnly:true,allowExtension:false});db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
      for(const name of ['audit_events','scan_results','actions'])invariant(db.prepare("SELECT type FROM sqlite_master WHERE name=?").get(name)?.type==='table','INCOMPATIBLE');
      const list=(sql,...args)=>{const rows=db.prepare(sql).all(...args);return {items:rows.slice(0,100),truncated:rows.length>100,limit:100};};
      const events=list("SELECT substr(id,1,200) AS id,substr(timestamp,1,80) AS timestamp,substr(action,1,100) AS action,substr(target,1,256) AS target,substr(severity,1,30) AS severity FROM audit_events WHERE connector=? ORDER BY timestamp DESC LIMIT 101",value.connector);
      const scans=list('SELECT substr(id,1,200) AS id,substr(scanner,1,100) AS scanner,substr(target,1,256) AS target,substr(timestamp,1,80) AS timestamp,duration_ms AS durationMs,finding_count AS findings,substr(max_severity,1,30) AS severity FROM scan_results ORDER BY timestamp DESC LIMIT 101');
      const rules=list("SELECT substr(id,1,200) AS id,substr(target_name,1,256) AS tool,substr(actions_json,1,4096) AS policy,substr(updated_at,1,80) AS updatedAt FROM actions WHERE target_type='tool' AND (connector='' OR connector=?) AND (target_name NOT LIKE '@%' OR target_name LIKE ?) ORDER BY updated_at DESC LIMIT 101",value.connector,`@${value.connector}/%`);
      for(const row of rules.items){const state=JSON.parse(row.policy);row.policy=['block','allow'].includes(state.install)?state.install:'scan';row.scope=row.tool.startsWith('@')?'connector':row.tool.includes('/')?'source-audit-only':'global-fallback';}
      this.assertSame(value);
      return redactor(value.secrets)({available:true,events,scans,rules,source:'Bound DefenseClaw retained local store snapshot; summaries exclude prompts, raw findings, reasons and credentials.',scope:'Selected single-connector component. Scan records are historical, not evidence of current enforcement.'});
    }catch(error){if(error.code==='IDENTITY_CHANGED')throw error;return unavailable('The retained component store is missing, changing, unsafe or incompatible. No database was created or migrated.');}
    finally{db?.close();if(directory)fs.rmSync(directory,{recursive:true,force:true});}
  }
  snapshot(){
    try{const value=this.read();return {available:true,connector:value.connector,configured:value.configured,history:this.history(value),
      effective:{state:'unverified',reason:'Stored component policy does not prove a running hook or proxy enforced a request. Federation observations are shown separately.'},
      settings:{supported:value.configured.enabled,modes:value.configured.enabled?['observe','enforce','disabled']:[],effect:'Save only. Effective state requires a separately qualified component restart and observation. Enabling a disabled guard requires its normal backend hook setup.'},
      scans:{supported:false,reason:'Retained scan summaries are readable. Starting component scanners still requires a qualified disclosure, execution and cancellation adapter.'}};
    }catch(error){if(error.code==='IDENTITY_CHANGED')throw error;return unavailable('No compatible explicitly owned DefenseClaw v8 component is bound. Use the backend binding preview; no global component is adopted.');}
  }
  adapter(){
    const pending=new Map(),component=this;
    function plan(value,mode){
      invariant(['observe','enforce','disabled'].includes(mode));
      const prefix=value.config.guardrail.connectors?.[value.connector]?['guardrail','connectors',value.connector]:['guardrail'];
      if(mode==='disabled')value.document.setIn([...prefix,'enabled'],false);
      else{
        // Enabling hooks may require changing another runtime's files. This
        // adapter only changes mode on an already enabled connector.
        invariant(value.configured.enabled,'UNQUALIFIED');value.document.setIn([...prefix,'mode'],mode==='enforce'?'action':'observe');
      }
      return Buffer.from(value.document.toString());
    }
    return {qualified:true,resource:'configuration',
      async prepare(input){
        invariant(input.targets.length===1&&input.targets[0]===component.binding.installationId,'DENIED');const value=component.read();plan(value,input.patch.mode);
        const baseline=Buffer.from(JSON.stringify({format:1,record:value.record,bytes:value.bytes.toString('base64')}));
        return {baseline,rollback:baseline,changeClass:configurationChangeClass(component.binding),impact:'Save the selected DefenseClaw connector mode. No hook installation, guard restart, provider request or tool execution occurs. Running enforcement remains unverified until independently observed.'};
      },
      async apply(proposal,{baseline,replacements}){
        invariant(Object.keys(replacements||{}).length===0);const saved=JSON.parse(baseline),value=component.read();
        invariant(saved.format===1&&digest(saved.record)===digest(value.record)&&value.bytes.equals(Buffer.from(saved.bytes,'base64')),'STALE_REVISION');
        const after=plan(value,proposal.patch.mode);component.assertSame(value);pending.set(proposal.proposalId,{record:value.record,file:value.file,before:value.bytes,after});atomicPrivate(value.file,after);return {expected:after};
      },
      async verify(proposal,result){return {verified:component.read().bytes.equals(result.expected),pendingRestart:true};},
      async rollback(proposal,bytes){
        const saved=JSON.parse(bytes),value=component.read(),state=pending.get(proposal.proposalId),original=Buffer.from(saved.bytes,'base64');
        invariant(saved.format===1&&digest(saved.record)===digest(value.record),'IDENTITY_CHANGED');
        invariant(value.bytes.equals(original)||state&&value.bytes.equals(state.after),'STALE_REVISION');
        if(!value.bytes.equals(original))atomicPrivate(value.file,original);return {verified:component.read().bytes.equals(original)};
      },release:proposal=>pending.delete(proposal.proposalId),
    };
  }
}

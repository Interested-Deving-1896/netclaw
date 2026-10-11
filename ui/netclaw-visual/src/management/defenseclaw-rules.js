import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {ownedFile,readOwned} from './files.js';
import {invariant} from './errors.js';
import {digest} from './journal.js';
import {configurationChangeClass} from './configuration.js';

const columns=['id','target_type','target_name','source_path','actions_json','reason','updated_at','connector'];
const toolName=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/.test(value);
const same=(a,b)=>digest(a)===digest(b);
const identity=file=>{const stat=ownedFile(file);return {device:stat.dev,inode:stat.ino};};
const state=row=>{
  if(!row)return {};
  invariant(typeof row.actions_json==='string'&&row.actions_json.length<=4096,'INCOMPATIBLE');
  const value=JSON.parse(row.actions_json);
  invariant(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['install','file','runtime'].includes(key)),'INCOMPATIBLE');
  invariant(['',undefined,'block','allow'].includes(value.install)&&['',undefined,'quarantine'].includes(value.file)&&['',undefined,'disable'].includes(value.runtime),'INCOMPATIBLE');return value;
};

/** V8 connector tool policy only. Never executes a tool/scanner, moves a file,
 * initializes a component or writes the global/other-connector fallback. */
export class DefenseToolRules{
  constructor(component,journal){this.component=component;this.binding=component.binding;this.journal=journal;}
  schema(db){
    invariant(db.prepare("SELECT type FROM sqlite_master WHERE name='actions'").get()?.type==='table','INCOMPATIBLE');
    const fields=db.prepare("SELECT name,type,pk FROM pragma_table_info('actions')").all();
    invariant(fields.length===columns.length&&fields.every((row,index)=>row.name===columns[index]&&['TEXT','DATETIME'].includes(row.type.toUpperCase()))&&fields[0].pk===1,'INCOMPATIBLE');
    invariant(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND tbl_name='actions'").get(),'UNQUALIFIED');
    const indices=db.prepare("SELECT name FROM pragma_index_list('actions') WHERE \"unique\"=1").all();
    invariant(indices.some(row=>same(db.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(row.name).map(field=>field.name),['target_type','target_name','connector'])),'INCOMPATIBLE');
  }
  rows(db,connector,tool){
    this.schema(db);const get=name=>{
      const row=db.prepare('SELECT '+columns.join(',')+" FROM actions WHERE target_type='tool' AND target_name=? AND connector='' LIMIT 2").all(name);
      invariant(row.length<=1,'INCOMPATIBLE');const value=row[0]||null;state(value);return value;
    };
    return {scoped:get(`@${connector}/${tool}`),fallback:get(tool)};
  }
  observe(tool){
    invariant(toolName(tool),'INVALID_INPUT');const value=this.component.read(),file=value.database,dbIdentity=identity(file);
    // Copy a stable private DB/WAL pair; a read must not create live sidecars.
    invariant(!fs.existsSync(file+'-journal'),'BUSY');
    const bytes=readOwned(file,{limit:64*1024*1024}),wal=readOwned(file+'-wal',{missing:true,limit:16*1024*1024});
    let directory,db;
    try{
      directory=fs.mkdtempSync(path.join(this.binding.statePath,'.defense-rule-read-'));fs.chmodSync(directory,0o700);
      const copy=path.join(directory,'audit.db');fs.writeFileSync(copy,bytes,{mode:0o600});if(wal)fs.writeFileSync(copy+'-wal',wal,{mode:0o600});
      const nextWal=readOwned(file+'-wal',{missing:true,limit:16*1024*1024});
      invariant(same(dbIdentity,identity(file))&&readOwned(file,{limit:64*1024*1024}).equals(bytes)&&(wal===null?nextWal===null:nextWal!==null&&wal.equals(nextWal)),'BUSY');
      db=new DatabaseSync(copy,{readOnly:true,allowExtension:false});db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
      const rows=this.rows(db,value.connector,tool);this.component.assertSame(value);
      const observed={format:1,installationId:this.binding.installationId,record:value.record,config:value.bytes.toString('base64'),database:file,dbIdentity,connector:value.connector,tool,...rows};
      return {...observed,revision:digest(observed)};
    }finally{db?.close();if(directory)fs.rmSync(directory,{recursive:true,force:true});}
  }
  snapshot(tool){return this.view(this.observe(tool));}
  view(value){
    const scoped=state(value.scoped),fallback=state(value.fallback);
    return {installationId:value.installationId,connector:value.connector,tool:value.tool,revision:value.revision,override:scoped.install||'inherit',fallback:fallback.install||'scan',effective:scoped.install||fallback.install||'scan',
      logicalFlags:{file:scoped.file||null,runtime:scoped.runtime||null},policies:['block','allow','inherit'],
      scope:'Stored connector policy resolution. A running guard and enforced request are separate evidence. Allow bypasses rule/pattern/judge scanning; write-tool content still uses the existing CodeGuard path. Allow also clears this scoped row’s logical file/runtime flags, without restoring or moving files. Inherit removes the scoped install override and uses the global fallback.'};
  }
  validBaseline(bytes){
    const saved=JSON.parse(bytes);invariant(saved.format===1&&saved.installationId===this.binding.installationId&&toolName(saved.tool),'IDENTITY_CHANGED');
    const {revision,...body}=saved;invariant(revision===digest(body),'STALE_REVISION');return saved;
  }
  current(saved){
    const value=this.component.read();invariant(same(value.record,saved.record)&&value.bytes.toString('base64')===saved.config&&value.database===saved.database&&value.connector===saved.connector&&same(identity(value.database),saved.dbIdentity),'STALE_REVISION');return value;
  }
  plan(saved,proposal){
    const policy=proposal.patch.policy;invariant(['block','allow','inherit'].includes(policy),'INVALID_INPUT');
    const fields={...state(saved.scoped)};
    if(policy==='inherit')delete fields.install;else fields.install=policy;
    if(policy==='allow'){delete fields.file;delete fields.runtime;}
    if(policy==='inherit'&&!Object.keys(fields).length&&!saved.scoped?.source_path)return null;
    return {...(saved.scoped||{id:randomUUID(),target_type:'tool',target_name:`@${saved.connector}/${saved.tool}`,source_path:null,connector:''}),actions_json:JSON.stringify(fields),
      reason:`NetClaw reviewed ${policy} policy; proposal ${proposal.proposalId}`,updated_at:new Date().toISOString()};
  }
  mutate(saved,expected,next,{checkFallback=false}={}){
    const value=this.current(saved);for(const suffix of ['-wal','-shm'])if(fs.existsSync(value.database+suffix))ownedFile(value.database+suffix);
    let db;
    try{
      db=new DatabaseSync(value.database,{allowExtension:false});db.exec('PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=2000; BEGIN IMMEDIATE;');
      this.current(saved);const observed=this.rows(db,saved.connector,saved.tool);invariant(same(observed.scoped,expected),'STALE_REVISION');
      if(checkFallback)invariant(same(observed.fallback,saved.fallback),'STALE_REVISION');
      if(next){
        db.prepare('INSERT INTO actions ('+columns.join(',')+') VALUES ('+columns.map(()=>'?').join(',')+') ON CONFLICT(target_type,target_name,connector) DO UPDATE SET '+columns.filter(name=>!['target_type','target_name','connector'].includes(name)).map(name=>`${name}=excluded.${name}`).join(',')).run(...columns.map(name=>next[name]));
      }else db.prepare("DELETE FROM actions WHERE target_type='tool' AND target_name=? AND connector=''").run(`@${saved.connector}/${saved.tool}`);
      invariant(same(this.rows(db,saved.connector,saved.tool).scoped,next),'UNKNOWN_OUTCOME');this.current(saved);db.exec('COMMIT');
    }catch(error){if(db){try{db.exec('ROLLBACK');}catch{}}throw error;}
    finally{db?.close();}
  }
  adapter(){
    const rules=this;
    return {qualified:true,resource:'configuration',
      async prepare(input,principal){
        invariant(principal.surface==='operator'&&input.targets.length===1&&input.targets[0]===rules.binding.installationId,'DENIED');
        const saved=rules.observe(input.patch.tool);invariant(saved.revision===input.patch.expectedRuleRevision,'STALE_REVISION');rules.plan(saved,{patch:input.patch,proposalId:'preview'});
        const baseline=Buffer.from(JSON.stringify(saved)),view=rules.view(saved);
        return {baseline,rollback:baseline,changeClass:configurationChangeClass(rules.binding),impact:`Set only @${saved.connector}/${saved.tool} to ${input.patch.policy}. Current stored resolution: ${view.effective}; global fallback: ${view.fallback}. ${view.scope} No tool execution, physical quarantine, file restoration or guard restart occurs. Already dispatched work may continue.`};
      },
      async validate(proposal,{baseline}){
        const saved=rules.validBaseline(baseline);invariant(proposal.patch.tool===saved.tool&&proposal.patch.expectedRuleRevision===saved.revision,'DENIED');
        invariant(rules.observe(saved.tool).revision===saved.revision,'STALE_REVISION');
      },
      async apply(proposal,{baseline,replacements,revalidate}){
        invariant(!Object.keys(replacements||{}).length,'DENIED');const saved=rules.validBaseline(baseline);await revalidate();
        invariant(rules.observe(saved.tool).revision===saved.revision,'STALE_REVISION');const after=rules.plan(saved,proposal);
        // Retain the exact intended row before effect. It is a recovery record,
        // not evidence of commit. Recovery always compares the actual store.
        rules.journal.put('defense-rule-recovery',proposal.proposalId,rules.binding.principal,{actionDigest:proposal.actionDigest,beforeRevision:saved.revision,after});
        rules.mutate(saved,saved.scoped,after,{checkFallback:true});return {after};
      },
      async verify(proposal,result){
        const now=rules.observe(proposal.patch.tool);return {verified:same(now.scoped,result.after),observedState:'Stored connector policy verified; running enforcement remains unverified'};
      },
      async rollback(proposal,bytes){
        const saved=rules.validBaseline(bytes);rules.current(saved);const observed=rules.observe(saved.tool);
        if(same(observed.scoped,saved.scoped))return {verified:true};
        const record=rules.journal.record('defense-rule-recovery',proposal.proposalId,rules.binding.principal);
        invariant(record.actionDigest===proposal.actionDigest&&record.beforeRevision===saved.revision&&same(observed.scoped,record.after),'STALE_REVISION');
        rules.mutate(saved,record.after,saved.scoped);return {verified:same(rules.observe(saved.tool).scoped,saved.scoped)};
      },
    };
  }
}

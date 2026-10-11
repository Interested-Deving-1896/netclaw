import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {readOwned,atomicPrivate} from './files.js';
import {invariant} from './errors.js';
import {safeError} from './errors.js';
import {parseEnvData} from '../security/private-files.js';
import {digest} from './journal.js';

const exec=promisify(execFile),ids=['gateway','federation','hermes-companion'];
const sourceRoot=fileURLToPath(new URL('../../../../',import.meta.url)).replace(/\/$/,'');
export const serviceRegistryPath=binding=>path.join(binding.statePath,'managed-services.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const samePath=(value,expected)=>typeof value==='string'&&path.isAbsolute(value)&&path.resolve(value)===expected;
const words=text=>{
  const tokens=text.match(/"(?:[^"\\]|\\.)*"|[^\s"]+/g)||[];
  invariant(tokens.join(' ')===text.trim().replace(/\s+/g,' '),'UNQUALIFIED');
  return tokens.map(token=>token.startsWith('"')?JSON.parse(token):token);
};
function readableDefinition(file){
  const bytes=readOwned(file,{privateMode:false,limit:256*1024});invariant(!(fs.statSync(file).mode&0o022),'DENIED');return bytes;
}
function selection(binding,env){
  const selected=binding.kind==='hermes'?env.HERMES_HOME:env.OPENCLAW_STATE_DIR||env.OPENCLAW_HOME;
  invariant(samePath(selected,binding.home),'IDENTITY_CHANGED');
  if(env.OPENCLAW_CONFIG_PATH&&binding.kind==='openclaw')invariant(samePath(env.OPENCLAW_CONFIG_PATH,binding.configPath),'IDENTITY_CHANGED');
  if(env.NETCLAW_RUNTIME)invariant(env.NETCLAW_RUNTIME===binding.kind,'IDENTITY_CHANGED');
  if(env.NETCLAW_INSTALLATION_ID)invariant(env.NETCLAW_INSTALLATION_ID===binding.installationId,'IDENTITY_CHANGED');
}

/** Only definitions under the authenticated user's service-manager directory
 * are eligible. An explicit backend registration stores their reviewed hashes. */
export class OwnedServiceController{
  constructor(binding,{ready,run=exec,platform=process.platform,userHome=os.homedir(),readProcessEnvironment=pid=>Object.fromEntries(readOwned(`/proc/${pid}/environ`,{privateMode:false,limit:256*1024}).toString().split('\0').filter(Boolean).map(item=>{const at=item.indexOf('=');return [item.slice(0,at),item.slice(at+1)];}))}={}){Object.assign(this,{binding,readyProbe:ready,run,platform,userHome,readProcessEnvironment});}
  async command(program,args){
    const env=Object.fromEntries(['PATH','HOME','USER','LOGNAME','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS'].flatMap(key=>process.env[key]===undefined?[]:[[key,process.env[key]]]));
    return this.run(program,args,{timeout:15000,maxBuffer:256*1024,encoding:'utf8',shell:false,env});
  }
  registry(){
    this.binding.assertCurrent();const bytes=readOwned(serviceRegistryPath(this.binding),{missing:true,limit:32768});
    if(!bytes)return {schemaVersion:1,installationId:this.binding.installationId,hostId:this.binding.hostId,runtime:this.binding.kind,services:{}};
    const value=JSON.parse(bytes);
    invariant(value.schemaVersion===1&&value.installationId===this.binding.installationId&&value.hostId===this.binding.hostId&&value.runtime===this.binding.kind,'IDENTITY_CHANGED');
    invariant(value.services&&typeof value.services==='object'&&!Array.isArray(value.services)&&Object.keys(value.services).every(key=>ids.includes(key)),'INCOMPATIBLE');
    return value;
  }
  async definition(record){
    const systemd=this.platform==='linux';invariant(systemd||this.platform==='darwin','UNQUALIFIED');
    invariant(record.manager===(systemd?'systemd':'launchd'),'UNQUALIFIED');
    invariant(typeof record.unit==='string'&&(systemd?/^(?:netclaw-[a-z0-9.-]+|openclaw-gateway(?:-[a-z0-9.-]+)?)\.service$/:/^ai\.(?:netclaw|openclaw)\.[a-zA-Z0-9.-]+$/).test(record.unit),'DENIED');
    const directory=path.join(this.userHome,systemd?'.config/systemd/user':'Library/LaunchAgents');
    const file=path.join(directory,record.unit+(systemd?'':'.plist'));
    invariant(record.definitionPath===file,'DENIED');
    const bytes=readableDefinition(file),files=[{path:file,sha256:hash(bytes)}];let env={},program,programArguments;
    if(systemd){
      const text=bytes.toString();invariant(!/\\\r?\n|^\s*(?:PassEnvironment|UnsetEnvironment|RootDirectory|RootImage|User|Group)\s*=/m.test(text),'UNQUALIFIED');
      const entries=[];let section;
      for(const raw of text.split(/\r?\n/)){
        const line=raw.trim();if(!line||/^[#;]/.test(line))continue;
        if(/^\[[A-Za-z]+\]$/.test(line)){section=line;continue;}
        const field=line.match(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.*)$/);invariant(field,'UNQUALIFIED');
        if(section==='[Service]')entries.push(field[1]+'='+field[2]);
      }
      for(const line of entries.filter(line=>line.startsWith('Environment='))){
        const values=words(line.slice(12));invariant(values.length>0,'UNQUALIFIED');
        for(const word of values){const at=word.indexOf('=');invariant(at>0,'UNQUALIFIED');env[word.slice(0,at)]=word.slice(at+1).replaceAll('%%','%');}
      }
      for(const line of entries.filter(line=>line.startsWith('EnvironmentFile='))){
        const tokens=words(line.slice(16).replace(/^-/,''));invariant(tokens.length===1,'UNQUALIFIED');
        const source=tokens[0].replaceAll('%h',this.userHome).replaceAll('%%','%');invariant(path.isAbsolute(source)&&!/[\0\r\n*?]/.test(source),'UNQUALIFIED');
        const content=readableDefinition(source);files.push({path:source,sha256:hash(content)});Object.assign(env,parseEnvData(content.toString()));
      }
      const commands=entries.filter(line=>line.startsWith('ExecStart='));invariant(commands.length===1,'UNQUALIFIED');programArguments=words(commands[0].slice(10));program=programArguments.join(' ');
      invariant(!entries.some(line=>/^Exec(?:Condition|StartPre|StartPost|Stop|StopPost|Reload)\s*=/.test(line)),'UNQUALIFIED');
    }else{
      const result=await this.command('/usr/bin/plutil',['-convert','json','-o','-','--',file]);
      const plist=JSON.parse(result.stdout);invariant(plist.Label===record.unit&&Array.isArray(plist.ProgramArguments),'DENIED');
      env=plist.EnvironmentVariables||{};programArguments=plist.ProgramArguments;program=programArguments.join(' ');
    }
    selection(this.binding,env);invariant(typeof program==='string'&&!/[\0\r\n]/.test(program),'UNQUALIFIED');
    invariant(programArguments.every(value=>typeof value==='string'&&!/[\0\r\n]/.test(value))&&path.isAbsolute(programArguments[0]),'UNQUALIFIED');
    // Reject alternate selectors even when a definition also contains a matching
    // environment. Explicitly selecting another profile is never inherited.
    invariant(!/--(?:profile|dev|config|state-dir)(?:\s|=|$)/.test(program)&&!env.OPENCLAW_PROFILE,'UNQUALIFIED');
    const executable=path.basename(programArguments[0]);
    if(record.id==='federation')invariant(/^python(?:3(?:\.\d+)?)?$/.test(executable)&&programArguments.length===3&&programArguments[1]===path.join(sourceRoot,'scripts/federation-control.py')&&programArguments[2]==='run','UNQUALIFIED');
    else if(record.id==='hermes-companion'){
      const args=programArguments.slice(1);if(args[0]==='-u')args.shift();
      invariant(this.binding.kind==='hermes'&&/^python(?:3(?:\.\d+)?)?$/.test(executable)&&args.shift()===path.join(sourceRoot,'mcp-servers/hermes-hud-mcp/hermes_api.py'),'UNQUALIFIED');
      const values={};invariant(args.length%2===0,'UNQUALIFIED');
      for(let index=0;index<args.length;index+=2){invariant(['--home','--source','--installation','--port','--namespace'].includes(args[index])&&!Object.hasOwn(values,args[index]),'UNQUALIFIED');values[args[index]]=args[index+1];}
      invariant(values['--home']===this.binding.home&&values['--installation']===this.binding.installationId&&(!values['--namespace']||values['--namespace']==='hud')&&(!values['--port']||/^\d{1,5}$/.test(values['--port'])),'UNQUALIFIED');
      const source=values['--source'];invariant(typeof source==='string'&&path.isAbsolute(source)&&fs.realpathSync(source)===source&&fs.statSync(source).isDirectory()&&fs.statSync(source).uid===process.getuid(),'UNQUALIFIED');
    }else{
      const args=programArguments.slice(1);
      if(executable==='node')invariant(path.isAbsolute(args[0]||'')&&path.basename(args.shift())==='openclaw.mjs','UNQUALIFIED');
      else invariant(executable==='openclaw','UNQUALIFIED');
      invariant(this.binding.kind==='openclaw'&&args.shift()==='gateway','UNQUALIFIED');if(args[0]==='run')args.shift();
      const flags=new Set();
      while(args.length){
        const flag=args.shift();invariant(['--port','--bind'].includes(flag)&&!flags.has(flag),'UNQUALIFIED');flags.add(flag);
        const value=args.shift();invariant(flag==='--port'?/^\d{1,5}$/.test(value||'')&&Number(value)>0&&Number(value)<=65535:['loopback','lan','tailnet','auto','custom'].includes(value),'UNQUALIFIED');
      }
    }
    // plutil and environment reads may have awaited work. Recheck all bytes.
    this.binding.assertCurrent();for(const item of files)invariant(hash(readableDefinition(item.path))===item.sha256,'STALE_REVISION');
    return {files,definitionRevision:digest(files),programArguments};
  }
  async managerState(record,definition){
    if(record.manager==='systemd'){
      const properties='Id,LoadState,ActiveState,SubState,FragmentPath,DropInPaths,NeedDaemonReload,MainPID,InvocationID';
      const {stdout}=await this.command('/usr/bin/systemctl',['--user','show',record.unit,`--property=${properties}`]);
      const state=Object.fromEntries(stdout.trim().split('\n').map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
      invariant(state.Id===record.unit&&state.LoadState==='loaded'&&state.FragmentPath===record.definitionPath&&!state.DropInPaths&&state.NeedDaemonReload==='no','UNQUALIFIED');
      invariant(['active','inactive','failed','activating','deactivating','reloading'].includes(state.ActiveState),'SOURCE_UNAVAILABLE');
      if(state.ActiveState==='active'){
        const pid=Number(state.MainPID);invariant(Number.isSafeInteger(pid)&&pid>0,'SOURCE_UNAVAILABLE');
        const runningEnvironment=this.readProcessEnvironment(pid);selection(this.binding,runningEnvironment);
        invariant(state.InvocationID&&runningEnvironment.INVOCATION_ID===state.InvocationID,'IDENTITY_CHANGED');
      }
      return {loaded:true,active:state.ActiveState==='active',transitional:['activating','deactivating','reloading'].includes(state.ActiveState),pid:Number(state.MainPID)||null,invocation:state.InvocationID||null};
    }
    try{
      const {stdout}=await this.command('/bin/launchctl',['print',`gui/${process.getuid()}/${record.unit}`]);
      invariant(stdout.includes(`path = ${record.definitionPath}`),'IDENTITY_CHANGED');
      const block=name=>{
        const lines=stdout.split('\n'),start=lines.findIndex(line=>line.trim()===`${name} = {`);invariant(start>=0,'SOURCE_UNAVAILABLE');
        const indent=lines[start].match(/^\s*/)[0],end=lines.findIndex((line,index)=>index>start&&line===indent+'}');invariant(end>start,'SOURCE_UNAVAILABLE');
        return lines.slice(start+1,end).map(line=>line.trim());
      };
      const loadedArguments=block('arguments');invariant(digest(loadedArguments)===digest(definition.programArguments),'IDENTITY_CHANGED');
      const loadedEnvironment=Object.fromEntries(block('environment').flatMap(line=>{const at=line.indexOf(' => ');return at>0?[[line.slice(0,at),line.slice(at+4)]]:[];}));
      selection(this.binding,loadedEnvironment);
      const state=stdout.match(/^\s*state = (.+)$/m)?.[1],pid=Number(stdout.match(/^\s*pid = (\d+)$/m)?.[1])||null;
      invariant(state,'SOURCE_UNAVAILABLE');return {loaded:true,active:state==='running'&&pid!==null,transitional:!['running','not running','waiting','exited'].includes(state),pid,invocation:null};
    }catch(error){if(error.code===113&&/Could not find service/i.test(String(error.stderr)))return {loaded:false,active:false,transitional:false,pid:null,invocation:null};throw error;}
  }
  async inspect(id){
    invariant(ids.includes(id),'UNQUALIFIED');const record=this.registry().services[id];invariant(record&&record.id===id,'UNQUALIFIED');
    const definition=await this.definition(record);invariant(definition.definitionRevision===record.definitionRevision,'STALE_REVISION');
    const state=await this.managerState(record,definition);this.binding.assertCurrent();
    return {id,manager:record.manager,unit:record.unit,definitionRevision:record.definitionRevision,...state};
  }
  async act(id,action){
    invariant(['start','stop','restart'].includes(action),'DENIED');const record=this.registry().services[id];
    const state=await this.inspect(id);invariant(!state.transitional,'BUSY');
    invariant(digest(this.registry().services[id])===digest(record)&&state.unit===record.unit,'STALE_REVISION');
    if(record.manager==='systemd')await this.command('/usr/bin/systemctl',['--user','--no-block',action,record.unit]);
    else{
      const domain=`gui/${process.getuid()}`,target=`${domain}/${record.unit}`;
      if(action==='stop'){if(state.loaded)await this.command('/bin/launchctl',['bootout',target]);}
      else if(!state.loaded)await this.command('/bin/launchctl',['bootstrap',domain,record.definitionPath]);
      else await this.command('/bin/launchctl',['kickstart',...(action==='restart'?['-k']:[]),target]);
    }
  }
  async ready(id){try{return await this.readyProbe?.(id)===true;}catch{return false;}}
  async inventory(){
    const registry=this.registry();
    return Promise.all(ids.map(async id=>{
      if(!registry.services[id])return {id,available:false,reason:'No reviewed service-manager binding exists. Existing unmanaged processes are preserved.'};
      try{return {...await this.inspect(id),available:true,scope:'Explicitly registered installation-owned service'};}
      catch(error){return {id,available:false,...safeError(error)};}
    }));
  }
  async register(record,{audit,reviewed=false}={}){
    invariant(ids.includes(record.id),'UNQUALIFIED');
    const definition=await this.definition(record),state=await this.managerState(record,definition);
    invariant(!state.transitional,'BUSY');
    const preview={id:record.id,manager:record.manager,unit:record.unit,definitionPath:record.definitionPath,definitionRevision:definition.definitionRevision,active:state.active,
      scope:'Existing owned service only. Registration changes no unit, process, configuration or credential.'};
    if(!reviewed)return preview;
    invariant(audit,'AUDIT_UNAVAILABLE');await audit.record({action:'service-binding',state:'before-register'});
    const fresh=await this.definition(record);invariant(fresh.definitionRevision===definition.definitionRevision,'STALE_REVISION');
    const registry=this.registry();registry.services[record.id]={...record,definitionRevision:definition.definitionRevision,registeredAt:new Date().toISOString()};
    atomicPrivate(serviceRegistryPath(this.binding),JSON.stringify(registry,null,2)+'\n');return preview;
  }
}

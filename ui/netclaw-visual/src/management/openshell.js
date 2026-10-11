import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ownedDirectory,ownedFile,readOwned,atomicPrivate} from './files.js';
import {invariant} from './errors.js';
import {digest} from './journal.js';
import {redactor} from './evidence.js';

const exec=promisify(execFile),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const name=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(value)&&!value.includes('..');
const unavailable=reason=>({available:false,enforcement:{state:'unavailable'},reason});
export const openshellBindingPath=binding=>path.join(binding.statePath,'openshell-binding.json');

/** Fixed CLI reads against explicit mTLS metadata. No last-used selection,
 * bearer refresh, service discovery, insecure TLS or arbitrary command entry. */
export class OpenShellComponent{
  constructor(binding,{run=exec}={}){Object.assign(this,{binding,run});}
  record(){
    this.binding.assertCurrent();const bytes=readOwned(openshellBindingPath(this.binding),{missing:true,limit:16384});if(!bytes)return null;
    const value=JSON.parse(bytes);invariant(value.schemaVersion===1&&value.installationId===this.binding.installationId&&value.hostId===this.binding.hostId&&value.runtime===this.binding.kind,'IDENTITY_CHANGED');
    invariant(value.version==='0.1.3'&&typeof value.materialDigest==='string'&&typeof value.sandboxId==='string','INCOMPATIBLE');return value;
  }
  material(record){
    this.binding.assertCurrent();invariant(record,'UNQUALIFIED');
    invariant(name(record.gateway)&&name(record.workspace)&&name(record.sandbox),'INVALID_INPUT');
    ownedDirectory(record.configHome);invariant(path.isAbsolute(record.executable),'DENIED');
    const executable=ownedFile(record.executable,{privateMode:false});invariant(!(executable.mode&0o022)&&(executable.mode&0o100),'DENIED');
    const binary=readOwned(record.executable,{privateMode:false,limit:128*1024*1024});
    const directory=path.join(record.configHome,'openshell/gateways',record.gateway);ownedDirectory(directory);
    const metadata=readOwned(path.join(directory,'metadata.json'),{limit:16384}),value=JSON.parse(metadata);
    invariant(value.name===record.gateway,'IDENTITY_CHANGED');invariant(value.auth_mode===undefined||value.auth_mode===null||value.auth_mode==='mtls','UNQUALIFIED');
    const endpoint=new URL(value.gateway_endpoint);invariant(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash&&['','/'].includes(endpoint.pathname),'UNQUALIFIED');
    const mtls=path.join(directory,'mtls');ownedDirectory(mtls);
    const files=Object.fromEntries(['ca.crt','tls.crt','tls.key'].map(name=>{
      const file=path.join(mtls,name),bytes=readOwned(file,{privateMode:name==='tls.key',limit:65536});
      invariant(!(fs.statSync(file).mode&0o022),'DENIED');return [name,bytes];
    }));
    const materialDigest=digest({executable:hash(binary),metadata:hash(metadata),certificates:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,hash(bytes)]))});
    if(record.materialDigest)invariant(record.materialDigest===materialDigest,'STALE_REVISION');
    return {metadata,files,materialDigest,endpoint:value.gateway_endpoint};
  }
  async command(record,kind){
    invariant(['version','status','sandbox'].includes(kind),'DENIED');const material=this.material(record);
    // Copy reviewed metadata/certificates into an ephemeral private CLI home.
    // A concurrent edit of the original cannot retarget a launched read.
    const scratch=fs.mkdtempSync(path.join(this.binding.statePath,'.openshell-read-'));fs.chmodSync(scratch,0o700);
    try{
      const directory=path.join(scratch,'openshell/gateways',record.gateway),mtls=path.join(directory,'mtls');fs.mkdirSync(mtls,{recursive:true,mode:0o700});
      fs.writeFileSync(path.join(directory,'metadata.json'),material.metadata,{mode:0o600});
      for(const [name,bytes] of Object.entries(material.files))fs.writeFileSync(path.join(mtls,name),bytes,{mode:0o600});
      const args=kind==='version'?['--version']:['--gateway',record.gateway,'--workspace',record.workspace,'--color','never',...(kind==='status'?['status','-o','json']:['sandbox','get',record.sandbox,'-o','json'])];
      const result=await this.run(record.executable,args,{timeout:12000,maxBuffer:1024*1024,encoding:'utf8',shell:false,cwd:scratch,
        env:{HOME:scratch,XDG_CONFIG_HOME:scratch,XDG_STATE_HOME:scratch,XDG_DATA_HOME:scratch,OPENSHELL_SYSTEM_GATEWAY_DIR:path.join(scratch,'no-system-gateways'),OPENSHELL_TELEMETRY_ENABLED:'false',NO_COLOR:'1'}});
      this.binding.assertCurrent();invariant(this.material(record).materialDigest===material.materialDigest,'STALE_REVISION');
      if(kind==='version'){invariant(/^openshell 0\.1\.3\s*$/.test(result.stdout),'UNQUALIFIED');return '0.1.3';}
      let value;try{value=JSON.parse(result.stdout);}catch{invariant(false,'SOURCE_UNAVAILABLE');}
      invariant(value&&typeof value==='object'&&!Array.isArray(value),'INCOMPATIBLE');return value;
    }finally{fs.rmSync(scratch,{recursive:true,force:true});}
  }
  async observe(record){
    const gateway=await this.command(record,'status'),endpoint=this.material(record).endpoint;
    invariant(gateway.gateway===record.gateway&&gateway.server===endpoint,'IDENTITY_CHANGED');
    invariant(['connected','connected_http','disconnected','error'].includes(gateway.status),'INCOMPATIBLE');
    const result={gateway:{name:record.gateway,endpoint,status:gateway.status,authentication:gateway.authentication?.status||'unverified',version:gateway.version||null},observedAt:new Date().toISOString()};
    if(gateway.status!=='connected'||gateway.authentication?.status!=='authenticated')return {...result,...unavailable('The selected gateway did not provide authenticated gRPC evidence. HTTP health alone is insufficient.')};
    invariant(gateway.version==='0.1.3','UNQUALIFIED');
    const sandbox=await this.command(record,'sandbox');
    invariant(sandbox.name===record.sandbox&&sandbox.workspace===record.workspace&&sandbox.labels?.['netclaw.installation-id']===this.binding.installationId,'IDENTITY_CHANGED');
    invariant(typeof sandbox.id==='string'&&sandbox.id.length>0&&sandbox.id.length<=200,'INCOMPATIBLE');
    if(record.sandboxId)invariant(sandbox.id===record.sandboxId,'IDENTITY_CHANGED');
    const degraded=Array.isArray(sandbox.conditions)&&sandbox.conditions.some(c=>['ConfigurationReady','DesiredConfigurationReady'].includes(c.type)&&String(c.status).toLowerCase()==='false');
    const policy=sandbox.policy&&typeof sandbox.policy==='object'&&!Array.isArray(sandbox.policy)?sandbox.policy:null;
    // Policy is read from GetSandboxConfig by the qualified CLI. Never project
    // arbitrary sandbox annotations, environment, credential bindings or errors.
    const publicPolicy=policy?redactor()({version:policy.version,filesystem_policy:policy.filesystem_policy,network_policies:policy.network_policies,landlock:policy.landlock,process:policy.process}):null;
    return {...result,available:true,sandbox:{id:sandbox.id,name:sandbox.name,workspace:sandbox.workspace,phase:sandbox.phase,resourceVersion:sandbox.resource_version,
      configuredPolicyRevision:sandbox.revision,reportedPolicyVersion:sandbox.current_policy_version,policySource:sandbox.policy_source,policy:publicPolicy},
      enforcement:{state:sandbox.phase==='Ready'&&policy&&!degraded&&sandbox.configuration_admission?.state==='accepted'?'reported-active':'degraded',
        scope:'Authenticated gateway report for the explicitly labelled sandbox. This is not a probe of every filesystem, network or tool denial.'},
      actions:{supported:false,reason:'Gateway/sandbox lifecycle and policy changes require a qualified durable transaction and rollback adapter. These reads do not start, stop or modify a sandbox.'}};
  }
  async register(input,{reviewed=false,audit}={}){
    invariant(input&&Object.keys(input).length===5&&Object.keys(input).every(key=>['executable','configHome','gateway','workspace','sandbox'].includes(key)),'INVALID_INPUT');
    const record={schemaVersion:1,installationId:this.binding.installationId,hostId:this.binding.hostId,runtime:this.binding.kind,...input};
    const material=this.material(record);record.materialDigest=material.materialDigest;record.version=await this.command(record,'version');
    const observed=await this.observe(record);invariant(observed.available,'UNQUALIFIED');record.sandboxId=observed.sandbox.id;
    if(reviewed){
      invariant(audit,'AUDIT_UNAVAILABLE');await audit.record({action:'openshell-binding',state:'before-register'});
      const again=await this.observe(record);invariant(again.available,'UNQUALIFIED');this.material(record);this.binding.assertCurrent();
      atomicPrivate(openshellBindingPath(this.binding),JSON.stringify({...record,registeredAt:new Date().toISOString()},null,2)+'\n');
    }
    return {gateway:record.gateway,workspace:record.workspace,sandbox:record.sandbox,sandboxId:record.sandboxId,version:record.version,materialDigest:record.materialDigest,
      scope:'Explicit existing mTLS gateway and installation-labelled sandbox. Registration changes no gateway, sandbox, credential or policy.'};
  }
  async snapshot(){
    try{const record=this.record();invariant(record,'UNQUALIFIED');return await this.observe(record);}
    catch(error){if(error.code==='IDENTITY_CHANGED')throw error;return unavailable('No current compatible OpenShell binding could be observed. Review its executable, mTLS material, gateway version and exact sandbox ownership. No ambient gateway was selected.');}
  }
}

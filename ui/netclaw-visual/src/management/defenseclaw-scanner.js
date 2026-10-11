import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ownedDirectory,ownedFile,readOwned,atomicPrivate} from './files.js';
import {digest} from './journal.js';
import {invariant,ManagementError} from './errors.js';

export const SCAN_PROFILE='defenseclaw-static-skill-v1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bindingFile=binding=>path.join(binding.statePath,'defenseclaw-scanner-binding.json');
const same=(a,b)=>digest(a)===digest(b);
const textExtensions=new Set(['.md','.txt','.py','.pyc','.pyo','.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.yaml','.yml','.toml','.sh','.bash','.ps1','.html','.css']);
const ignoredDirectories=new Set(['.git','node_modules','.venv','venv','__pycache__','.cache']);

function pythonIdentity(python){
  invariant(typeof python==='string'&&path.isAbsolute(python)&&path.basename(path.dirname(python))==='bin','UNQUALIFIED');
  const executable=fs.realpathSync(python),info=fs.statSync(executable);
  invariant(info.isFile()&&[0,process.getuid()].includes(info.uid)&&!(info.mode&0o022)&&(info.mode&0o111)&&info.size<=64*1024*1024,'DENIED');
  const venv=path.join(path.dirname(path.dirname(python)),'pyvenv.cfg');
  const venvInfo=ownedFile(venv,{privateMode:false});invariant(!(venvInfo.mode&0o022),'DENIED');
  return {executable,sha256:sha(fs.readFileSync(executable)),venvSha256:sha(readOwned(venv,{privateMode:false,limit:16384}))};
}

export async function scannerProcess(python,helper,input,{directory,signal,timeout=120000}={}){
  ownedDirectory(directory);const env={PATH:'/usr/bin:/bin',HOME:directory,TMPDIR:directory,PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',PYTHONUNBUFFERED:'1',LITELLM_LOCAL_MODEL_COST_MAP:'True',RAYON_NUM_THREADS:'2',OMP_NUM_THREADS:'2'};
  const child=spawn(python,['-I',helper],{cwd:directory,env,shell:false,stdio:['pipe','pipe','ignore','pipe']});
  let exceeded=false,timedOut=false,cancelled=false,killer,bytes=0;const chunks=[];
  const stop=()=>{if(child.exitCode!==null||child.signalCode!==null)return;child.kill('SIGTERM');killer=setTimeout(()=>child.kill('SIGKILL'),2000);killer.unref();};
  const abort=()=>{if(child.exitCode!==null||child.signalCode!==null)return;cancelled=true;stop();};
  const timer=setTimeout(()=>{timedOut=true;stop();},timeout);timer.unref();
  const value=await new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>128*1024){exceeded=true;stop();}else chunks.push(chunk);});
    child.once('close',(code,signalName)=>resolve({code,signalName}));
    child.stdin.on('error',()=>{});child.stdio[3].on('error',()=>{});child.stdio[3].write('owned worker');
    child.stdin.end(JSON.stringify(input));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  }).finally(()=>{clearTimeout(timer);clearTimeout(killer);signal?.removeEventListener('abort',abort);child.stdio[3].destroy();});
  if(cancelled)return {cancelled:true,confirmedExited:true};
  const failed=()=>{const error=new ManagementError('SOURCE_UNAVAILABLE');error.confirmedExited=true;throw error;};
  if(timedOut||exceeded||value.code!==0)failed();
  let result;try{result=JSON.parse(Buffer.concat(chunks));}catch{failed();}
  if(result.ok!==true||result.data?.profile!==SCAN_PROFILE)failed();return {data:result.data};
}

export class DefenseScanner{
  constructor({binding,component,root=fileURLToPath(new URL('../../../../',import.meta.url)),audit}){Object.assign(this,{binding,component,root,audit});this.helper=path.join(root,'scripts/netclaw-defenseclaw-scan.py');}
  async withScratch(callback){
    this.binding.assertCurrent();const directory=fs.mkdtempSync(path.join(this.binding.statePath,'.defense-scan-'));fs.chmodSync(directory,0o700);
    try{return await callback(directory);}finally{fs.rmSync(directory,{recursive:true,force:true});}
  }
  async register(python,{reviewed=false}={}){
    const component=this.component.read(),binary=pythonIdentity(python),helperSha256=sha(fs.readFileSync(this.helper));
    const {data:probe}=await this.withScratch(directory=>scannerProcess(python,this.helper,{action:'probe'},{directory,timeout:15000}));
    this.component.assertSame(component);invariant(same(binary,pythonIdentity(python))&&sha(fs.readFileSync(this.helper))===helperSha256,'STALE_REVISION');
    const record={format:1,installationId:this.binding.installationId,hostId:this.binding.hostId,runtime:this.binding.kind,component:digest(component.record),python,binary,helperSha256,probe};
    if(reviewed){await this.audit.record({action:'defenseclaw-scanner-binding',state:'before-register',profile:SCAN_PROFILE});this.component.assertSame(component);invariant(same(binary,pythonIdentity(python))&&sha(fs.readFileSync(this.helper))===helperSha256,'STALE_REVISION');atomicPrivate(bindingFile(this.binding),JSON.stringify(record,null,2)+'\n');}
    return {recorded:reviewed,installationId:this.binding.installationId,python,profile:SCAN_PROFILE,probe,scope:'Bind an existing Python 3.12 DefenseClaw 0.8.6 / Cisco skill-scanner 2.0.4 SDK environment for reviewed local static scans. No installation, provider request, scan or enforcement occurs during binding.'};
  }
  read(){
    this.binding.assertCurrent();const component=this.component.read(),record=JSON.parse(readOwned(bindingFile(this.binding),{limit:16384}));
    invariant(record.format===1&&record.installationId===this.binding.installationId&&record.hostId===this.binding.hostId&&record.runtime===this.binding.kind&&record.component===digest(component.record),'IDENTITY_CHANGED');
    invariant(record.probe?.profile===SCAN_PROFILE&&same(record.binary,pythonIdentity(record.python))&&record.helperSha256===sha(fs.readFileSync(this.helper)),'STALE_REVISION');return record;
  }
  async verify(record){
    invariant(same(this.read(),record),'STALE_REVISION');
    const {data}=await this.withScratch(directory=>scannerProcess(record.python,this.helper,{action:'probe'},{directory,timeout:15000}));
    invariant(same(data,record.probe)&&same(this.read(),record),'STALE_REVISION');return record;
  }
  skill(name){
    this.binding.assertCurrent();invariant(typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name)&&!name.includes('..'),'INVALID_INPUT');
    const base=path.join(this.binding.home,this.binding.kind==='hermes'?'skills':'workspace/skills'),directory=path.join(base,name);
    for(const parent of [base,directory]){const info=ownedDirectory(parent,{privateMode:false});invariant(!(info.mode&0o022),'DENIED');}
    const root=fs.statSync(directory),files=[];let total=0,visited=0,omitted=0;
    const walk=current=>{
      for(const entry of fs.readdirSync(current,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
        invariant(++visited<=2048,'INVALID_INPUT');const file=path.join(current,entry.name),relative=path.relative(directory,file);
        invariant(relative.length<=512&&!/[\x00-\x1f\x7f]/.test(relative),'INVALID_INPUT');
        if(entry.isDirectory()){
          if(ignoredDirectories.has(entry.name)){omitted++;continue;}
          const info=ownedDirectory(file,{privateMode:false});invariant(!(info.mode&0o022),'DENIED');walk(file);continue;
        }
        if(!textExtensions.has(path.extname(entry.name).toLowerCase())||entry.name==='.env'||entry.name.startsWith('.env.')){omitted++;continue;}
        const info=ownedFile(file,{privateMode:false});invariant(!(info.mode&0o022)&&info.nlink===1&&info.size<=512*1024,'DENIED');
        const bytes=readOwned(file,{privateMode:false,limit:512*1024});total+=bytes.length;invariant(total<=8*1024*1024&&files.length<256,'INVALID_INPUT');
        files.push({path:relative,sha256:sha(bytes),bytes,device:info.dev,inode:info.ino});
      }
    };walk(directory);invariant(files.some(file=>file.path==='SKILL.md'),'UNQUALIFIED');
    const manifest=files.map(({bytes,...file})=>file),source={name,device:root.dev,inode:root.ino,manifest,bytes:total,omittedEntries:omitted};
    return {source,files,revision:digest(source)};
  }
  async scan(record,selected,{signal}={}){
    await this.verify(record);const current=this.skill(selected.source.name);invariant(current.revision===selected.revision,'STALE_REVISION');
    return this.withScratch(async directory=>{
      const stage=path.join(directory,'source');fs.mkdirSync(stage,{mode:0o700});
      for(const file of current.files){const destination=path.join(stage,file.path);fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});fs.writeFileSync(destination,file.bytes,{mode:0o600,flag:'wx'});}
      invariant(same(this.read(),record),'STALE_REVISION');
      return scannerProcess(record.python,this.helper,{action:'scan',directory:stage,expected:record.probe,files:current.source.manifest.map(({path,sha256})=>({path,sha256}))},{directory,signal});
    });
  }
}

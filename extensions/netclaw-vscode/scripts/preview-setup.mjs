import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const {root,executable}=JSON.parse(fs.readFileSync('/tmp/netclaw153-preview.json'));
if(!path.basename(root).startsWith('netclaw153-preview-')||!root.startsWith(fs.realpathSync(os.tmpdir())+path.sep))throw Error('Isolated fixture root required.');
const extension=fileURLToPath(new URL('../',import.meta.url)),observer=path.join(root,'observer');fs.mkdirSync(observer,{recursive:true});
for(const name of ['error.txt','report.json','cdp.json'])if(fs.existsSync(path.join(root,name)))fs.unlinkSync(path.join(root,name));
const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
fs.writeFileSync(path.join(root,'user/User/settings.json'),JSON.stringify({'telemetry.telemetryLevel':'off','update.mode':'none','extensions.autoUpdate':false,'workbench.startupEditor':'none','window.dialogStyle':'custom','security.workspace.trust.enabled':false}));
const state=path.join(root,'user/User/globalStorage/netclaw.netclaw/state');fs.mkdirSync(state,{recursive:true,mode:0o700});
const save=(key,value)=>fs.writeFileSync(path.join(state,createHash('sha256').update(key).digest('hex')+'.json'),JSON.stringify({key,value}),{mode:0o600});
const old=path.join(root,'existing-claw');fs.mkdirSync(path.join(old,'netclaw-hud'),{recursive:true,mode:0o700});fs.writeFileSync(path.join(old,'openclaw.json'),'{}',{mode:0o600});fs.writeFileSync(path.join(old,'netclaw-components.conf'),'subnet-calc\n',{mode:0o600});fs.writeFileSync(path.join(old,'netclaw-hud/installation.json'),JSON.stringify({schemaVersion:1,installationId:'00000000-0000-0000-0000-000000000001'}),{mode:0o600});
save('management-bindings',[{target:{home:old,kind:'openclaw',installationId:'00000000-0000-0000-0000-000000000001'},profile:{label:'Existing fixture claw'}}]);
save('setup-draft',{schema:1,shape:'focused',assumptions:[],unresolved:['source','host'],claws:[{id:'fixture',displayName:'My new lab claw',role:'focused',harness:'openclaw',harnessChoice:'explicit',runtimeHome:path.join(root,'new-claw'),workspace:path.join(root,'new-claw/workspace'),provider:{id:'anthropic',kind:'cloud',model:'choose-a-model'},channels:[],capabilities:{profile:'minimal',components:['subnet-calc'],skills:['subnet-calculator'],trustDomain:'fixture'},service:{name:'fixture',mode:'hot'},settings:{}}]});
fs.writeFileSync(path.join(observer,'package.json'),JSON.stringify({name:'netclaw-setup-observer',publisher:'fixture',version:'0.0.0',engines:{vscode:'^1.109.0'},main:'index.cjs',activationEvents:['onStartupFinished']}));
fs.writeFileSync(path.join(observer,'index.cjs'),`const fs=require('node:fs'),vscode=require('vscode');exports.activate=()=>{setImmediate(async()=>{try{await require(${JSON.stringify(path.join(extension,'test/editor-setup.cjs'))}).run();}catch(e){fs.writeFileSync(${JSON.stringify(path.join(root,'error.txt'))},String(e.stack||e));}finally{await vscode.commands.executeCommand('workbench.action.quit');}});};`);
// Chromium's test keychain is confined to this disposable preview. Never ask the
// owner to reset the login keychain because a fixture uses a temporary HOME.
const child=spawn(executable,['--user-data-dir',path.join(root,'user'),'--extensions-dir',path.join(root,'extensions'),...(process.platform==='darwin'?['--use-mock-keychain']:[]),'--skip-welcome','--skip-release-notes','--disable-extensions','--disable-telemetry','--remote-debugging-port='+port,'--extensionDevelopmentPath='+extension,'--extensionDevelopmentPath='+observer,path.join(root,'workspace')],
  {env:{HOME:path.join(root,'home'),PATH:'/usr/bin:/bin:/usr/sbin:/sbin',LANG:'en_US.UTF-8',TMPDIR:path.join(root,'cache'),NETCLAW_SETUP_PREVIEW_ROOT:root,NETCLAW_SETUP_PREVIEW_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',b=>{output=(output+b).slice(-100000);});child.stderr.on('data',b=>{output=(output+b).slice(-100000);});
const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
const timer=setTimeout(()=>child.kill(),180000);
for(let i=0;i<100&&child.exitCode===null&&child.signalCode===null;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(1000)});fs.writeFileSync(path.join(root,'cdp.json'),JSON.stringify(await r.json()));break;}catch{await new Promise(r=>setTimeout(r,100));}}
try{await exited;}finally{clearTimeout(timer);}
fs.writeFileSync(path.join(root,'editor.log'),output,{mode:0o600});
if(fs.existsSync(path.join(root,'error.txt')))throw Error(fs.readFileSync(path.join(root,'error.txt'),'utf8'));
console.log(fs.readFileSync(path.join(root,'report.json'),'utf8'));

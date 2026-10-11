import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,spawn,execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {installationFixture} from './fixtures.mjs';
import {Journal} from '../../ui/netclaw-visual/src/management/journal.js';
import {updateEnvironment} from '../../ui/netclaw-visual/src/security/private-files.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const python=code=>spawnSync('python3',['-c',code],{cwd:root,encoding:'utf8'});
const load=(file,name='writer')=>`import importlib.util\nspec=importlib.util.spec_from_file_location('${name}',${JSON.stringify(path.join(root,'scripts',file))})\n${name}=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(${name})\n`;

test('bulk dotenv import cannot bypass a held management lock or overwrite newer assignments',t=>{
  const f=installationFixture(t),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const incoming=path.join(f.root,'incoming.env');fs.writeFileSync(incoming,'OPENAI_API_KEY=SYNTHETIC_INCOMING\n',{mode:0o600});
  const before=fs.readFileSync(path.join(f.home,'.env'));
  const code=load('import-env.py')+`from pathlib import Path\nwriter.import_env(Path(${JSON.stringify(incoming)}),Path(${JSON.stringify(path.join(f.home,'.env'))}),True)`;
  const token=journal.lock('configuration','extension');assert.notEqual(python(code).status,0);assert.deepEqual(fs.readFileSync(path.join(f.home,'.env')),before);journal.unlock('configuration',token);
  updateEnvironment(path.join(f.home,'.env'),{OPENAI_API_KEY:'SYNTHETIC_NEWER'});const result=python(code);assert.equal(result.status,0,result.stderr);assert.match(fs.readFileSync(path.join(f.home,'.env'),'utf8'),/OPENAI_API_KEY=SYNTHETIC_NEWER/);
});

test('MCP registration merge owns the whole read/merge/write and preserves unrelated fields',t=>{
  const f=installationFixture(t),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  fs.writeFileSync(f.configPath,'{"agents":{},"unrelated":{"preserve":true}}\n');const before=fs.readFileSync(f.configPath);
  const entry={fixture:{command:'python3',args:['fixed.py']}};
  const code=load('install-mcp-config.py')+`from pathlib import Path\nwriter.merge_config(Path(${JSON.stringify(f.configPath)}),${JSON.stringify(entry)},${JSON.stringify(entry)})`;
  const token=journal.lock('configuration','extension');assert.notEqual(python(code).status,0);assert.deepEqual(fs.readFileSync(f.configPath),before);journal.unlock('configuration',token);
  const result=python(code);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(f.configPath)).unrelated.preserve,true);
});

for(const mode of ['missing','empty','linked'])test(`damaged ${mode} management journal blocks Node and Python configuration writers without initialization`,t=>{
  const f=installationFixture(t),directory=path.join(f.statePath,'management'),database=path.join(directory,'operations.sqlite');fs.mkdirSync(directory,{mode:0o700});
  if(mode==='empty')fs.writeFileSync(database,'',{mode:0o600});
  if(mode==='linked')fs.symlinkSync(path.join(f.root,'absent'),database);
  const env=path.join(f.home,'.env'),before=fs.readFileSync(env);
  assert.throws(()=>updateEnvironment(env,{OPENAI_API_KEY:'SYNTHETIC'}));
  const result=spawnSync('python3',[path.join(root,'scripts/write-env.py'),env,'OPENAI_API_KEY'],{input:'SYNTHETIC',encoding:'utf8'});assert.notEqual(result.status,0);
  assert.deepEqual(fs.readFileSync(env),before);if(mode==='empty')assert.equal(fs.statSync(database).size,0);if(mode==='missing')assert.equal(fs.existsSync(database),false);
});

test('Hermes launcher joins the lock and accepts normalized env credentials without recreating literal keys',async t=>{
  const {prepareCompanionAuth,readCompanionAuth}=await import('../../ui/netclaw-visual/src/hud-server/companion-auth.js');
  const f=installationFixture(t,'hermes'),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const selected={...f,envPath:path.join(f.home,'.env')},file=path.join(f.statePath,'companion-auth.json'),key='a'.repeat(64);
  fs.appendFileSync(selected.envPath,`NETCLAW_HERMES_HUD_API_KEY=${key}\n`);fs.writeFileSync(file,'{"port":9463,"unrelated":true}',{mode:0o600});
  const options={key,port:9464,expectedEnvironment:fs.readFileSync(selected.envPath)};
  const token=journal.lock('configuration','normalization');assert.throws(()=>prepareCompanionAuth(selected,options),{code:'BUSY'});journal.unlock('configuration',token);
  assert.deepEqual(prepareCompanionAuth(selected,options),{key,port:9464});const saved=JSON.parse(fs.readFileSync(file));assert.equal(saved.key,undefined);assert.equal(saved.unrelated,true);assert.deepEqual(readCompanionAuth(selected),{key,port:9464});
  updateEnvironment(selected.envPath,{NETCLAW_HERMES_HUD_API_KEY:'b'.repeat(64)});assert.throws(()=>prepareCompanionAuth(selected,options),{code:'STALE_REVISION'});
});

test('migration apply and restore acquire the shared lock before touching originals or recovery artifacts',t=>{
  const f=installationFixture(t),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const env=path.join(f.home,'.env'),before=fs.readFileSync(env),token=journal.lock('configuration','extension');
  for(const filename of ['migrate-change-gates.py','migrate-zoom-auth.py','migrate-voice-auth.py'])for(const restore of [false,true]){
    const result=python(load(filename)+`writer.migrate(${JSON.stringify(env)},apply=True,restore=${restore?'True':'False'})`);assert.notEqual(result.status,0);assert.match(result.stderr,/Configuration is owned/);
  }
  journal.unlock('configuration',token);assert.deepEqual(fs.readFileSync(env),before);assert.equal(fs.readdirSync(f.home).some(name=>name.includes('.pre-')),false);
});

test('actual HUD status CLI reads normalized Hermes authentication without changing files or starting a service',async t=>{
  const f=installationFixture(t,'hermes'),key='c'.repeat(64),requests=[];
  const server=http.createServer((request,response)=>{requests.push({route:request.url,authorization:request.headers.authorization});response.setHeader('Content-Type','application/json');response.end(JSON.stringify({installationId:f.installationId,ready:true,executionVerified:false}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  const port=server.address().port,auth=path.join(f.statePath,'companion-auth.json'),env=path.join(f.home,'.env');
  fs.writeFileSync(auth,JSON.stringify({port,unrelated:'retained'}),{mode:0o600});fs.appendFileSync(env,`NETCLAW_HERMES_HUD_API_KEY=${key}\nNETCLAW_HERMES_HUD_PORT=${port}\n`);
  const before=fs.readFileSync(auth),beforeEnv=fs.readFileSync(env);
  const {stdout}=await promisify(execFile)(process.execPath,[path.join(root,'scripts/hud-launch.mjs'),'status','--runtime','hermes','--home',f.home],{env:{HOME:f.root,PATH:process.env.PATH},timeout:5000});
  const result=JSON.parse(stdout);assert.equal(result.readiness.ready,true);assert.equal(result.readiness.installationId,f.installationId);assert.equal(stdout.includes(key),false);
  assert.deepEqual(requests,[{route:'/health/detailed',authorization:'Bearer '+key}]);assert.deepEqual(fs.readFileSync(auth),before);assert.deepEqual(fs.readFileSync(env),beforeEnv);
});

test('a separate Python configuration owner excludes the HUD writer until the transaction ends',async t=>{
  const f=installationFixture(t),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const code=load('management_lock.py')+`import sys\nwith writer.configuration_lock(${JSON.stringify(f.home)}):\n print('locked',flush=True)\n sys.stdin.read()\n`;
  const child=spawn('python3',['-u','-c',code],{stdio:['pipe','pipe','pipe']});t.after(()=>{if(child.exitCode===null)child.kill('SIGTERM');});
  const closed=once(child,'close');await once(child.stdout,'data');
  assert.throws(()=>updateEnvironment(path.join(f.home,'.env'),{NETCLAW_GCF_MODE:'off'}),{code:'BUSY'});
  child.stdin.end();assert.equal((await closed)[0],0);
  updateEnvironment(path.join(f.home,'.env'),{NETCLAW_GCF_MODE:'off'});assert.match(fs.readFileSync(path.join(f.home,'.env'),'utf8'),/NETCLAW_GCF_MODE=off/);
});

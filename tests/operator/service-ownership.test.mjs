import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {installationFixture,auditFixture} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {OwnedServiceController,serviceRegistryPath} from '../../ui/netclaw-visual/src/management/service-ownership.js';

function fixture(t){
  const f=installationFixture(t),binding=bindInstallation(f),unit='netclaw-gateway-fixture.service',directory=path.join(f.root,'.config/systemd/user');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const definitionPath=path.join(directory,unit),record={id:'gateway',manager:'systemd',unit,definitionPath};
  const source=`[Service]\nEnvironment="OPENCLAW_STATE_DIR=${f.home}"\nEnvironment="OPENCLAW_CONFIG_PATH=${f.configPath}"\nExecStart=/fixture/node /fixture/openclaw.mjs gateway run\n`;
  fs.writeFileSync(definitionPath,source,{mode:0o600});
  const calls=[];
  const run=async(program,args)=>{calls.push({program,args});return {stdout:`Id=${unit}\nLoadState=loaded\nActiveState=active\nSubState=running\nFragmentPath=${definitionPath}\nDropInPaths=\nNeedDaemonReload=no\nMainPID=123\nInvocationID=fixture\n`};};
  const controller=new OwnedServiceController(binding,{run,platform:'linux',userHome:f.root,ready:async()=>true,readProcessEnvironment:()=>({OPENCLAW_STATE_DIR:f.home,INVOCATION_ID:'fixture'})});
  return {...f,binding,record,source,calls,controller};
}
test('explicit binding preview leaves services and registration unchanged; reviewed binding selects one fixed manager target',async t=>{
  const f=fixture(t),preview=await f.controller.register(f.record);assert.equal(preview.active,true);assert.equal(fs.existsSync(serviceRegistryPath(f.binding)),false);
  await f.controller.register(f.record,{reviewed:true,audit:auditFixture()});await f.controller.act('gateway','restart');
  assert.deepEqual(f.calls.at(-1),{program:'/usr/bin/systemctl',args:['--user','--no-block','restart',f.record.unit]});
  assert.equal(fs.readFileSync(f.record.definitionPath,'utf8'),f.source);
});
test('unbound services, unit-name injection, another runtime home and manual definition changes cannot dispatch',async t=>{
  const f=fixture(t);await assert.rejects(f.controller.act('gateway','stop'),{code:'UNQUALIFIED'});
  await assert.rejects(f.controller.register({...f.record,unit:'--all'}),{code:'DENIED'});
  fs.writeFileSync(f.record.definitionPath,f.source.replace(f.home,'/another/installation'));
  await assert.rejects(f.controller.register(f.record),{code:'IDENTITY_CHANGED'});fs.writeFileSync(f.record.definitionPath,f.source);
  await f.controller.register(f.record,{reviewed:true,audit:auditFixture()});fs.appendFileSync(f.record.definitionPath,'# changed after registration\n');
  await assert.rejects(f.controller.act('gateway','stop'),{code:'STALE_REVISION'});
  assert.ok(f.calls.every(c=>c.args.includes('show')));
});
test('writable definitions, symlinks and unqualified hooks are rejected before registration',async t=>{
  const f=fixture(t);fs.chmodSync(f.record.definitionPath,0o666);await assert.rejects(f.controller.register(f.record),{code:'DENIED'});fs.chmodSync(f.record.definitionPath,0o600);
  fs.appendFileSync(f.record.definitionPath,'ExecStartPre=/unreviewed/helper\n');await assert.rejects(f.controller.register(f.record),{code:'UNQUALIFIED'});
  fs.unlinkSync(f.record.definitionPath);fs.symlinkSync(f.configPath,f.record.definitionPath);await assert.rejects(f.controller.register(f.record),{code:'DENIED'});
});
test('service binding refuses disguised shell commands, indented hooks and alternate process launch selectors',async t=>{
  for(const replacement of [
    'ExecStart=/bin/sh -c "echo openclaw gateway"',
    'ExecStart=/fixture/node /fixture/openclaw.mjs gateway run\n ExecCondition=/unreviewed/helper',
    'ExecStart=/fixture/node --require /unreviewed/helper /fixture/openclaw.mjs gateway run',
    'ExecStart=/fixture/node /fixture/openclaw.mjs gateway run --config /elsewhere',
    'ExecStart=/fixture/node /fixture/openclaw.mjs gateway run\n Environment=',
  ]){
    const f=fixture(t);fs.writeFileSync(f.record.definitionPath,f.source.replace('ExecStart=/fixture/node /fixture/openclaw.mjs gateway run',replacement));
    await assert.rejects(f.controller.register(f.record));assert.equal(f.calls.length,0);
  }
});
test('replacement installation during binding audit writes no service registry',async t=>{
  const f=fixture(t),audit={async record(){fs.writeFileSync(path.join(f.statePath,'installation.json'),JSON.stringify({schemaVersion:1,installationId:randomUUID()}));}};
  await assert.rejects(f.controller.register(f.record,{reviewed:true,audit}),{code:'IDENTITY_CHANGED'});assert.equal(fs.existsSync(serviceRegistryPath(f.binding)),false);
});
test('systemd active process must match installation and current invocation, not just the unit file',async t=>{
  const f=fixture(t);
  f.controller.readProcessEnvironment=()=>({OPENCLAW_STATE_DIR:'/different/home',INVOCATION_ID:'fixture'});
  await assert.rejects(f.controller.register(f.record),{code:'IDENTITY_CHANGED'});
  f.controller.readProcessEnvironment=()=>({OPENCLAW_STATE_DIR:f.home,INVOCATION_ID:'another-invocation'});
  await assert.rejects(f.controller.register(f.record),{code:'IDENTITY_CHANGED'});
  assert.equal(fs.existsSync(serviceRegistryPath(f.binding)),false);
});
test('a loaded launchd job cannot be adopted from a newly edited matching plist path',async t=>{
  const f=fixture(t),unit='ai.netclaw.fixture',directory=path.join(f.root,'Library/LaunchAgents');fs.mkdirSync(directory,{recursive:true});
  const definitionPath=path.join(directory,unit+'.plist'),record={id:'gateway',manager:'launchd',unit,definitionPath};fs.writeFileSync(definitionPath,'fixture plist',{mode:0o600});
  const args=['/fixture/node','/fixture/openclaw.mjs','gateway','run'];
  const loaded=home=>`${unit} = {\n\tpath = ${definitionPath}\n\tstate = running\n\tpid = 123\n\targuments = {\n${args.map(arg=>'\t\t'+arg).join('\n')}\n\t}\n\tenvironment = {\n\t\tOPENCLAW_STATE_DIR => ${home}\n\t}\n}`;
  let observed=f.home;
  const run=async program=>({stdout:program==='/usr/bin/plutil'?JSON.stringify({Label:unit,ProgramArguments:args,EnvironmentVariables:{OPENCLAW_STATE_DIR:f.home}}):loaded(observed)});
  const controller=new OwnedServiceController(f.binding,{run,platform:'darwin',userHome:f.root});
  await controller.register(record);observed='/another/loaded/installation';
  await assert.rejects(controller.register(record),{code:'IDENTITY_CHANGED'});assert.equal(fs.existsSync(serviceRegistryPath(f.binding)),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from '../../extensions/netclaw-vscode/test/bundle-fixture.mjs';
const profile={id:'fixture',label:'Same label',transport:'local',home:'/fixture/home',nodePath:'/fixture/node',launcherPath:'/fixture/repo/scripts/netclaw-operator.mjs',harness:'hermes'};

test('Restricted Mode and wrong extension-host context refuse before backend launch',async()=>{
  class EventEmitter{event=()=>({dispose(){}});fire(){}dispose(){}}
  const api={env:{},workspace:{isTrusted:false},EventEmitter};
  const {Connection}=await sourceModule('connection/connect.ts',api),connection=new Connection({appendLine(){}});
  await assert.rejects(connection.connect(profile),/Trust this workspace/);
  assert.equal(connection.generation,0);assert.equal(connection.ready,false);
  api.workspace.isTrusted=true;await assert.rejects(connection.connect({...profile,context:'another-machine'}),/different extension host/);assert.equal(connection.generation,0);
});
test('no-folder and multi-root workspaces never select an implicit backend home',async()=>{
  for(const workspaceFolders of [undefined,[{uri:{fsPath:'/first'}},{uri:{fsPath:'/second'}}]]){
    const {launchProfile}=await sourceModule('connection/connect.ts',{env:{},workspace:{workspaceFolders}});
    const launch=launchProfile(profile);assert.equal(launch.args[2],profile.home);assert.equal(launch.command,profile.nodePath);
    assert.ok(!JSON.stringify(launch.args).includes('/first'));assert.ok(!JSON.stringify(launch.args).includes('/second'));
  }
});
test('native Windows cannot launch a Linux backend path locally or fall back to another distribution',async()=>{
  const {launchProfile}=await sourceModule('connection/connect.ts',{env:{}});
  assert.throws(()=>launchProfile(profile,'win32'),/intended WSL distribution/);
  assert.equal(launchProfile({...profile,transport:'ssh',sshAlias:'trusted-host'},'win32').command,'ssh');
});
test('SSH uses existing local agent authentication but never forwards it or model credentials',async()=>{
  const before={SSH_AUTH_SOCK:process.env.SSH_AUTH_SOCK,ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY,NODE_OPTIONS:process.env.NODE_OPTIONS};
  try{
    process.env.SSH_AUTH_SOCK='/fixture/agent.sock';process.env.ANTHROPIC_API_KEY='synthetic-do-not-forward';process.env.NODE_OPTIONS='synthetic-do-not-inherit';
    const {launchProfile}=await sourceModule('connection/connect.ts',{env:{}});
    const launch=launchProfile({...profile,transport:'ssh',sshAlias:'trusted-host'});
    assert.equal(launch.env.SSH_AUTH_SOCK,'/fixture/agent.sock');assert.equal(launch.env.ANTHROPIC_API_KEY,undefined);assert.equal(launch.env.NODE_OPTIONS,undefined);
    for(const option of ['StrictHostKeyChecking=yes','BatchMode=yes','ForwardAgent=no','ClearAllForwardings=yes'])assert.ok(launch.args.includes(option));
    assert.equal(launchProfile(profile).env.SSH_AUTH_SOCK,undefined);
  }finally{for(const [key,value] of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

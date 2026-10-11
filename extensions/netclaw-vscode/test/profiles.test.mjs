import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceModule } from './bundle-fixture.mjs';

test('a delayed backend response is discarded after disconnect instead of crossing profiles',async()=>{
  class EventEmitter {event=()=>({dispose(){}});fire(){} dispose(){}}
  const {Connection}=await sourceModule('connection/connect.ts',{env:{},workspace:{isTrusted:true},EventEmitter});
  const connection=new Connection({appendLine(){}});
  let finish;
  connection.client={callTool:()=>new Promise(resolve=>{finish=resolve;}),close:async()=>{}};
  connection.identity={installationId:'first'};
  const pending=connection.call('operator_identity');
  await connection.disconnect();
  finish({structuredContent:{installationId:'first',privateResult:'old installation'},content:[]});
  await assert.rejects(pending,/response was discarded/);
  assert.equal(connection.identity,undefined);assert.equal(connection.ready,false);
});

test('reviewed commands cannot send secret replacements after a profile switch',async()=>{
  const {boundCaller}=await sourceModule('connection/connect.ts',{env:{}});
  const calls=[],connection={generation:1,call:async(name,args)=>{calls.push({name,args});return {};}};
  const call=boundCaller(connection);
  await call('operator_evidence',{kind:'approval',id:'reviewed-proposal'});
  connection.generation++;
  assert.throws(()=>call('operator_change_apply',{replacements:{ANTHROPIC_API_KEY:'synthetic-secret'}}));
  assert.equal(calls.length,1);assert.ok(!JSON.stringify(calls).includes('synthetic-secret'));
});

test('reconnect refuses a changed operator even when installation and host match',async()=>{
  const {verifyBinding}=await sourceModule('connection/connect.ts',{env:{}});
  const profile={harness:'hermes',installationId:'fixture-installation',hostId:'fixture-host',principalId:'os:1000'};
  const identity={contract:{major:1,minor:0},harness:{type:'hermes'},installationId:profile.installationId,hostId:profile.hostId,principalId:profile.principalId};
  assert.doesNotThrow(()=>verifyBinding(profile,identity));
  for(const changed of [{principalId:'os:1001'},{hostId:'other-host'},{installationId:'other-installation'},{harness:{type:'openclaw'}},{contract:{major:2}}])assert.throws(()=>verifyBinding(profile,{...identity,...changed}));
});

test('WSL profiles do not cross distributions sharing a Windows hostname and Linux UID',async()=>{
  const previous=process.env.WSL_DISTRO_NAME;
  try{
    const {Profiles,hostContext}=await sourceModule('state/profiles.ts',{env:{remoteName:'wsl'}});
    const values=new Map(),state={get:(k,f)=>values.get(k)??f,keys:()=>[...values.keys()],update:async(k,v)=>values.set(k,v)};
    process.env.WSL_DISTRO_NAME='synthetic-wsl-a';
    const profiles=new Profiles(state),context=hostContext();
    await profiles.save({label:'Same label',transport:'local',home:'/fixture/home',nodePath:'/fixture/node',launcherPath:'/fixture/repo/scripts/netclaw-operator.mjs',harness:'hermes'});
    process.env.WSL_DISTRO_NAME='synthetic-wsl-b';
    assert.notEqual(hostContext(),context);assert.equal(profiles.list().length,0);
    process.env.WSL_DISTRO_NAME='synthetic-wsl-a';assert.equal(profiles.list().length,1);
  }finally{if(previous===undefined)delete process.env.WSL_DISTRO_NAME;else process.env.WSL_DISTRO_NAME=previous;}
});

test('independent windows retain same-label profiles and host separation',async()=>{
  const {Profiles,hostContext}=await sourceModule('state/profiles.ts',{env:{}});
  const values=new Map(),state={get:(key,fallback)=>structuredClone(values.has(key)?values.get(key):fallback),keys:()=>[...values.keys()],async update(key,value){await new Promise(resolve=>setTimeout(resolve,2));values.set(key,structuredClone(value));}};
  const first=new Profiles(state),second=new Profiles(state);
  const input={label:'Same label',transport:'local',home:'/fixture/home',nodePath:'/fixture/node',launcherPath:'/fixture/repo/scripts/netclaw-operator.mjs',harness:'hermes'};
  const [a,b]=await Promise.all([first.save(input),second.save(input)]);
  assert.equal(first.list().length,2);assert.notEqual(a.id,b.id);
  await first.save({...input,context:'another-host'});assert.equal(second.list().length,2);
  await second.remove(a.id);assert.equal(first.list().length,1);assert.equal(first.list()[0].id,b.id);
  assert.equal(first.list()[0].context,hostContext());
});

test('atomic profile files survive stale Memento echoes and process restart',async t=>{
  const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'netclaw150-profiles-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const {Profiles}=await sourceModule('state/profiles.ts',{env:{}});
  const stale={get:(_key,fallback)=>fallback,keys:()=>[],update:()=>{throw Error('must not write a whole stale Memento');}};
  const input={label:'Same label',transport:'local',home:'/fixture/home',nodePath:'/fixture/node',launcherPath:'/fixture/repo/scripts/netclaw-operator.mjs',harness:'hermes'};
  const one=new Profiles(stale,directory),two=new Profiles(stale,directory);
  const [a,b]=await Promise.all([one.save(input),two.save(input)]);
  assert.equal(new Profiles(stale,directory).list().length,2);
  await one.remove(a.id);assert.equal(new Profiles(stale,directory).list()[0].id,b.id);
});

test('SSH launch preserves hostile path text as a single quoted argument and verifies known hosts',async()=>{
  const {launchProfile,quotePosix}=await sourceModule('connection/connect.ts',{env:{}});
  const profile={id:'fixture',label:'fixture',transport:'ssh',home:"/fixture/a'$(echo injection); x",nodePath:'/usr/bin/node',launcherPath:'/fixture/repo/scripts/netclaw-operator.mjs',harness:'openclaw',sshAlias:'fixture-alias'};
  const launch=launchProfile(profile);assert.equal(launch.command,'ssh');assert.ok(launch.args.includes('StrictHostKeyChecking=yes'));assert.ok(launch.args.includes('ForwardAgent=no'));assert.equal(launch.args.at(-1).includes(quotePosix(profile.home)),true);
  const {spawnSync}=await import('node:child_process');
  const actual=spawnSync('/bin/sh',['-c',`printf '%s' ${quotePosix(profile.home)}`],{encoding:'utf8'});
  assert.equal(actual.stdout,profile.home);assert.equal(actual.status,0);
  assert.throws(()=>launchProfile({...profile,sshAlias:'-oProxyCommand=bad'}));
  assert.throws(()=>launchProfile({...profile,home:'/fixture\ncommand'}));
});

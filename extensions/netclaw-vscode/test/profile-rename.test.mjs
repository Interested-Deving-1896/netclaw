import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {sourceModule} from './bundle-fixture.mjs';

async function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'netclaw150-rename-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const values=new Map(),state={get:(key,fallback)=>values.get(key)??fallback,keys:()=>[...values.keys()],update:async(key,value)=>values.set(key,value)};
  const {Profiles}=await sourceModule('state/profiles.ts',{env:{}}),profiles=new Profiles(state,directory);
  const profile=await profiles.save({label:'Old name',transport:'local',nodePath:'/test/node',launcherPath:'/test/scripts/netclaw-operator.mjs',home:'/test/home',harness:'hermes',installationId:'selected'});
  return {directory,profiles,profile};
}
test('native rename preserves live binding and performs no backend operation',async t=>{
  const f=await fixture(t);let events=0;
  const connection={profile:f.profile,generation:7,identity:{installationId:'selected'},changed:{fire:()=>events++},call:()=>assert.fail('rename must not call backend'),connect:()=>assert.fail('rename must not reconnect')};
  const api={window:{showQuickPick:async rows=>rows[0],showInputBox:async()=> 'Renamed installation'}};
  const {renameConnection}=await sourceModule('commands/profiles.ts',api);await renameConnection(f.profiles,connection);
  assert.equal(f.profiles.list()[0].label,'Renamed installation');assert.equal(connection.profile.label,'Renamed installation');assert.equal(connection.generation,7);assert.equal(events,1);
  assert.deepEqual({...JSON.parse(JSON.stringify(f.profiles.list()[0])),label:f.profile.label},JSON.parse(JSON.stringify(f.profile)));
});
test('cancelled, stale, deleted or locked profiles cannot be overwritten or resurrected by a rename',async t=>{
  for(const mode of ['cancel','stale','deleted','locked']){
    const f=await fixture(t),connection={profile:f.profile,changed:{fire(){}}};
    const api={window:{showQuickPick:async rows=>rows[0],showInputBox:async()=>{
      if(mode==='cancel')return undefined;
      if(mode==='stale')await f.profiles.save({...f.profile,home:'/changed/home'});
      if(mode==='deleted')await f.profiles.remove(f.profile.id);
      if(mode==='locked')fs.mkdirSync(path.join(f.directory,'profiles',f.profile.id+'.lock'));
      return 'New name';
    }}};
    const {renameConnection}=await sourceModule('commands/profiles.ts',api);
    if(mode==='cancel')await renameConnection(f.profiles,connection);else await assert.rejects(renameConnection(f.profiles,connection),/changed|removed|being updated/);
    assert.equal(connection.profile.label,'Old name');
    if(mode==='deleted')assert.equal(f.profiles.list().length,0);
    else {assert.equal(f.profiles.list()[0].label,'Old name');if(mode==='stale')assert.equal(f.profiles.list()[0].home,'/changed/home');}
  }
});

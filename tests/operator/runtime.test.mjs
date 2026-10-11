import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture,nonce,auditFixture,authoritativeApproval} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {Journal} from '../../ui/netclaw-visual/src/management/journal.js';
import {Proposals} from '../../ui/netclaw-visual/src/management/proposals.js';
import {RiskConfiguration} from '../../ui/netclaw-visual/src/management/runtime.js';
import {environment} from '../../ui/netclaw-visual/src/management/configuration.js';

function fixture(t,kind='openclaw'){
  const f=installationFixture(t,kind),binding=bindInstallation(f),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const live={role:'border',risk_name:'existing-risk',description:'retained',enabled_stacks:'both',border_endpoint:'wss://border.example:18443/in2n',self_member_id:'existing-member'};
  const instances=[{id:'federation',available:true,active:true,pid:101,invocation:'first',definitionRevision:'synthetic-owned-definition',transitional:false}];
  const audit=auditFixture(),authority=authoritativeApproval(),reads=[];
  const risk=new RiskConfiguration({binding,journal,readFederation:async kind=>{reads.push(kind);return {value:structuredClone(live)};},services:{inventory:async()=>structuredClone(instances)}});
  const proposals=new Proposals({binding,journal,audit,authority,adapters:{'risk.role':risk.adapter()}});
  return {...f,binding,journal,live,instances,audit,authority,risk,proposals,reads};
}
const prepare=(f,role='standalone',patch={})=>f.proposals.prepare(f.binding.principal,{nonce:nonce(),action:'risk.role',targets:[f.installationId],expectedRevision:f.proposals.revision(),patch:{role,acknowledgeActiveWork:true,...patch}});
const apply=(f,p,extra={})=>f.proposals.apply(f.binding.principal,{nonce:nonce(),proposalId:p.proposalId,expectedRevision:p.proposal.expectedRevision,...extra});

test('role review preserves exact env bytes; save distinguishes observed role and pending restart on both harnesses',async t=>{
  for(const kind of ['openclaw','hermes']){
    const f=fixture(t,kind),before=fs.readFileSync(f.binding.envPath),config=fs.readFileSync(f.configPath),p=await prepare(f);
    assert.deepEqual(fs.readFileSync(f.binding.envPath),before);assert.match(p.proposal.impact,/No membership, trust or process change/);
    const result=await apply(f,p);assert.equal(result.state,'succeeded');assert.equal(result.result.pendingRestart,true);
    const env=environment(f.binding);assert.equal(env.N2N_ROLE,'standalone');assert.equal(env.N2N_RISK_NAME,'existing-risk');assert.equal(env.N2N_ENABLED_STACKS,'both');
    assert.equal(env.N2N_MEMBER_ID,'existing-member');assert.equal(env.N2N_BORDER_ENDPOINT,f.live.border_endpoint);assert.equal(env.UNMANAGED,'value');
    assert.equal(fs.readFileSync(f.binding.envPath).subarray(0,before.length).toString(),before.toString());assert.deepEqual(fs.readFileSync(f.configPath),config);
    const state=await f.risk.snapshot();assert.equal(state.observedRole,'border');assert.equal(state.configuredRole,'standalone');assert.equal(state.pendingRestart,true);
    assert.ok(f.reads.every(value=>value==='overview'));
  }
});
test('a new role cannot manufacture a Risk name, stack, enrollment or explicit impact acknowledgment',async t=>{
  const f=fixture(t);await assert.rejects(prepare(f,'standalone',{acknowledgeActiveWork:false}),{code:'DENIED'});
  f.live.risk_name='';await assert.rejects(prepare(f,'border'),{code:'UNQUALIFIED'});f.live.risk_name='existing-risk';
  f.live.enabled_stacks='';await assert.rejects(prepare(f,'border'),{code:'UNQUALIFIED'});f.live.enabled_stacks='both';
  f.live.self_member_id='';await assert.rejects(prepare(f,'member'),{code:'UNQUALIFIED'});
  assert.equal(environment(f.binding).N2N_ROLE,undefined);
});
test('pending metadata conflicts, live role changes and manager-instance drift invalidate review without writing',async t=>{
  for(const drift of ['metadata','live','service','work']){
    const f=fixture(t),p=await prepare(f),before=fs.readFileSync(f.binding.envPath);
    if(drift==='metadata')fs.appendFileSync(f.binding.envPath,'N2N_RISK_NAME=other-risk\n');
    if(drift==='live')f.live.role='member';
    if(drift==='service')f.instances[0].pid=102;
    if(drift==='work')f.journal.admit(f.binding.principal,nonce(),'mobile-capture',{synthetic:true});
    await assert.rejects(apply(f,p),{code:'STALE_REVISION'});assert.equal(environment(f.binding).N2N_ROLE,undefined);
    if(drift!=='metadata')assert.deepEqual(fs.readFileSync(f.binding.envPath),before);
  }
  const f=fixture(t);fs.appendFileSync(f.binding.envPath,'N2N_BORDER_ENDPOINT=wss://other.example\n');
  await assert.rejects(prepare(f),{code:'STALE_REVISION'});
});
test('questions, lab flags and operator initiation never substitute for live production approval',async t=>{
  const f=fixture(t);fs.appendFileSync(f.binding.envPath,'N2N_RISK_MODE=production\nNETCLAW_LAB_MODE=true\n');
  const p=await prepare(f),before=fs.readFileSync(f.binding.envPath);assert.equal(p.proposal.changeClass,'production');
  await assert.rejects(apply(f,p),{code:'DENIED'});assert.deepEqual(fs.readFileSync(f.binding.envPath),before);
  f.authority.withdraw();await assert.rejects(apply(f,p,{approvalReference:'CHG-fixture'}),{code:'DENIED'});
});
test('withdrawn approval after save restores exact baseline and leaves approval unresolved',async t=>{
  const f=fixture(t);fs.appendFileSync(f.binding.envPath,'N2N_RISK_MODE=production\n');const before=fs.readFileSync(f.binding.envPath),p=await prepare(f);
  const adapter=f.proposals.adapters['risk.role'],verify=adapter.verify;adapter.verify=async(...args)=>{const result=await verify(...args);f.authority.withdraw();return result;};
  const result=await apply(f,p,{approvalReference:'CHG-fixture'});assert.equal(result.state,'rolled-back');assert.equal(result.result.approvalClosed,false);
  assert.deepEqual(fs.readFileSync(f.binding.envPath),before);assert.equal(f.live.role,'border');
});
test('manual edits and a concurrent daemon role change prevent a false successful rollback',async t=>{
  for(const drift of ['env','live']){
    const f=fixture(t),p=await prepare(f),adapter=f.proposals.adapters['risk.role'];
    adapter.verify=async()=>{if(drift==='env')fs.appendFileSync(f.binding.envPath,'OWNER_NEW_SETTING=keep\n');else f.live.role='member';return {verified:false};};
    const result=await apply(f,p);assert.equal(result.state,'rollback-failed');assert.equal(result.result.approvalClosed,false);
    assert.equal(environment(f.binding).N2N_ROLE,'standalone');if(drift==='env')assert.equal(environment(f.binding).OWNER_NEW_SETTING,'keep');
  }
});
test('lost apply response recovers retained operation without repeating a role write',async t=>{
  const f=fixture(t),p=await prepare(f),input={nonce:nonce(),proposalId:p.proposalId,expectedRevision:p.proposal.expectedRevision};
  const first=await f.proposals.apply(f.binding.principal,input),before=fs.statSync(f.binding.envPath);
  const again=await f.proposals.apply(f.binding.principal,input);assert.equal(again.operationId,first.operationId);assert.equal(again.state,'succeeded');
  assert.equal(fs.statSync(f.binding.envPath).ino,before.ino);
});
test('unavailable or wrong-installation observations cannot enable role changes',async t=>{
  const f=fixture(t);f.risk.readFederation=async()=>{throw Object.assign(Error(),{code:'SOURCE_UNAVAILABLE'});};
  assert.equal((await f.risk.snapshot()).available,false);await assert.rejects(prepare(f),{code:'SOURCE_UNAVAILABLE'});
  f.risk.readFederation=async()=>{throw Object.assign(Error(),{code:'IDENTITY_CHANGED'});};
  await assert.rejects(f.risk.snapshot(),{code:'IDENTITY_CHANGED'});await assert.rejects(prepare(f),{code:'IDENTITY_CHANGED'});
});
test('legacy Risk responses missing persisted endpoint metadata cannot erase it through a role-only save',async t=>{
  const f=fixture(t),before=fs.readFileSync(f.binding.envPath);delete f.live.border_endpoint;
  await assert.rejects(prepare(f),{code:'UNQUALIFIED'});assert.equal((await f.risk.snapshot()).available,false);
  assert.deepEqual(fs.readFileSync(f.binding.envPath),before);
});

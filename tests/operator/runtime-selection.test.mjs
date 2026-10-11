import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture,nonce,auditFixture,authoritativeApproval} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {Journal} from '../../ui/netclaw-visual/src/management/journal.js';
import {Proposals} from '../../ui/netclaw-visual/src/management/proposals.js';
import {RuntimeSelection,runtimeRegistryPath} from '../../ui/netclaw-visual/src/management/runtime-selection.js';
import {resolveRuntime,selectRuntime,acquireRuntimeSelectionLock} from '../../scripts/runtime-selection.mjs';

async function fixture(t){
  const f=installationFixture(t),target=installationFixture(t,'hermes'),binding=bindInstallation(f),targetBinding=bindInstallation(target);
  const journal=new Journal(path.join(f.statePath,'management'),f.installationId),targetJournal=new Journal(path.join(target.statePath,'management'),target.installationId);t.after(()=>{journal.close();targetJournal.close();});
  const selectorDirectory=path.join(f.root,'config/netclaw');fs.mkdirSync(selectorDirectory,{recursive:true,mode:0o700});
  const selectorPath=path.join(selectorDirectory,'runtime.json');fs.writeFileSync(selectorPath,JSON.stringify({schemaVersion:1,kind:f.kind,home:f.home,configPath:f.configPath}),{mode:0o600});
  const audit=auditFixture(),authority=authoritativeApproval(),probes=[];
  const manager=new RuntimeSelection({binding,journal,root:f.root,probe:async candidate=>{probes.push(candidate.installationId);return {ready:true,source:'Synthetic readiness'};}});
  const register={selectorPath,home:target.home,kind:target.kind,installationId:target.installationId};
  await manager.register(register,{reviewed:true,audit});
  const proposals=new Proposals({binding,journal,audit,authority,adapters:{'runtime.select':manager.adapter()}});
  return {...f,target,binding,targetBinding,journal,targetJournal,selectorPath,manager,audit,authority,proposals,probes,register};
}
const prepare=f=>f.proposals.prepare(f.binding.principal,{nonce:nonce(),action:'runtime.select',targets:[f.installationId,f.target.installationId],expectedRevision:f.proposals.revision(),patch:{runtimeId:f.target.installationId,acknowledgeActiveWork:true}});
const apply=(f,p,extra={})=>f.proposals.apply(f.binding.principal,{nonce:nonce(),proposalId:p.proposalId,expectedRevision:p.proposal.expectedRevision,...extra});

test('selection updates the real resolver default without migrating or rebinding either installation',async t=>{
  const f=await fixture(t),before=fs.readFileSync(f.selectorPath),source=fs.readFileSync(f.configPath),target=fs.readFileSync(f.target.configPath),p=await prepare(f);
  assert.deepEqual(fs.readFileSync(f.selectorPath),before);const result=await apply(f,p);assert.equal(result.state,'succeeded');
  const selected=resolveRuntime({env:{HOME:f.root,XDG_CONFIG_HOME:path.join(f.root,'config')}});
  assert.equal(selected.installationId,f.target.installationId);assert.equal(selected.kind,'hermes');assert.equal(f.binding.kind,'openclaw');f.binding.assertCurrent();
  assert.deepEqual(fs.readFileSync(f.configPath),source);assert.deepEqual(fs.readFileSync(f.target.configPath),target);
  assert.equal(f.manager.snapshot().selectedInstallationId,f.target.installationId);
  assert.equal(resolveRuntime({env:{HOME:f.root,XDG_CONFIG_HOME:path.join(f.root,'config'),NETCLAW_RUNTIME:'openclaw',OPENCLAW_HOME:f.home}}).installationId,f.installationId);
});
test('selection requires both scoped targets and an explicit impact acknowledgment',async t=>{
  const f=await fixture(t),base={nonce:nonce(),action:'runtime.select',targets:[f.installationId],expectedRevision:f.proposals.revision(),patch:{runtimeId:f.target.installationId,acknowledgeActiveWork:true}};
  await assert.rejects(f.proposals.prepare(f.binding.principal,base),{code:'DENIED'});
  await assert.rejects(f.proposals.prepare(f.binding.principal,{...base,nonce:nonce(),targets:[f.installationId,f.target.installationId],patch:{runtimeId:f.target.installationId}}),{code:'DENIED'});
  const assistant={...f.binding.principal,surface:'assistant',grantId:'scoped-fixture',generation:1,actions:['propose'],targets:[f.installationId],expiresAt:Date.now()+60000};
  await assert.rejects(f.proposals.prepare(assistant,{...base,nonce:nonce(),targets:[f.installationId,f.target.installationId]}),{code:'DENIED'});
});
test('target identity/configuration, work and readiness drift refuse apply without selecting a different default',async t=>{
  for(const drift of ['identity','config','work','readiness']){
    const f=await fixture(t),p=await prepare(f),before=fs.readFileSync(f.selectorPath);
    if(drift==='identity')fs.writeFileSync(path.join(f.target.statePath,'installation.json'),JSON.stringify({schemaVersion:1,installationId:f.installationId}));
    if(drift==='config')fs.appendFileSync(f.target.configPath,'# owner edit\n');
    if(drift==='work')f.targetJournal.admit(f.targetBinding.principal,nonce(),'conversation-request',{owned:true});
    if(drift==='readiness')f.manager.probe=async()=>({ready:false});
    await assert.rejects(apply(f,p));assert.deepEqual(fs.readFileSync(f.selectorPath),before);assert.equal(fs.existsSync(f.selectorPath+'.lock'),false);
  }
});
test('shared selector lock blocks legacy CLI selection; target configuration lock blocks managed apply',async t=>{
  const f=await fixture(t),release=acquireRuntimeSelectionLock(f.selectorPath);
  assert.throws(()=>selectRuntime('hermes',f.target.home,{HOME:f.root,XDG_CONFIG_HOME:path.join(f.root,'config')}),{code:'BUSY'});
  await assert.rejects(prepare(f),{code:'BUSY'});release();
  const p=await prepare(f),token=f.targetJournal.lock('configuration','existing-HUD');
  await assert.rejects(apply(f,p),{code:'BUSY'});f.targetJournal.unlock('configuration',token);assert.equal(fs.existsSync(f.selectorPath+'.lock'),false);
});
test('target production policy requires an authoritative CR and post-save withdrawal restores exact selector bytes',async t=>{
  const f=await fixture(t);fs.appendFileSync(f.targetBinding.envPath,'N2N_RISK_MODE=production\n');
  const p=await prepare(f),before=fs.readFileSync(f.selectorPath);assert.equal(p.proposal.changeClass,'production');
  await assert.rejects(apply(f,p),{code:'DENIED'});
  const adapter=f.proposals.adapters['runtime.select'],verify=adapter.verify;
  adapter.verify=async(...args)=>{const result=await verify(...args);f.authority.withdraw();return result;};
  const result=await apply(f,p,{approvalReference:'CHG-fixture'});assert.equal(result.state,'rolled-back');assert.equal(result.result.approvalClosed,false);
  assert.deepEqual(fs.readFileSync(f.selectorPath),before);assert.equal(fs.existsSync(f.selectorPath+'.lock'),false);
});
test('a newer manual selector edit prevents rollback and is retained',async t=>{
  const f=await fixture(t),p=await prepare(f),manual=JSON.stringify({schemaVersion:1,kind:f.kind,home:f.home,configPath:f.configPath},null,4);
  f.proposals.adapters['runtime.select'].verify=async()=>{fs.writeFileSync(f.selectorPath,manual);return {verified:false};};
  const result=await apply(f,p);assert.equal(result.state,'rollback-failed');assert.equal(fs.readFileSync(f.selectorPath,'utf8'),manual);
  assert.equal(fs.existsSync(f.selectorPath+'.lock'),false);
});
test('registration previews preserve state and never initialize an unknown candidate identity or management journal',async t=>{
  const f=await fixture(t),registry=fs.readFileSync(runtimeRegistryPath(f.binding)),selector=fs.readFileSync(f.selectorPath);
  const preview=await f.manager.register(f.register,{audit:f.audit});assert.equal(preview.ready,true);
  assert.deepEqual(fs.readFileSync(runtimeRegistryPath(f.binding)),registry);assert.deepEqual(fs.readFileSync(f.selectorPath),selector);
  const candidate=installationFixture(t,'hermes');await assert.rejects(f.manager.register({...f.register,home:candidate.home,installationId:candidate.installationId},{reviewed:true,audit:f.audit}));
  assert.equal(fs.existsSync(path.join(candidate.statePath,'management')),false);
  fs.unlinkSync(path.join(candidate.statePath,'installation.json'));await assert.rejects(f.manager.register({...f.register,home:candidate.home,installationId:candidate.installationId},{reviewed:true,audit:f.audit}));
  assert.equal(fs.existsSync(path.join(candidate.statePath,'installation.json')),false);
});
test('lost successful apply response never rewrites the descriptor and preserves the consumed nonce',async t=>{
  const f=await fixture(t),p=await prepare(f),input={nonce:nonce(),proposalId:p.proposalId,expectedRevision:p.proposal.expectedRevision};
  const first=await f.proposals.apply(f.binding.principal,input),before=fs.statSync(f.selectorPath);
  const second=await f.proposals.apply(f.binding.principal,input);assert.equal(second.operationId,first.operationId);assert.equal(second.state,'succeeded');assert.equal(fs.statSync(f.selectorPath).ino,before.ino);
});

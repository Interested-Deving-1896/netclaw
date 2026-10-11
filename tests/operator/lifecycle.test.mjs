import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture,nonce,auditFixture} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {Journal} from '../../ui/netclaw-visual/src/management/journal.js';
import {Proposals} from '../../ui/netclaw-visual/src/management/proposals.js';
import {lifecycleAdapters} from '../../ui/netclaw-visual/src/management/lifecycle.js';

function fixture(t){
  const f=installationFixture(t),binding=bindInstallation(f),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  let active=true,revision='unit-v1',healthy=true;const calls=[];
  const controller={async inspect(id){assert.equal(id,'gateway');return {id,active,loaded:true,definitionRevision:revision,manager:'fixture',unit:'fixture-owned-unit'};},
    async act(id,action){calls.push({id,action});active=action!=='stop';},async ready(){return healthy;}};
  const proposals=new Proposals({binding,journal,audit:auditFixture(),adapters:lifecycleAdapters({binding,journal,controller,settleTimeoutMs:5})});
  return {...f,binding,journal,proposals,calls,controller,get active(){return active;},changeDefinition(){revision='manual-edit';},failHealth(){healthy=false;}};
}
const prepare=(f,action,patch={})=>f.proposals.prepare(f.binding.principal,{nonce:nonce(),action,targets:[f.installationId],expectedRevision:f.proposals.revision(),patch:{serviceId:'gateway',acknowledgeActiveWork:true,...patch}});
const apply=(f,p)=>f.proposals.apply(f.binding.principal,{nonce:nonce(),proposalId:p.proposalId,expectedRevision:p.proposal.expectedRevision});

test('service prepare has no process effects and apply preserves configuration with verified exact service control',async t=>{
  const f=fixture(t),before=fs.readFileSync(f.configPath),p=await prepare(f,'service.stop');assert.equal(f.calls.length,0);
  const result=await apply(f,p);assert.equal(result.state,'succeeded');assert.equal(f.active,false);assert.deepEqual(f.calls,[{id:'gateway',action:'stop'}]);assert.deepEqual(fs.readFileSync(f.configPath),before);
});
test('disruptive service control requires explicit impact acknowledgment and rejects newly admitted work',async t=>{
  const f=fixture(t);await assert.rejects(prepare(f,'service.restart',{acknowledgeActiveWork:false}),{code:'DENIED'});
  const p=await prepare(f,'service.restart');f.journal.admit(f.binding.principal,nonce(),'conversation-request',{prompt:'new work'});
  await assert.rejects(apply(f,p),{code:'STALE_REVISION'});assert.equal(f.calls.length,0);
});
test('service definition drift is refused without replacing the operator’s new definition',async t=>{
  const f=fixture(t),p=await prepare(f,'service.restart');f.changeDefinition();
  await assert.rejects(apply(f,p),{code:'STALE_REVISION'});assert.equal(f.calls.length,0);
});
test('a service restarted outside management invalidates its reviewed process instance',async t=>{
  const f=fixture(t),original=f.controller.inspect.bind(f.controller);let pid=101,invocation='first';
  f.controller.inspect=async id=>({...await original(id),pid,invocation});
  const p=await prepare(f,'service.restart');pid=102;invocation='second';
  await assert.rejects(apply(f,p),{code:'STALE_REVISION'});assert.equal(f.calls.length,0);
});
test('failed restart health runs bounded recovery and retains a failed approval outcome',async t=>{
  const f=fixture(t),p=await prepare(f,'service.restart');f.failHealth();
  const result=await apply(f,p);assert.equal(result.state,'rollback-failed');assert.equal(result.result.approvalClosed,false);
  assert.deepEqual(f.calls.map(c=>c.action),['restart','restart']);
});
test('production service changes cannot borrow operator-local initiation as independent approval',async t=>{
  const f=fixture(t);fs.appendFileSync(path.join(f.home,'.env'),'N2N_RISK_MODE=production\n');
  const p=await prepare(f,'service.stop');assert.equal(p.proposal.changeClass,'production');
  await assert.rejects(apply(f,p),{code:'DENIED'});assert.equal(f.calls.length,0);
});
test('lost stop acknowledgement restores only the attested unit and a retained nonce never repeats control',async t=>{
  const f=fixture(t),p=await prepare(f,'service.stop'),act=f.controller.act.bind(f.controller);let first=true;
  f.controller.act=async(id,action)=>{await act(id,action);if(first){first=false;throw Error('lost manager receipt after stop');}};
  const input={nonce:nonce(),proposalId:p.proposalId,expectedRevision:p.proposal.expectedRevision};
  const result=await f.proposals.apply(f.binding.principal,input);assert.equal(result.state,'rolled-back');assert.equal(f.active,true);
  assert.deepEqual(f.calls.map(c=>c.action),['stop','start']);
  assert.equal((await f.proposals.apply(f.binding.principal,input)).operationId,result.operationId);assert.equal(f.calls.length,2);
});

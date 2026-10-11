import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture,nonce,auditFixture,authoritativeApproval} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {Journal} from '../../ui/netclaw-visual/src/management/journal.js';
import {Proposals} from '../../ui/netclaw-visual/src/management/proposals.js';
import {FederationPermissions,PeerPolicyClient} from '../../ui/netclaw-visual/src/management/peer-policy.js';
import {parseOperatorInput} from '../../mcp-servers/netclaw-operator-mcp/schemas.mjs';

function fixture(t){
  const f=installationFixture(t),binding=bindInstallation(f),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const policy={identity:'peer',revision:1,state:'federated',chatEnabled:false,consent:{local_grant:true,remote_grant:true},grants:[],work:[]},calls=[],saved=new Map();
  const client={afterApply:null,rollbackFails:false,production:false,async call(action,args){calls.push({action,args});
    if(action==='snapshot')return {format:1,installationId:f.installationId,harness:f.kind,production:this.production,policy:structuredClone(policy),grantCandidates:[{type:'tool',name:'local/calculate'}]};
    if(action==='apply'){saved.set(args.operationId,structuredClone(policy));policy.chatEnabled=true;policy.revision++;this.afterApply?.();return {verified:true,state:'applied'};}
    if(action==='verify')return {verified:true,state:'applied'};
    if(action==='rollback'){if(this.rollbackFails)throw Error('newer policy');Object.assign(policy,saved.get(args.operationId));return {verified:true,state:'rolled-back'};}
  }};
  const audit=auditFixture(),authority=authoritativeApproval(),permissions=new FederationPermissions({binding,client}),adapter=permissions.adapter();
  const proposals=new Proposals({binding,journal,audit,authority,adapters:{'peer.trust':adapter,'peer.untrust':adapter}});
  return {...f,binding,journal,policy,calls,client,audit,authority,permissions,proposals};
}
const prepare=(f,overrides={})=>f.proposals.prepare(f.binding.principal,{nonce:nonce(),action:'peer.trust',targets:[f.installationId,'peer'],expectedRevision:f.proposals.revision(),patch:{chatEnabled:true,acknowledgeActiveWork:true},...overrides});
const apply=async(f,p,extra={})=>{const input={nonce:nonce(),proposalId:p.proposalId,expectedRevision:p.proposal.expectedRevision,...extra},op=f.proposals.admitApply(f.binding.principal,input),lease=f.journal.claim(op.operationId,{pid:process.pid});return f.proposals.apply(f.binding.principal,input,{lease});};

test('peer proposal preserves exact target and active-work impact, then uses only its worker reference',async t=>{
  const f=fixture(t),p=await prepare(f);assert.match(p.proposal.impact,/exact existing external peer peer/);assert.match(p.proposal.impact,/Rollback.*cannot undo work/);
  const result=await apply(f,p);assert.equal(result.state,'succeeded');assert.equal(f.policy.chatEnabled,true);
  const dispatch=f.calls.find(row=>row.action==='apply');assert.deepEqual(Object.keys(dispatch.args).sort(),['lease','operationId']);assert.equal(dispatch.args.operationId,result.operationId);
});
test('foreign targets, missing consent and assistant-origin permission proposals cannot dispatch',async t=>{
  const f=fixture(t);await assert.rejects(prepare(f,{targets:['other','peer']}),{code:'DENIED'});
  f.policy.consent.remote_grant=false;await assert.rejects(prepare(f),{code:'UNQUALIFIED'});f.policy.consent.remote_grant=true;
  const assistant={principalId:'assistant',surface:'assistant',grantId:'grant',generation:1,targets:[f.installationId,'peer'],actions:['propose'],disclosure:['summary'],expiresAt:Date.now()+60000};
  await assert.rejects(f.proposals.prepare(assistant,{nonce:nonce(),action:'peer.trust',targets:[f.installationId,'peer'],expectedRevision:f.proposals.revision(),patch:{chatEnabled:true,acknowledgeActiveWork:true}}),{code:'DENIED'});
  assert.ok(!f.calls.some(row=>row.action==='apply'));
});
test('policy revision change after review fails before apply; audit loss cannot dispatch',async t=>{
  const f=fixture(t),p=await prepare(f);f.policy.revision++;
  await assert.rejects(apply(f,p),{code:'STALE_REVISION'});assert.equal(f.policy.chatEnabled,false);
  const next=await prepare(f);f.audit.available=false;await assert.rejects(apply(f,next));assert.ok(!f.calls.some(row=>row.action==='apply'));
});
test('production permission changes require live independent scope approval and retain withdrawal rollback evidence',async t=>{
  const f=fixture(t);fs.appendFileSync(f.binding.envPath,'N2N_RISK_MODE=" Production "\n');const p=await prepare(f);
  assert.equal(p.proposal.changeClass,'production');
  await assert.rejects(apply(f,p),{code:'DENIED'});assert.equal(f.policy.chatEnabled,false);
  f.client.afterApply=()=>f.authority.withdraw();const result=await apply(f,p,{approvalReference:'CHG-fixture'});
  assert.equal(result.state,'rolled-back');assert.equal(result.result.approvalClosed,false);assert.equal(f.policy.chatEnabled,false);
});
test('running federation production mode cannot be downgraded by saved testing settings',async t=>{
  const f=fixture(t);f.client.production=true;fs.appendFileSync(f.binding.envPath,'N2N_RISK_MODE=testing\n');const p=await prepare(f);
  assert.equal(p.proposal.changeClass,'production');await assert.rejects(apply(f,p),{code:'DENIED'});
  assert.ok(!f.calls.some(row=>row.action==='apply'));
});
test('newer policy preventing rollback remains rollback-failed and never closes approval',async t=>{
  const f=fixture(t);fs.appendFileSync(f.binding.envPath,'N2N_RISK_MODE=production\n');const p=await prepare(f);
  f.client.rollbackFails=true;f.client.afterApply=()=>f.authority.withdraw();const result=await apply(f,p,{approvalReference:'CHG-fixture'});
  assert.equal(result.state,'rollback-failed');assert.equal(result.result.approvalClosed,false);assert.equal(f.policy.chatEnabled,true);
});
test('peer action shapes refuse approval bypass, duplicate revoke IDs, arbitrary URLs and generic lab flags',()=>{
  const input={nonce:nonce(),action:'peer.trust',targets:['installation','peer'],expectedRevision:'00000000-0000-4000-8000-000000000000',patch:{chatEnabled:true,acknowledgeActiveWork:true}};
  assert.ok(parseOperatorInput('operator_change_prepare',input));
  for(const patch of [{...input.patch,url:'http://example.invalid'},{...input.patch,approved:true},{...input.patch,localLab:true},{...input.patch,grant:{type:'tool',name:'local/calculate',requiresApproval:false,timeoutSeconds:30}}])
    assert.throws(()=>parseOperatorInput('operator_change_prepare',{...input,patch}),{code:'INVALID_INPUT'});
  assert.throws(()=>parseOperatorInput('operator_change_prepare',{...input,action:'peer.untrust',patch:{acknowledgeActiveWork:true,revokeGrantIds:[1,1]}}),{code:'INVALID_INPUT'});
});
test('fixed peer-policy transport checks identity after response and rejects arbitrary actions',async t=>{
  const f=fixture(t),calls=[],status={installation_id:f.installationId,harness_type:f.kind,federation_ready:true};
  const client=new PeerPolicyClient(f.binding,async(url,args)=>{calls.push({url,args});return Response.json(calls.length===1?status:calls.length===2?{private:'must not return'}:{...status,installation_id:'wrong'});});
  await assert.rejects(client.call('snapshot',{peer:'peer'}),{code:'IDENTITY_CHANGED'});assert.ok(calls[1].url.endsWith('/n2n/management/peer-policy'));
  await assert.rejects(client.call('http://example.invalid',{}),{code:'UNSUPPORTED'});assert.equal(calls.length,3);
});

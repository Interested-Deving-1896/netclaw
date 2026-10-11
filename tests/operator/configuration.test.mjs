import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { installationFixture,nonce,auditFixture } from './fixtures.mjs';
import { bindInstallation } from '../../ui/netclaw-visual/src/management/identity.js';
import { Journal } from '../../ui/netclaw-visual/src/management/journal.js';
import { configurationAdapters,configurationSnapshot,managedSettingsSnapshot,patchEnvironment,configuredSecrets } from '../../ui/netclaw-visual/src/management/configuration.js';
import { Proposals } from '../../ui/netclaw-visual/src/management/proposals.js';
import { updateEnvironment } from '../../ui/netclaw-visual/src/security/private-files.js';
import {withManagementConfigurationLock} from '../../ui/netclaw-visual/src/management/shared-lock.js';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {updateBudgetConfiguration} from '../../ui/netclaw-visual/src/hud-server/configuration-mutations.js';
import {createManagementRuntime} from '../../ui/netclaw-visual/src/management/chat-runtime.js';

test('env edit preserves unrelated bytes and handles multiline legacy spans',()=>{
  const source='# keep CRLF\r\nUNRELATED="a\nb"\nANTHROPIC_API_KEY="old\nkey"\nTAIL=x\n';
  assert.equal(patchEnvironment(source,{ANTHROPIC_API_KEY:'new'}),'# keep CRLF\r\nUNRELATED="a\nb"\nTAIL=x\nANTHROPIC_API_KEY="new"\n');
});
test('configuration inventory contains presence, never synthetic secrets',t=>{
  const f=installationFixture(t),binding=bindInstallation(f);fs.appendFileSync(binding.envPath,'ANTHROPIC_API_KEY="SYNTHETIC_SECRET_150"\n');
  assert.ok(!JSON.stringify(configurationSnapshot(binding)).includes('SYNTHETIC_SECRET_150'));
});
test('secret proposal carries only intent; apply keeps blank/mask, replaces and explicitly clears',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  fs.appendFileSync(binding.envPath,'ANTHROPIC_API_KEY="SYNTHETIC_OLD"\n');
  const p=new Proposals({binding,journal,audit:auditFixture(),adapters:configurationAdapters(binding)});
  for(const [intent,value,expected] of [['replace','', 'SYNTHETIC_OLD'],['replace','****','SYNTHETIC_OLD'],['replace','SYNTHETIC_NEW','SYNTHETIC_NEW'],['clear',undefined,'']]){
    const proposal=await p.prepare(binding.principal,{nonce:nonce(),action:'integration.configure',targets:[f.installationId],expectedRevision:p.revision(),patch:{fields:[{key:'ANTHROPIC_API_KEY',intent}]}});
    assert.ok(!JSON.stringify(proposal).includes('SYNTHETIC_OLD'));
    const result=await p.apply(binding.principal,{nonce:nonce(),proposalId:proposal.proposalId,expectedRevision:proposal.proposal.expectedRevision,...(value===undefined?{}:{replacements:{ANTHROPIC_API_KEY:value}})});
    assert.equal(result.state,'succeeded');assert.equal(result.result.pendingRestart,true);
    assert.ok(fs.readFileSync(binding.envPath,'utf8').includes(`ANTHROPIC_API_KEY="${expected}"`));
    assert.equal(fs.statSync(binding.envPath).mode&0o777,0o600);
  }
});
test('executable injection and broad lab bypass cannot be configured through managed fields',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f),adapter=configurationAdapters(binding)['integration.configure'];
  for(const key of ['NODE_OPTIONS','PYTHONPATH','PYATS_MCP_SCRIPT','NETCLAW_LAB_MODE','N2N_RISK_MODE']){
    await assert.rejects(adapter.prepare({targets:[f.installationId],patch:{fields:[{key,intent:'replace',value:'anything'}]}}),{code:'UNSUPPORTED'});
  }
});
test('managed production configuration requires live approval even when a legacy lab flag is present',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  fs.appendFileSync(binding.envPath,'N2N_RISK_MODE=production\nNETCLAW_LAB_MODE=true\n');
  const before=fs.readFileSync(f.configPath),env=fs.readFileSync(binding.envPath),p=new Proposals({binding,journal,audit:auditFixture(),adapters:configurationAdapters(binding)});
  for(const [action,patch] of [['budget.patch',{sessionBudgetUsd:2}],['integration.configure',{fields:[{key:'ANTHROPIC_API_KEY',intent:'clear'}]}]]){
    const proposal=await p.prepare(binding.principal,{nonce:nonce(),action,targets:[f.installationId],expectedRevision:p.revision(),patch});
    assert.equal(proposal.proposal.changeClass,'production');
    await assert.rejects(p.apply(binding.principal,{nonce:nonce(),proposalId:proposal.proposalId,expectedRevision:proposal.proposal.expectedRevision}),{code:'DENIED'});
    assert.deepEqual(fs.readFileSync(f.configPath),before);assert.deepEqual(fs.readFileSync(binding.envPath),env);
  }
});
test('existing HUD environment writer respects the management process lock',t=>{
  const f=installationFixture(t),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const token=journal.lock('configuration','extension');
  assert.throws(()=>updateEnvironment(path.join(f.home,'.env'),{ANTHROPIC_API_KEY:'synthetic'}),{code:'BUSY'});
  journal.unlock('configuration',token);updateEnvironment(path.join(f.home,'.env'),{ANTHROPIC_API_KEY:'synthetic'});
  assert.ok(fs.readFileSync(path.join(f.home,'.env'),'utf8').includes('ANTHROPIC_API_KEY=synthetic'));
});
test('shared configuration ownership lasts until an asynchronous writer settles',async t=>{
  const f=installationFixture(t),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  let finish;const work=withManagementConfigurationLock(f.home,()=>new Promise(resolve=>{finish=resolve;}));
  assert.throws(()=>journal.lock('configuration','competitor'),{code:'BUSY'});
  finish();await work;const acquired=journal.lock('configuration','competitor');journal.unlock('configuration',acquired);
});
test('Python env writer joins the same configuration lock and retains multiline unrelated bytes',t=>{
  const f=installationFixture(t),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const file=path.join(f.home,'.env'),source='# retained\r\nUNRELATED="one\ntwo"\nOLD="old\nvalue"\n';fs.writeFileSync(file,source,{mode:0o600});
  const script=fileURLToPath(new URL('../../scripts/write-env.py',import.meta.url));
  const lock=journal.lock('configuration','extension');
  const denied=spawnSync('python3',[script,file,'OLD'],{input:'new',encoding:'utf8'});
  assert.notEqual(denied.status,0);assert.equal(fs.readFileSync(file,'utf8'),source);
  journal.unlock('configuration',lock);
  const result=spawnSync('python3',[script,file,'OLD'],{input:'new',encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  assert.equal(fs.readFileSync(file,'utf8'),'# retained\r\nUNRELATED="one\ntwo"\nOLD=new\n');
});
test('HUD budget merge shares configuration ownership and preserves unrelated fields',t=>{
  const f=installationFixture(t),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  fs.writeFileSync(f.configPath,JSON.stringify({agents:{defaults:{budget:{sessionBudgetUsd:5,customRetained:true}}},unrelated:{retain:true}}));
  const lock=journal.lock('configuration','extension');
  assert.throws(()=>updateBudgetConfiguration(f.home,{budget:{sessionBudgetUsd:2}}),{code:'BUSY'});
  journal.unlock('configuration',lock);
  const result=updateBudgetConfiguration(f.home,{budget:{sessionBudgetUsd:0}});
  assert.equal(result.agents.defaults.budget.sessionBudgetUsd,0);assert.equal(result.agents.defaults.budget.customRetained,true);assert.equal(result.unrelated.retain,true);
  for(const invalid of [{sessionBudgetUsd:-1},{allowOverride:'true'},{maxToolCallsPerTurn:1.5}])assert.throws(()=>updateBudgetConfiguration(f.home,{budget:invalid}));
});
test('managed budget uses real session controls, rejects unimplemented aggregate caps, and verifies saved state',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  const p=new Proposals({binding,journal,audit:auditFixture(),adapters:configurationAdapters(binding)});
  const base={action:'budget.patch',targets:[f.installationId]};
  await assert.rejects(p.prepare(binding.principal,{...base,nonce:nonce(),expectedRevision:p.revision(),patch:{monthlyLimit:3}}),{code:'UNSUPPORTED'});
  const prepared=await p.prepare(binding.principal,{...base,nonce:nonce(),expectedRevision:p.revision(),patch:{sessionBudgetUsd:3,maxToolCallsPerTurn:7}});
  const result=await p.apply(binding.principal,{nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision});
  assert.equal(result.state,'succeeded');assert.equal(result.result.pendingRestart,true);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.configPath)).agents.defaults.budget,{sessionBudgetUsd:3,maxToolCallsPerTurn:7});
});
test('reviewed legacy OpenClaw credential normalization preserves provider and unrelated configuration',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f),journal=new Journal(path.join(f.statePath,'management'),f.installationId);t.after(()=>journal.close());
  fs.writeFileSync(f.configPath,JSON.stringify({gateway:{auth:{mode:'token',token:'SYNTHETIC_LEGACY_GATEWAY'}},agents:{defaults:{model:{primary:'fixture/old',fallbacks:['fixture/old']}}},models:{providers:{fixture:{models:[{id:'old'},{id:'new'}],apiKey:'${OPENAI_API_KEY}'}}},unrelated:{retain:true}}));
  const p=new Proposals({binding,journal,audit:auditFixture(),adapters:configurationAdapters(binding)});
  const prepared=await p.prepare(binding.principal,{nonce:nonce(),action:'settings.patch',targets:[f.installationId],expectedRevision:p.revision(),patch:{provider:'fixture',model:'new',normalizeCredentials:true}});
  assert.ok(!JSON.stringify(prepared).includes('SYNTHETIC_LEGACY_GATEWAY'));
  assert.equal(JSON.parse(fs.readFileSync(f.configPath)).gateway.auth.token,'SYNTHETIC_LEGACY_GATEWAY');
  const result=await p.apply(binding.principal,{nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision});
  assert.equal(result.state,'succeeded');
  const config=JSON.parse(fs.readFileSync(f.configPath));assert.equal(config.gateway.auth.token,'${OPENCLAW_GATEWAY_TOKEN}');
  assert.equal(config.agents.defaults.model.primary,'fixture/new');assert.deepEqual(config.agents.defaults.model.fallbacks,['fixture/old']);assert.equal(config.unrelated.retain,true);
  assert.match(fs.readFileSync(binding.envPath,'utf8'),/OPENCLAW_GATEWAY_TOKEN="SYNTHETIC_LEGACY_GATEWAY"/);
});
test('legacy normalization refuses conflicting env credentials without changing either file',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f);
  fs.writeFileSync(f.configPath,JSON.stringify({gateway:{auth:{token:'SYNTHETIC_ONE'}}}));fs.appendFileSync(binding.envPath,'OPENCLAW_GATEWAY_TOKEN=SYNTHETIC_OTHER\n');
  const before=fs.readFileSync(f.configPath),envBefore=fs.readFileSync(binding.envPath);
  const adapter=configurationAdapters(binding)['settings.patch'];assert.ok(adapter);
  await assert.rejects(adapter.prepare({targets:[f.installationId],patch:{normalizeCredentials:true}}),{code:'DENIED'});
  assert.deepEqual(fs.readFileSync(f.configPath),before);assert.deepEqual(fs.readFileSync(binding.envPath),envBefore);
});

test('Hermes credential normalization detects the actual legacy key and restores exact rollback bytes',async t=>{
  const f=installationFixture(t,'hermes'),binding=bindInstallation(f),auth=path.join(binding.statePath,'companion-auth.json');
  const original='{"key":"SYNTHETIC_COMPANION_SECRET","port":9463,"unrelated":true}\n';fs.writeFileSync(auth,original,{mode:0o600});
  const config=fs.readFileSync(binding.configPath),env=fs.readFileSync(binding.envPath),adapter=configurationAdapters(binding)['settings.patch'];
  assert.equal(managedSettingsSnapshot(binding).legacyCredentials,true);assert.ok(configuredSecrets(binding).includes('SYNTHETIC_COMPANION_SECRET'));
  const input={targets:[f.installationId],patch:{normalizeCredentials:true}},prepared=await adapter.prepare(input);
  const proposal={...input,proposalId:'synthetic-proposal'},result=await adapter.apply(proposal,{baseline:prepared.baseline});
  assert.equal((await adapter.verify(proposal,result)).verified,true);assert.equal(managedSettingsSnapshot(binding).legacyCredentials,false);
  assert.equal(JSON.parse(fs.readFileSync(auth)).unrelated,true);assert.equal(JSON.parse(fs.readFileSync(auth)).key,undefined);
  assert.match(fs.readFileSync(binding.envPath,'utf8'),/NETCLAW_HERMES_HUD_API_KEY="SYNTHETIC_COMPANION_SECRET"/);
  assert.match(fs.readFileSync(binding.envPath,'utf8'),/NETCLAW_HERMES_HUD_PORT="9463"/);
  assert.equal((await adapter.rollback(proposal,prepared.rollback)).verified,true);
  assert.equal(fs.readFileSync(auth,'utf8'),original);assert.deepEqual(fs.readFileSync(binding.configPath),config);assert.deepEqual(fs.readFileSync(binding.envPath),env);
});
test('Hermes management refuses ambient and legacy JSON credentials before starting a bridge',async t=>{
  const f=installationFixture(t,'hermes'),binding=bindInstallation(f),before=process.env.NETCLAW_HERMES_HUD_API_KEY;
  fs.writeFileSync(path.join(binding.statePath,'companion-auth.json'),'{"key":"SYNTHETIC_LEGACY","port":9463}',{mode:0o600});
  const runtime=createManagementRuntime(binding,fileURLToPath(new URL('../../',import.meta.url)));
  try{process.env.NETCLAW_HERMES_HUD_API_KEY='SYNTHETIC_AMBIENT';await assert.rejects(runtime.readiness(),{code:'UNAUTHENTICATED'});}
  finally{if(before===undefined)delete process.env.NETCLAW_HERMES_HUD_API_KEY;else process.env.NETCLAW_HERMES_HUD_API_KEY=before;await runtime.close();}
});
test('normalization refuses collisions and rollback never overwrites an intervening manual edit',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f),adapter=configurationAdapters(binding)['settings.patch'];
  const input={targets:[f.installationId],patch:{normalizeCredentials:true}};
  fs.writeFileSync(f.configPath,JSON.stringify({models:{providers:{'custom-api':{apiKey:'SYNTHETIC_A'},custom_api:{apiKey:'SYNTHETIC_B'}}}}));
  await assert.rejects(adapter.prepare(input),{code:'DENIED'});
  fs.writeFileSync(f.configPath,JSON.stringify({gateway:{auth:{token:'SYNTHETIC_A'}}}));
  const prepared=await adapter.prepare(input),proposal={...input,proposalId:'synthetic'};await adapter.apply(proposal,{baseline:prepared.baseline});
  fs.writeFileSync(f.configPath,'{"manual":"retained"}\n');
  await assert.rejects(adapter.rollback(proposal,prepared.rollback),{code:'STALE_REVISION'});assert.equal(fs.readFileSync(f.configPath,'utf8'),'{"manual":"retained"}\n');
});
test('HUD and management env editing retain CRLF, multiline and escaped closing quotes consistently',t=>{
  const f=installationFixture(t),file=path.join(f.home,'.env');
  const source='# keep\r\nUNRELATED="line one\nline two"\r\nOLD="backslash\\\\"\r\nTAIL=retained';fs.writeFileSync(file,source);
  updateEnvironment(file,{OLD:'new'});
  assert.equal(fs.readFileSync(file,'utf8'),'# keep\r\nUNRELATED="line one\nline two"\r\nTAIL=retained\nOLD=new\n');
  assert.equal(patchEnvironment(source,{}),source);
  assert.throws(()=>patchEnvironment('BROKEN="open\n',{OLD:'new'}));
});

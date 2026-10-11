import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {installationFixture,auditFixture,nonce,authoritativeApproval} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

async function fixture(t,kind='openclaw',options={}){
  const f=installationFixture(t,kind),directory=path.join(f.root,'defense');fs.mkdirSync(directory,{mode:0o700});
  fs.writeFileSync(path.join(directory,'config.yaml'),`config_version: 8\nclaw:\n  mode: ${kind}\n  home_dir: ${JSON.stringify(f.home)}\n  config_file: ${JSON.stringify(f.configPath)}\nguardrail:\n  enabled: true\n  mode: observe\n  connector: ${kind}\n`,{mode:0o600});
  const database=path.join(directory,'audit.db'),db=new DatabaseSync(database);
  db.exec(`CREATE TABLE actions(id TEXT PRIMARY KEY,target_type TEXT NOT NULL,target_name TEXT NOT NULL,source_path TEXT,actions_json TEXT NOT NULL DEFAULT '{}',reason TEXT,updated_at DATETIME NOT NULL,connector TEXT NOT NULL DEFAULT '');CREATE UNIQUE INDEX action_target ON actions(target_type,target_name,connector);`);
  const insert=db.prepare('INSERT INTO actions VALUES (?,?,?,?,?,?,?,?)');
  insert.run('global','tool','write_file',null,'{"install":"block"}','global reason','original','');
  insert.run('scoped','tool',`@${kind}/write_file`,'/private/retained-source','{"install":"block","file":"quarantine","runtime":"disable"}','private reason','original','');
  insert.run('foreign','tool','@codex/write_file',null,'{"install":"block"}','foreign reason','original','');
  fs.chmodSync(database,0o600);t.after(()=>db.close());
  const audit=auditFixture(),service=new ManagementService({...f,audit,...options});t.after(()=>service.close());
  await service.defenseclaw.register({directory},{reviewed:true,audit});
  const snapshot=async()=>(await service.call('operator_workspace',{action:'security-rule',args:{tool:'write_file'}})).data;
  const prepare=async policy=>{const view=await snapshot();return service.call('operator_change_prepare',{nonce:nonce(),action:'security.tool-rule',targets:[f.installationId],expectedRevision:service.proposals.revision(),patch:{tool:'write_file',policy,expectedRuleRevision:view.revision}});};
  const apply=prepared=>service.proposals.apply(service.binding.principal,{nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision,...(options.authority?{approvalReference:'CHG-fixture'}:{})});
  return {...f,directory,database,db,service,audit,snapshot,prepare,apply};
}

test('reviewed connector allow clears only upstream logical flags; inherit resolves the unchanged global fallback',async t=>{
  for(const kind of ['openclaw','hermes']){
    const f=await fixture(t,kind),untouched=f.db.prepare("SELECT * FROM actions WHERE id IN ('global','foreign') ORDER BY id").all(),bytes=fs.readFileSync(f.database);
    const before=await f.snapshot();assert.equal(before.effective,'block');assert.deepEqual(fs.readFileSync(f.database),bytes);
    assert.ok(!JSON.stringify(before).includes('private reason'));assert.ok(!JSON.stringify(before).includes('/private/retained-source'));
    const prepared=await f.prepare('allow');assert.deepEqual(fs.readFileSync(f.database),bytes);assert.match(prepared.proposal.impact,/clears this scoped row/);
    const result=await f.apply(prepared);assert.equal(result.state,'succeeded');assert.match(result.result.observedState,/running enforcement remains unverified/);
    const row=f.db.prepare("SELECT * FROM actions WHERE id='scoped'").get();assert.deepEqual(JSON.parse(row.actions_json),{install:'allow'});assert.equal(row.source_path,'/private/retained-source');
    assert.equal((await f.snapshot()).effective,'allow');
    assert.equal((await f.apply(await f.prepare('inherit'))).state,'succeeded');const inherited=await f.snapshot();assert.equal(inherited.override,'inherit');assert.equal(inherited.effective,'block');
    assert.deepEqual(f.db.prepare("SELECT * FROM actions WHERE id IN ('global','foreign') ORDER BY id").all(),untouched);
  }
});
test('same-policy ABA, changed global fallback and replaced database refuse a stale reviewed mutation',async t=>{
  for(const variant of ['aba','fallback','inode']){
    const f=await fixture(t),prepared=await f.prepare('allow');
    if(variant==='aba'){f.db.prepare("UPDATE actions SET actions_json=?,updated_at=? WHERE id='scoped'").run('{"install":"allow"}','intermediate');f.db.prepare("UPDATE actions SET actions_json=?,updated_at=? WHERE id='scoped'").run('{"install":"block","file":"quarantine","runtime":"disable"}','later');}
    if(variant==='fallback')f.db.prepare("UPDATE actions SET actions_json=? WHERE id='global'").run('{"install":"allow"}');
    if(variant==='inode'){fs.renameSync(f.database,f.database+'.original');fs.copyFileSync(f.database+'.original',f.database);}
    await assert.rejects(f.apply(prepared),{code:'STALE_REVISION'});
    assert.equal(f.service.journal.records('defense-rule-recovery',f.service.binding.principal).length,0);
  }
});
test('the write transaction rechecks fallback after preparation and preserves an interleaved owner change',async t=>{
  const f=await fixture(t),prepared=await f.prepare('allow'),rules=f.service.defenseRules,mutate=rules.mutate.bind(rules);
  rules.mutate=(...args)=>{f.db.prepare("UPDATE actions SET actions_json=?,updated_at=? WHERE id='global'").run('{"install":"allow"}','interleaved');return mutate(...args);};
  const result=await f.apply(prepared);assert.equal(result.state,'rolled-back');
  assert.equal(JSON.parse(f.db.prepare("SELECT actions_json FROM actions WHERE id='scoped'").get().actions_json).install,'block');
  assert.equal(f.db.prepare("SELECT updated_at FROM actions WHERE id='global'").get().updated_at,'interleaved');
});
test('withdrawn production approval restores the exact scoped row but cannot overwrite a later owner rule',async t=>{
  for(const later of [false,true]){
    const authority=authoritativeApproval(),f=await fixture(t,'openclaw',{authority});fs.appendFileSync(path.join(f.home,'.env'),'N2N_RISK_MODE=production\n');
    const original=f.db.prepare("SELECT * FROM actions WHERE id='scoped'").get(),prepared=await f.prepare('allow'),adapter=f.service.adapters['security.tool-rule'],verify=adapter.verify;
    adapter.verify=async(...args)=>{const result=await verify(...args);if(later)f.db.prepare("UPDATE actions SET reason='new owner rule',updated_at='newer' WHERE id='scoped'").run();authority.withdraw();return result;};
    const result=await f.apply(prepared);assert.equal(result.state,later?'rollback-failed':'rolled-back');assert.equal(result.result.approvalClosed,false);
    if(later)assert.equal(f.db.prepare("SELECT reason FROM actions WHERE id='scoped'").get().reason,'new owner rule');else assert.deepEqual(f.db.prepare("SELECT * FROM actions WHERE id='scoped'").get(),original);
  }
});
test('no production approval, audit failure and assistant origin cannot mutate connector rules',async t=>{
  const f=await fixture(t),bytes=fs.readFileSync(f.database),view=await f.snapshot(),input={nonce:nonce(),action:'security.tool-rule',targets:[f.installationId],expectedRevision:f.service.proposals.revision(),patch:{tool:'write_file',policy:'allow',expectedRuleRevision:view.revision}};
  await assert.rejects(f.service.adapters['security.tool-rule'].prepare(input,{surface:'assistant'}),{code:'DENIED'});
  f.audit.available=false;await assert.rejects(f.service.call('operator_change_prepare',input));f.audit.available=true;
  fs.appendFileSync(path.join(f.home,'.env'),'N2N_RISK_MODE=production\n');await assert.rejects(f.apply(await f.prepare('allow')),{code:'DENIED'});assert.deepEqual(fs.readFileSync(f.database),bytes);
});
test('linked/private-file violations, unknown action schema and action triggers deny writes and previews',async t=>{
  for(const variant of ['linked','public','schema','trigger']){
    const f=await fixture(t);
    if(variant==='linked'){fs.renameSync(f.database,f.database+'.original');fs.symlinkSync(f.database+'.original',f.database);}
    if(variant==='public')fs.chmodSync(f.database,0o644);
    if(variant==='schema')f.db.exec('ALTER TABLE actions ADD COLUMN future_policy TEXT');
    if(variant==='trigger')f.db.exec("CREATE TRIGGER unsafe_rule AFTER UPDATE ON actions BEGIN UPDATE actions SET reason='unexpected'; END");
    await assert.rejects(f.snapshot());
  }
});
test('a new scoped override can be removed without changing a global rule or creating any component files',async t=>{
  const f=await fixture(t);f.db.prepare("DELETE FROM actions WHERE id='scoped'").run();const before=fs.readdirSync(f.directory).sort();
  assert.equal((await f.apply(await f.prepare('allow'))).state,'succeeded');assert.equal((await f.snapshot()).override,'allow');
  assert.equal((await f.apply(await f.prepare('inherit'))).state,'succeeded');assert.equal((await f.snapshot()).effective,'block');assert.equal(f.db.prepare("SELECT count(*) AS n FROM actions WHERE target_name='@openclaw/write_file'").get().n,0);
  assert.deepEqual(fs.readdirSync(f.directory).sort(),before);
});

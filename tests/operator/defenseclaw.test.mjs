import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {installationFixture,auditFixture,nonce} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {DefenseClawComponent} from '../../ui/netclaw-visual/src/management/defenseclaw.js';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

function component(t,kind='openclaw'){
  const f=installationFixture(t,kind),binding=bindInstallation(f),directory=path.join(f.root,'defense');fs.mkdirSync(directory,{mode:0o700});
  const file=path.join(directory,'config.yaml');
  const original=`# Preserve this comment\nconfig_version: 8\nclaw:\n  mode: ${kind}\n  home_dir: ${JSON.stringify(f.home)}\n  config_file: ${JSON.stringify(f.configPath)}\nguardrail:\n  enabled: true\n  mode: observe\n  connector: ${kind}\n  hook_fail_mode: closed\nobservability:\n  local:\n    path: audit.db\nllm:\n  api_key: synthetic-component-secret\n`;
  fs.writeFileSync(file,original,{mode:0o600});
  const db=new DatabaseSync(path.join(directory,'audit.db'));
  db.exec(`CREATE TABLE audit_events(id TEXT, timestamp TEXT, action TEXT, target TEXT, actor TEXT, severity TEXT, connector TEXT, details TEXT);
    CREATE TABLE scan_results(id TEXT,scanner TEXT,target TEXT,timestamp TEXT,duration_ms INTEGER,finding_count INTEGER,max_severity TEXT,raw_json TEXT);
    CREATE TABLE actions(id TEXT,target_type TEXT,target_name TEXT,actions_json TEXT,reason TEXT,updated_at TEXT,connector TEXT);
    INSERT INTO audit_events VALUES('event','2026-10-11','connector-hook','tool','guard','WARN','${kind}','synthetic-component-secret');
    INSERT INTO audit_events VALUES('foreign','2026-10-11','connector-hook','foreign','guard','WARN','codex','foreign secret');
    INSERT INTO scan_results VALUES('scan','skill','owned-skill','2026-10-11',4,1,'HIGH','synthetic-component-secret');
    INSERT INTO actions VALUES('rule','tool','@${kind}/write_file','{"install":"block"}','private reason','2026-10-11','');
    INSERT INTO actions VALUES('rule-global','tool','read_file','{"install":"allow"}','private reason','2026-10-11','');
    INSERT INTO actions VALUES('rule-foreign','tool','@codex/foreign','{"install":"block"}','foreign secret','2026-10-11','');`);
  db.close();fs.chmodSync(path.join(directory,'audit.db'),0o600);
  const component=new DefenseClawComponent(binding);
  return {...f,binding,directory,file,original,component};
}
test('explicit component registration previews without adopting or initializing state',async t=>{
  const f=component(t),before=fs.readdirSync(f.directory);assert.equal(f.component.snapshot().available,false);
  const preview=await f.component.register({directory:f.directory},{reviewed:false});assert.equal(preview.connector,'openclaw');assert.equal(f.component.snapshot().available,false);
  assert.deepEqual(fs.readdirSync(f.directory),before);
  await f.component.register({directory:f.directory},{reviewed:true,audit:auditFixture()});
  const bytes=fs.readFileSync(path.join(f.directory,'audit.db')),result=f.component.snapshot();
  assert.equal(result.available,true);assert.equal(result.configured.mode,'observe');assert.equal(result.effective.state,'unverified');
  assert.equal(result.history.events.items.length,1);assert.equal(result.history.scans.items.length,1);assert.equal(result.history.rules.items.length,2);
  assert.ok(!JSON.stringify(result).includes('synthetic-component-secret'));assert.ok(!JSON.stringify(result).includes('foreign'));
  assert.deepEqual(fs.readFileSync(path.join(f.directory,'audit.db')),bytes);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});
test('component registration refuses other homes, connectors, unsafe files and incompatible schemas',async t=>{
  const f=component(t);
  for(const text of [f.original.replace(f.home,f.root),f.original.replace('config_version: 8','config_version: 7'),f.original.replace('  connector: openclaw','  connector: openclaw\n  connectors:\n    openclaw: {}\n    codex: {}')]){
    fs.writeFileSync(f.file,text);await assert.rejects(f.component.register({directory:f.directory},{reviewed:false}));
  }
  fs.writeFileSync(f.file,f.original);fs.chmodSync(f.file,0o644);await assert.rejects(f.component.register({directory:f.directory},{reviewed:false}),{code:'DENIED'});
});
test('guard mode uses review, revision, exact recovery bytes and pending effective state',async t=>{
  const f=component(t,'hermes'),audit=auditFixture();await f.component.register({directory:f.directory},{reviewed:true,audit});
  const service=new ManagementService({...f,audit});t.after(()=>service.close());
  const input={nonce:nonce(),action:'security.patch',targets:[f.installationId],expectedRevision:service.proposals.revision(),patch:{mode:'enforce'}};
  const prepared=await service.call('operator_change_prepare',input);
  assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
  const applied=await service.proposals.apply(service.binding.principal,{proposalId:prepared.proposalId,nonce:nonce(),expectedRevision:input.expectedRevision});
  assert.equal(applied.state,'succeeded');assert.equal(applied.result.pendingRestart,true);
  assert.match(fs.readFileSync(f.file,'utf8'),/# Preserve this comment/);assert.match(fs.readFileSync(f.file,'utf8'),/mode: action/);
  assert.equal(f.component.snapshot().effective.state,'unverified');
  const stale=await service.call('operator_change_prepare',{...input,nonce:nonce(),expectedRevision:service.proposals.revision(),patch:{mode:'observe'}});
  fs.appendFileSync(f.file,'# concurrent owner change\n');
  await assert.rejects(service.proposals.apply(service.binding.principal,{proposalId:stale.proposalId,nonce:nonce(),expectedRevision:stale.proposal.expectedRevision}),{code:'STALE_REVISION'});
  assert.match(fs.readFileSync(f.file,'utf8'),/concurrent owner change/);
});
test('missing or incompatible history is reported without creating or migrating a database',async t=>{
  const f=component(t);await f.component.register({directory:f.directory},{reviewed:true,audit:auditFixture()});
  fs.renameSync(path.join(f.directory,'audit.db'),path.join(f.directory,'retained.db'));
  const result=f.component.snapshot();assert.equal(result.available,true);assert.equal(result.history.available,false);
  assert.equal(fs.existsSync(path.join(f.directory,'audit.db')),false);
});

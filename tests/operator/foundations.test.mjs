import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { installationFixture, nonce, authoritativeApproval } from './fixtures.mjs';
import { bindInstallation, installationHostId } from '../../ui/netclaw-visual/src/management/identity.js';
import { Journal } from '../../ui/netclaw-visual/src/management/journal.js';
import { authorize, verifyChangeApproval, attenuate } from '../../ui/netclaw-visual/src/management/policy.js';
import { parseOperatorInput } from '../../mcp-servers/netclaw-operator-mcp/schemas.mjs';

const owner = Object.freeze({ principalId: 'os:fixture', surface: 'operator', grantId: null, generation: 0 });
function fixtureJournal(t) { const f = installationFixture(t); const j = new Journal(path.join(f.statePath, 'management'), f.installationId); t.after(() => j.close()); return { ...f, j }; }

test('binding requires existing identity and never initializes a missing one', t => {
  const f = installationFixture(t); fs.unlinkSync(path.join(f.statePath, 'installation.json'));
  assert.throws(() => bindInstallation({ home: f.home, kind: f.kind }), { code: 'INCOMPATIBLE' });
  assert.equal(fs.existsSync(path.join(f.statePath, 'installation.json')), false);
});
test('binding uses actual OS principal and detects replacement installation', t => {
  const f = installationFixture(t), b = bindInstallation({ home: f.home, kind: f.kind });
  assert.match(b.principal.principalId, /^os:/); assert.equal(b.installationId, f.installationId);
  fs.writeFileSync(path.join(f.statePath, 'installation.json'), JSON.stringify({ schemaVersion: 1, installationId: randomUUID() }));
  assert.throws(() => b.assertCurrent(), { code: 'IDENTITY_CHANGED' });
});
test('Linux host fingerprint separates distro and machine identity while Mac ignores a stray WSL variable', () => {
  const base={platform:'linux',hostname:'shared-host',machine:'a'.repeat(32),home:'/home/test/netclaw',installationId:randomUUID()};
  const first=installationHostId({...base,distro:'a'});
  assert.notEqual(first,installationHostId({...base,distro:'b'}));
  assert.notEqual(first,installationHostId({...base,distro:'a',machine:'b'.repeat(32)}));
  assert.equal(installationHostId({...base,platform:'darwin',distro:'a'}),installationHostId({...base,platform:'darwin',distro:'b'}));
  assert.throws(()=>installationHostId({...base,machine:''}),{code:'INCOMPATIBLE'});
});
test('actual Linux backend binding includes the selected WSL distribution', {skip:process.platform!=='linux'}, t => {
  const f=installationFixture(t),previous=process.env.WSL_DISTRO_NAME;
  try {
    process.env.WSL_DISTRO_NAME='synthetic-wsl-a';const first=bindInstallation(f);
    process.env.WSL_DISTRO_NAME='synthetic-wsl-b';const second=bindInstallation(f);
    assert.notEqual(first.hostId,second.hostId);
    assert.equal(first.installationId,second.installationId);
  } finally { if(previous===undefined)delete process.env.WSL_DISTRO_NAME;else process.env.WSL_DISTRO_NAME=previous; }
});
test('binding rejects symlinked home and config', t => {
  const f = installationFixture(t); fs.symlinkSync(f.home, path.join(f.root, 'alias'));
  assert.throws(() => bindInstallation({ home: path.join(f.root, 'alias'), kind: f.kind }));
  fs.unlinkSync(f.configPath); fs.symlinkSync(path.join(f.home, '.env'), f.configPath);
  assert.throws(() => bindInstallation({ home: f.home, kind: f.kind }));
});
test('strict schemas reject injected role, arbitrary tool and command fields', () => {
  for (const input of [{ role: 'operator' }, { approved: true }, { command: 'anything' }, { installationId: randomUUID() }]) {
    assert.throws(() => parseOperatorInput('operator_identity', input), { code: 'INVALID_INPUT' });
  }
  assert.throws(() => parseOperatorInput('shell', {}), { code: 'DENIED' });
  assert.throws(() => parseOperatorInput('operator_resources', { kind: 'member', limit: 501 }), { code: 'INVALID_INPUT' });
});
test('admission deduplicates after reopen; changed payload conflicts; another owner cannot read it', t => {
  const { j, statePath, installationId } = fixtureJournal(t), n = nonce();
  const op = j.admit(owner, n, 'request', { prompt: 'synthetic' });
  assert.equal(j.admit(owner, n, 'request', { prompt: 'synthetic' }).operationId, op.operationId);
  assert.throws(() => j.admit(owner, n, 'request', { prompt: 'different' }), { code: 'NONCE_CONFLICT' });
  const second = new Journal(path.join(statePath, 'management'), installationId); t.after(() => second.close());
  assert.equal(second.get(owner, op.operationId).state, 'admitted');
  assert.throws(() => second.get({ ...owner, principalId: 'other', surface: 'assistant' }, op.operationId), { code: 'DENIED' });
});
test('expired unknown nonce is refused and known old nonce remains deduplicated', t => {
  const { j } = fixtureJournal(t);
  assert.throws(() => j.admit(owner, nonce(Date.now() - 86400001), 'request', {}), { code: 'EXPIRED' });
  const n = nonce(), op = j.admit(owner, n, 'request', {});
  assert.equal(j.admit(owner, n, 'request', {}, Date.now() + 86400002).operationId, op.operationId);
});
test('journal binds installation and refuses future schema without mutation', t => {
  const { j, statePath } = fixtureJournal(t);
  assert.throws(() => new Journal(path.join(statePath, 'management'), randomUUID()), { code: 'IDENTITY_CHANGED' });
  j.db.exec('PRAGMA user_version=99');
  assert.throws(() => new Journal(path.join(statePath, 'management'), j.installationId), { code: 'INCOMPATIBLE' });
  assert.equal(j.db.prepare('PRAGMA user_version').get().user_version, 99);
});
test('journal refuses a populated unversioned database without adopting or rewriting it',t=>{
  const f=installationFixture(t),directory=path.join(f.statePath,'management');fs.mkdirSync(directory,{mode:0o700});
  const file=path.join(directory,'operations.sqlite'),db=new DatabaseSync(file);
  db.exec("CREATE TABLE existing_owner_data(value TEXT); INSERT INTO existing_owner_data VALUES ('retain');");db.close();fs.chmodSync(file,0o600);
  const before=fs.readFileSync(file);
  assert.throws(()=>new Journal(directory,f.installationId),{code:'INCOMPATIBLE'});
  assert.deepEqual(fs.readFileSync(file),before);
});
test('expired execution is unknown, never admitted or automatically replayed', t => {
  const { j } = fixtureJournal(t), op = j.admit(owner, nonce(), 'request', {});
  const token = j.claim(op.operationId, { pid: 123, start: 'fixture' }, 10, 100);
  assert.ok(token); assert.equal(j.claim(op.operationId, { pid: 124, start: 'fixture2' }, 10, 101), null);
  j.reconcileExpired(111);
  assert.equal(j.get(owner, op.operationId).state, 'unknown');
  assert.equal(j.claim(op.operationId, { pid: 124, start: 'fixture2' }, 10, 112), null);
  assert.throws(() => j.finish(op.operationId, token, 'succeeded', {}), { code: 'UNKNOWN_OUTCOME' });
});
test('events are monotonic and resource locks serialize independent connections', t => {
  const { j, statePath, installationId } = fixtureJournal(t), op = j.admit(owner, nonce(), 'request', {});
  const second = new Journal(path.join(statePath, 'management'), installationId); t.after(() => second.close());
  j.event(op.operationId, 'note', { message: 'one' }); j.event(op.operationId, 'note', { message: 'two' });
  assert.deepEqual(j.events(owner, op.operationId).map(e => e.sequence), [1, 2, 3]);
  const lock = j.lock('configuration', 'one');
  assert.throws(() => second.lock('configuration', 'two'), { code: 'BUSY' });
  j.unlock('configuration', lock); assert.ok(second.lock('configuration', 'two'));
});
test('opaque revision changes on external edits without exposing content hash', t => {
  const { j, configPath } = fixtureJournal(t), a = j.revision([configPath]);
  assert.equal(j.revision([configPath]), a); assert.match(a, /^[a-f0-9-]{36}$/);
  fs.appendFileSync(configPath, ' '); assert.notEqual(j.revision([configPath]), a);
});
test('assistant authority is target/action/disclosure intersection at every hop', () => {
  const grant = { installationId: 'i', principalId: 'client', grantId: 'g', generation: 1, surface: 'assistant',
    actions: ['inspect', 'delegate', 'propose'], targets: ['member-a'], disclosure: ['summary'], expiresAt: Date.now() + 10000 };
  assert.equal(authorize(grant, 'inspect', ['member-a']), true);
  assert.throws(() => authorize(grant, 'apply', ['member-a']), { code: 'DENIED' });
  assert.throws(() => authorize(grant, 'delegate', ['member-b']), { code: 'DENIED' });
  assert.throws(() => authorize({ ...grant, revokedAt: Date.now() }, 'inspect', []), { code: 'DENIED' });
  assert.throws(() => authorize({ ...grant, expiresAt: 1 }, 'inspect', []), { code: 'EXPIRED' });
  const child = attenuate(grant, { actions: ['inspect', 'apply'], targets: ['member-a', 'member-b'], disclosure: ['summary', 'raw'] });
  assert.deepEqual(child.actions, ['inspect']); assert.deepEqual(child.targets, ['member-a']); assert.deepEqual(child.disclosure, ['summary']);
  assert.ok(Object.isFrozen(child)); assert.ok(Object.isFrozen(child.actions));
});
test('production approval is re-read, exact, independent and withdrawal is denied', async () => {
  const authority = authoritativeApproval(), intent = { actionDigest: 'digest', changeClass: 'production' };
  await verifyChangeApproval(owner, intent, 'CHG-fixture', authority);
  authority.withdraw(); await assert.rejects(verifyChangeApproval(owner, intent, 'CHG-fixture', authority), { code: 'DENIED' });
  assert.equal(authority.calls.length, 2);
  await assert.rejects(verifyChangeApproval(owner, intent, 'CHG-fixture', { verify: async () => ({ verified: true, state: 'Implement', actionDigest: 'other', approverId: 'other', incidentsClear: true }) }), { code: 'DENIED' });
});
test('assistant self-approval and generic lab flags never provide authority', async () => {
  await assert.rejects(verifyChangeApproval({ ...owner, surface: 'assistant' }, { changeClass: 'operator-local' }, null), { code: 'DENIED' });
  await assert.rejects(verifyChangeApproval(owner, { changeClass: 'lab', approved: true }, null), { code: 'DENIED' });
});

test('an expired worker cannot revive its lease or report completion before a recovery sweep',t=>{
  const {j}=fixtureJournal(t),op=j.admit(owner,nonce(),'request',{});
  const token=j.claim(op.operationId,{pid:123,start:'fixture'},1,Date.now()-100);
  assert.throws(()=>j.renew(op.operationId,token),{code:'UNKNOWN_OUTCOME'});
  assert.throws(()=>j.finish(op.operationId,token,'succeeded',{}),{code:'UNKNOWN_OUTCOME'});
  assert.throws(()=>j.attachReference(op.operationId,token,'late-receipt'),{code:'UNKNOWN_OUTCOME'});
  assert.throws(()=>j.input(op.operationId,token),{code:'UNKNOWN_OUTCOME'});
  assert.equal(j.get(owner,op.operationId).state,'unknown');
  assert.equal(j.claim(op.operationId,{pid:124,start:'replacement'}),null);
});

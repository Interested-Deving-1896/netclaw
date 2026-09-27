import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the production session handlers, with storage/state boundaries replaced.
function handlers({ failSave = false, failDelete = false } = {}) {
  const source = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const newSession =');
  const end = source.indexOf('\n  useEffect(', start);
  const rows = new Map([['old', { id: 'old' }]]);
  const state = { id: 'old', errors: [] };
  const context = {
    runSessionChange: async (fn) => { try { return await fn(); } catch(e) { state.errors.push(e.message); } },
    resetSession: () => { state.id = 'new'; },
    saveTimerRef: { current: null }, currentSession: { id: 'old', createdAt: 1 },
    clearTimeout, serialize: () => ({ nodes: [], active: 'root' }),
    deriveSessionTitle: () => 'fixture', sessId: () => 'new', ROOT: {},
    pastRef: { current: [] }, futureRef: { current: [] }, firstSave: { current: false },
    _seq: 0, setCurrentSession: (v) => { state.id = v.id; },
    setDrafts() {}, setQuotes() {}, setAttachments() {}, setNodes() {}, setActive() {}, setSel() {}, setShowSessions() {},
    reloadSessionList() {}, setSessionFolder() {}, setSessionTitles() {},
    loadState() {},
    idb: {
      put: async (row) => { if (failSave) throw Error('fixture storage full'); rows.set(row.id, row); },
      del: async (id) => { if (failDelete) throw Error('fixture delete failed'); rows.delete(id); },
      get: async (id) => rows.get(id),
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nglobalThis.handlers = { newSession, openSession, deleteSession };', context);
  return { ...context.handlers, rows, state };
}

test('deleting active session never saves it again', async () => {
  const h = handlers(); await h.deleteSession('old');
  assert.equal(h.rows.has('old'), false);
  assert.equal(h.state.id, 'new');
});
test('failed save retains current session', async () => {
  const h = handlers({ failSave: true }); await h.newSession();
  assert.equal(h.state.id, 'old'); assert.equal(h.state.errors.length, 1);
});
test('failed deletion retains current session and metadata', async () => {
  const h = handlers({ failDelete: true }); await h.deleteSession('old');
  assert.equal(h.state.id, 'old'); assert.equal(h.rows.has('old'), true);
  assert.equal(h.state.errors.length, 1);
});

import { createSessionGate } from './session-gate.js';
test('pending reply blocks conversation replacement, then releases after failure', async () => {
  const gate = createSessionGate();
  let reject;
  const request = gate.request(() => new Promise((_, no) => { reject = no; }));
  let changed = false;
  await assert.rejects(gate.change(() => { changed = true; }), /Wait/);
  assert.equal(changed, false);
  reject(new Error('fixture request failed'));
  await assert.rejects(request, /fixture/);
  await gate.change(() => { changed = true; });
  assert.equal(changed, true);
});
test('pending session save blocks new requests and overlapping switches', async () => {
  const gate = createSessionGate();
  let resolve;
  const save = gate.change(() => new Promise((yes) => { resolve = yes; }));
  await assert.rejects(gate.request(() => 'wrong conversation'), /Wait/);
  await assert.rejects(gate.change(() => {}), /Wait/);
  resolve(); await save;
  assert.equal(await gate.request(() => 'correct conversation'), 'correct conversation');
});

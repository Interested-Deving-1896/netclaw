import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalAccess, hudPorts } from './local-access.js';
const allowed = createLocalAccess({ api: 3001, ui: 3000 });
const req = (headers = {}, remoteAddress = '127.0.0.1') => ({
  headers: { host: 'localhost:3001', ...headers }, socket: { remoteAddress },
});
test('local CLI, both configured origins and IPv6 loopback are accepted', () => {
  assert.ok(allowed(req()));
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3001', 'http://[::1]:3000']) {
    assert.ok(allowed(req({ origin }, '::1')));
  }
  assert.ok(allowed(req({}, '::ffff:127.0.0.1')));
});
test('untrusted connections and rebinding/opaque/malformed origins are denied', () => {
  for (const origin of ['null', '', 'https://attacker.example', 'http://localhost:9999',
    'http://localhost:3000.attacker.example', 'http://localhost:3000/', 'http://user@localhost:3000']) {
    assert.equal(allowed(req({ origin })), false, origin);
  }
  assert.equal(allowed(req({}, '192.0.2.1')), false);
  assert.equal(allowed(req({ host: 'attacker.example', 'x-forwarded-host': 'localhost:3001' })), false);
  assert.equal(allowed(req({ 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(allowed(req({ host: undefined })), false);
});
test('ports are bounded, distinct and explicitly configurable', () => {
  assert.deepEqual(hudPorts({}), { api: 3001, ui: 3000 });
  assert.deepEqual(hudPorts({ HUD_PORT: '4001', HUD_UI_PORT: '4000' }), { api: 4001, ui: 4000 });
  for (const p of ['0', '-1', '65536', 'abc', '3001junk']) assert.throws(() => hudPorts({ HUD_PORT: p }));
  assert.throws(() => hudPorts({ HUD_PORT: '3000' }));
});

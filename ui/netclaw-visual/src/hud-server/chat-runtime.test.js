import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatRuntime } from './chat-runtime.js';
import { publicChatModels, resolveChatEffort, resolveChatModel } from './chat-models.js';
const config = { agents: { entries: { engineer: {} }, defaults: { model: 'p/default@private' } } };
const models = [{ provider: 'p', id: 'fast', available: true, thinkingDefault: 'low', thinkingLevels: [{ id: 'low' }, { id: 'high' }] },
  { provider: 'p', id: 'denied', available: false }];
test('available runtime choices and supported efforts are validated without leaking profiles', () => {
  const catalog = publicChatModels(config, models);
  assert.equal(catalog.models.length, 2);
  assert.doesNotMatch(JSON.stringify(catalog), /private/);
  const id = catalog.models[1].id;
  assert.equal(resolveChatModel(config, id, models), 'p/fast');
  assert.equal(resolveChatEffort(config, id, 'high', models), 'high');
  assert.equal(resolveChatEffort(config, id, '', models), '');
  assert.throws(() => resolveChatEffort(config, id, 'ultra', models));
  assert.throws(() => resolveChatEffort(config, id, {}, models));
  assert.throws(() => resolveChatModel(config, id, null));
});
test('runtime catalog coalesces calls and falls back safely on discovery failure', async () => {
  let calls = 0;
  const runtime = createChatRuntime(async (method, params) => { calls++; assert.equal(params.agentId, 'engineer'); return { models }; });
  const rows = await Promise.all([runtime.catalog(config, '/nonexistent/config.json'), runtime.catalog(config, '/nonexistent/config.json')]);
  assert.equal(calls, 1); assert.equal(rows[0].length, 1);
  assert.equal(await createChatRuntime(async () => { throw Error(); }).catalog(config, '/absent/config.json'), null);
});
test('effort changes require a private key and confirmed session mutation; default clears override', async () => {
  const calls = [];
  const runtime = createChatRuntime(async (method, params, port) => {
    calls.push({ method, params, port }); return { ok: true, entry: { thinkingLevel: params.thinkingLevel } };
  });
  await assert.rejects(runtime.apply({ effort: 'low' }));
  await runtime.apply({ key: 'owned-key', model: 'p/fast', effort: 'low', port: 18789 });
  await runtime.apply({ key: 'owned-key', model: 'p/default', effort: '', port: 18789 });
  assert.deepEqual(calls[0], { method: 'sessions.patch', params: { key: 'owned-key', model: 'p/fast', thinkingLevel: 'low' }, port: 18789 });
  assert.equal(calls[1].params.thinkingLevel, null);
  await assert.rejects(createChatRuntime(async () => ({ ok: true, entry: { thinkingLevel: 'high' } })).apply({ key: 'owned-key', effort: 'low' }));
});

test('malformed discovery metadata cannot introduce selectable model references', () => {
  const catalog = publicChatModels(config, [{available:true}, {available:true,provider:'p',id:'bad\r\nheader'}]);
  assert.equal(catalog.models.length,1);
});

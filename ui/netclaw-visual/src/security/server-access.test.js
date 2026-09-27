import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../..', import.meta.url));
function request(port, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/testbed/raw', headers }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
  });
}
function upgrade(port, origin) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/ws', headers: {
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', Origin: origin,
    } });
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
    req.on('response', res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
  });
}

test('real HUD server rejects hostile HTTP and WebSocket requests before fixture access', { timeout: 15000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'netclaw-hud-security-'));
  const ui = path.join(root, 'ui', 'netclaw-visual');
  fs.mkdirSync(ui, { recursive: true });
  fs.mkdirSync(path.join(root, 'testbed'));
  fs.writeFileSync(path.join(root, 'testbed', 'testbed.yaml'), 'devices: {}\n');
  for (const name of ['server.js', 'package.json']) fs.copyFileSync(path.join(source, name), path.join(ui, name));
  for (const name of ['node_modules', 'src']) fs.symlinkSync(path.join(source, name), path.join(ui, name), 'dir');
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ui, env: { PATH: process.env.PATH, HOME: root, HUD_PORT: String(port), HUD_UI_PORT: '3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    fs.rmSync(root, { recursive: true, force: true });
  });
  let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => { if (String(chunk).includes('listening')) resolve(); });
    child.once('exit', code => reject(new Error(`HUD exited ${code}: ${stderr}`)));
    child.once('error', reject);
  });
  assert.equal(await request(port), 200, 'local CLI keeps access');
  assert.equal(await request(port, { Origin: 'http://127.0.0.1:3000' }), 200, 'local frontend keeps access');
  assert.equal(await request(port, { Origin: 'https://untrusted.example' }), 403, 'foreign browser cannot read fixture');
  assert.equal(await request(port, { Host: 'rebound.example' }), 403, 'DNS rebinding host rejected');
  assert.equal(await request(port, { Origin: 'null' }), 403, 'opaque origin rejected');
  assert.equal(await upgrade(port, 'https://untrusted.example'), 403, 'foreign WebSocket rejected');
  assert.equal(await upgrade(port, 'http://127.0.0.1:3000'), 101, 'local WebSocket preserved');

  const skills = path.join(root, 'workspace', 'skills');
  const sessions = path.join(root, '.openclaw', 'agents', 'main', 'sessions');
  const outside = path.join(root, 'outside');
  for (const dir of [skills, sessions, outside]) fs.mkdirSync(dir, { recursive:true });
  fs.writeFileSync(path.join(outside, 'SKILL.md'), '# outside fixture\n');
  fs.writeFileSync(path.join(outside, 'private.jsonl'), '{}\n');
  fs.symlinkSync(outside, path.join(skills, 'linked'), 'dir');
  fs.symlinkSync(path.join(outside, 'private.jsonl'), path.join(sessions, 'linked.jsonl'));
  fs.mkdirSync(path.join(skills, 'ordinary'));
  fs.writeFileSync(path.join(skills, 'ordinary', 'SKILL.md'), '# Ordinary\n\nValid skill.\n');
  fs.writeFileSync(path.join(sessions, 'ordinary.jsonl'), '{}\n');
  for (const route of ['/api/skill/ordinary', '/api/session/ordinary/tools']) {
    assert.equal((await fetch(`http://127.0.0.1:${port}${route}`)).status, 200, route);
  }
  for (const route of [
    '/api/skill/..%2f..%2foutside', '/api/skill/linked',
    '/api/session/..%2f..%2f..%2f..%2foutside%2fprivate/tools', '/api/session/linked/tools',
  ]) {
    assert.equal((await fetch(`http://127.0.0.1:${port}${route}`)).status, 404, route);
  }
  fs.writeFileSync(path.join(root, '.openclaw', 'openclaw.json'), JSON.stringify({
    agents: { defaults: { budget: { sessionBudgetUsd:0, maxToolCallsPerTurn:0 } } },
  }));
  const budget = await (await fetch(`http://127.0.0.1:${port}/api/budget/status`)).json();
  assert.equal(budget.sessionBudgetUsd, 0);
  assert.equal(budget.maxToolCallsPerTurn, 0);
  assert.equal(budget.status, 'halted');
});

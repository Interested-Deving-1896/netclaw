import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gatewayAgentId } from './gateway-agent.js';
const execute = promisify(execFile);
export async function gatewayCall(method, params, port, configPath) {
  const { stdout } = await execute('openclaw', ['gateway', 'call', method, '--params', JSON.stringify(params),
    '--expect-url', `ws://127.0.0.1:${port}`, '--timeout', '10000', '--json'],
  { env: { ...process.env, ...(configPath ? { OPENCLAW_CONFIG_PATH: configPath } : {}) }, timeout: 20000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  return JSON.parse(stdout.slice(stdout.indexOf('{')));
}
export function createChatRuntime(call = gatewayCall) {
  const cache = new Map();
  return {
    async catalog(config, configPath) {
      const agentId = gatewayAgentId(config), port = config.gateway?.port || 18789;
      const key = JSON.stringify([agentId, port, configPath, config.agents]);
      const prior = cache.get(key);
      if (prior && Date.now() - prior.time < 60000) return prior.promise;
      const promise = (async () => {
        try {
          const data = await call('models.list', { agentId, includeDetails: true }, port, configPath);
          let native = [];
          try { native = JSON.parse(await readFile(path.join(path.dirname(configPath), 'agents', agentId, 'agent/codex-home/models_cache.json'), 'utf8')).models || []; } catch {}
          return (data.models || []).filter(m => m.available === true && (m.agentRuntime?.id !== 'codex' || !native.length || native.some(n => n.slug === m.id && n.visibility === 'list'))).map(m => {
            const match = m.agentRuntime?.id === 'codex' && native.find(n => n.slug === m.id);
            return { ...m, thinkingLevels: match ? (m.thinkingLevels || []).filter(level => match.supported_reasoning_levels?.some(n => n.effort === level.id)) : m.thinkingLevels };
          });
        } catch { return null; }
      })();
      cache.set(key, { time: Date.now(), promise });
      return promise;
    },
    async apply({ key, model, effort, port, configPath }) {
      if (!key) throw Error('A private chat session is required for effort selection.');
      const result = await call('sessions.patch', { key, ...(model ? { model } : {}), thinkingLevel: effort || null }, port, configPath);
      if (result.ok === false || !result.entry) throw Error('The gateway did not confirm chat settings.');
      if ((effort && result.entry.thinkingLevel !== effort) || (!effort && result.entry.thinkingLevel != null)) throw Error('The gateway did not confirm the selected effort.');
    },
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { ownedDirectory, readOwned, atomicPrivate } from './files.js';
import { fail, invariant } from './errors.js';

const secretKey = /password|secret|api.?key|authorization|credential|^(?:token|accessToken|refreshToken|bearer|cookie)$/i;
export function redactText(secrets = []) {
  const values = [...new Set(secrets.filter(v => typeof v === 'string' && v.length > 0))].sort((a,b) => b.length-a.length);
  return value => {
    let result = value;
    for (const secret of values) result = result.split(secret).join('[redacted]');
    return result.replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
      .replace(/\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{8,}/g, '[redacted]');
  };
}
export function redactor(secrets = []) {
  const text=redactText(secrets);
  return value => {
    const truncation={strings:0,arrays:0,objects:0,depth:0};
    const visit = (item, depth = 0) => {
      if (depth > 16) {truncation.depth++;return '[depth limit]';}
      if (typeof item === 'string') {const safe=text(item);if(safe.length>65536)truncation.strings++;return safe.slice(0,65536);}
      if (Array.isArray(item)) {if(item.length>500)truncation.arrays++;return item.slice(0,500).map(next=>next===undefined?null:visit(next,depth+1));}
      if (item && typeof item === 'object') {
        const entries=Object.entries(item).filter(([,v])=>v!==undefined);if(entries.length>500)truncation.objects++;
        return Object.fromEntries(entries.slice(0,500).map(([key,next])=>[key,
          key==='credentialRef'&&typeof next==='string'&&/^NETCLAW_CLIENT_[A-F\d]{32}_TOKEN$/.test(next)?next:
            ['legacyCredentials','normalizeCredentials'].includes(key)&&typeof next==='boolean'?next:
            secretKey.test(key)?'[redacted]':visit(next,depth+1)]));
      }
      return item;
    };
    const result=visit(value);
    return Object.values(truncation).some(Boolean)&&result&&typeof result==='object'&&!Array.isArray(result)?{...result,truncation}:result;
  };
}
export function bounded(value) {
  if (Buffer.byteLength(JSON.stringify(value)) <= 1024*1024) return value;
  const truncated={available:false,truncated:true,reason:'Response exceeded 1 MiB. Narrow the query or use pagination.'};
  if(value?.contractVersion===1){const {nextCursor,...envelope}=value;return {...envelope,data:truncated,freshness:'partial',warnings:[truncated.reason]};}
  if(value?.operationId)return Object.fromEntries(Object.entries({...value,result:truncated,proposal:undefined}).filter(([,v])=>v!==undefined));
  return truncated;
}
export class ArtifactStore {
  constructor(journal) { this.journal = journal; this.directory = path.join(journal.directory, 'artifacts'); ownedDirectory(this.directory, { create: true }); }
  write(owner, bytes, kind) {
    invariant(Buffer.byteLength(bytes) <= 20*1024*1024);
    const id = randomUUID(), hash = createHash('sha256').update(bytes).digest('hex');
    atomicPrivate(path.join(this.directory, id), bytes);
    this.journal.put('artifact', id, owner, { kind, hash, size: Buffer.byteLength(bytes) });
    return { id, hash, size: Buffer.byteLength(bytes), kind };
  }
  read(owner, id) {
    invariant(/^[a-f\d-]{36}$/.test(id));
    const record = this.journal.record('artifact', id, owner);
    const bytes = readOwned(path.join(this.directory, id), { limit: 20*1024*1024 });
    invariant(createHash('sha256').update(bytes).digest('hex') === record.hash, 'STALE_REVISION');
    return bytes;
  }
}

/** Dedicated MCP process, cwd, sticky file and GAIT root for each installation. */
export class InstallationAudit {
  constructor(binding, root, journal, environment = process.env) {
    this.binding = binding; this.root = root; this.journal = journal; this.environment = environment;
    this.directory = path.join(journal.directory, 'audit'); this.queue = Promise.resolve();
  }
  async connect() {
    if (this.client) return;
    ownedDirectory(this.directory, { create: true });
    const transport = new StdioClientTransport({ command: 'python3', args: ['-u', path.join(this.root,'scripts/gait-stdio.py')],
      cwd: this.directory, env: { ...this.environment, GAIT_MCP_STICKY_FILE: path.join(this.directory,'root') }, stderr: 'ignore' });
    const client = new Client({ name: 'netclaw-management-audit', version: '1.0.0' });
    try {
      await client.connect(transport, { timeout: 10000 }); this.client = client;
      if (!fs.existsSync(path.join(this.directory,'.gait'))) await this.call('gait_init', { path: this.directory });
      const status = await this.call('gait_status', { path: this.directory });
      invariant(status.root === this.directory, 'AUDIT_UNAVAILABLE');
      this.branch = `management-${randomUUID()}`;
      await this.call('gait_branch', { name: this.branch });
      await this.call('gait_checkout', { name: this.branch });
    } catch { this.client = null; await client.close().catch(() => {}); fail('AUDIT_UNAVAILABLE'); }
  }
  async call(name, args) {
    const result = await this.client.callTool({ name, arguments: args }, { timeout: 10000 });
    const data = result.structuredContent?.result || JSON.parse(result.content?.find(c=>c.type==='text')?.text || '{}');
    invariant(!result.isError && data.ok === true, 'AUDIT_UNAVAILABLE'); return data;
  }
  async record(value) {
    const work = this.queue.catch(() => {}).then(async () => {
      const lock = await this.acquireLock();
      try {
        await this.connect();
        const status = await this.call('gait_status', { path: this.directory });
        invariant(status.root === this.directory, 'AUDIT_UNAVAILABLE');
        await this.call('gait_checkout', { name: this.branch });
        // Never record freeform input, configuration, replacement secrets or provider output.
        const summary = {installationId:this.binding.installationId,principalId:this.binding.principal.principalId,...Object.fromEntries(['operationId','proposalId','action','state','artifactId'].filter(k => typeof value[k] === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value[k])).map(k => [k,value[k]]))};
        return await this.call('gait_record_turn', { user_text: 'Authorized NetClaw management operation', assistant_text: JSON.stringify(summary), note: 'netclaw-management', use_memory_snapshot: false });
      } catch { fail('AUDIT_UNAVAILABLE'); } finally { this.journal.unlock('gait', lock); }
    });
    this.queue = work; return work;
  }
  async acquireLock() {
    // An independently owned worker may be recording while its facade closes.
    // Wait for that turn within a bounded deadline; never steal its lease or
    // silently omit the required audit. Other errors still fail immediately.
    const deadline = Date.now() + 10000;
    for (;;) {
      try { return this.journal.lock('gait', this.binding.principal.principalId, 60000); }
      catch (error) {
        if (error.code !== 'BUSY' || Date.now() >= deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }
  async log(limit = 100) {
    const lock=await this.acquireLock();
    try{await this.connect();const status=await this.call('gait_status',{path:this.directory});invariant(status.root===this.directory,'AUDIT_UNAVAILABLE');return await this.call('gait_log',{limit:Math.min(limit,500)});}
    finally{this.journal.unlock('gait',lock);}
  }
  async close() { await this.queue.catch(() => {}); if (this.client) { try { await this.log(20); } finally { await this.client.close(); this.client = null; } } }
}

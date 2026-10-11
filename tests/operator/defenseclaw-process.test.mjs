import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {installationFixture,auditFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

test('actual pinned DefenseClaw store and config reader preserve WAL bytes and interpret the saved mode',{skip:!process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON},async t=>{
  const f=installationFixture(t),directory=path.join(f.root,'defense');fs.mkdirSync(directory,{mode:0o700});
  const file=path.join(directory,'config.yaml');
  fs.writeFileSync(file,`config_version: 8\nclaw:\n  mode: openclaw\n  home_dir: ${JSON.stringify(f.home)}\n  config_file: ${JSON.stringify(f.configPath)}\nguardrail:\n  enabled: true\n  mode: observe\n  connector: openclaw\n`,{mode:0o600});
  const python=process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON;
  const env={PATH:process.env.PATH,HOME:f.root,DEFENSECLAW_HOME:directory,PYTHONNOUSERSITE:'1'};
  const code=`import json,sys,os
from datetime import datetime,timezone
from defenseclaw.db import Store
from defenseclaw.models import Event,ActionState
from defenseclaw.config import load
cfg=load(data_dir=sys.argv[1])
store=Store(cfg.audit_db);store.init()
store.log_event(Event(action='connector-hook',target='owned-tool',connector='openclaw',details='synthetic-private-prompt',severity='WARN'))
store.insert_scan_result('owned-scan','codeguard','owned.py',datetime.now(timezone.utc),7,1,'HIGH','synthetic-private-finding')
store.set_action('tool','@openclaw/write_file','',ActionState(install='block'),'synthetic-private-reason')
for name in ['audit.db','audit.db-wal','audit.db-shm']:
 p=os.path.join(sys.argv[1],name)
 if os.path.exists(p): os.chmod(p,0o600)
print(json.dumps({'ready':True,'mode':cfg.guardrail.effective_mode('openclaw')}),flush=True)
sys.stdin.readline();store.close()
`;
  const child=spawn(python,['-u','-c',code,directory],{env,stdio:['pipe','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
  const closed=once(child,'close');const lines=createInterface({input:child.stdout});
  t.after(async()=>{child.stdin.end('\n');await closed;lines.close();});
  const ready=await Promise.race([once(lines,'line').then(([line])=>JSON.parse(line)),closed.then(()=>{throw Error(stderr||'Component exited before ready');}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Component startup timed out')),15000);timer.unref();})]);
  assert.equal(ready.mode,'observe');
  const service=new ManagementService({...f,audit:auditFixture()});t.after(()=>service.close());
  await service.defenseclaw.register({directory},{reviewed:true,audit:service.audit});
  const capture=()=>Object.fromEntries(fs.readdirSync(directory).map(name=>[name,fs.readFileSync(path.join(directory,name)).toString('base64')]));
  const before=capture(),snapshot=service.defenseclaw.snapshot();assert.deepEqual(capture(),before);
  assert.equal(snapshot.history.available,true);assert.equal(snapshot.history.events.items.length,1);assert.equal(snapshot.history.scans.items[0].findings,1);assert.equal(snapshot.history.rules.items[0].policy,'block');
  assert.ok(!JSON.stringify(snapshot).includes('synthetic-private'));
  const expectedRevision=service.proposals.revision(),prepared=await service.call('operator_change_prepare',{nonce:nonce(),action:'security.patch',targets:[f.installationId],expectedRevision,patch:{mode:'enforce'}});
  const applied=await service.proposals.apply(service.binding.principal,{proposalId:prepared.proposalId,nonce:nonce(),expectedRevision});assert.equal(applied.state,'succeeded');
  const observed=execFileSync(python,['-c',"from defenseclaw.config import load; print(load().guardrail.effective_mode('openclaw'))"],{env,encoding:'utf8',timeout:15000});assert.equal(observed.trim(),'action');
  assert.equal(child.exitCode,null); // The management change did not stop the component writer.
});

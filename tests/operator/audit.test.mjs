import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { installationFixture } from './fixtures.mjs';
import { bindInstallation } from '../../ui/netclaw-visual/src/management/identity.js';
import { Journal } from '../../ui/netclaw-visual/src/management/journal.js';
import { InstallationAudit } from '../../ui/netclaw-visual/src/management/evidence.js';

test('audit close waits for an independent worker audit turn without losing the final log',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f);
  const journal=new Journal(path.join(f.statePath,'management'),f.installationId);
  t.after(()=>journal.close());
  const audit=new InstallationAudit(binding,f.root,journal);
  let closed=false,logged=false;
  audit.client={close:async()=>{closed=true;}};
  audit.connect=async()=>{};
  audit.call=async name=>{
    if(name==='gait_status')return {ok:true,root:audit.directory};
    if(name==='gait_log'){logged=true;return {ok:true};}
    throw Error('Unexpected method');
  };
  const lock=journal.lock('gait','independent-worker');
  const release=setTimeout(()=>journal.unlock('gait',lock),100);
  t.after(()=>clearTimeout(release));
  await audit.close();
  assert.equal(logged,true);assert.equal(closed,true);
});

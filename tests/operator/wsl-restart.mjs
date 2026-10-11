/** Opt-in two-phase journal probe. The caller restarts only a designated test
 * distribution between phases. This does not claim editor/runtime acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { installationFixture, nonce } from './fixtures.mjs';
import { bindInstallation } from '../../ui/netclaw-visual/src/management/identity.js';
import { Journal } from '../../ui/netclaw-visual/src/management/journal.js';

const [phase,receipt]=process.argv.slice(2);
assert.equal(process.env.NETCLAW_TEST_WSL_RESTART,'1','Explicit test opt-in required');
assert.ok(process.env.WSL_DISTRO_NAME,'Run in an actual WSL distribution');
assert.ok(receipt&&path.isAbsolute(receipt),'Explicit private receipt path required');
if(phase==='prepare'){
  // WSL clears /tmp on distro termination. The receipt's explicitly selected
  // private parent is durable storage, matching a real installation home.
  process.env.TMPDIR=path.dirname(receipt);
  const fixture=installationFixture(),binding=bindInstallation(fixture);
  const journal=new Journal(path.join(fixture.statePath,'management'),fixture.installationId);
  const input={prompt:'synthetic restart probe'},clientNonce=nonce();
  const operation=journal.admit(binding.principal,clientNonce,'request',input);
  journal.claim(operation.operationId,{pid:process.pid,start:'restart-probe'},1000);
  journal.event(operation.operationId,'dispatch-intent',{synthetic:true});
  const bootId=fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
  fs.writeFileSync(receipt,JSON.stringify({fixture,input,clientNonce,operationId:operation.operationId,bootId,distro:process.env.WSL_DISTRO_NAME}),{flag:'wx',mode:0o600});
  journal.close();console.log(JSON.stringify({prepared:true,state:'running',scope:'synthetic journal; no provider or device dispatch'}));
}else if(phase==='verify'){
  const saved=JSON.parse(fs.readFileSync(receipt,'utf8'));
  assert.equal(saved.distro,process.env.WSL_DISTRO_NAME);
  const binding=bindInstallation(saved.fixture);
  const journal=new Journal(path.join(saved.fixture.statePath,'management'),saved.fixture.installationId);
  try{
    assert.equal(journal.get(binding.principal,saved.operationId).state,'running');
    assert.equal(journal.reconcileExpired(),1,'Lease expires in real elapsed time');
    assert.equal(journal.get(binding.principal,saved.operationId).state,'unknown');
    assert.equal(journal.claim(saved.operationId,{pid:process.pid,start:'restarted'}),null);
    const retry=journal.admit(binding.principal,saved.clientNonce,'request',saved.input);
    assert.equal(retry.operationId,saved.operationId);assert.equal(retry.state,'unknown');
    assert.equal(journal.events(binding.principal,saved.operationId).filter(e=>e.type==='dispatch-intent').length,1);
    console.log(JSON.stringify({passed:true,state:'unknown',replayed:false,retainedDispatchIntents:1,scope:'actual WSL distro restart; synthetic durable journal only'}));
  }finally{journal.close();}
}else throw Error('Use prepare or verify');

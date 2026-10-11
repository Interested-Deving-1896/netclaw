import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {securitySnapshot,projectPosture} from '../../ui/netclaw-visual/src/management/security.js';

const now=Date.now(),posture={mode:'production',state:'enforced',computed_at:now/1000,model:{guarded:true},controls:[{name:'sandbox',kind:'containment',available:true,probed_at:now/1000},{name:'model-guard',kind:'containment',available:true,probed_at:now/1000},{name:'audit',kind:'audit',available:true,probed_at:now/1000}]};
test('daemon posture keeps host confinement separate from OpenShell and advertises observation scope',()=>{
  const result=projectPosture(posture,now);
  assert.equal(result.available,true);assert.equal(result.freshness,'observed');assert.equal(result.reportedState,'enforced');
  assert.equal(result.hostConfinement.control,'sandbox');assert.equal(result.hostConfinement.state,'reported-enforced');
  assert.equal(result.defenseclaw.state,'reported-enforced');assert.equal(result.openshell.state,'unverified');assert.match(result.openshell.reason,/does not identify/);
});
test('stale, testing and incomplete reports never turn into current enforcement claims',()=>{
  assert.equal(projectPosture({...posture,computed_at:(now-120000)/1000},now).defenseclaw.state,'stale');
  assert.equal(projectPosture({...posture,mode:'testing',state:'testing'},now).defenseclaw.state,'disabled-for-federation');
  assert.equal(projectPosture({...posture,controls:posture.controls.filter(c=>c.name!=='model-guard')},now).defenseclaw.state,'unavailable');
  assert.equal(projectPosture({...posture,model:{guarded:false}},now).defenseclaw.state,'degraded');
  assert.equal(projectPosture({...posture,controls:[...posture.controls,posture.controls[0]]},now).available,false);
});
test('selected-installation security configuration never borrows a global guard home',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f);fs.mkdirSync(path.join(f.home,'config'),{mode:0o700});
  fs.writeFileSync(path.join(f.home,'config/openclaw.json'),JSON.stringify({security:{mode:'defenseclaw'},token:'synthetic-not-projected'}),{mode:0o600});
  const value=await securitySnapshot(binding,async()=>({value:posture,source:'selected daemon'}));
  assert.equal(value.configured.defenseMode,'defenseclaw');assert.equal(value.configured.guardMode,'unknown');assert.ok(!JSON.stringify(value).includes('synthetic-not-projected'));
});
test('unavailable federation leaves stored security visible; identity mismatch is never downgraded to a healthy panel',async t=>{
  const f=installationFixture(t),binding=bindInstallation(f);
  const unavailable=await securitySnapshot(binding,async()=>{throw Object.assign(Error(),{code:'SOURCE_UNAVAILABLE'});});
  assert.equal(unavailable.effective.available,false);assert.equal(unavailable.configured.riskMode,'testing');
  await assert.rejects(securitySnapshot(binding,async()=>{throw Object.assign(Error(),{code:'IDENTITY_CHANGED'});}),{code:'IDENTITY_CHANGED'});
});

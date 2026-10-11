import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {installationFixture} from './fixtures.mjs';
import {nativeHarnessUi} from '../../ui/netclaw-visual/src/management/chat-runtime.js';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';

test('native browser descriptor carries configured address but never a gateway credential',t=>{
  const f=installationFixture(t),binding=bindInstallation(f);
  fs.writeFileSync(f.configPath,JSON.stringify({gateway:{port:12345,tls:{enabled:true},auth:{token:'PRIVATE-FIXTURE'},controlUi:{basePath:'/control'}}}));
  const value=nativeHarnessUi(binding);assert.equal(value.available,true);assert.equal(value.scheme,'https');assert.equal(value.port,12345);assert.equal(value.pathname,'/control');assert.equal(JSON.stringify(value).includes('PRIVATE-FIXTURE'),false);
  for(const gateway of [{controlUi:{enabled:false}},{controlUi:{basePath:'/?token=PRIVATE-FIXTURE'}},{port:-1}]){fs.writeFileSync(f.configPath,JSON.stringify({gateway}));assert.equal(nativeHarnessUi(binding).available,false);}
});
test('Hermes private API never becomes a native browser UI or credential-bearing link',t=>{
  const f=installationFixture(t,'hermes');const value=nativeHarnessUi(bindInstallation(f));assert.equal(value.available,false);assert.match(value.reason,/not a browser UI/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {installationFixture,auditFixture} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

const exec=promisify(execFile),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('official OpenShell CLI and mTLS gateway observe a real isolated Docker sandbox without adopting owner state',{
  skip:process.platform!=='darwin'||!process.env.NETCLAW_TEST_OPENSHELL_GATEWAY||!process.env.NETCLAW_TEST_OPENSHELL_CLI||!process.env.NETCLAW_TEST_DOCKER_SOCKET,
  timeout:120000,
},async t=>{
  const f=installationFixture(),binding=bindInstallation(f),configHome=path.join(f.root,'config');fs.mkdirSync(configHome,{mode:0o700});
  const gateway=process.env.NETCLAW_TEST_OPENSHELL_GATEWAY,cli=process.env.NETCLAW_TEST_OPENSHELL_CLI;
  const env={PATH:process.env.PATH,HOME:f.root,XDG_CONFIG_HOME:configHome,XDG_STATE_HOME:path.join(f.root,'state'),XDG_DATA_HOME:path.join(f.root,'data'),OPENSHELL_LOCAL_TLS_DIR:path.join(f.root,'tls'),OPENSHELL_TELEMETRY_ENABLED:'false'};
  const call=args=>exec(cli,['--gateway','openshell','--workspace','default','--color','never',...args],{env,timeout:45000,maxBuffer:1024*1024,encoding:'utf8'});
  let child,closed,created=false,log,service;const sandbox='nc150-'+f.installationId.slice(0,8);
  t.after(async()=>{
    try{
      if(created&&child?.exitCode===null){
        const state=JSON.parse((await call(['sandbox','get',sandbox,'-o','json'])).stdout);
        assert.equal(state.labels['netclaw.installation-id'],f.installationId);
        if(state.phase==='Ready')await call(['sandbox','stop',sandbox]);
      }
    }finally{
      if(child?.exitCode===null){child.kill('SIGTERM');await closed;}
      if(service)await service.close();if(log!==undefined)fs.closeSync(log);f.cleanup();
    }
  });
  await exec(gateway,['generate-certs','--output-dir',path.join(f.root,'tls'),'--server-san','127.0.0.1'],{env,timeout:15000,maxBuffer:65536});
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  const directory=path.join(configHome,'openshell/gateways/openshell');
  fs.writeFileSync(path.join(directory,'metadata.json'),JSON.stringify({name:'openshell',gateway_endpoint:`https://127.0.0.1:${port}`,is_remote:false,gateway_port:port,auth_mode:'mtls'}),{mode:0o600});
  const config=path.join(f.root,'gateway.toml'),label='netclaw150-'+f.installationId;
  fs.writeFileSync(config,`[openshell]\nversion = 2\n[openshell.gateway]\nname = "${label}"\ncompute_driver = "docker"\nguest_tls_ca = ${JSON.stringify(path.join(f.root,'tls/ca.crt'))}\n[openshell.drivers.docker]\nsocket_path = ${JSON.stringify(process.env.NETCLAW_TEST_DOCKER_SOCKET)}\nsandbox_label = "${label}"\nimage_pull_policy = "never"\ngrpc_endpoint = "https://host.docker.internal:${port}"\n`,{mode:0o600});
  log=fs.openSync(path.join(f.root,'gateway.log'),'w',0o600);
  child=spawn(gateway,['--config',config,'--bind-address','127.0.0.1','--port',String(port),'--tls-cert',path.join(f.root,'tls/server/tls.crt'),'--tls-key',path.join(f.root,'tls/server/tls.key'),'--tls-client-ca',path.join(f.root,'tls/ca.crt')],{env,stdio:['ignore',log,log]});closed=once(child,'close');
  let ready;for(let attempt=0;attempt<30;attempt++){
    try{ready=JSON.parse((await call(['status','-o','json'])).stdout);if(ready.status==='connected')break;}catch{}
    assert.equal(child.exitCode,null,'Gateway exited during startup');await pause(100);
  }
  assert.equal(ready?.authentication?.status,'authenticated');assert.equal(ready?.version,'0.1.3');
  const policy=path.join(f.root,'policy.yaml');fs.writeFileSync(policy,'version: 1\nfilesystem_policy:\n  read_only: [/usr, /bin, /lib, /lib64, /etc]\n  read_write: [/sandbox, /tmp]\nlandlock:\n  compatibility: best_effort\nprocess:\n  run_as_user: "65534"\n  run_as_group: "65534"\nnetwork_policies: {}\n',{mode:0o600});
  // Images must already exist. The driver is configured never to pull. No
  // provider, owner mount, credential import or inference is requested.
  const made=JSON.parse((await call(['sandbox','create','--name',sandbox,'--from',process.env.NETCLAW_TEST_OPENSHELL_IMAGE||'python:3.11','--policy',policy,'--label',`netclaw.installation-id=${f.installationId}`,'--no-auto-providers','--detach','-o','json','--','/bin/sleep','90'])).stdout);created=true;
  assert.equal(made.phase,'Ready');assert.equal(made.configuration_admission.state,'accepted');
  const capture=()=>Object.fromEntries(['metadata.json','mtls/ca.crt','mtls/tls.crt','mtls/tls.key'].map(name=>[name,fs.readFileSync(path.join(directory,name)).toString('base64')]));
  service=new ManagementService({...f,root:fileURLToPath(new URL('../../',import.meta.url)),...(process.env.NETCLAW_TEST_LIVE_GAIT==='1'?{}:{audit:auditFixture()})});
  const before=capture(),component=service.openshell;
  await component.register({executable:cli,configHome,gateway:'openshell',workspace:'default',sandbox},{reviewed:true,audit:service.audit});
  const observed=await component.snapshot();assert.equal(observed.available,true);assert.equal(observed.sandbox.id,made.id);assert.equal(observed.sandbox.phase,'Ready');assert.equal(observed.enforcement.state,'reported-active');assert.deepEqual(capture(),before);
  assert.deepEqual(observed.sandbox.policy.process,{run_as_user:'65534',run_as_group:'65534'});
  const management=await service.call('operator_snapshot',{domain:'security'});assert.equal(management.data.openshell.sandbox.id,made.id);assert.equal(management.data.openshell.enforcement.state,'reported-active');
  assert.equal(child.exitCode,null);await call(['sandbox','stop',sandbox]);
  const stopped=await component.snapshot();assert.equal(stopped.sandbox.phase,'Stopped');assert.equal(stopped.enforcement.state,'degraded');assert.equal(child.exitCode,null);
});

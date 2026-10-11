import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {installationFixture,auditFixture} from './fixtures.mjs';
import {bindInstallation} from '../../ui/netclaw-visual/src/management/identity.js';
import {OpenShellComponent} from '../../ui/netclaw-visual/src/management/openshell.js';

function setup(t){
  const f=installationFixture(t),binding=bindInstallation(f),configHome=path.join(f.root,'config');
  const directory=path.join(configHome,'openshell/gateways/owned'),mtls=path.join(directory,'mtls');fs.mkdirSync(mtls,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(directory,'metadata.json'),JSON.stringify({name:'owned',gateway_endpoint:'https://127.0.0.1:40443',auth_mode:'mtls',is_remote:false,gateway_port:40443}),{mode:0o600});
  for(const name of ['ca.crt','tls.crt','tls.key'])fs.writeFileSync(path.join(mtls,name),`synthetic-${name}`,{mode:0o600});
  const executable=path.join(f.root,'openshell');fs.writeFileSync(executable,'synthetic executable bytes',{mode:0o700});
  const calls=[],sandbox={id:'sandbox-id',name:'selected',workspace:'netclaw',phase:'Ready',labels:{'netclaw.installation-id':f.installationId},resource_version:5,
    revision:4,current_policy_version:4,policy_source:'sandbox',configuration_admission:{state:'accepted',policy_hash:'hash'},conditions:[],policy:{version:1,filesystem_policy:{read_only:['/usr'],read_write:['/sandbox']},api_key:'not-projected'}};
  let status={gateway:'owned',server:'https://127.0.0.1:40443',status:'connected',authentication:{status:'authenticated'},version:'0.1.3'};
  const run=async(program,args,options)=>{calls.push({program,args,options});return {stdout:args.includes('--version')?'openshell 0.1.3\n':JSON.stringify(args.includes('status')?status:sandbox)};};
  const component=new OpenShellComponent(binding,{run}),record={configHome,executable,gateway:'owned',workspace:'netclaw',sandbox:'selected'};
  return {...f,binding,configHome,directory,mtls,executable,calls,sandbox,component,record,setStatus:value=>{status=value;}};
}
test('OpenShell binding observes the exact authenticated gateway and labelled sandbox before recording',async t=>{
  const f=setup(t);assert.equal((await f.component.snapshot()).available,false);
  const preview=await f.component.register(f.record);assert.equal(preview.sandboxId,'sandbox-id');assert.equal((await f.component.snapshot()).available,false);
  await f.component.register(f.record,{reviewed:true,audit:auditFixture()});
  const view=await f.component.snapshot();assert.equal(view.available,true);assert.equal(view.sandbox.phase,'Ready');assert.equal(view.enforcement.state,'reported-active');assert.ok(!JSON.stringify(view).includes('not-projected'));
  const query=f.calls.find(call=>call.args.includes('sandbox'));assert.deepEqual(query.args,['--gateway','owned','--workspace','netclaw','--color','never','sandbox','get','selected','-o','json']);
  assert.equal(query.options.shell,false);assert.ok(query.options.env.XDG_CONFIG_HOME.startsWith(f.statePath+'/.openshell-read-'));assert.equal(fs.existsSync(query.options.env.XDG_CONFIG_HOME),false);assert.equal(query.options.env.OPENSHELL_GATEWAY_ENDPOINT,undefined);assert.equal(query.options.env.OPENSHELL_GATEWAY_INSECURE,undefined);
});
test('OpenShell rejects a wrong label, replaced sandbox, changed certificate and executable',async t=>{
  const f=setup(t);f.sandbox.labels['netclaw.installation-id']='another-installation';await assert.rejects(f.component.register(f.record),{code:'IDENTITY_CHANGED'});
  f.sandbox.labels['netclaw.installation-id']=f.installationId;await f.component.register(f.record,{reviewed:true,audit:auditFixture()});
  f.sandbox.id='replacement';await assert.rejects(f.component.snapshot(),{code:'IDENTITY_CHANGED'});f.sandbox.id='sandbox-id';
  fs.writeFileSync(path.join(f.mtls,'tls.key'),'rotated key');const before=f.calls.length;assert.equal((await f.component.snapshot()).available,false);assert.equal(f.calls.length,before);
  fs.writeFileSync(path.join(f.mtls,'tls.key'),'synthetic-tls.key');fs.appendFileSync(f.executable,'changed');assert.equal((await f.component.snapshot()).available,false);assert.equal(f.calls.length,before);
});
test('HTTP health and absent policy are not reported as OpenShell enforcement',async t=>{
  const f=setup(t);await f.component.register(f.record,{reviewed:true,audit:auditFixture()});
  f.setStatus({gateway:'owned',server:'https://127.0.0.1:40443',status:'connected_http',authentication:{status:'unverified'}});
  const count=f.calls.filter(c=>c.args.includes('sandbox')).length;
  const view=await f.component.snapshot();assert.equal(view.enforcement.state,'unavailable');assert.equal(f.calls.filter(c=>c.args.includes('sandbox')).length,count);
  f.setStatus({gateway:'owned',server:'https://127.0.0.1:40443',status:'connected',authentication:{status:'authenticated'},version:'0.1.3'});f.sandbox.policy=null;
  assert.equal((await f.component.snapshot()).enforcement.state,'degraded');
});
test('unsupported bearer auto-refresh and plaintext gateways never invoke the CLI',async t=>{
  const f=setup(t);
  for(const metadata of [{auth_mode:'oidc',gateway_endpoint:'https://127.0.0.1:40443'},{auth_mode:'plaintext',gateway_endpoint:'http://127.0.0.1:40443'}]){
    fs.writeFileSync(path.join(f.directory,'metadata.json'),JSON.stringify({name:'owned',...metadata}));const count=f.calls.length;
    await assert.rejects(f.component.register(f.record));assert.equal(f.calls.length,count);
  }
});
test('caller input cannot replace the authenticated installation tuple or add arbitrary launch flags',async t=>{
  const f=setup(t);
  for(const extra of [{installationId:'another'},{args:['--gateway-insecure']},{runtime:'hermes'}])await assert.rejects(f.component.register({...f.record,...extra}),{code:'INVALID_INPUT'});
  assert.equal(f.calls.length,0);
});

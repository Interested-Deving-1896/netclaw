import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sourceModule} from './bundle-fixture.mjs';

class EventEmitter {event=()=>({dispose(){}});fire(){}dispose(){}}
class McpStdioServerDefinition {constructor(label,command,args,env,version){Object.assign(this,{label,command,args,env,version});}}
const api={env:{},workspace:{isTrusted:true},EventEmitter,McpStdioServerDefinition};
async function fixture(){
  const {hostContext}=await sourceModule('state/profiles.ts',api);
  const profile={id:randomUUID(),label:'Synthetic',transport:'local',home:"/fixture/home'$(false)",nodePath:'/fixture/node',launcherPath:'/fixture/scripts/netclaw-operator.mjs',harness:'hermes',context:hostContext(),installationId:randomUUID(),hostId:'fixture-host',principalId:'os:501'};
  const grantId=randomUUID(),grant={grantId,installationId:profile.installationId,client:'copilot',generation:1,credentialRef:`NETCLAW_CLIENT_${grantId.replaceAll('-','').toUpperCase()}_TOKEN`,actions:['inspect'],targets:[profile.installationId],disclosure:['summary'],expiresAt:Date.now()+3600000,revokedAt:null,status:'active'};
  return {profile,grant};
}
test('assistant launcher is fixed, grant-bound and secret-free, including hostile SSH paths',async()=>{
  const {profile,grant}=await fixture(),{assistantLaunch,terminalPreview}=await sourceModule('assistants/registration.ts',api);
  const launch=assistantLaunch(profile,grant);assert.equal(launch.args[0],'/fixture/scripts/netclaw-assistant.mjs');assert.equal(launch.args.at(-1),grant.credentialRef);
  for(const changed of [{installationId:randomUUID()},{credentialRef:'OPENCLAW_GATEWAY_TOKEN'},{status:'revoked'},{expiresAt:1},{credentialRef:`NETCLAW_CLIENT_${'A'.repeat(32)}_TOKEN`}])assert.throws(()=>assistantLaunch(profile,{...grant,...changed}));
  assert.throws(()=>assistantLaunch({...profile,context:'different-wsl'},grant));
  const ssh=assistantLaunch({...profile,transport:'ssh',sshAlias:'existing'},grant);assert.equal(ssh.command,'ssh');assert.ok(ssh.args.includes('StrictHostKeyChecking=yes'));
  assert.ok(!ssh.args.at(-1).includes('netclaw-operator.mjs'));
  for(const client of ['codex','claude-code']){
    const preview=terminalPreview({profile,grant:{...grant,client},enabled:true});assert.match(preview,/mcp.*add/);assert.match(preview,/mcp.*remove/);assert.ok(preview.includes(grant.credentialRef));assert.ok(!preview.includes('--env'));
  }
});
test('Copilot discovery is opt-in and side-effect-free; resolve rechecks revocation and immutable binding',async()=>{
  const {profile,grant}=await fixture(),{AssistantProvider}=await sourceModule('assistants/provider.ts',api);
  const values=new Map(),state={get:(key,fallback)=>values.get(key)??fallback,update:async(key,value)=>values.set(key,value)};
  let calls=0,live=grant;
  const connection={ready:true,profile,identity:{installationId:profile.installationId,hostId:profile.hostId,principalId:profile.principalId},generation:1,changed:new EventEmitter(),call:async()=>{calls++;return {data:{items:[live]}};}};
  const provider=new AssistantProvider(state,connection,{list:()=>[profile]});
  assert.equal(provider.provideMcpServerDefinitions().length,0);assert.equal(calls,0);
  await provider.remember({profile,grant,enabled:true});assert.equal(provider.provideMcpServerDefinitions().length,0);
  await provider.refresh();const definitions=provider.provideMcpServerDefinitions();assert.equal(definitions.length,1);
  const before=calls;provider.provideMcpServerDefinitions();assert.equal(calls,before);
  const resolved=await provider.resolveMcpServerDefinition(definitions[0],{isCancellationRequested:false});assert.equal(resolved.label,definitions[0].label);
  const copied=await provider.resolveMcpServerDefinition({...definitions[0],command:'unexpected',args:['hostile']},{isCancellationRequested:false});assert.equal(copied.command,profile.nodePath);assert.ok(!copied.args.includes('hostile'));
  connection.identity={...connection.identity,installationId:randomUUID()};assert.equal(provider.provideMcpServerDefinitions().length,0);assert.equal(await provider.resolveMcpServerDefinition(definitions[0],{isCancellationRequested:false}),undefined);
  connection.identity.installationId=profile.installationId;live={...grant,generation:2,status:'revoked',revokedAt:Date.now()};assert.equal(await provider.resolveMcpServerDefinition(definitions[0],{isCancellationRequested:false}),undefined);
  live=grant;await provider.forget(profile.id,grant.grantId);assert.equal(provider.provideMcpServerDefinitions().length,0);assert.equal(await provider.resolveMcpServerDefinition(definitions[0],{isCancellationRequested:false}),undefined);
  provider.dispose();
});
test('Restricted Mode and disconnect expose no Copilot definitions',async()=>{
  const {profile,grant}=await fixture(),restricted={...api,workspace:{isTrusted:false}},{AssistantProvider}=await sourceModule('assistants/provider.ts',restricted);
  const values=new Map(),state={get:(k,f)=>values.get(k)??f,update:async(k,v)=>values.set(k,v)};
  const connection={ready:true,profile,identity:{installationId:profile.installationId,hostId:profile.hostId},changed:new EventEmitter(),call:async()=>({data:{items:[grant]}})};
  const provider=new AssistantProvider(state,connection,{list:()=>[profile]});await provider.remember({profile,grant,enabled:true});await provider.refresh();assert.equal(provider.provideMcpServerDefinitions().length,0);
  restricted.workspace.isTrusted=true;connection.ready=false;assert.equal(provider.provideMcpServerDefinitions().length,0);provider.dispose();
});

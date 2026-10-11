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
    const version={client,version:client==='codex'?'0.162.1':'2.1.286',verified:true,host:profile.context};
    const preview=terminalPreview({profile,grant:{...grant,client},enabled:true},version);assert.match(preview,/mcp.*add/);assert.match(preview,/mcp.*remove/);assert.ok(preview.includes(grant.credentialRef));assert.ok(!preview.includes('--env'));
    for(const wrong of [{...version,version:'0.0.0'},{...version,host:'other'},{...version,verified:false}])assert.throws(()=>terminalPreview({profile,grant:{...grant,client},enabled:true},wrong));
  }
});
test('terminal export rejects unknown, injected and mismatched CLI version output',async()=>{
  const {parseClientVersion}=await sourceModule('assistants/registration.ts',api);
  assert.equal(parseClientVersion('codex','codex-cli 0.162.1\n').verified,true);
  assert.equal(parseClientVersion('claude-code','2.1.286 (Claude Code)\n').verified,true);
  assert.equal(parseClientVersion('codex','codex-cli 0.163.0').verified,false);
  for(const output of ['codex-cli 0.162.1\nextra command','2.1.286 (Claude Code)','codex-cli 0.162.1; echo injected',''])assert.throws(()=>parseClientVersion('codex',output));
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

test('assistant setup offers only qualified scope and requires explicit answer disclosure before grant creation',async()=>{
  for(const qualified of [false,true]){
    const {profile,grant}=await fixture(),calls=[],prompts=[];let permissionOptions=[];
    const localApi={...api,window:{
      showQuickPick:async(items,options={})=>{
        if(options.title==='NetClaw assistant access')return 'Connect an assistant';
        if(options.title==='Assistant client')return 'copilot';
        if(options.title==='Assistant permissions'){permissionOptions=items;return items[0];}
        if(options.title==='What may this assistant receive?')return items.at(-1);
        if(options.title==='Grant expiry')return items[0];
        throw Error('Unexpected picker');
      },showInformationMessage:async(message,options={},...choices)=>{prompts.push(options.detail);return choices[0];},
    }};
    const connection={profile,generation:1,call:async(name,args)=>{
      calls.push({name,args});
      if(name==='operator_identity')return {capabilities:{delegation:{qualified,profile:'local-subnet',reason:'Local subnet only'}}};
      if(name==='operator_client_prepare')return {proposalId:'fixture-proposal',expectedRevision:'fixture-revision',disclosureNotice:'External provider disclosure'};
      if(name==='operator_client_apply')return {state:'succeeded',result:{grantId:grant.grantId}};
      if(name==='operator_resources')return {data:{items:[grant]}};
      throw Error(name);
    }};
    const provider={remember:async()=>{},refresh:async()=>{}},profiles={list:()=>[profile]};
    const {manageAssistant}=await sourceModule('assistants/setup.ts',localApi);await manageAssistant(connection,profiles,provider);
    assert.equal(permissionOptions.some(option=>option.actions.includes('delegate')),qualified);
    const prepared=calls.find(call=>call.name==='operator_client_prepare').args;
    assert.equal(prepared.actions.includes('delegate'),qualified);assert.equal(prepared.disclosure.includes('conversation'),qualified);
    assert.deepEqual(Array.from(prepared.targets),[profile.installationId]);assert.match(prompts[0],/External provider disclosure/);assert.match(prompts[0],/inference costs/);
    if(qualified)assert.match(prompts[0],/Local subnet only/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(){
  const calls=[],commands=[],risk={available:true,configuredRole:'border',observedRole:'border',riskName:'existing-risk',effect:'Save for a separate restart.',activeWork:[],choices:[{role:'standalone',available:true}]};
  const connection={generation:1,identity:{installationId:'selected-installation'},call:async(name,args)=>{calls.push({name,args});return name==='operator_snapshot'?{data:{revision:'reviewed-revision',risk,managed:{providers:[],budget:{supported:false},legacyCredentials:false,runtime:'openclaw'}}}:{proposalId:'reviewed-proposal'};}};
  const api={window:{showQuickPick:async rows=>rows.find(row=>row.value==='role')||rows[0],showWarningMessage:async()=>'Prepare role review'},commands:{executeCommand:async(...args)=>commands.push(args)}};
  return {calls,commands,risk,connection,api};
}
test('native role workflow prepares the exact existing-installation change after impact acknowledgment',async()=>{
  const f=fixture(),{configureSettings}=await sourceModule('views/settings.ts',f.api);await configureSettings(f.connection);
  assert.equal(f.calls.length,2);assert.equal(f.calls[1].name,'operator_change_prepare');assert.equal(f.calls[1].args.action,'risk.role');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1].args.targets)),['selected-installation']);assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1].args.patch)),{role:'standalone',acknowledgeActiveWork:true});
  assert.deepEqual(f.commands,[['netclaw.reviewProposal','reviewed-proposal']]);
});
test('native harness selection scopes both installations and preserves connection identity',async()=>{
  const f=fixture(),call=f.connection.call;f.connection.call=async(name,args)=>{
    const result=await call(name,args);
    if(name==='operator_snapshot')result.data.runtimeSelection={available:true,effect:'Existing processes and this connection stay bound.',choices:[{id:'target-installation',harness:'hermes',home:'/existing/hermes',available:true,activeWork:2}]};
    return result;
  };
  f.api.window.showQuickPick=async rows=>rows.find(row=>row.value==='runtime')||rows[0];f.api.window.showWarningMessage=async()=>'Prepare harness review';
  const {configureSettings}=await sourceModule('views/settings.ts',f.api);await configureSettings(f.connection);
  assert.equal(f.calls[1].args.action,'runtime.select');assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1].args.targets)),['selected-installation','target-installation']);
  assert.equal(f.calls[1].args.patch.runtimeId,'target-installation');assert.equal(f.connection.identity.installationId,'selected-installation');
  assert.equal(f.calls.length,2);
});
test('cancelled role review, unavailable role and connection switch never prepare a backend change',async()=>{
  for(const variant of ['cancel','unavailable','switch']){
    const f=fixture();if(variant==='unavailable')f.risk.choices[0].available=false;
    f.api.window.showWarningMessage=async()=>{if(variant==='switch'){f.connection.generation++;return 'Prepare role review';}};
    const {configureSettings}=await sourceModule('views/settings.ts',f.api);
    if(variant==='cancel')await configureSettings(f.connection);else await assert.rejects(configureSettings(f.connection));
    assert.equal(f.calls.length,1);assert.equal(f.commands.length,0);
  }
});

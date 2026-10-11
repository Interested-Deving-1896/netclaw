import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
const setup=()=>{
  const calls=[],commands=[],connection={generation:1,identity:{installationId:'installation'},call:async(name,args)=>{calls.push({name,args});return name==='operator_snapshot'?{data:{revision:'reviewed-revision',services:[{id:'gateway',available:true,active:true,manager:'fixture',unit:'owned-fixture'}]}}:{proposalId:'proposal'};}};
  const api={window:{showQuickPick:async rows=>typeof rows[0]==='string'?'restart':rows[0],showWarningMessage:async()=> 'Prepare service review'},commands:{executeCommand:async(...args)=>commands.push(args)}};
  return {calls,commands,connection,api};
};
test('native lifecycle creates only a scoped proposal after interruption review',async()=>{
  const f=setup(),{configureService}=await sourceModule('views/lifecycle.ts',f.api);await configureService(f.connection);
  assert.equal(f.calls.length,2);assert.equal(f.calls[1].name,'operator_change_prepare');assert.equal(f.calls[1].args.action,'service.restart');
  assert.equal(f.calls[1].args.patch.serviceId,'gateway');assert.equal(f.calls[1].args.patch.acknowledgeActiveWork,true);assert.equal(f.commands[0][0],'netclaw.reviewProposal');
});
test('cancelled interruption review and connection changes never prepare or execute service control',async()=>{
  for(const change of [false,true]){
    const f=setup();f.api.window.showWarningMessage=async()=>{if(change){f.connection.generation++;return 'Prepare service review';}};
    const {configureService}=await sourceModule('views/lifecycle.ts',f.api);
    if(change)await assert.rejects(configureService(f.connection),/Connection changed/);else await configureService(f.connection);
    assert.equal(f.calls.length,1);assert.equal(f.commands.length,0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(action){
  const calls=[],commands=[],policy={identity:'peer',state:'federated',chatEnabled:action==='disable',grants:action==='revoke'?[{id:4,target_type:'tool',target_name:'local/one'}]:[],work:[],consent:{local_grant:true,remote_grant:true}};
  const connection={generation:1,identity:{installationId:'installation'},call:async(name,args)=>{calls.push({name,args});
    if(name==='operator_resources')return {data:{items:[{id:'peer',label:'Same name',state:'federated'}],total:1}};
    if(name==='operator_workspace')return {data:{revision:'revision',policy,grantCandidatesAvailable:true,grantCandidatesLimit:500,grantCandidates:[{type:'tool',name:'local/one'}]}};
    return {proposalId:'proposal'};
  }};
  const api={window:{showQuickPick:async(rows,options)=>options.canPickMany?[rows[0]]:rows.find(row=>row.value===action)||rows[0],showInputBox:async()=> '30',showWarningMessage:async()=> 'Prepare permission review'},commands:{executeCommand:async(...args)=>commands.push(args)}};
  return {calls,commands,policy,connection,api};
}
test('native peer controls prepare exact permission deltas and never call apply directly',async()=>{
  for(const action of ['enable','disable','grant','revoke']){
    const f=fixture(action),{openPeers}=await sourceModule('views/peers.ts',f.api);await openPeers({},f.connection);
    const last=f.calls.at(-1);assert.equal(last.name,'operator_change_prepare');assert.deepEqual(JSON.parse(JSON.stringify(last.args.targets)),['installation','peer']);
    assert.equal(last.args.patch.acknowledgeActiveWork,true);
    if(action==='grant'){assert.equal(last.args.patch.grant.requiresApproval,true);assert.equal(last.args.patch.grant.name,'local/one');}
    if(action==='revoke')assert.deepEqual(Array.from(last.args.patch.revokeGrantIds),[4]);
    assert.deepEqual(f.commands,[['netclaw.reviewProposal','proposal']]);assert.ok(!f.calls.some(call=>call.name==='operator_change_apply'));
  }
});
test('cancelled peer review and connection switch do not prepare a mutation',async()=>{
  for(const variant of ['cancel','switch']){
    const f=fixture('grant');f.api.window.showWarningMessage=async()=>{if(variant==='switch'){f.connection.generation++;return 'Prepare permission review';}};
    const {openPeers}=await sourceModule('views/peers.ts',f.api);
    if(variant==='cancel')await openPeers({},f.connection);else await assert.rejects(openPeers({},f.connection),/Connection changed/);
    assert.ok(!f.calls.some(call=>call.name==='operator_change_prepare'));assert.equal(f.commands.length,0);
  }
});

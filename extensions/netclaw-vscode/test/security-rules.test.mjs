import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(){
  const calls=[],commands=[],details=[];
  const connection={generation:1,identity:{installationId:'installation'},call:async(name,args)=>{calls.push({name,args});
    if(name==='operator_identity')return {installationId:'installation',configurationRevision:'config-revision'};
    if(name==='operator_workspace')return {data:{installationId:'installation',connector:'hermes',tool:'write_file',revision:'rule-revision',effective:'block',fallback:'block',scope:'Allow bypasses scans and clears logical flags; physical files remain untouched.'}};
    return {proposalId:'proposal'};
  }};
  const api={window:{showQuickPick:async rows=>rows.find(row=>row.value==='tool-rule')||rows.find(row=>row.policy==='allow'),showInputBox:async()=> 'write_file',showWarningMessage:async(_,options)=>{details.push(options.detail);return 'Prepare tool rule review';}},commands:{executeCommand:async(...args)=>commands.push(args)}};
  return {calls,commands,details,connection,api};
}
test('native tool policy review preserves exact connector, tool and rule revision and never applies directly',async()=>{
  const f=fixture(),{openSecurity}=await sourceModule('views/security.ts',f.api);await openSecurity({},f.connection);
  const proposal=f.calls.at(-1);assert.equal(proposal.name,'operator_change_prepare');assert.equal(proposal.args.action,'security.tool-rule');assert.equal(proposal.args.patch.tool,'write_file');assert.equal(proposal.args.patch.policy,'allow');assert.equal(proposal.args.patch.expectedRuleRevision,'rule-revision');
  assert.deepEqual(Array.from(proposal.args.targets),['installation']);assert.match(f.details[0],/Connector: hermes/);assert.match(f.details[0],/bypasses scans/);assert.deepEqual(f.commands,[['netclaw.reviewProposal','proposal']]);
});
test('cancelled or switched tool-rule review never prepares a change',async()=>{
  for(const variant of ['cancel','switch']){
    const f=fixture();f.api.window.showWarningMessage=async()=>{if(variant==='switch'){f.connection.generation++;return 'Prepare tool rule review';}};
    const {openSecurity}=await sourceModule('views/security.ts',f.api);
    if(variant==='cancel')await openSecurity({},f.connection);else await assert.rejects(openSecurity({},f.connection),/Connection changed/);
    assert.ok(!f.calls.some(row=>row.name==='operator_change_prepare'));assert.equal(f.commands.length,0);
  }
});

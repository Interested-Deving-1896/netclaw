import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';

function fixture(overrides={}){
  const calls=[],dialogs=[],proposal={action:'env.patch',targets:['installation'],expectedRevision:'revision',impact:'Synthetic change',changeClass:'operator-local',state:'pending-approval',expiresAt:Date.now()+60000,patch:{fields:[{key:'ANTHROPIC_API_KEY',intent:'replace'}]},...overrides};
  const connection={generation:1,identity:{installationId:'installation'},call:async(name,args)=>{calls.push({name,args:structuredClone(args)});return name==='operator_evidence'?{data:proposal}:{operationId:'operation'};}};
  const api={window:{showInformationMessage:async(_message,options)=>{dialogs.push(options);return 'Apply reviewed change';},showInputBox:async()=> 'synthetic-transient-secret'}};
  return {calls,dialogs,proposal,connection,api};
}
test('review returns owned receipt and sends replacement only to the reviewed backend',async()=>{
  const f=fixture(),{applyReviewedProposal}=await sourceModule('views/operations.ts',f.api);
  const receipt=await applyReviewedProposal(f.connection,'proposal');
  assert.equal(receipt.operationId,'operation');assert.equal(f.calls[1].name,'operator_change_apply');
  assert.equal(f.calls[1].args.replacements.ANTHROPIC_API_KEY,'synthetic-transient-secret');
  assert.ok(!JSON.stringify(f.dialogs).includes('synthetic-transient-secret'));
});
test('expired, completed and unknown-authority proposals cannot open an apply prompt',async()=>{
  for(const overrides of [{expiresAt:1},{state:'verified'},{changeClass:'lab'}]){
    const f=fixture(overrides),{applyReviewedProposal}=await sourceModule('views/operations.ts',f.api);
    await assert.rejects(applyReviewedProposal(f.connection,'proposal'));assert.equal(f.calls.length,1);assert.equal(f.dialogs.length,0);
  }
});
test('profile change during secret entry cannot send the replacement to another installation',async()=>{
  const f=fixture();f.api.window.showInputBox=async()=>{f.connection.generation++;return 'synthetic-transient-secret';};
  const {applyReviewedProposal}=await sourceModule('views/operations.ts',f.api);
  await assert.rejects(applyReviewedProposal(f.connection,'proposal'),/Connection changed/);assert.equal(f.calls.length,1);
});
test('production and exact Local/Lab reviews require their own nonempty authority reference',async()=>{
  for(const changeClass of ['production','terminal-local']){
    const f=fixture({changeClass,patch:{}});let prompt;
    f.api.window.showInputBox=async options=>{prompt=options;return '';};
    const {applyReviewedProposal}=await sourceModule('views/operations.ts',f.api);
    assert.equal(await applyReviewedProposal(f.connection,'proposal'),undefined);assert.equal(f.calls.length,1);
    assert.match(prompt.title,changeClass==='production'?/ServiceNow/:/Local\/Lab/);
  }
});
test('declined native review causes no secret prompt or managed apply',async()=>{
  const f=fixture();f.api.window.showInformationMessage=async()=>undefined;f.api.window.showInputBox=async()=>{throw Error('not authorized');};
  const {applyReviewedProposal}=await sourceModule('views/operations.ts',f.api);
  assert.equal(await applyReviewedProposal(f.connection,'proposal'),undefined);assert.equal(f.calls.length,1);
});

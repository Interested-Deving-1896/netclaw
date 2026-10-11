import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';

function fixture(){
  const calls=[],commands=[];let pick=0;
  const connection={generation:1,identity:{installationId:'installation'},call:async(name,args)=>{
    calls.push({name,args:structuredClone(args)});return name==='operator_snapshot'?{data:{revision:'revision',defenseclaw:{available:true,settings:{supported:true,modes:['observe','enforce','disabled'],effect:'Stored policy only'}}}}:{proposalId:'proposal'};
  }};
  const api={window:{showQuickPick:async()=>++pick===1?{value:'settings'}:'enforce'},commands:{executeCommand:async(...args)=>commands.push(args)}};
  return {connection,api,calls,commands};
}
test('guard mode stages a proposal and hands it to native human review',async()=>{
  const f=fixture(),{openSecurity}=await sourceModule('views/security.ts',f.api);await openSecurity({},f.connection);
  assert.equal(f.calls.length,2);assert.equal(f.calls[1].name,'operator_change_prepare');assert.equal(f.calls[1].args.action,'security.patch');
  assert.deepEqual(f.calls[1].args.patch,{mode:'enforce'});assert.deepEqual(f.commands,[['netclaw.reviewProposal','proposal']]);
});
test('connection changes during guard selection prevent preparation',async()=>{
  const f=fixture();let pick=0;f.api.window.showQuickPick=async()=>{if(++pick===1)return {value:'settings'};f.connection.generation++;return 'disabled';};
  const {openSecurity}=await sourceModule('views/security.ts',f.api);await assert.rejects(openSecurity({},f.connection),/Connection changed/);
  assert.equal(f.calls.length,1);assert.equal(f.commands.length,0);
});

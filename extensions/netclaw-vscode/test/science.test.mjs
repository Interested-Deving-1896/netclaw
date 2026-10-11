import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(){
  const calls=[],state=new Map();let pick=0;
  const connection={generation:1,identity:{installationId:'installation',hostId:'host',principalId:'principal'},call:async(name,args)=>{
    calls.push({name,args:structuredClone(args)});
    if(name==='operator_resources')return {data:{taskOwnedAssessments:[{id:'original',conversationId:'task',operationId:'request',parent:null}],operations:[]}};
    if(args.action==='assessment-read')return {data:{assessment:{status:'ok',assessment_id:'original'},related:[]}};
    if(args.action==='assessment-preview')return {data:{reviewId:'review',request:{state:'Historical advice'},prepared:{endpoint:'http://127.0.0.1/test',reserved_cost_usd:.003,approval_required:false},budgets:{}}};
    return {operationId:'operation',state:'admitted'};
  }};
  const api={ViewColumn:{Beside:2},window:{showQuickPick:async()=>++pick===1?{id:'original'}:{value:'reconsider'},showInputBox:async()=>'Review the assumption',showInformationMessage:async()=>'Submit reconsideration',showTextDocument:async()=>{}},workspace:{openTextDocument:async value=>value}};
  const context={globalStorageUri:{fsPath:'/tmp/unused'},globalState:{get:key=>state.get(key),update:async(key,value)=>state.set(key,value)}};
  return {connection,api,context,calls,state};
}
test('Science Officer reviews the exact cost/destination and admits one request using its retained review ID',async()=>{
  const f=fixture(),{openScience}=await sourceModule('views/science.ts',f.api);await openScience(f.context,f.connection);
  const sent=f.calls.find(call=>call.args.action==='assessment-reconsider');assert.equal(sent.args.args.reviewId,'review');assert.equal(sent.args.args.id,'original');assert.equal(sent.args.args.query,'Review the assumption');
  assert.equal(f.calls.filter(call=>call.args.action==='assessment-reconsider').length,1);
});
test('switching installations during final review cannot submit reconsideration',async()=>{
  const f=fixture();f.api.window.showInformationMessage=async()=>{f.connection.generation++;return 'Submit reconsideration';};
  const {openScience}=await sourceModule('views/science.ts',f.api);await assert.rejects(openScience(f.context,f.connection),/Connection changed/);
  assert.equal(f.calls.some(call=>call.args.action==='assessment-reconsider'),false);
});

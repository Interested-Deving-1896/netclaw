import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(){
  const calls=[],documents=[],reviews=[],saved=new Map();
  const connection={generation:1,identity:{installationId:'installation',hostId:'host',principalId:'operator'},call:async(name,args)=>{
    calls.push({name,args});
    if(name==='operator_resources')return {data:{items:[{id:'exact-skill'}],total:1}};
    if(args.action==='security-scan-list')return {data:{scanner:{bound:true},reports:[],operations:[],scope:'Retained local scans'}};
    if(args.action==='security-scan-preview')return {data:{reviewId:'review',name:'exact-skill',profile:'static-profile',sourceRevision:'hash',files:[{path:'SKILL.md',sha256:'file-hash'}],bytes:123,omittedEntries:1,disclosure:'Static only. No provider calls or enforcement.'}};
    return {operationId:'operation',kind:'defense-scan',state:'admitted'};
  }};
  const context={globalState:{get:key=>saved.get(key),update:async(key,value)=>value===undefined?saved.delete(key):saved.set(key,value)}};
  const api={ViewColumn:{Beside:2},workspace:{openTextDocument:async value=>{documents.push(value);return value;}},window:{showTextDocument:async()=>{},showQuickPick:async rows=>rows[0],showWarningMessage:async(_,options)=>{reviews.push(options.detail);return 'Run reviewed static scan';},showInformationMessage:async()=>{}}};
  return {calls,documents,reviews,saved,connection,context,api};
}
test('native scan reviews exact file manifest and stores only nonce and request identity',async()=>{
  const f=fixture(),{openSecurityScans}=await sourceModule('views/security-scans.ts',f.api);await openSecurityScans(f.context,f.connection);
  assert.equal(f.documents[0].language,'plaintext');assert.match(f.documents[0].content,/file-hash  SKILL.md/);assert.match(f.reviews[0],/Skill: exact-skill/);
  const submit=f.calls.find(row=>row.args.action==='security-scan-submit');assert.deepEqual(structuredClone(submit.args.args),{reviewId:'review'});
  assert.deepEqual(Object.keys(f.saved.values().next().value).sort(),['nonce','operationId']);
});
test('cancelled review, changed connection and substituted skill dispatch nothing',async()=>{
  for(const variant of ['cancel','switch','destination']){
    const f=fixture();if(variant==='destination'){const call=f.connection.call;f.connection.call=async(name,args)=>{const value=await call(name,args);if(args.action==='security-scan-preview')value.data.name='other';return value;};}
    else f.api.window.showWarningMessage=async()=>{if(variant==='switch'){f.connection.generation++;return 'Run reviewed static scan';}};
    const {openSecurityScans}=await sourceModule('views/security-scans.ts',f.api);if(variant==='cancel')await openSecurityScans(f.context,f.connection);else await assert.rejects(openSecurityScans(f.context,f.connection),/changed/);
    assert.ok(!f.calls.some(row=>row.args.action==='security-scan-submit'));assert.equal(f.saved.size,0);
  }
});
test('lost scan response reconciles by nonce without resubmission and findings remain plain text',async()=>{
  const f=fixture(),call=f.connection.call;f.connection.call=async(name,args)=>{if(args.action==='security-scan-submit')throw Error('lost reply');return call(name,args);};
  const {openSecurityScans}=await sourceModule('views/security-scans.ts',f.api);await assert.rejects(openSecurityScans(f.context,f.connection),/lost reply/);f.calls.length=0;
  f.connection.call=async(name,args)=>{f.calls.push({name,args});if(name==='operator_resources')return {data:{operation:{operationId:'operation'}}};return {operationId:'operation',kind:'defense-scan',state:'succeeded',result:{findings:'<script>command:unsafe</script>'}};};
  await openSecurityScans(f.context,f.connection);assert.equal(f.saved.size,0);assert.ok(f.calls.some(row=>row.args.filters?.query));assert.ok(!f.calls.some(row=>row.args.action==='security-scan-submit'));
  assert.equal(f.documents.at(-1).language,'plaintext');assert.match(f.documents.at(-1).content,/<script>command:unsafe<\/script>/);
});
test('pending scan cancellation uses the owned operation receipt without a second submit',async()=>{
  const f=fixture();f.saved.set('security-scan.pending.host.installation.operator',{nonce:'nonce',operationId:'operation'});f.api.window.showInformationMessage=async()=> 'Cancel scan';
  const {openSecurityScans}=await sourceModule('views/security-scans.ts',f.api);await openSecurityScans(f.context,f.connection);
  assert.equal(f.calls.find(row=>row.name==='operator_cancel_request').args.operationId,'operation');assert.ok(!f.calls.some(row=>row.args.action==='security-scan-submit'));assert.equal(f.saved.size,1);
});

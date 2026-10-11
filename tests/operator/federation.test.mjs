import test from 'node:test';
import assert from 'node:assert/strict';
import {federationReader,projectFederation} from '../../ui/netclaw-visual/src/management/federation.js';

const binding={installationId:'installation',kind:'hermes',assertCurrent(){}};
const status={installation_id:binding.installationId,harness_type:'hermes',federation_ready:true};
test('fixed federation reads verify installation both before and after a bounded response',async()=>{
  const calls=[],reader=federationReader(binding,()=>({}),async url=>{calls.push(new URL(url).pathname);return Response.json(url.endsWith('/status')?status:{members:[]});});
  assert.deepEqual((await reader('member')).value,{members:[]});assert.deepEqual(calls,['/status','/n2n/members','/status']);
});
test('wrong runtime or replaced daemon fails without exposing its inventory',async()=>{
  for(const replacement of [{...status,harness_type:'openclaw'},{...status,installation_id:'other'}]){
    let calls=0;const reader=federationReader(binding,()=>({}),async()=>Response.json(++calls===1?status:calls===2?{members:[{private:'wrong installation'}]}:replacement));
    await assert.rejects(reader('member'),{code:'IDENTITY_CHANGED'});assert.equal(calls,3);
  }
});
test('fixed routes deny URLs and oversized responses; edge uses actual edge membership',async()=>{
  const routes=[],reader=federationReader(binding,()=>({}),async url=>{routes.push(new URL(url).pathname);return Response.json(url.endsWith('/status')?status:{members:[{member_id:'edge',node_type:'edge'}]});});
  await reader('edge');assert.equal(routes[1],'/n2n/members');
  await assert.rejects(reader('http://example.test'),{code:'UNSUPPORTED'});
  const huge=federationReader(binding,()=>({}),async url=>url.endsWith('/status')?Response.json(status):new Response('x'.repeat(1024*1024+1)));
  await assert.rejects(huge('member'),{code:'SOURCE_UNAVAILABLE'});
});
test('legacy/stale cards and advertised tools cannot become execution authority',()=>{
  const value={members:[{member_id:'member',display_name:'A',node_type:'claw',state:'active',inventory:{harness:{type:'hermes',version:'v0.21.6',qualified:true},mcp_servers:[{name:'subnet',tools:['calculate'],command:'do-not-project'}],received_at:'2026-10-10T00:00:00Z'}},{member_id:'legacy',inventory:null},{member_id:'edge',node_type:'edge',state:'active'}]};
  const result=projectFederation('member',value),first=result.items[0];
  assert.equal(result.items.length,2);assert.equal(first.harness.type,'hermes');assert.equal(first.executionVerified,null);
  assert.equal(first.capabilities[0].advertised,true);assert.equal(first.capabilities[0].executionVerified,null);assert.ok(!JSON.stringify(result).includes('do-not-project'));
  assert.equal(result.items[1].harness.type,'unknown');assert.equal(projectFederation('edge',value).items[0].id,'edge');
});
test('duplicate member identities fail instead of silently merging installations',()=>{
  assert.throws(()=>projectFederation('member',{members:[{member_id:'same'},{member_id:'same'}]}),{code:'SOURCE_UNAVAILABLE'});
});

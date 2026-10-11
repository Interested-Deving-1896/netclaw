import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installationFixture,auditFixture} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
import {topologyEvidenceWriter,retainedTopology} from '../../ui/netclaw-visual/src/management/topology.js';
import {TopologyService} from '../../ui/netclaw-visual/topology-service.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output={global:'Codes: C - connected\nC 192.0.2.0/24 is directly connected, Gi0/0',vrfs:'Routing Table: VRF\nCodes: C - connected',outputs:{'show cdp neighbors detail':'Device ID: R2\nInterface: Gi0/0, Port ID (outgoing port): Gi0/1','show lldp neighbors detail':'Total entries displayed : 0'}};
function fixture(t,kind='openclaw'){
  const f=installationFixture(t,kind),backend=new ManagementService({...f,root,audit:auditFixture()});t.after(()=>backend.close());
  const profile={id:'R1',alias:'R1',host:'192.0.2.1',port:22,protocol:'ssh',os:'iosxe',password:'DO_NOT_RETAIN'};
  let collections=0,fail=false;
  const collector=new TopologyService({file:path.join(f.home,'authorization.json'),getProfile:()=>profile,listProfiles:()=>[profile],knownFingerprint:()=> 'SHA256:fixture',
    collect:async()=>{collections++;if(fail)throw Error('synthetic collection failure');return output;},autoStart:false,publishEvidence:topologyEvidenceWriter(f)});
  t.after(()=>collector.stop());
  return {...f,backend,collector,profile,count:()=>collections,fail:()=>{fail=true;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('topology reads never authorize or poll, and retained collector evidence stays distinct from configured inventory',async t=>{
  for(const kind of ['openclaw','hermes']){
    const f=fixture(t,kind);
    const initial=await f.backend.call('operator_resources',{kind:'network',sourceKind:'historical'});assert.equal(initial.data.enabled,false);assert.equal(f.count(),0);
    f.collector.authorize({authorized:true,devices:[{id:'R1'}],intervalSeconds:30,scopes:['routes','neighbors']});await settle();
    assert.equal(f.count(),1);assert.equal(f.collector.evidenceError,null);
    const {data}=await f.backend.call('operator_resources',{kind:'network',sourceKind:'historical'});
    assert.equal(data.sourceKind,'historical');assert.equal(data.collectorLiveness,'unknown');assert.equal(data.edges.length,1);assert.equal(data.edges[0].protocol,'CDP');assert.equal(data.edges[0].sourceReference.sourceId,'cdp');
    assert.equal(data.nodes.find(row=>row.label==='R2').kind,'neighbor-advertisement');assert.equal(data.nodes[0].stale,false);assert.equal(f.count(),1);
    assert.ok(!JSON.stringify(data).includes('DO_NOT_RETAIN'));assert.ok(!JSON.stringify(data).includes('192.0.2.1'));assert.ok(!JSON.stringify(data).includes('SHA256:fixture'));
    const configured=await f.backend.call('operator_resources',{kind:'network'});assert.equal(configured.data.sourceKind,'configured');assert.equal(configured.data.available,false);
    assert.ok(retainedTopology(f.backend.binding,{now:Date.now()+100000}).nodes.every(row=>row.stale));
    f.fail();await f.collector.run(f.collector.grants[0]);assert.equal(retainedTopology(f.backend.binding).edges[0].stale,true);
    f.collector.revoke();const revoked=retainedTopology(f.backend.binding);assert.equal(revoked.enabled,false);assert.equal(revoked.edges.length,0);assert.equal(f.count(),2);
  }
});
test('retained topology rejects another installation, unsafe files and unsupported source filters',async t=>{
  const f=fixture(t),file=path.join(f.statePath,'topology-observations.json'),original=fs.readFileSync(file),value=JSON.parse(original);
  fs.writeFileSync(file,JSON.stringify({...value,installationId:'different'}));await assert.rejects(f.backend.call('operator_resources',{kind:'network',sourceKind:'historical'}),{code:'IDENTITY_CHANGED'});
  fs.writeFileSync(file,original);fs.chmodSync(file,0o644);assert.equal(retainedTopology(f.backend.binding).available,false);fs.chmodSync(file,0o600);
  const other=path.join(f.statePath,'other.json');fs.renameSync(file,other);fs.symlinkSync(other,file);assert.equal(retainedTopology(f.backend.binding).available,false);fs.unlinkSync(file);fs.renameSync(other,file);
  for(const args of [{kind:'network',sourceKind:'live'},{kind:'peer',sourceKind:'historical'},{kind:'network',sourceKind:'historical',filters:{query:'ignored'}}])await assert.rejects(f.backend.call('operator_resources',args),{code:'INVALID_INPUT'});
  fs.writeFileSync(file,JSON.stringify({...value,edges:[{from:'unknown',to:'unknown'}]}));assert.equal(retainedTopology(f.backend.binding).available,false);
  fs.writeFileSync(file,JSON.stringify({...value,unexpectedPrivateConfig:'do not expose'}));assert.equal(retainedTopology(f.backend.binding).available,false);
});
test('topology projection explicitly bounds scale and preserves per-source failure provenance',t=>{
  const f=installationFixture(t),backend=new ManagementService({...f,root,audit:auditFixture()});t.after(()=>backend.close());
  const now=Date.now(),publish=topologyEvidenceWriter(f),status={devices:[{id:'R1',phase:'partial',lastSuccess:now}],enabled:true,intervalSeconds:30,revision:3};
  const records=Array.from({length:600},(_,i)=>({neighbor:`R${i}`,interface:`Gi0/${i}`,remotePort:'Gi0/1',password:'PRIVATE'}));
  publish({status,snapshots:[{deviceId:'R1',facts:{cdp:{records,observedAt:now,failed:true},interfaceBrief:{records:Array.from({length:600},()=>({interface:'Gi0/1',address:'192.0.2.1',state:'up',protocol:'up'})),observedAt:now,failed:false}}}]});
  const result=retainedTopology(backend.binding);assert.equal(result.nodes.length,401);assert.equal(result.edges.length,400);assert.equal(result.observations.length,500);assert.equal(result.omitted,300);assert.equal(result.truncated,true);assert.equal(result.edges[0].stale,true);assert.equal(result.observations[0].stale,false);assert.equal(result.observations[0].values.state,'up');assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('evidence publication failure neither broadens nor cancels existing collection authorization',async()=>{
  let collects=0;
  const collector=new TopologyService({file:null,getProfile:id=>({id,host:'192.0.2.1',port:22,protocol:'ssh',os:'iosxe'}),knownFingerprint:()=> 'fixed',autoStart:false,collect:async()=>{collects++;return output;},publishEvidence:()=>{throw Error('synthetic disk failure');}});
  try{collector.authorize({authorized:true,devices:[{id:'R1'}],intervalSeconds:30,scopes:['routes','neighbors']});await settle();assert.equal(collects,1);assert.equal(collector.status().enabled,true);assert.match(collector.status().evidenceError,/could not be saved/);collector.revoke();assert.equal(collector.status().enabled,false);assert.equal(collects,1);}finally{collector.stop();}
});

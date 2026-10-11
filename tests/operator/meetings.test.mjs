import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {installationFixture,auditFixture} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

test('meeting context reads only the selected fixed route, preserves source and rechecks the daemon identity',async t=>{
  const f=installationFixture(t),service=new ManagementService({...f,root:path.resolve('.'),audit:auditFixture()});t.after(()=>service.close());
  const calls=[];service.workspace.mobile.client.fetcher=async(url,options)=>{
    const route=new URL(url).pathname;calls.push({route,body:options.body?JSON.parse(options.body):undefined});
    return Response.json(route==='/status'?{installation_id:f.installationId,harness_type:f.kind,federation_ready:true}:{installationId:f.installationId,available:true,id:'meeting',networkObservation:false,entries:[{text:'<script>untrusted meeting text</script>',source:'live Zoom transcript',citation:{meetingId:'meeting'}}]});
  };
  const result=await service.call('operator_workspace',{action:'meeting-read',args:{id:'meeting'}});
  assert.deepEqual(calls.map(row=>row.route),['/status','/n2n/management/meetings','/status']);assert.deepEqual(calls[1].body,{id:'meeting'});
  assert.equal(result.data.networkObservation,false);assert.equal(result.data.entries[0].citation.meetingId,'meeting');assert.match(result.data.entries[0].text,/<script>/);
  assert.equal(service.journal.records('context',service.binding.principal).length,0);
});

test('missing Zoom context is explicit and replacement installation context is never returned',async t=>{
  const f=installationFixture(t),service=new ManagementService({...f,root:path.resolve('.'),audit:auditFixture()});t.after(()=>service.close());
  let replaced=false,statusReads=0;
  service.workspace.mobile.client.fetcher=async url=>Response.json(url.endsWith('/status')?{installation_id:replaced&&++statusReads===2?'other':f.installationId,harness_type:f.kind,federation_ready:true}:{installationId:f.installationId,available:false,reason:'No uniquely bound live process',meetings:[]});
  const result=await service.call('operator_workspace',{action:'meeting-read',args:{}});assert.equal(result.freshness,'unknown');assert.equal(result.data.available,false);
  replaced=true;await assert.rejects(service.call('operator_workspace',{action:'meeting-read',args:{}}),{code:'IDENTITY_CHANGED'});
});

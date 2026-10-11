import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {installationFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';

test('actual mobile control route, pinned WebSocket simulator, detached worker and GAIT preserve one consent request and chunked media',{
  skip:!process.env.NETCLAW_TEST_FEDERATION_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:60000,
},async t=>{
  const f=installationFixture(),root=fileURLToPath(new URL('../../',import.meta.url));let service,worker;
  const child=spawn(process.env.NETCLAW_TEST_FEDERATION_PYTHON,['-u',path.join(root,'tests/operator/mobile-process.py'),f.home],{env:{PATH:process.env.PATH,HOME:f.home,PYTHONNOUSERSITE:'1'},stdio:['pipe','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString();});const closed=once(child,'close'),lines=createInterface({input:child.stdout}),iterator=lines[Symbol.asyncIterator]();
  t.after(async()=>{await service?.close();if(worker){const deadline=Date.now()+5000;while(Date.now()<deadline){try{process.kill(worker,0);}catch{break;}await new Promise(resolve=>setTimeout(resolve,50));}}child.stdin.end();await closed;lines.close();f.cleanup();});
  const ready=await Promise.race([iterator.next().then(({value})=>JSON.parse(value)),closed.then(()=>{throw Error(stderr||'Fixture exited');})]);
  fs.appendFileSync(path.join(f.home,'.env'),`\nBGP_API_PORT=${ready.port}\n`);service=new ManagementService({...f,root});
  const inventory=await service.call('operator_workspace',{action:'mobile-inventory',args:{}});assert.equal(inventory.data.items[0].enrolled,true);assert.equal(inventory.data.items[0].connected,true);
  const preview=await service.call('operator_workspace',{action:'mobile-capture-preview',args:{id:ready.phone,capability:'camera.capture'}});
  const input={action:'mobile-capture-request',nonce:nonce(),args:{id:ready.phone,capability:'camera.capture',consentReference:preview.data.consentReference}};
  const admitted=await service.call('operator_workspace',input);await service.close();service=new ManagementService({...f,root});
  let result;const deadline=Date.now()+30000;
  do{result=await service.call('operator_operation_get',{operationId:admitted.operationId});if(['succeeded','failed','unknown'].includes(result.state))break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);
  worker=JSON.parse(service.journal._row(admitted.operationId).worker||'null')?.pid;
  assert.equal(result.state,'succeeded',JSON.stringify(result));assert.equal(result.result.decision,'captured');assert.equal(result.result.media.bytes,70000);
  assert.equal((await service.call('operator_workspace',input)).operationId,admitted.operationId);
  let offset=0;const chunks=[];
  for(;;){const {data}=await service.call('operator_workspace',{action:'mobile-capture-content',args:{id:admitted.operationId,offset}});assert.equal(data.offset,offset);assert.equal(data.sha256,result.result.media.sha256);chunks.push(Buffer.from(data.content,'base64'));if(data.nextOffset===null)break;offset=data.nextOffset;}
  const bytes=Buffer.concat(chunks);assert.deepEqual(bytes,Buffer.alloc(70000,17));assert.equal(createHash('sha256').update(bytes).digest('hex'),result.result.media.sha256);assert.equal(chunks.length,3);
  child.stdin.write('count\n');assert.equal(JSON.parse((await iterator.next()).value).captures,1);assert.equal((await service.audit.log()).ok,true);assert.equal(child.exitCode,null);
});

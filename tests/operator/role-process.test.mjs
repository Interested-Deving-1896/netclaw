import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('real Risk API, SQLite startup sync, GAIT and independent role worker preserve existing metadata on both harnesses',{
  skip:!process.env.NETCLAW_TEST_FEDERATION_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:90000,
},async()=>{
  for(const kind of ['openclaw','hermes']){
    const f=installationFixture(null,kind);let service,worker;
    const child=spawn(process.env.NETCLAW_TEST_FEDERATION_PYTHON,['-u',path.join(root,'tests/operator/role-process.py'),f.home,kind],{env:{PATH:process.env.PATH,HOME:f.home,PYTHONNOUSERSITE:'1'},stdio:['pipe','pipe','pipe']});
    let stderr='';child.stderr.on('data',bytes=>{stderr+=bytes.toString();});const closed=once(child,'close'),lines=createInterface({input:child.stdout}),iterator=lines[Symbol.asyncIterator]();
    try{
      const ready=await Promise.race([iterator.next().then(({value})=>JSON.parse(value)),closed.then(()=>{throw Error(stderr||'Fixture exited');})]);
      fs.appendFileSync(path.join(f.home,'.env'),`BGP_API_PORT=${ready.port}\n`);const config=fs.readFileSync(f.configPath);
      service=new ManagementService({...f,root});
      for(const role of ['standalone','border','member']){
        const before=await service.risk.snapshot(),prepared=await service.call('operator_change_prepare',{nonce:nonce(),action:'risk.role',targets:[f.installationId],expectedRevision:service.proposals.revision(),patch:{role,acknowledgeActiveWork:true}});
        const input={nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision},op=await service.call('operator_change_apply',input);
        await service.close();service=new ManagementService({...f,root});let result;const deadline=Date.now()+25000;
        do{result=await service.call('operator_operation_get',{operationId:op.operationId});if(!['admitted','running'].includes(result.state))break;await delay(100);}while(Date.now()<deadline);
        assert.equal(result.state,'succeeded',JSON.stringify(result));assert.equal(result.result.pendingRestart,true);
        const saved=await service.risk.snapshot();assert.equal(saved.configuredRole,role);assert.equal(saved.observedRole,before.observedRole);
        assert.equal((await service.call('operator_change_apply',input)).operationId,op.operationId);
        worker=JSON.parse(service.journal._row(op.operationId).worker).pid;
        for(let attempt=0;attempt<100;attempt++){try{process.kill(worker,0);await delay(50);}catch{worker=null;break;}}
        child.stdin.write('startup-sync\n');const sync=JSON.parse((await iterator.next()).value);assert.equal(sync.role,role);assert.equal(sync.metadataPreserved,true);assert.ok(sync.requests.every(route=>['/status','/n2n/risk'].includes(route)));
        const current=await service.risk.snapshot();assert.equal(current.observedRole,role);assert.equal(current.pendingRestart,false);assert.deepEqual(fs.readFileSync(f.configPath),config);
      }
      assert.equal((await service.audit.log()).ok,true);assert.equal(child.exitCode,null);
    }finally{await service?.close();child.stdin.end();await closed;lines.close();f.cleanup();}
  }
});

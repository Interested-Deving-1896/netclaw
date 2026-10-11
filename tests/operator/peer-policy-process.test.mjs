import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {installationFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('real peer policy receiver authenticates private proposal/worker lease, survives facade exit and preserves unrelated permissions on both harnesses',{
  skip:!process.env.NETCLAW_TEST_FEDERATION_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:90000,
},async()=>{
  for(const kind of ['openclaw','hermes']){
    const f=installationFixture(null,kind),peer='as65002-2.2.2.2';let service;
    const child=spawn(process.env.NETCLAW_TEST_FEDERATION_PYTHON,['-u',path.join(root,'tests/operator/role-process.py'),f.home,kind,'--peer-policy'],{env:{PATH:process.env.PATH,HOME:f.home,PYTHONNOUSERSITE:'1'},stdio:['pipe','pipe','pipe']});
    let stderr='';child.stderr.on('data',bytes=>{stderr+=bytes.toString();});const closed=once(child,'close'),lines=createInterface({input:child.stdout}),iterator=lines[Symbol.asyncIterator]();
    try{
      const ready=await Promise.race([iterator.next().then(({value})=>JSON.parse(value)),closed.then(()=>{throw Error(stderr||'Fixture exited');})]);
      fs.appendFileSync(path.join(f.home,'.env'),`BGP_API_PORT=${ready.port}\n`);const config=fs.readFileSync(f.configPath),env=fs.readFileSync(path.join(f.home,'.env'));
      service=new ManagementService({...f,root});
      for(const request of [{action:'apply',operationId:randomUUID(),lease:'forged'},{action:'apply',peer,patch:{chatEnabled:true}},{action:'snapshot',peer,url:'http://example.invalid'}]){
        const response=await fetch(`http://127.0.0.1:${ready.port}/n2n/management/peer-policy`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});assert.equal(response.status,409);
      }
      const snapshot=async()=>(await service.call('operator_workspace',{action:'peer-policy',args:{id:peer}})).data;
      const before=await snapshot();assert.equal(before.policy.chatEnabled,false);assert.equal(before.policy.grants.length,0);assert.equal(before.grantCandidates[0].name,'fixture-mcp/calculate');
      const apply=async(action,patch,expected='succeeded')=>{
        const current=await snapshot(),prepared=await service.call('operator_change_prepare',{nonce:nonce(),action,targets:[f.installationId,peer],expectedRevision:current.revision,patch:{acknowledgeActiveWork:true,...patch}});
        const input={nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision};
        const admitted=await service.call('operator_change_apply',input);await service.close();service=new ManagementService({...f,root});
        let result;const deadline=Date.now()+20000;
        do{result=await service.call('operator_operation_get',{operationId:admitted.operationId});if(!['admitted','running'].includes(result.state))break;await pause(80);}while(Date.now()<deadline);
        assert.equal(result.state,expected,JSON.stringify(result));
        assert.equal((await service.call('operator_change_apply',input)).operationId,admitted.operationId);
        const worker=JSON.parse(service.journal._row(admitted.operationId).worker).pid;
        for(let i=0;i<100;i++){try{process.kill(worker,0);await pause(30);}catch{break;}}
        return result;
      };
      await apply('peer.trust',{chatEnabled:true,grant:{type:'tool',name:'fixture-mcp/calculate',requiresApproval:true,timeoutSeconds:30}});
      let observed=await snapshot();assert.equal(observed.policy.chatEnabled,true);assert.equal(observed.policy.grants.length,1);assert.equal(observed.policy.grants[0].requires_approval,1);
      const grantId=observed.policy.grants[0].id;
      await apply('peer.untrust',{disableChat:true});observed=await snapshot();assert.equal(observed.policy.chatEnabled,false);assert.equal(observed.policy.grants[0].id,grantId);
      await apply('peer.untrust',{revokeGrantIds:[grantId]});observed=await snapshot();assert.equal(observed.policy.grants.length,0);
      assert.deepEqual(observed.policy.consent,before.policy.consent);assert.equal(observed.policy.state,before.policy.state);
      // Inspect actual receiver admission against real private journal rows.
      // Test-owned state simulates the worker's executing phase; every tampered
      // request below must be refused before any peer policy mutation.
      const prepared=await service.call('operator_change_prepare',{nonce:nonce(),action:'peer.trust',targets:[f.installationId,peer],expectedRevision:observed.revision,patch:{chatEnabled:true,acknowledgeActiveWork:true}});
      const input={nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision},operation=service.proposals.admitApply(service.binding.principal,input),lease=service.journal.claim(operation.operationId,{pid:process.pid,source:'synthetic denial harness'});
      const proposal={...service.journal.record('proposal',prepared.proposalId,service.binding.principal),state:'executing'};
      const save=value=>service.journal.put('proposal',prepared.proposalId,service.binding.principal,value,{replace:true});save(proposal);
      const denied=async(candidateLease=lease)=>{const response=await fetch(`http://127.0.0.1:${ready.port}/n2n/management/peer-policy`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'apply',operationId:operation.operationId,lease:candidateLease})});assert.equal(response.status,409);};
      await denied('wrong-lease');
      const row=service.journal._row(operation.operationId);service.journal.db.prepare('UPDATE operations SET lease_until=? WHERE id=?').run(Date.now()-1,operation.operationId);await denied();service.journal.db.prepare('UPDATE operations SET lease_until=? WHERE id=?').run(row.lease_until,operation.operationId);
      save({...proposal,targets:[f.installationId,'different-peer']});await denied();
      save({...proposal,originAuthority:{...proposal.originAuthority,surface:'assistant'}});await denied();
      save({...proposal,patch:{acknowledgeActiveWork:true,grant:{type:'tool',name:'fixture-mcp/calculate',requiresApproval:false,timeoutSeconds:30}}});await denied();save(proposal);
      const artifact=path.join(service.journal.directory,'artifacts',proposal.baseline.id),bytes=fs.readFileSync(artifact);fs.writeFileSync(artifact,'{}');await denied();fs.writeFileSync(artifact,bytes);
      service.journal.finish(operation.operationId,lease,'failed',{source:'Completed synthetic denial cases; no dispatch'});
      const unchanged=await snapshot();assert.equal(unchanged.policy.revision,observed.policy.revision);assert.equal(unchanged.policy.chatEnabled,false);assert.equal(unchanged.policy.grants.length,0);
      child.stdin.write('drop-next-policy-reply\n');assert.equal(JSON.parse((await iterator.next()).value).armed,true);
      const recovered=await apply('peer.trust',{chatEnabled:true},'rolled-back');assert.equal(recovered.result.recoveryVerified,true);assert.equal(recovered.result.approvalClosed,false);
      assert.equal((await snapshot()).policy.chatEnabled,false);
      child.stdin.write('set-live-production\n');assert.equal(JSON.parse((await iterator.next()).value).production,true);
      assert.equal((await snapshot()).production,true);
      const production=await apply('peer.trust',{chatEnabled:true},'failed');assert.equal(production.result.code,'DENIED');assert.equal((await snapshot()).policy.chatEnabled,false);
      assert.equal((await service.audit.log()).ok,true);assert.deepEqual(fs.readFileSync(f.configPath),config);assert.deepEqual(fs.readFileSync(path.join(f.home,'.env')),env);
    }finally{await service?.close();child.stdin.end();await closed;lines.close();f.cleanup();}
  }
});

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
test('actual peer execution receiver/journal/detached worker/GAIT retain receipts across facade loss on both harnesses',{
  skip:!process.env.NETCLAW_TEST_FEDERATION_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:90000,
},async()=>{
  for(const kind of ['openclaw','hermes']){
    const f=installationFixture(null,kind),peer='as65002-2.2.2.2';let service;
    const child=spawn(process.env.NETCLAW_TEST_FEDERATION_PYTHON,['-u',path.join(root,'tests/operator/role-process.py'),f.home,kind,'--peer-execution'],{env:{PATH:process.env.PATH,HOME:f.home,PYTHONNOUSERSITE:'1'},stdio:['pipe','pipe','pipe']});
    let stderr='';child.stderr.on('data',bytes=>{stderr+=bytes.toString();});const closed=once(child,'close'),lines=createInterface({input:child.stdout}),iterator=lines[Symbol.asyncIterator]();
    try{
      const ready=await Promise.race([iterator.next().then(({value})=>JSON.parse(value)),closed.then(()=>{throw Error(stderr||'Fixture exited');})]);
      fs.appendFileSync(path.join(f.home,'.env'),`BGP_API_PORT=${ready.port}\n`);const config=fs.readFileSync(f.configPath),env=fs.readFileSync(path.join(f.home,'.env'));
      service=new ManagementService({...f,root});
      const request=async body=>fetch(`http://127.0.0.1:${ready.port}/n2n/management/peer-execution`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      for(const body of [{action:'start',operationId:randomUUID(),lease:'forged'},{action:'start',peer,cidr:'0.0.0.0/0'},{action:'snapshot',peer,url:'http://example.invalid'}])assert.equal((await request(body)).status,409);
      const prepare=async mode=>{const review=(await service.call('operator_workspace',{action:'peer-execution-preview',args:{peer,mode,cidr:'192.0.2.0/24'}})).data;return {review,input:{action:'peer-execution-submit',nonce:nonce(),args:{reviewId:review.reviewId}}};};
      const finish=async id=>{
        let result;const deadline=Date.now()+20000;
        do{result=await service.call('operator_operation_get',{operationId:id});if(['succeeded','failed','cancelled'].includes(result.state))break;await pause(100);}while(Date.now()<deadline);
        assert.equal(result.state,'succeeded',JSON.stringify(result));assert.equal(result.result.peer,peer);
        const worker=JSON.parse(service.journal._row(id).worker).pid;for(let i=0;i<100;i++){try{process.kill(worker,0);await pause(30);}catch{break;}}
      };
      const first=await prepare('tool'),admitted=await service.call('operator_workspace',first.input);await service.close();service=new ManagementService({...f,root});await finish(admitted.operationId);
      assert.equal((await service.call('operator_workspace',first.input)).operationId,admitted.operationId);
      child.stdin.write('drop-next-execution-reply\n');assert.equal(JSON.parse((await iterator.next()).value).armed,true);
      const second=await prepare('skill'),next=await service.call('operator_workspace',second.input);await finish(next.operationId);
      const candidate=await prepare('tool'),principal=service.binding.principal,op=service.journal.admit(principal,candidate.input.nonce,'peer-execution',candidate.input),lease=service.journal.claim(op.operationId,{pid:process.pid,source:'synthetic denial harness'});
      const denied=async(value=lease)=>assert.equal((await request({action:'start',operationId:op.operationId,lease:value})).status,409);
      await denied('wrong-lease');const row=service.journal._row(op.operationId);
      for(const [column,value] of [['lease_until',Date.now()-1],['owner',JSON.stringify(['assistant','forged',1])],['input',JSON.stringify({...candidate.input,args:{reviewId:randomUUID()}})],['state','succeeded']]){
        service.journal.db.prepare(`UPDATE operations SET ${column}=? WHERE id=?`).run(value,op.operationId);await denied();service.journal.db.prepare(`UPDATE operations SET ${column}=? WHERE id=?`).run(row[column],op.operationId);
      }
      const saved=service.journal.record('peer-execution-review',candidate.review.reviewId,principal);
      for(const value of [{...saved,expiresAt:0},{...saved,selection:{...saved.selection,cidr:'0.0.0.0/0'}},{...saved,selection:{...saved.selection,arguments:{command:'unsafe'}}}]){
        service.journal.put('peer-execution-review',candidate.review.reviewId,principal,value,{replace:true});await denied();
      }
      service.journal.put('peer-execution-review',candidate.review.reviewId,principal,saved,{replace:true});service.journal.finish(op.operationId,lease,'failed',{source:'Denial fixtures complete; no remote call'});
      child.stdin.write('check-execution\n');const report=JSON.parse((await iterator.next()).value);assert.equal(report.tasks,2);assert.deepEqual(report.calls.map(row=>row.method),['n2n/tools/call','n2n/tasks/submit','n2n/tasks/result']);
      assert.equal(report.calls[0].body.request_id,admitted.operationId);assert.equal(report.calls[1].body.request_id,next.operationId);
      assert.equal((await service.audit.log()).ok,true);assert.deepEqual(fs.readFileSync(f.configPath),config);assert.deepEqual(fs.readFileSync(path.join(f.home,'.env')),env);
    }finally{await service?.close();child.stdin.end();await closed;lines.close();f.cleanup();}
  }
});

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
test('real peer-chat receiver/private journal/detached worker/GAIT preserve admission and reconcile lost receipts on both harnesses',{
  skip:!process.env.NETCLAW_TEST_FEDERATION_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:90000,
},async()=>{
  for(const kind of ['openclaw','hermes']){
    const f=installationFixture(null,kind),peer='as65002-2.2.2.2';let service;
    const child=spawn(process.env.NETCLAW_TEST_FEDERATION_PYTHON,['-u',path.join(root,'tests/operator/role-process.py'),f.home,kind,'--peer-chat'],{env:{PATH:process.env.PATH,HOME:f.home,PYTHONNOUSERSITE:'1'},stdio:['pipe','pipe','pipe']});
    let stderr='';child.stderr.on('data',bytes=>{stderr+=bytes.toString();});const closed=once(child,'close'),lines=createInterface({input:child.stdout}),iterator=lines[Symbol.asyncIterator]();
    try{
      const ready=await Promise.race([iterator.next().then(({value})=>JSON.parse(value)),closed.then(()=>{throw Error(stderr||'Fixture exited');})]);
      fs.appendFileSync(path.join(f.home,'.env'),`BGP_API_PORT=${ready.port}\n`);const config=fs.readFileSync(f.configPath),env=fs.readFileSync(path.join(f.home,'.env'));
      service=new ManagementService({...f,root});
      const request=async body=>fetch(`http://127.0.0.1:${ready.port}/n2n/management/peer-chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      for(const body of [{action:'start',operationId:randomUUID(),lease:'forged'},{action:'start',peer,text:'Injected prompt'},{action:'snapshot',peer,url:'http://example.invalid'}])assert.equal((await request(body)).status,409);
      const prepare=async conversationId=>{
        const text='Reviewed synthetic process question',review=(await service.call('operator_workspace',{action:'peer-chat-preview',args:{peer,text,...(conversationId?{conversationId}:{})}})).data;
        return {review,input:{action:'peer-chat-submit',nonce:nonce(),args:{peer,text,reviewId:review.reviewId}}};
      };
      const finish=async id=>{
        let result;const deadline=Date.now()+20000;
        do{result=await service.call('operator_operation_get',{operationId:id});if(['succeeded','failed','cancelled'].includes(result.state))break;await pause(100);}while(Date.now()<deadline);
        assert.equal(result.state,'succeeded',JSON.stringify(result));assert.equal(result.result.result.text,'Synthetic external peer response');
        const worker=JSON.parse(service.journal._row(id).worker).pid;
        for(let i=0;i<100;i++){try{process.kill(worker,0);await pause(30);}catch{break;}}
      };
      const first=await prepare(),admitted=await service.call('operator_workspace',first.input);
      await service.close();service=new ManagementService({...f,root});await finish(admitted.operationId);
      assert.equal((await service.call('operator_workspace',first.input)).operationId,admitted.operationId);
      child.stdin.write('drop-next-chat-reply\n');assert.equal(JSON.parse((await iterator.next()).value).armed,true);
      const follow=await prepare(first.review.conversationId),second=await service.call('operator_workspace',follow.input);await finish(second.operationId);
      // Exercise real SQL admission with a test-owned worker row, without
      // allowing any of these mutated records to send a peer message.
      const candidate=await prepare(),principal=service.binding.principal,op=service.journal.admit(principal,candidate.input.nonce,'peer-chat',candidate.input),lease=service.journal.claim(op.operationId,{pid:process.pid,source:'synthetic denial harness'});
      service.journal.put('peer-conversation',candidate.review.conversationId,principal,{installationId:f.installationId,peer,createdAt:new Date().toISOString()});
      const denied=async(value=lease)=>assert.equal((await request({action:'start',operationId:op.operationId,lease:value})).status,409);
      await denied('wrong-lease');
      const row=service.journal._row(op.operationId),update=(column,value)=>{assert.ok(['lease_until','owner','input','state'].includes(column));service.journal.db.prepare(`UPDATE operations SET ${column}=? WHERE id=?`).run(value,op.operationId);};
      for(const [column,value] of [['lease_until',Date.now()-1],['owner',JSON.stringify(['assistant','forged',1])],['input',JSON.stringify({...candidate.input,args:{...candidate.input.args,text:'Altered after review'}})],['state','succeeded']]){update(column,value);await denied();update(column,row[column]);}
      const review=service.journal.record('peer-chat-review',candidate.review.reviewId,principal);
      service.journal.put('peer-chat-review',candidate.review.reviewId,principal,{...review,expiresAt:0},{replace:true});await denied();
      service.journal.put('peer-chat-review',candidate.review.reviewId,principal,review,{replace:true});
      const identityFile=path.join(f.home,'netclaw-hud/installation.json'),identity=fs.readFileSync(identityFile);fs.writeFileSync(identityFile,JSON.stringify({schemaVersion:1,installationId:randomUUID()}));await denied();fs.writeFileSync(identityFile,identity);
      service.journal.finish(op.operationId,lease,'failed',{source:'Completed denial cases; no peer dispatch'});
      child.stdin.write('check-chat\n');const report=JSON.parse((await iterator.next()).value);assert.equal(report.tasks,2);assert.deepEqual(report.calls.map(row=>row.method),['n2n/chat/open','n2n/chat/message','n2n/chat/message']);
      assert.equal((await service.audit.log()).ok,true);assert.deepEqual(fs.readFileSync(f.configPath),config);assert.deepEqual(fs.readFileSync(path.join(f.home,'.env')),env);
    }finally{await service?.close();child.stdin.end();await closed;lines.close();f.cleanup();}
  }
});

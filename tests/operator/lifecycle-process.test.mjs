import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const exec=promisify(execFile),root=fileURLToPath(new URL('../../',import.meta.url));

test('actual isolated Mac launchd gateway start/restart/stop survives facade exit and preserves backend configuration',{
  skip:process.platform!=='darwin'||process.env.NETCLAW_TEST_LIVE_SERVICES!=='1'||!process.env.NETCLAW_TEST_OPENCLAW_ENTRY||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:180000,
},async()=>{
  const f=installationFixture(),label=`ai.netclaw.spec150.${f.installationId}`,directory=path.join(os.homedir(),'Library/LaunchAgents'),definition=path.join(directory,label+'.plist');
  fs.mkdirSync(directory,{recursive:true});let service,created=false;
  try{
    const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
    const workspace=path.join(f.home,'workspace');fs.mkdirSync(workspace,{mode:0o700});
    fs.writeFileSync(f.configPath,JSON.stringify({models:{providers:{fixture:{baseUrl:'http://127.0.0.1:9/v1',apiKey:'${OPENAI_API_KEY}',api:'openai-completions',models:[{id:'hud-fixture',name:'hud-fixture',contextWindow:64000,maxTokens:4096}]}}},agents:{defaults:{model:{primary:'fixture/hud-fixture'},workspace}},tools:{deny:['*']},gateway:{mode:'local',port,auth:{mode:'token',token:'${OPENCLAW_GATEWAY_TOKEN}'}}}));
    fs.writeFileSync(path.join(f.home,'.env'),'OPENCLAW_GATEWAY_TOKEN=fixture-service-private-token\nOPENAI_API_KEY=fixture-only\n');
    const baseline=fs.readFileSync(f.configPath),environment=fs.readFileSync(path.join(f.home,'.env')),log=path.join(f.root,'service.log');fs.writeFileSync(log,'',{mode:0o600});
    const plist={Label:label,ProgramArguments:[process.execPath,process.env.NETCLAW_TEST_OPENCLAW_ENTRY,'gateway','run','--port',String(port),'--bind','loopback'],EnvironmentVariables:{HOME:f.home,PATH:`${path.dirname(process.execPath)}:${process.env.PATH}`,OPENCLAW_STATE_DIR:f.home,OPENCLAW_CONFIG_PATH:f.configPath},RunAtLoad:true,KeepAlive:false,StandardOutPath:log,StandardErrorPath:log};
    const bytes=execFileSync('python3',['-c','import json,plistlib,sys;sys.stdout.buffer.write(plistlib.dumps(json.load(sys.stdin)))'],{input:JSON.stringify(plist)});
    fs.writeFileSync(definition,bytes,{flag:'wx',mode:0o600});created=true;
    service=new ManagementService({...f,root});
    await service.services.register({id:'gateway',manager:'launchd',unit:label,definitionPath:definition},{reviewed:true,audit:service.audit});
    async function change(action){
      const identity=await service.call('operator_identity',{}),prepared=await service.call('operator_change_prepare',{nonce:nonce(),action,targets:[f.installationId],expectedRevision:identity.configurationRevision,patch:{serviceId:'gateway',acknowledgeActiveWork:true}});
      const op=await service.call('operator_change_apply',{nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision});
      // Disconnect immediately after admission; the owned worker controls only
      // this fixture's registered service and remains independent of the facade.
      await service.close();service=new ManagementService({...f,root});
      const deadline=Date.now()+45000;let result;
      do{result=await service.call('operator_operation_get',{operationId:op.operationId});if(['succeeded','failed','denied','rolled-back','rollback-failed','unknown'].includes(result.state))break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);
      assert.equal(result.state,'succeeded',JSON.stringify(result));
      assert.deepEqual(fs.readFileSync(f.configPath),baseline);assert.deepEqual(fs.readFileSync(path.join(f.home,'.env')),environment);
      assert.deepEqual(fs.readFileSync(definition),bytes);return result;
    }
    await change('service.start');const first=await service.services.inspect('gateway');assert.equal(first.active,true);assert.ok(first.pid>0);
    await change('service.restart');const second=await service.services.inspect('gateway');assert.equal(second.active,true);assert.notEqual(second.pid,first.pid);
    await change('service.stop');assert.equal((await service.services.inspect('gateway')).active,false);
    console.log(JSON.stringify({platform:process.platform,os:os.release(),actions:['start','restart','stop'],configurationPreserved:true,facadeExitPreserved:true,scope:'Unique disposable launchd label and synthetic gateway home; no inference or owner service changes'}));
  }finally{
    // Only the definition created with wx above and its unique test label.
    if(created){
      await exec('/bin/launchctl',['bootout',`gui/${process.getuid()}/${label}`],{timeout:15000}).catch(()=>{});
      if(fs.existsSync(definition))fs.unlinkSync(definition);
    }
    await service?.close();f.cleanup();
  }
});

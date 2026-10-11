import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
import {startPackageRuntime} from '../vscode/live-package-runtime.mjs';
import {resolveRuntime} from '../../scripts/runtime-selection.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const enabled=process.env.NETCLAW_TEST_OPENCLAW_ENTRY&&process.env.NETCLAW_TEST_HERMES_PYTHON&&process.env.NETCLAW_TEST_HERMES_SOURCE&&process.env.NETCLAW_HUD_BRIDGE_PYTHON&&process.env.NETCLAW_TEST_LIVE_GAIT==='1';
test('real OpenClaw and pinned Hermes remain running through both-direction durable default selection with no inference', {skip:!enabled,timeout:180000},async()=>{
  const openclaw=installationFixture(),hermes=installationFixture(null,'hermes');let live,companion,left,right;
  try{
    live=await startPackageRuntime(root,openclaw);
    const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    const key='fixture-only-selection-companion-key';
    fs.writeFileSync(hermes.configPath,JSON.stringify({model:{default:'hud-fixture',provider:'custom',base_url:'http://127.0.0.1:9/v1'},mcp_servers:{}}));
    fs.writeFileSync(path.join(hermes.home,'.env'),`NETCLAW_HERMES_HUD_API_KEY=${key}\nNETCLAW_HERMES_HUD_PORT=${port}\nOPENAI_API_KEY=fixture-only\n`);
    const log=fs.openSync(path.join(hermes.root,'companion.log'),'wx',0o600);
    companion=spawn(process.env.NETCLAW_TEST_HERMES_PYTHON,['-u',path.join(root,'mcp-servers/hermes-hud-mcp/hermes_api.py'),'--home',hermes.home,'--source',process.env.NETCLAW_TEST_HERMES_SOURCE,'--installation',hermes.installationId,'--port',String(port)],{
      env:{PATH:process.env.PATH,HOME:hermes.home,HERMES_HOME:hermes.home,NETCLAW_HERMES_HUD_API_KEY:key,OPENAI_API_KEY:'fixture-only',OPENAI_BASE_URL:'http://127.0.0.1:9/v1',PYTHON_DOTENV_DISABLED:'1'},stdio:['ignore',log,log]});fs.closeSync(log);
    left=new ManagementService({...openclaw,root});right=new ManagementService({...hermes,root});let ready=false;
    for(let attempt=0;attempt<100;attempt++){assert.equal(companion.exitCode,null);try{ready=(await right.runtime.readiness()).ready;if(ready)break;}catch{}await delay(250);}
    assert.equal(ready,true,'actual pinned companion readiness');
    const selectorDirectory=path.join(openclaw.root,'config/netclaw');fs.mkdirSync(selectorDirectory,{recursive:true,mode:0o700});const selectorPath=path.join(selectorDirectory,'runtime.json');
    fs.writeFileSync(selectorPath,JSON.stringify({schemaVersion:1,kind:'openclaw',home:openclaw.home,configPath:openclaw.configPath}),{mode:0o600});
    const preserved=[openclaw.configPath,path.join(openclaw.home,'.env'),hermes.configPath,path.join(hermes.home,'.env')].map(file=>[file,fs.readFileSync(file)]);
    for(const [source,target] of [[left,hermes],[right,openclaw]])await source.runtimeSelection.register({selectorPath,home:target.home,kind:target.kind,installationId:target.installationId},{reviewed:true,audit:source.audit});
    async function select(source,fixture,target){
      const prepared=await source.call('operator_change_prepare',{nonce:nonce(),action:'runtime.select',targets:[fixture.installationId,target.installationId],expectedRevision:source.proposals.revision(),patch:{runtimeId:target.installationId,acknowledgeActiveWork:true}});
      const input={nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision},op=await source.call('operator_change_apply',input);
      await source.close();const observer=new ManagementService({...fixture,root});
      try{
        let outcome;const deadline=Date.now()+60000;
        do{outcome=await observer.call('operator_operation_get',{operationId:op.operationId});if(!['admitted','running'].includes(outcome.state))break;await delay(100);}while(Date.now()<deadline);
        assert.equal(outcome.state,'succeeded',JSON.stringify(outcome));assert.equal((await observer.call('operator_change_apply',input)).operationId,op.operationId);
        assert.equal(observer.binding.installationId,fixture.installationId,'original connection remains pinned');
        const selected=resolveRuntime({env:{HOME:openclaw.root,XDG_CONFIG_HOME:path.join(openclaw.root,'config')}});assert.equal(selected.installationId,target.installationId);
        assert.equal((await observer.runtime.readiness()).ready,true);await live.verify(0);assert.equal(companion.exitCode,null);process.kill(companion.pid,0);
        for(const [file,bytes] of preserved)assert.deepEqual(fs.readFileSync(file),bytes);
        assert.equal(fs.existsSync(selectorPath+'.lock'),false);
        const pid=JSON.parse(observer.journal._row(op.operationId).worker).pid;
        for(let attempt=0;attempt<100;attempt++){try{process.kill(pid,0);await delay(50);}catch{break;}}
      }finally{await observer.close();}
    }
    await select(left,openclaw,hermes);left=null;await select(right,hermes,openclaw);right=null;
    console.log(JSON.stringify({platform:process.platform,source:'Actual OpenClaw and Hermes companion; installation-specific GAIT and detached management workers',directions:['OpenClaw to Hermes default','Hermes to OpenClaw default'],processesPreserved:true,configurationPreserved:true,providerRequests:0,scope:'Default selector only; no service migration or real estate role transition'}));
  }finally{
    await left?.close();await right?.close();if(companion&&companion.exitCode===null){companion.kill('SIGTERM');await once(companion,'exit').catch(()=>{});}await live?.close();hermes.cleanup();openclaw.cleanup();
  }
});

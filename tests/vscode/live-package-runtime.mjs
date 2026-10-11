import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** Opt-in, installed OpenClaw process with loopback-only synthetic provider and
 * brand-new home. No owner service, configuration or provider is selected. */
export async function startPackageRuntime(root,fixture,{intentReport=false}={}){
  if(!process.env.NETCLAW_TEST_OPENCLAW_ENTRY)return null;
  assert.equal(process.env.NETCLAW_TEST_LIVE_GAIT,'1','Real package conversations require installation-specific GAIT');
  const children=[];
  const close=async()=>{for(const child of children.reverse())if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit').catch(()=>{});}};
  try{
    const provider=spawn('python3',['-u',path.join(root,'tests/operator/controlled-provider.py'),...(intentReport?['--intent-report']:[])],{stdio:['pipe','pipe','ignore']});children.push(provider);
    const lines=createInterface({input:provider.stdout}),iterator=lines[Symbol.asyncIterator](),{url}=JSON.parse((await iterator.next()).value);
    const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    const workspace=path.join(fixture.home,'workspace');fs.mkdirSync(workspace,{mode:0o700});
    fs.writeFileSync(fixture.configPath,JSON.stringify({models:{providers:{fixture:{baseUrl:url,apiKey:'${OPENAI_API_KEY}',api:'openai-completions',models:[{id:'hud-fixture',name:'hud-fixture',contextWindow:64000,maxTokens:4096}]}}},agents:{defaults:{model:{primary:'fixture/hud-fixture'},workspace}},tools:{deny:['*']},gateway:{mode:'local',port,auth:{mode:'token',token:'${OPENCLAW_GATEWAY_TOKEN}'}}}),{mode:0o600});
    fs.writeFileSync(path.join(fixture.home,'.env'),'OPENCLAW_GATEWAY_TOKEN=fixture-package-private-token\nOPENAI_API_KEY=fixture-only\n',{mode:0o600});
    if(intentReport){const config=JSON.parse(fs.readFileSync(fixture.configPath));config.gateway.http={endpoints:{chatCompletions:{enabled:true}}};fs.writeFileSync(fixture.configPath,JSON.stringify(config),{mode:0o600});}
    const log=fs.openSync(path.join(fixture.root,'gateway.log'),'wx',0o600);
    const gateway=spawn(process.execPath,[process.env.NETCLAW_TEST_OPENCLAW_ENTRY,'gateway','run','--port',String(port),'--bind','loopback'],{
      env:{PATH:`${path.dirname(process.execPath)}:${process.env.PATH}`,HOME:fixture.home,OPENCLAW_STATE_DIR:fixture.home,OPENCLAW_CONFIG_PATH:fixture.configPath,OPENCLAW_GATEWAY_TOKEN:'fixture-package-private-token',OPENAI_API_KEY:'fixture-only'},stdio:['ignore',log,log]});fs.closeSync(log);children.push(gateway);
    const service=new ManagementService({...fixture,root});let ready=false;
    try{for(let attempt=0;attempt<120;attempt++){
      assert.equal(gateway.exitCode,null,'isolated gateway remains running');
      try{ready=(await service.runtime.readiness()).ready;if(ready)break;}catch{}
      await delay(250);
    }}finally{await service.close();}
    assert.equal(ready,true,'real package runtime ready');
    return {close,async verify(expectedRequests){assert.equal(gateway.exitCode,null,'VSIX lifecycle must preserve the independent gateway');process.kill(gateway.pid,0);provider.stdin.write('count\n');const observed=JSON.parse((await iterator.next()).value).requests;assert.equal(observed,expectedRequests,'VSIX lifecycle must not replay provider work');},
      async release(){await fetch(new URL('/__fixture/release',url),{method:'POST',headers:{'content-type':'application/json'},body:'{}'});},
      version:'Installed OpenClaw executable; controlled loopback provider'};
  }catch(error){await close();throw error;}
}

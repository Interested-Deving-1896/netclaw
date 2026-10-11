import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {installationFixture,nonce} from '../operator/fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const require=createRequire(new URL('../../mcp-servers/netclaw-operator-mcp/package.json',import.meta.url));
const {Client}=require('@modelcontextprotocol/client'),{StdioClientTransport}=require('@modelcontextprotocol/client/stdio');
const root=fileURLToPath(new URL('../../',import.meta.url)),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const enabled=process.env.NETCLAW_TEST_FEDERATION_PYTHON&&process.env.NETCLAW_HERMES_PYTHON&&process.env.NETCLAW_HERMES_SOURCE&&process.env.NETCLAW_SUBNET_PYTHON&&process.env.NETCLAW_TEST_LIVE_GAIT==='1';

test('actual assistant MCP, detached worker and protected Hermes enforce source grant through tool execution and revocation',{skip:!enabled,timeout:180000},async t=>{
  const f=installationFixture(null,'hermes'),clients=[];let service;
  const log=fs.openSync(path.join(f.root,'fixture.log'),'wx',0o600);
  const child=spawn(process.env.NETCLAW_TEST_FEDERATION_PYTHON,['-u',path.join(root,'tests/assistant-clients/hermes-fixture.py'),f.home],{env:process.env,stdio:['pipe','pipe',log]});
  fs.closeSync(log);
  t.after(async()=>{for(const client of clients)await client.close().catch(()=>{});await service?.close();if(child.exitCode===null){child.stdin.end();child.kill('SIGTERM');await once(child,'exit');}f.cleanup();});
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  const started=await Promise.race([lines.next(),once(child,'exit').then(()=>{throw Error('Fixture exited: '+fs.readFileSync(path.join(f.root,'fixture.log'),'utf8'));})]);
  assert.equal(started.done,false);const fixture=JSON.parse(started.value);assert.equal(fixture.installationId,f.installationId);
  const config=fs.readFileSync(f.configPath);service=new ManagementService({...f,root});
  const proposal=await service.clients.prepare(service.binding.principal,{nonce:nonce(),client:'codex',actions:['inspect','delegate','cancel','evidence'],targets:[f.installationId],disclosure:['summary','conversation','usage'],expiresAt:Date.now()+3600000});
  const grant=(await service.clients.apply(service.binding.principal,{nonce:nonce(),proposalId:proposal.proposalId,expectedRevision:proposal.expectedRevision})).result;
  const connect=async()=>{const client=new Client({name:'spec150-real-assistant-test',version:'1.0.0'});clients.push(client);
    await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'scripts/netclaw-assistant.mjs'),'--home',f.home,'--runtime','hermes','--installation',f.installationId,'--grant-ref',grant.credentialRef],stderr:'ignore'}));return client;};
  const call=async(client,name,args)=>{const result=await client.callTool({name,arguments:args},{timeout:30000});assert.equal(result.isError,undefined,JSON.stringify(result));return result.structuredContent;};
  const terminal=async id=>{for(let n=0;n<400;n++){const value=await service.call('operator_operation_get',{operationId:id});if(['succeeded','failed','cancelled','unknown'].includes(value.state))return value;await pause(100);}throw Error('Request deadline exceeded');};
  const count=async()=>(await (await fetch(new URL('/__fixture/count',fixture.url))).json()).inferences;
  let client=await connect();assert.equal((await client.listTools()).tools.length,7);
  const input={nonce:nonce(),prompt:'SUBNET'},admitted=await call(client,'netclaw_request',input);await client.close();
  const result=await terminal(admitted.operationId);assert.equal(result.state,'succeeded',JSON.stringify(result));assert.match(result.result.output,/192\.0\.2\./);
  const requests=await count();assert.equal(requests,2);client=await connect();assert.equal((await call(client,'netclaw_request',input)).operationId,admitted.operationId);assert.equal(await count(),requests);
  const ledger=new DatabaseSync(path.join(f.home,'netclaw-federation/ledger.db'),{readOnly:true});t.after(()=>ledger.close());
  assert.ok(ledger.prepare("SELECT 1 FROM evidence WHERE request=? AND state='completed' AND tool LIKE '%subnet_calculator'").get(admitted.operationId));
  const forged=await call(client,'netclaw_request',{nonce:nonce(),prompt:'FORGED_SHELL'}),refused=await terminal(forged.operationId);
  assert.equal(refused.state,'failed',JSON.stringify(refused));assert.equal(ledger.prepare('SELECT COUNT(*) AS n FROM evidence WHERE request=?').get(forged.operationId).n,0);
  const before=await count(),pending=await call(client,'netclaw_request',{nonce:nonce(),prompt:'WAIT_FOR_TEST SUBNET'});
  for(let n=0;n<200&&await count()===before;n++)await pause(100);assert.equal(await count(),before+1);
  await service.clients.revoke(service.binding.principal,{nonce:nonce(),grantId:grant.grantId});
  const denied=await client.callTool({name:'netclaw_request_status',arguments:{requestId:pending.operationId}});assert.equal(denied.isError,true);
  await pause(500);await fetch(new URL('/__fixture/release',fixture.url),{method:'POST',body:'{}'});
  const stopped=await terminal(pending.operationId);assert.ok(['failed','cancelled'].includes(stopped.state),JSON.stringify(stopped));
  assert.equal(ledger.prepare("SELECT COUNT(*) AS n FROM evidence WHERE request=? AND state='completed'").get(pending.operationId).n,0);assert.equal(await count(),before+1);
  assert.deepEqual(fs.readFileSync(f.configPath),config);assert.equal(child.exitCode,null);process.kill(fixture.companionPid,0);
  for(const row of service.journal.db.prepare("SELECT worker FROM operations WHERE kind='assistant-request' AND worker IS NOT NULL").all()){
    const pid=JSON.parse(row.worker).pid;for(let n=0;n<100;n++){try{process.kill(pid,0);await pause(50);}catch{break;}}
  }
});

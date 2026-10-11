import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {installationFixture,nonce,auditFixture} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
import {assistantCall} from '../../mcp-servers/netclaw-assistant-mcp/server.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('actual daemon estate handler and SQLite/cache process returns 100 mixed members/peers without peer contact or writes',{
  skip:!process.env.NETCLAW_TEST_FEDERATION_PYTHON,timeout:45000,
},async t=>{
  for(const kind of ['openclaw','hermes']){
    const f=installationFixture(null,kind);let service;
    const child=spawn(process.env.NETCLAW_TEST_FEDERATION_PYTHON,['-u',path.join(root,'tests/operator/role-process.py'),f.home,kind,'--estate'],{env:{PATH:process.env.PATH,HOME:f.home,PYTHONNOUSERSITE:'1'},stdio:['pipe','pipe','pipe']});
    let stderr='';child.stderr.on('data',bytes=>{stderr+=bytes.toString();});const closed=once(child,'close'),lines=createInterface({input:child.stdout}),iterator=lines[Symbol.asyncIterator]();
    try{
      const ready=await Promise.race([iterator.next().then(({value})=>JSON.parse(value)),closed.then(()=>{throw Error(stderr||'Fixture exited');})]);
      fs.appendFileSync(path.join(f.home,'.env'),`BGP_API_PORT=${ready.port}\n`);const config=fs.readFileSync(f.configPath);
      service=new ManagementService({...f,root,audit:auditFixture()});
      const durations=[];
      for(let run=0;run<20;run++){
        const start=performance.now();
        const peers=await service.call('operator_resources',{kind:'peer',limit:100});
        const members=await service.call('operator_resources',{kind:'member',limit:100});
        durations.push(performance.now()-start);
        assert.equal(peers.data.total,100);assert.equal(members.data.total,100);
        assert.deepEqual([...new Set(peers.data.items.map(row=>row.harness.type))].sort(),['hermes','openclaw']);
        assert.equal(peers.data.items[0].inventory.counts.tools,1000);assert.equal(peers.data.items[0].capabilities.length,0);
        assert.equal(members.data.items[0].stale,true);assert.equal(members.data.items[0].executionVerified,null);
      }
      const p95=durations.toSorted((a,b)=>a-b)[18];t.diagnostic(JSON.stringify({harness:kind,p95Ms:p95,samples:20,scope:'Actual local HTTP fixture transport, shipped daemon handler, 100 members and 100 peers with 1000 tool names each; no editor rendering or runtime execution'}));
      assert.ok(p95<1000,`Estate backend p95 ${p95}ms`);
      const selected='as65002-10.0.0.1',detail=await service.call('operator_resources',{kind:'peer',resourceId:selected});
      assert.equal(detail.data.items.length,1);assert.equal(detail.data.items[0].capabilities[0].tools.length,500);assert.equal(detail.data.items[0].inventory.detail,true);assert.equal(detail.data.items[0].inventory.truncated,true);
      const proposal=await service.clients.prepare(service.binding.principal,{nonce:nonce(),client:'codex',targets:[f.installationId],actions:['inspect'],disclosure:['summary'],expiresAt:Date.now()+60000});
      const grant=await service.clients.apply(service.binding.principal,{nonce:nonce(),proposalId:proposal.proposalId,expectedRevision:proposal.expectedRevision});
      const assistant=await assistantCall(service,grant.result.credentialRef,'netclaw_inventory',{kind:'member',limit:100});
      assert.equal(assistant.data.items.length,100);assert.equal(assistant.data.items[0].harness.type,'openclaw');
      assert.ok(!JSON.stringify(assistant).includes('enrollment_token'));assert.ok(!JSON.stringify(assistant).includes('fixture_tool_'));
      child.stdin.write('check-estate\n');const observed=JSON.parse((await iterator.next()).value);
      assert.equal(observed.writes,0);assert.equal(observed.channels,0);assert.equal(observed.membersConnected,0);assert.deepEqual(observed.routes,['/n2n/management/estate','/status']);
      assert.deepEqual(fs.readFileSync(f.configPath),config);
    }finally{await service?.close();child.stdin.end();await closed;lines.close();f.cleanup();}
  }
});

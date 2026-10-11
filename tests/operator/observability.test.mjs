import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce,auditFixture} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
import {readUsage} from '../../ui/netclaw-visual/src/hud-server/tokenomics.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
function service(t,kind='openclaw'){
  const f=installationFixture(t,kind),backend=new ManagementService({root,home:f.home,kind,audit:auditFixture()});t.after(()=>backend.close());return {...f,backend};
}
test('usage windows reconcile recorded costs, duplicates and gaps without pricing estimates',t=>{
  const f=installationFixture(t),directory=path.join(f.home,'sessions');fs.mkdirSync(directory,{mode:0o700});
  const now=Date.now(),line=(id,offset,usage)=>JSON.stringify({id,type:'message',timestamp:offset===null?undefined:new Date(now-offset).toISOString(),message:{role:'assistant',model:'fixture',provider:'synthetic',usage}});
  const usage={input:10,output:3,cacheRead:0,cacheWrite:2,cost:{total:.25}};
  const rows=[line('first',1000,usage),line('first',1000,usage),line('old',8*86400000,{...usage,cost:{total:9}}),line('unknown',null,usage),line('missing',1000,null),line('partial',1000,{input:4}),'{malformed'];
  fs.writeFileSync(path.join(directory,'session.jsonl'),rows.join('\n'));
  const result=readUsage(directory,{window:'week',now});assert.equal(result.records,2);assert.equal(result.missingUsage,1);assert.equal(result.malformed,1);assert.equal(result.missingTimestamp,1);
  assert.equal(result.groups[0].input,14);assert.equal(result.groups[0].costUsd,.25);assert.equal(result.groups[0].costRecords,1);assert.equal(result.groups[0].incompleteTokenRecords,1);
  assert.equal(readUsage(directory).records,4);
});
test('owned Hermes usage retains actual counters and unknown cost separately from other operations',async t=>{
  const f=service(t,'hermes'),p=f.backend.binding.principal;
  for(const [kind,result] of [['conversation-request',{usage:{total_tokens:17},source:'Synthetic protected runtime'}],['conversation-request',{}],['apply',{usage:{total_tokens:999}}]]){
    const op=f.backend.journal.admit(p,nonce(),kind,{});f.backend.journal.transition(op.operationId,'running');f.backend.journal.transition(op.operationId,'succeeded',result);
  }
  const {data}=await f.backend.call('operator_snapshot',{domain:'usage',window:'day'});
  assert.equal(data.records.length,2);assert.equal(data.missingUsage,1);assert.equal(data.aggregateCostUsd,null);assert.equal(data.externalAssistantUsage,null);
  assert.ok(data.records.some(row=>row.usage?.total_tokens===17));assert.ok(!JSON.stringify(data).includes('999'));
});
test('log source selection is fixed, tails bounded, secrets removed and no shared /tmp source adopted',async t=>{
  const f=service(t);fs.mkdirSync(path.join(f.home,'logs'));
  fs.appendFileSync(path.join(f.home,'.env'),'ANTHROPIC_API_KEY=SYNTHETIC_RAW_SECRET\n');
  fs.writeFileSync(path.join(f.home,'logs/gateway.log'),'info ordinary message\nerror echoed SYNTHETIC_RAW_SECRET\nAuthorization: Bearer SYNTHETIC_OTHER\n');
  const listing=await f.backend.call('operator_evidence',{kind:'log'});assert.deepEqual(listing.data.sources.map(row=>row.id),['gateway','gateway-errors']);assert.ok(!JSON.stringify(listing).includes('/tmp/bgp'));
  const read=await f.backend.call('operator_evidence',{kind:'log',id:'gateway',filters:{severity:'error'}});
  assert.equal(read.data.rows.length,1);assert.ok(!JSON.stringify(read).includes('SYNTHETIC_RAW_SECRET'));assert.match(read.data.rows[0].message,/redacted/);
  await assert.rejects(f.backend.call('operator_evidence',{kind:'log',id:'unknown'}),{code:'DENIED'});
  fs.writeFileSync(path.join(f.home,'logs/gateway.log'),'info long line\n'.repeat(30000));
  const bounded=await f.backend.call('operator_evidence',{kind:'log',id:'gateway',limit:100});assert.equal(bounded.data.truncated,true);assert.equal(bounded.data.rows.length,100);assert.equal(bounded.data.nextCursor,'100');
  fs.symlinkSync(path.join(f.home,'logs/gateway.log'),path.join(f.home,'logs/gateway.err.log'));
  await assert.rejects(f.backend.call('operator_evidence',{kind:'log',id:'gateway-errors'}),{code:'DENIED'});
});
test('configured network inventory contains provenance and no credentials or invented live edges',async t=>{
  const f=service(t),file=path.join(f.home,'testbed.yaml');
  fs.writeFileSync(file,'devices:\n  R1:\n    os: iosxe\n    type: router\n    credentials:\n      default:\n        password: SYNTHETIC_DEVICE_SECRET\n',{mode:0o600});
  fs.appendFileSync(path.join(f.home,'.env'),`PYATS_TESTBED_PATH=${file}\n`);
  const {data}=await f.backend.call('operator_resources',{kind:'network'});assert.equal(data.sourceKind,'configured');assert.equal(data.items[0].id,'R1');assert.equal(data.items[0].observedState,null);assert.deepEqual(data.edges,[]);assert.ok(!JSON.stringify(data).includes('SYNTHETIC_DEVICE_SECRET'));
  fs.writeFileSync(file,'bad: [yaml');assert.equal((await f.backend.call('operator_resources',{kind:'network'})).data.available,false);
});

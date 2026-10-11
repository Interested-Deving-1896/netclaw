import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
import {startPackageRuntime} from '../vscode/live-package-runtime.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('actual OpenClaw HTTP Intent outlives facade exit; killed worker becomes unknown and cannot replay after real lease expiry',{
  skip:!process.env.NETCLAW_TEST_OPENCLAW_ENTRY||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:150000,
},async()=>{
  const f=installationFixture();let live,service,worker;
  try{
    live=await startPackageRuntime(root,f,{intentReport:true});
    const testbed=path.join(f.home,'testbed.yaml');fs.writeFileSync(testbed,'devices:\n  READONLY-FIXTURE:\n    connections:\n      cli: {protocol: ssh, ip: 192.0.2.1, port: 22}\n',{mode:0o600});fs.appendFileSync(path.join(f.home,'.env'),`PYATS_TESTBED_PATH=${testbed}\n`);
    const preserved=[f.configPath,path.join(f.home,'.env'),testbed].map(file=>[file,fs.readFileSync(file)]);
    service=new ManagementService({...f,root});
    const input=prompt=>({action:'intent-submit',nonce:nonce(),args:{request:prompt,requestKind:'read-only',changeMode:'production',targetDeviceIds:['READONLY-FIXTURE'],expectedRevision:service.intent.revision()}});
    const firstInput=input('Return the controlled test report without contacting any network device.');
    const first=await service.call('operator_workspace',firstInput);await service.close();service=new ManagementService({...f,root});let observed;
    const deadline=Date.now()+30000;
    do{observed=await service.call('operator_operation_get',{operationId:first.operationId});if(!['admitted','running'].includes(observed.state))break;await delay(100);}while(Date.now()<deadline);
    assert.equal(observed.state,'succeeded',JSON.stringify(observed));assert.equal(observed.result.verifiedNetworkOutcome,false);
    const saved=await service.call('operator_workspace',{action:'intent-read',args:{id:first.operationId}});assert.equal(saved.data.execution.status,'completed');assert.ok(saved.data.operation.externalReference);
    assert.equal((await service.call('operator_workspace',firstInput)).operationId,first.operationId);await live.verify(1);
    const secondInput=input('WAIT_FOR_TEST. Return only a controlled test report; do not contact a network device.');
    const second=await service.call('operator_workspace',secondInput);let started=false;
    for(let attempt=0;attempt<100;attempt++){try{await live.verify(2);started=true;break;}catch{}await delay(100);}
    assert.equal(started,true,'actual provider is blocked after dispatch');worker=JSON.parse(service.journal._row(second.operationId).worker).pid;
    process.kill(worker,'SIGKILL');worker=null;
    await service.close();service=new ManagementService({...f,root});await live.release();
    const expires=Date.now()+40000;
    do{observed=await service.call('operator_operation_get',{operationId:second.operationId});if(observed.state==='unknown')break;await delay(200);}while(Date.now()<expires);
    assert.equal(observed.state,'unknown','real unrenewed worker lease expires');
    assert.equal((await service.call('operator_workspace',secondInput)).operationId,second.operationId);
    await assert.rejects(service.call('operator_workspace',input('Inspect again without resolving the unknown work.')),{code:'BUSY'});await live.verify(2);
    const evidence=await service.call('operator_workspace',{action:'intent-read',args:{id:second.operationId}});assert.equal(evidence.data.operation.state,'unknown');assert.ok(evidence.data.execution.sessionId);
    for(const [file,bytes] of preserved)assert.deepEqual(fs.readFileSync(file),bytes);
    assert.equal((await service.audit.log()).ok,true);
    console.log(JSON.stringify({platform:process.platform,runtime:'Installed OpenClaw',provider:'Controlled loopback',providerRequests:2,facadeExitPreserved:true,realWorkerTermination:true,realLeaseExpiry:true,noReplay:true,networkDevicesContacted:0,configurationPreserved:true}));
  }finally{await service?.close();await live?.close();f.cleanup();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installationFixture,auditFixture} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
import {DefenseScanner} from '../../ui/netclaw-visual/src/management/defenseclaw-scanner.js';
import {execFileSync} from 'node:child_process';
import {nonce} from './fixtures.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('pinned actual local scanner completes its core analyzers without networking or executing skill files',{
  skip:!process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON,timeout:60000,
},async t=>{
  for(const kind of ['openclaw','hermes']){
    const f=installationFixture(t,kind),directory=path.join(f.root,'defense');fs.mkdirSync(directory,{mode:0o700});
    const config=path.join(directory,'config.yaml');fs.writeFileSync(config,`config_version: 8\nclaw:\n  mode: ${kind}\n  home_dir: ${JSON.stringify(f.home)}\n  config_file: ${JSON.stringify(f.configPath)}\nguardrail:\n  enabled: true\n  mode: observe\n  connector: ${kind}\n`,{mode:0o600});
    const audit=auditFixture(),service=new ManagementService({...f,root,audit});t.after(()=>service.close());await service.defenseclaw.register({directory},{reviewed:true,audit});
    const scanner=new DefenseScanner({binding:service.binding,component:service.defenseclaw,root,audit});
    const preview=await scanner.register(process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON);assert.equal(preview.recorded,false);assert.throws(()=>scanner.read());
    await scanner.register(process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON,{reviewed:true});
    const skill=path.join(f.home,kind==='hermes'?'skills':'workspace/skills','fixture');fs.mkdirSync(skill,{recursive:true,mode:0o700});
    const marker=path.join(f.root,'must-not-execute');fs.writeFileSync(path.join(skill,'SKILL.md'),'---\nname: fixture\ndescription: Synthetic static analysis acceptance.\n---\n# Fixture\nRead and summarize the provided text.\n',{mode:0o600});
    fs.writeFileSync(path.join(skill,'unsafe.py'),`open(${JSON.stringify(marker)}, "w").write("execution is forbidden")\n`,{mode:0o600});
    fs.writeFileSync(path.join(skill,'.env'),'PRIVATE_FIXTURE_SECRET=never-stage-this\n',{mode:0o600});
    const before=fs.readdirSync(directory),record=scanner.read(),selection=scanner.skill('fixture');assert.equal(selection.source.manifest.length,2);assert.equal(selection.source.omittedEntries,1);
    const result=await scanner.scan(record,selection);assert.equal(result.data.networkAttempts,0);assert.equal(result.data.enforcementPerformed,false);assert.deepEqual(result.data.analyzers,['bytecode','pipeline','static_analyzer']);
    assert.ok(result.data.findingCount>0);assert.equal(fs.existsSync(marker),false);assert.deepEqual(fs.readdirSync(directory),before);assert.ok(!JSON.stringify(result).includes('never-stage-this'));
    fs.appendFileSync(path.join(skill,'SKILL.md'),'Changed after preview.\n');await assert.rejects(scanner.scan(record,selection),{code:'STALE_REVISION'});
    assert.ok(!fs.readdirSync(f.statePath).some(name=>name.startsWith('.defense-scan-')));
  }
});

async function liveFixture(kind){
  const f=installationFixture(null,kind),directory=path.join(f.root,'defense');fs.mkdirSync(directory,{mode:0o700});
  fs.writeFileSync(path.join(directory,'config.yaml'),`config_version: 8\nclaw:\n  mode: ${kind}\n  home_dir: ${JSON.stringify(f.home)}\n  config_file: ${JSON.stringify(f.configPath)}\nguardrail:\n  enabled: true\n  mode: observe\n  connector: ${kind}\n`,{mode:0o600});
  let service=new ManagementService({...f,root});await service.defenseclaw.register({directory},{reviewed:true,audit:service.audit});await service.defenseScans.scanner.register(process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON,{reviewed:true});
  const skill=path.join(f.home,kind==='hermes'?'skills':'workspace/skills','fixture');fs.mkdirSync(skill,{recursive:true,mode:0o700});fs.writeFileSync(path.join(skill,'SKILL.md'),'---\nname: fixture\ndescription: Synthetic process scanner acceptance\n---\n# Fixture\nSummarize input text.\n',{mode:0o600});
  const admitted=async()=>{const {data}=await service.call('operator_workspace',{action:'security-scan-preview',args:{name:'fixture'}});const input={action:'security-scan-submit',nonce:nonce(),args:{reviewId:data.reviewId}};return {input,operation:await service.call('operator_workspace',input)};};
  const reopen=async()=>{await service.close();service=new ManagementService({...f,root});return service;};
  return {...f,directory,skill,get service(){return service;},admitted,reopen,async cleanup(){await service.close();f.cleanup();}};
}
async function waitFor(check,timeout=20000){const deadline=Date.now()+timeout;do{const result=await check();if(result)return result;await pause(20);}while(Date.now()<deadline);throw Error('Timed out waiting for owned scan evidence');}
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const children=pid=>execFileSync('/bin/ps',['-axo','pid=,ppid='],{encoding:'utf8'}).trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number)).filter(row=>row[1]===pid).map(row=>row[0]);

test('actual pinned scanner and GAIT complete through independent workers after facade exit for both harness selections',{
  skip:!process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:120000,
},async()=>{
  for(const kind of ['openclaw','hermes']){
    const f=await liveFixture(kind);let worker;
    try{
      const config=fs.readFileSync(f.configPath),env=fs.readFileSync(path.join(f.home,'.env')),component=fs.readFileSync(path.join(f.directory,'config.yaml'));
      const {input,operation}=await f.admitted();await f.reopen();
      const result=await waitFor(async()=>{const value=await f.service.call('operator_operation_get',{operationId:operation.operationId});return !['admitted','running'].includes(value.state)&&value;});
      worker=JSON.parse(f.service.journal._row(operation.operationId).worker).pid;
      assert.equal(result.state,'succeeded',JSON.stringify(result));assert.deepEqual(result.result.result.analyzers,['bytecode','pipeline','static_analyzer']);assert.equal(result.result.result.networkAttempts,0);
      assert.equal((await f.service.call('operator_workspace',input)).operationId,operation.operationId);
      assert.equal(f.service.journal.events(f.service.binding.principal,operation.operationId,0,100).filter(row=>row.type==='dispatch-intent').length,1);
      assert.deepEqual(fs.readFileSync(f.configPath),config);assert.deepEqual(fs.readFileSync(path.join(f.home,'.env')),env);assert.deepEqual(fs.readFileSync(path.join(f.directory,'config.yaml')),component);assert.equal((await f.service.audit.log()).ok,true);
      await waitFor(()=>!alive(worker));assert.ok(!fs.readdirSync(f.statePath).some(name=>name.startsWith('.defense-scan-')));
    }finally{if(worker&&alive(worker))process.kill(worker,'SIGTERM');await f.cleanup();}
  }
});

test('real scanner cancellation and worker loss stop the owned child; expired requests remain uncertain without replay',{
  skip:!process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:120000,
},async()=>{
  for(const scenario of ['cancel','worker-loss']){
    const f=await liveFixture('openclaw');let worker,scanner;
    try{
      // A bounded sizeable source keeps the real analyzer active long enough to
      // observe process termination; it contains no executable test hooks.
      for(let i=0;i<180;i++)fs.writeFileSync(path.join(f.skill,`source-${i}.py`),'# Synthetic static scan input\n'+'value = "sample"\n'.repeat(1200),{mode:0o600});
      const {input,operation}=await f.admitted();
      await waitFor(()=>{const row=f.service.journal._row(operation.operationId);if(row.worker)worker=JSON.parse(row.worker).pid;return row.external_reference;});
      // Dispatch performs one final profile probe, then starts the scan child.
      const observed=new Set();scanner=await waitFor(()=>{for(const pid of children(worker))observed.add(pid);return observed.size>=2&&children(worker).find(pid=>pid!==[...observed][0]);});
      assert.equal(alive(scanner),true);
      if(scenario==='cancel'){
        await f.service.call('operator_cancel_request',{operationId:operation.operationId,nonce:nonce()});
        const result=await waitFor(()=>{const value=f.service.journal.get(f.service.binding.principal,operation.operationId);return !['running','cancellation-requested'].includes(value.state)&&value;});
        assert.equal(result.state,'cancelled',JSON.stringify(result));assert.equal(result.result.result.confirmedExited,true);await waitFor(()=>!alive(scanner));await waitFor(()=>!alive(worker));
        assert.ok(!fs.readdirSync(f.statePath).some(name=>name.startsWith('.defense-scan-')));
      }else{
        process.kill(worker,'SIGKILL');await waitFor(()=>!alive(scanner));
        // Actual wall-clock lease expiration, without mutating the journal clock.
        const result=await waitFor(()=>{const value=f.service.journal.get(f.service.binding.principal,operation.operationId);return value.state==='unknown'&&value;},35000);
        assert.equal(result.result,undefined);assert.equal((await f.service.call('operator_operation_get',{operationId:operation.operationId})).state,'unknown');
      }
      assert.equal((await f.service.call('operator_workspace',input)).operationId,operation.operationId);assert.equal(f.service.journal.events(f.service.binding.principal,operation.operationId,0,100).filter(row=>row.type==='dispatch-intent').length,1);
      assert.equal((await f.service.audit.log()).ok,true);
    }finally{if(worker&&alive(worker))process.kill(worker,'SIGTERM');if(scanner&&alive(scanner))process.kill(scanner,'SIGTERM');await f.cleanup();}
  }
});

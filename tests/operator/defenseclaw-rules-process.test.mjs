import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce} from './fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('actual DefenseClaw Store/PolicyEngine observe detached reviewed rules while the writer survives and unrelated policies remain intact',{
  skip:!process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON||process.env.NETCLAW_TEST_LIVE_GAIT!=='1',timeout:90000,
},async()=>{
  for(const kind of ['openclaw','hermes']){
    const f=installationFixture(null,kind),directory=path.join(f.root,'defense');fs.mkdirSync(directory,{mode:0o700});
    const file=path.join(directory,'config.yaml');fs.writeFileSync(file,`config_version: 8\nclaw:\n  mode: ${kind}\n  home_dir: ${JSON.stringify(f.home)}\n  config_file: ${JSON.stringify(f.configPath)}\nguardrail:\n  enabled: true\n  mode: observe\n  connector: ${kind}\n`,{mode:0o600});const config=fs.readFileSync(file),runtimeConfig=fs.readFileSync(f.configPath);
    const code=`import json,sys,os
from defenseclaw.db import Store
from defenseclaw.enforce import PolicyEngine
from defenseclaw.models import ActionState
store=Store(os.path.join(sys.argv[1],'audit.db'));store.init();engine=PolicyEngine(store);connector=sys.argv[2]
engine.block_tool('write_file','','global fallback');engine.block_tool_for_connector('write_file','codex','foreign rule')
store.set_action('tool','@'+connector+'/write_file','',ActionState(install='block',runtime='disable',file='quarantine'),'synthetic logical flags')
for name in ['audit.db','audit.db-wal','audit.db-shm']:
 p=os.path.join(sys.argv[1],name)
 if os.path.exists(p):os.chmod(p,0o600)
print(json.dumps({'ready':True}),flush=True)
for line in sys.stdin:
 if line.strip()=='inspect':
  row=store.get_action('tool','@'+connector+'/write_file')
  print(json.dumps({'blocked':engine.is_tool_blocked_for_connector('write_file',connector),'allowed':engine.is_tool_allowed_for_connector('write_file',connector),'globalBlocked':engine.is_tool_blocked('write_file'),'foreignBlocked':engine.is_tool_blocked_for_connector('write_file','codex'),'scoped':row.actions.to_dict() if row else None}),flush=True)
store.close()
`;
    const child=spawn(process.env.NETCLAW_TEST_DEFENSECLAW_PYTHON,['-u','-c',code,directory,kind],{env:{PATH:process.env.PATH,HOME:f.root,DEFENSECLAW_HOME:directory,PYTHONNOUSERSITE:'1'},stdio:['pipe','pipe','pipe']});
    let stderr='';child.stderr.on('data',bytes=>{stderr+=bytes.toString();});const closed=once(child,'close'),lines=createInterface({input:child.stdout}),iterator=lines[Symbol.asyncIterator]();let service;
    try{
      const ready=await Promise.race([iterator.next().then(({value,done})=>{if(done)throw Error(stderr||'Component exited');return JSON.parse(value);}),closed.then(()=>{throw Error(stderr||'Component exited');})]);assert.equal(ready.ready,true);
      service=new ManagementService({...f,root});await service.defenseclaw.register({directory},{reviewed:true,audit:service.audit});
      const inspect=async()=>{child.stdin.write('inspect\n');return JSON.parse((await iterator.next()).value);};
      const before=await inspect();assert.equal(before.blocked,true);
      const apply=async policy=>{
        const view=(await service.call('operator_workspace',{action:'security-rule',args:{tool:'write_file'}})).data;
        const prepared=await service.call('operator_change_prepare',{nonce:nonce(),action:'security.tool-rule',targets:[f.installationId],expectedRevision:service.proposals.revision(),patch:{tool:'write_file',policy,expectedRuleRevision:view.revision}});
        const admitted=await service.call('operator_change_apply',{nonce:nonce(),proposalId:prepared.proposalId,expectedRevision:prepared.proposal.expectedRevision});
        await service.close();service=new ManagementService({...f,root});let result;const deadline=Date.now()+20000;
        do{result=await service.call('operator_operation_get',{operationId:admitted.operationId});if(!['admitted','running'].includes(result.state))break;await pause(100);}while(Date.now()<deadline);
        assert.equal(result.state,'succeeded',JSON.stringify(result));assert.equal(child.exitCode,null);
        const worker=JSON.parse(service.journal._row(admitted.operationId).worker).pid;for(let i=0;i<100;i++){try{process.kill(worker,0);await pause(30);}catch{break;}}
      };
      await apply('allow');const allowed=await inspect();assert.equal(allowed.allowed,true);assert.equal(allowed.blocked,false);assert.deepEqual(allowed.scoped,{install:'allow'});assert.equal(allowed.globalBlocked,true);assert.equal(allowed.foreignBlocked,true);
      await apply('block');const blocked=await inspect();assert.equal(blocked.blocked,true);assert.equal(blocked.allowed,false);assert.equal(blocked.foreignBlocked,true);
      await apply('inherit');const inherited=await inspect();assert.equal(inherited.blocked,true);assert.equal(inherited.allowed,false);assert.equal(inherited.scoped,null);assert.equal(inherited.globalBlocked,true);assert.equal(inherited.foreignBlocked,true);
      assert.deepEqual(fs.readFileSync(file),config);assert.deepEqual(fs.readFileSync(f.configPath),runtimeConfig);assert.equal((await service.audit.log()).ok,true);
    }finally{await service?.close();child.stdin.end();await closed;lines.close();f.cleanup();}
  }
});

import asyncio
import hashlib
import json
import os
import sqlite3
import time
import uuid
from types import SimpleNamespace
import pytest
from bgp.federation.runtime import selected
from bgp.federation.execution import ExecutionBroker, Refused
from bgp.federation.management_assistant import AssistantBridge


def fixture(tmp_path,manager):
    runtime=selected({'HOME':str(tmp_path),'NETCLAW_RUNTIME':'hermes','HERMES_HOME':str(tmp_path/'hermes')},initialize=True)
    directory=runtime.home/'netclaw-hud/management';directory.mkdir(mode=0o700)
    file=directory/'operations.sqlite';db=sqlite3.connect(file);os.chmod(file,0o600)
    db.executescript('PRAGMA user_version=1; CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE operations(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,state TEXT,input TEXT,lease_until INTEGER); CREATE TABLE records(kind TEXT,id TEXT,value TEXT,PRIMARY KEY(kind,id));')
    db.execute('INSERT INTO metadata VALUES (?,?)',('installationId',runtime.installation))
    grant_id=str(uuid.uuid4());request=str(uuid.uuid4());conversation=str(uuid.uuid4());ref='NETCLAW_CLIENT_'+grant_id.replace('-','').upper()+'_TOKEN';token='synthetic-management-token-150'
    grant={'surface':'assistant','installationId':runtime.installation,'principalId':'client:'+grant_id,'grantId':grant_id,'generation':1,'actions':['inspect','delegate','cancel'],'targets':[runtime.installation],'disclosure':['summary'],'expiresAt':int(time.time()*1000)+60000,'revokedAt':None}
    saved={**grant,'credentialRef':ref,'credentialHash':hashlib.sha256(token.encode()).hexdigest()}
    (runtime.home/'.env').write_text(ref+'='+token+'\n');os.chmod(runtime.home/'.env',0o600)
    owner=json.dumps([grant['principalId'],grant_id,1],separators=(',',':'))
    body={'prompt':'SUBNET','authority':grant,'conversationId':conversation,'contextIds':[]}
    db.execute('INSERT INTO records VALUES (?,?,?)',('grant',grant_id,json.dumps(saved)))
    db.execute('INSERT INTO operations VALUES (?,?,?,?,?,?)',(request,owner,'assistant-request','running',json.dumps(body),int(time.time()*1000)+60000));db.commit()
    broker=ExecutionBroker(manager,runtime)
    class Companion:
        ready=True
        def __init__(self):self.calls=[];self.state='completed'
        async def call(self,operation,**arguments):
            self.calls.append((operation,arguments))
            if operation=='status':return {'installationId':runtime.installation,'namespace':'federation','protected':True,'tools':['mcp__subnet_calc_mcp__subnet_calculator']}
            if operation=='stop':self.state='cancelled'
            return {'state':self.state,'output':'synthetic answer','usage':{'total_tokens':3}}
    companion=Companion();service=SimpleNamespace(runtime=runtime,execution_broker=broker,hermes_runtime=companion)
    bridge=AssistantBridge(service,broker);broker.assistant=bridge
    return SimpleNamespace(runtime=runtime,db=db,saved=saved,grant=grant,body=body,request=request,broker=broker,bridge=bridge,companion=companion)


def test_private_admission_freezes_client_authority_and_denies_tool_or_target_escape(tmp_path,manager):
    f=fixture(tmp_path,manager)
    async def run():
        result=await f.bridge({'operation':'submit','request':f.request});assert result['state']=='admitted'
        await asyncio.gather(*f.bridge.jobs.values())
        result=await f.bridge({'operation':'observe','request':f.request});assert result['state']=='succeeded'
        submitted=[args for name,args in f.companion.calls if name=='submit'];assert len(submitted)==1
        scope=submitted[0]['scope'];assert scope['origin']=='assistant' and scope['profile']=='subnet' and scope['grant']==f.grant['grantId']
        permit=submitted[0]['permit']
        with pytest.raises(Refused):await f.broker.check(permit,f.request,'mcp__n2n_mcp__n2n_invoke',{})
        with pytest.raises(Refused):await f.broker.check(permit,'foreign')
        again=await f.bridge({'operation':'submit','request':f.request});assert again['state']=='succeeded'
        assert len([name for name,_ in f.companion.calls if name=='submit'])==1
        await f.bridge.close()
    try:asyncio.run(run())
    finally:f.db.close()


@pytest.mark.parametrize('mutation',['revoke','expire','target','action','credential','lease','owner'])
def test_current_grant_and_owned_lease_are_required_at_every_hop(tmp_path,manager,mutation):
    f=fixture(tmp_path,manager)
    try:
        if mutation=='revoke':f.saved['revokedAt']=int(time.time()*1000)
        if mutation=='expire':f.saved['expiresAt']=1
        if mutation=='target':f.saved['targets']=['foreign']
        if mutation=='action':f.saved['actions']=['inspect']
        if mutation=='credential':f.saved['credentialHash']='0'*64
        f.db.execute('UPDATE records SET value=? WHERE kind=?',(json.dumps(f.saved),'grant'))
        if mutation=='lease':f.db.execute('UPDATE operations SET lease_until=1')
        if mutation=='owner':f.db.execute('UPDATE operations SET owner=?',(json.dumps(['another',f.grant['grantId'],1]),))
        f.db.commit()
        with pytest.raises(Refused):asyncio.run(f.bridge({'operation':'submit','request':f.request}))
        assert not f.companion.calls
    finally:f.db.close()


def test_revocation_requests_actual_runtime_stop_and_retains_observed_cancellation(tmp_path,manager):
    f=fixture(tmp_path,manager);f.companion.state='running'
    async def run():
        await f.bridge({'operation':'submit','request':f.request})
        while not any(name=='submit' for name,_ in f.companion.calls):await asyncio.sleep(.01)
        f.saved['revokedAt']=int(time.time()*1000);f.db.execute('UPDATE records SET value=? WHERE kind=?',(json.dumps(f.saved),'grant'));f.db.commit()
        await asyncio.gather(*f.bridge.jobs.values())
        result=await f.bridge({'operation':'observe','request':f.request});assert result['state']=='cancelled'
        assert [name for name,_ in f.companion.calls].count('stop')==1
        await f.bridge.close()
    try:asyncio.run(run())
    finally:f.db.close()


def test_missing_qualified_tool_never_admits_inference(tmp_path,manager):
    f=fixture(tmp_path,manager)
    async def no_tools(operation,**arguments):return {'installationId':f.runtime.installation,'namespace':'federation','protected':True,'tools':[]}
    f.companion.call=no_tools
    async def run():
        assert not (await f.bridge({'operation':'status'}))['ready']
        with pytest.raises(Refused):await f.bridge({'operation':'submit','request':f.request})
        assert not f.bridge.jobs and not f.broker.permits
    try:asyncio.run(run())
    finally:f.db.close()


@pytest.mark.skipif(not all(os.environ.get(k) for k in ('NETCLAW_HERMES_PYTHON','NETCLAW_HERMES_SOURCE','NETCLAW_SUBNET_PYTHON')),reason='real pinned Hermes/subnet fixture required')
def test_actual_hermes_assistant_subnet_and_mid_provider_revocation(tmp_path,manager,monkeypatch):
    import importlib.util
    import shutil
    import sys
    from bgp.federation.runtime import ROOT
    from bgp.federation.hermes_runtime import HermesRuntime
    spec=importlib.util.spec_from_file_location('assistant_provider150',ROOT/'tests/hermes-hud/fixtures/provider.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    provider=module.Provider();url=provider.start();f=fixture(tmp_path,manager);home=f.runtime.home
    monkeypatch.setenv('NETCLAW_RUNTIME','hermes');monkeypatch.setenv('HERMES_HOME',str(home));monkeypatch.setenv('XDG_CONFIG_HOME',str(tmp_path/'config'))
    with (home/'.env').open('a') as stream:stream.write('OPENAI_API_KEY=fixture-only-key\nOPENAI_BASE_URL='+url+'\n')
    records=home/'python-runtimes/records';records.mkdir(parents=True,mode=0o700)
    (records/'hermes-hud').write_text(sys.executable+'\n');(records/'subnet-calc').write_text(os.environ['NETCLAW_SUBNET_PYTHON']+'\n')
    config={'model':{'default':'hud-fixture','provider':'custom','base_url':url},'mcp_servers':{'subnet-calc-mcp':{
      'command':'python3','args':['-u',str(ROOT/'scripts/component-launch.py'),'subnet-calc','--server','subnet-calc-mcp'],
      'env':{'NETCLAW_RUNTIME_ROOT':str(home/'python-runtimes'),'NETCLAW_RUNTIME_ENV':str(home/'.env')}}}}
    (home/'config.yaml').write_text(json.dumps(config));os.chmod(home/'config.yaml',0o600);original=(home/'config.yaml').read_bytes()
    skill=home/'skills/subnet-calculator';skill.mkdir(parents=True);shutil.copyfile(ROOT/'workspace/skills/subnet-calculator/SKILL.md',skill/'SKILL.md')
    companion=HermesRuntime(f.runtime,f.broker);f.bridge.service.hermes_runtime=companion
    async def run():
        await f.broker.start()
        try:
            await companion.start();assert (await f.bridge({'operation':'status'}))['ready']
            await f.bridge({'operation':'submit','request':f.request})
            await asyncio.wait_for(asyncio.gather(*f.bridge.jobs.values()),40)
            first=await f.bridge({'operation':'observe','request':f.request});assert first['state']=='succeeded',first
            with sqlite3.connect(f.runtime.state/'ledger.db') as db:
                assert db.execute("SELECT 1 FROM evidence WHERE request=? AND tool LIKE '%subnet_calculator' AND state='completed'",(f.request,)).fetchone()
            count=len(provider.calls)
            await f.bridge({'operation':'submit','request':f.request});assert len(provider.calls)==count
            request=str(uuid.uuid4());body={**f.body,'prompt':'WAIT_FOR_TEST SUBNET','conversationId':str(uuid.uuid4())}
            row=f.db.execute('SELECT owner FROM operations WHERE id=?',(f.request,)).fetchone()
            f.db.execute('INSERT INTO operations VALUES (?,?,?,?,?,?)',(request,row[0],'assistant-request','running',json.dumps(body),int(time.time()*1000)+60000));f.db.commit()
            await f.bridge({'operation':'submit','request':request});assert await asyncio.to_thread(provider.started.wait,20)
            f.saved['revokedAt']=int(time.time()*1000);f.db.execute('UPDATE records SET value=? WHERE kind=?',(json.dumps(f.saved),'grant'));f.db.commit()
            await asyncio.sleep(.5);provider.release.set()
            await asyncio.wait_for(asyncio.gather(*f.bridge.jobs.values()),40)
            last=await f.bridge({'operation':'observe','request':request});assert last['state'] in ('failed','cancelled','unknown'),last
            with sqlite3.connect(f.runtime.state/'ledger.db') as db:assert not db.execute("SELECT 1 FROM evidence WHERE request=? AND state='completed'",(request,)).fetchone()
            assert len(provider.calls)==count+1  # No post-revocation provider hop.
            assert (home/'config.yaml').read_bytes()==original
        finally:provider.release.set();await f.bridge.close();await companion.close();await f.broker.close()
    try:asyncio.run(run())
    except Exception:
        log=f.runtime.state/'companion.log'
        if log.exists():print(log.read_text()[-8000:])
        raise
    finally:f.db.close();provider.close()

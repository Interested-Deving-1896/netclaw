"""Owned process fixture: real federation broker/Hermes/MCP, loopback model only."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'mcp-servers/protocol-mcp'))
from bgp.federation.manager import FederationManager
from bgp.federation.service import FederationService


async def run():
    home=Path(sys.argv[1]).resolve()
    # Caller must supply its newly allocated fixture, never an owner installation.
    assert home.parent.name.startswith('netclaw150-fixture-') and home.name=='hermes'
    spec=importlib.util.spec_from_file_location('controlled_provider150',ROOT/'tests/hermes-hud/fixtures/provider.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    provider=module.Provider();url=provider.start()
    os.environ.update(NETCLAW_RUNTIME='hermes',HERMES_HOME=str(home),XDG_CONFIG_HOME=str(home.parent/'selection'),OPENAI_API_KEY='fixture-only',OPENAI_BASE_URL=url)
    records=home/'python-runtimes/records';records.mkdir(parents=True,mode=0o700)
    for name,value in [('hermes-hud',sys.executable),('subnet-calc',os.environ['NETCLAW_SUBNET_PYTHON'])]:(records/name).write_text(value+'\n')
    (home/'.env').write_text('OPENAI_API_KEY=fixture-only\nOPENAI_BASE_URL='+url+'\n');(home/'.env').chmod(0o600)
    config={'model':{'default':'hud-fixture','provider':'custom','base_url':url},'mcp_servers':{
      'subnet-calc-mcp':{'command':'python3','args':['-u',str(ROOT/'scripts/component-launch.py'),'subnet-calc','--server','subnet-calc-mcp'],
      'env':{'NETCLAW_RUNTIME_ROOT':str(home/'python-runtimes'),'NETCLAW_RUNTIME_ENV':str(home/'.env')}}}}
    (home/'config.yaml').write_text(json.dumps(config));(home/'config.yaml').chmod(0o600)
    skill=home/'skills/subnet-calculator';skill.mkdir(parents=True);shutil.copyfile(ROOT/'workspace/skills/subnet-calculator/SKILL.md',skill/'SKILL.md')
    manager=FederationManager(base_dir=str(home/'n2n'))
    service=FederationService(local_as=65001,router_id='1.1.1.1',manager=manager)
    done=asyncio.Event();loop=asyncio.get_running_loop()
    for sig in (signal.SIGTERM,signal.SIGINT):loop.add_signal_handler(sig,done.set)
    def stop():sys.stdin.readline();done.set()
    loop.add_reader(sys.stdin.fileno(),stop)
    try:
        await service.start_runtime()
        assert (await service.execution_broker.assistant({'operation':'status'}))['ready']
        print(json.dumps({'url':url,'installationId':service.runtime.installation,'companionPid':service.hermes_runtime.process.pid}),flush=True)
        await done.wait()
    finally:
        provider.release.set();loop.remove_reader(sys.stdin.fileno())
        await service.stop_runtime();manager.close();provider.close()


asyncio.run(run())

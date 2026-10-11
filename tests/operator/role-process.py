"""Isolated daemon Risk API and real startup synchronization, no mesh listeners.

The control transport is a fixture; the Risk SQLite store, API handler and
_sync_risk_from_env are the shipped implementations. No peer/device/provider.
"""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'mcp-servers/protocol-mcp'))
from bgp.federation.manager import FederationManager
from bgp.federation.service import FederationService
from bgp.federation.runtime import Runtime


async def main():
    home=Path(sys.argv[1]);kind=sys.argv[2]
    installation=json.loads((home/'netclaw-hud/installation.json').read_text())['installationId']
    spec=importlib.util.spec_from_file_location('managed_role_daemon',ROOT/'mcp-servers/protocol-mcp/bgp-daemon-v2.py')
    daemon=importlib.util.module_from_spec(spec);spec.loader.exec_module(daemon)
    fed=FederationService(local_as=65001,router_id='4.4.4.4',manager=FederationManager(base_dir=str(home/'n2n')))
    fed.runtime=Runtime(kind,home,home/('config.yaml' if kind=='hermes' else 'openclaw.json'),installation);daemon._federation=fed
    fed.risk.set_role('border',risk_name='existing-risk',description='retained description',enabled_stacks='both',border_endpoint='wss://existing.invalid:18443/in2n',self_member_id='existing-risk/existing-member')
    before={key:fed.risk.get_risk()[key] for key in ['risk_name','description','enabled_stacks','border_endpoint','self_member_id']}
    requests=[]
    async def handle(reader,writer):
        try:
            head=await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'),5);assert len(head)<=8192
            method,route,_=head.decode().split('\r\n')[0].split(' ');assert method=='GET';requests.append(route)
            if route=='/status':code,value=200,{'installation_id':installation,'harness_type':kind,'federation_ready':True}
            else:code,value=await daemon.handle_n2n(method,route,{})
            data=json.dumps(value).encode();writer.write(f'HTTP/1.1 {code} Result\r\nContent-Type: application/json\r\nContent-Length: {len(data)}\r\nConnection: close\r\n\r\n'.encode()+data);await writer.drain()
        finally:writer.close();await writer.wait_closed()
    api=await asyncio.start_server(handle,'127.0.0.1',0)
    print(json.dumps({'port':api.sockets[0].getsockname()[1]}),flush=True)
    try:
        while True:
            line=await asyncio.to_thread(sys.stdin.readline)
            if not line:break
            if line.strip()=='startup-sync':
                spec=importlib.util.spec_from_file_location('role_fixture_env',ROOT/'scripts/write-env.py')
                writer=importlib.util.module_from_spec(spec);spec.loader.exec_module(writer)
                for key,value in writer.values((home/'.env').read_text()).items():
                    if key.startswith('N2N_'):os.environ[key]=value
                daemon._sync_risk_from_env(fed)
                after=fed.risk.get_risk()
                print(json.dumps({'role':after['role'],'metadataPreserved':all(after[key]==value for key,value in before.items()),'requests':requests,'scope':'Real daemon startup sync, no mesh listener restart'}),flush=True)
    finally:api.close();await api.wait_closed();fed.manager.close()


asyncio.run(main())

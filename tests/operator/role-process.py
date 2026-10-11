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
from types import SimpleNamespace

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
    fed.inventory.runtime=fed.runtime
    fed.risk.set_role('border',risk_name='existing-risk',description='retained description',enabled_stacks='both',border_endpoint='wss://existing.invalid:18443/in2n',self_member_id='existing-risk/existing-member')
    before={key:fed.risk.get_risk()[key] for key in ['risk_name','description','enabled_stacks','border_endpoint','self_member_id']}
    if '--estate' in sys.argv:
        for number in range(100):
            peer=f'as{65002+number}-10.0.0.{number+1}'
            fed.manager.upsert_peer(65002+number,f'10.0.0.{number+1}',display_name='Same peer label')
            card={'identity':peer,'harness':{'type':'hermes' if number%2 else 'openclaw','version':'fixture'},'llm':{'primary_model':'fixture/model'},
                  'mcp_servers':[{'name':'fixture-mcp','tools':[f'fixture_tool_{n}' for n in range(1000)]}],'skills':[{'name':'subnet-calculator'}]}
            fed.inventory.cache_remote(peer,card)
            member=fed.risk.add_member(f'claw-{number}',profile='custom',specialty=['subnet-calculator'])
            fed.risk.update_health(member['member_id'],inventory=card,inventory_at='2026-01-01T00:00:00Z')
    estate_changes=fed.manager._conn.total_changes
    if '--peer-policy' in sys.argv:
        fed.manager.local_consent(65002,'2.2.2.2');fed.manager.remote_consent(65002,'2.2.2.2')
        # Controlled local catalog, no actual tool or model execution.
        fed.inventory._load_mcp_servers=lambda:[{'name':'fixture-mcp','tools':['calculate'],'invocable_tools':['calculate'],'qualification':'synthetic catalog only'}]
        fed.inventory._load_skills=lambda:[];fed.inventory._load_knowledge=lambda peer:[]
    chat_calls=[]
    if '--peer-chat' in sys.argv:
        fed.manager.local_consent(65002,'2.2.2.2');fed.manager.remote_consent(65002,'2.2.2.2')
        async def chat_call(method,body,**kwargs):
            # Synthetic channel only: the receiver, task journal and chat
            # transcript implementation are real; no remote model is contacted.
            chat_calls.append({'method':method,'session':body.get('session_id')})
            await asyncio.sleep(.35)
            if method=='n2n/chat/open':return {'accepted':True,'session_id':body['session_id']}
            return {'session_id':body['session_id'],'text':'Synthetic external peer response'}
        fed.channels['as65002-2.2.2.2']=SimpleNamespace(peer_identity='as65002-2.2.2.2',attestation='possession',_closed=False,call=chat_call)
    requests=[];drop_policy_reply=False;drop_chat_reply=False
    async def handle(reader,writer):
        nonlocal drop_policy_reply,drop_chat_reply
        try:
            head=await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'),5);assert len(head)<=8192
            method,route,_=head.decode().split('\r\n')[0].split(' ');assert method=='GET' or any(flag in sys.argv for flag in ['--estate','--peer-policy','--peer-chat']) and method=='POST';requests.append(route)
            length=next((int(line.split(':',1)[1]) for line in head.decode().split('\r\n') if line.lower().startswith('content-length:')),0)
            assert 0<=length<=8192;body=json.loads(await reader.readexactly(length)) if length else {}
            if route=='/status':code,value=200,{'installation_id':installation,'harness_type':kind,'federation_ready':True}
            else:code,value=await daemon.handle_n2n(method,route,body)
            if drop_policy_reply and route=='/n2n/management/peer-policy' and body.get('action')=='apply' and code==200:
                drop_policy_reply=False;return  # Effect committed; deliberately lose its receipt.
            if drop_chat_reply and route=='/n2n/management/peer-chat' and body.get('action')=='start' and code==200:
                drop_chat_reply=False;return
            data=json.dumps(value).encode();writer.write(f'HTTP/1.1 {code} Result\r\nContent-Type: application/json\r\nContent-Length: {len(data)}\r\nConnection: close\r\n\r\n'.encode()+data);await writer.drain()
        finally:writer.close();await writer.wait_closed()
    api=await asyncio.start_server(handle,'127.0.0.1',0)
    print(json.dumps({'port':api.sockets[0].getsockname()[1]}),flush=True)
    try:
        while True:
            line=await asyncio.to_thread(sys.stdin.readline)
            if not line:break
            if line.strip()=='set-live-production':
                os.environ['N2N_RISK_MODE']='production';print(json.dumps({'production':True}),flush=True)
            if line.strip()=='drop-next-policy-reply':
                drop_policy_reply=True;print(json.dumps({'armed':True}),flush=True)
            if line.strip()=='drop-next-chat-reply':
                drop_chat_reply=True;print(json.dumps({'armed':True}),flush=True)
            if line.strip()=='check-chat':
                print(json.dumps({'calls':chat_calls,'tasks':fed.manager._conn.execute("SELECT count(*) FROM delegated_task WHERE target_type='chat'").fetchone()[0]}),flush=True)
            if line.strip()=='check-estate':
                print(json.dumps({'writes':fed.manager._conn.total_changes-estate_changes,'routes':sorted(set(requests)),'channels':len(fed.channels),'membersConnected':len(fed.member_channels)}),flush=True)
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

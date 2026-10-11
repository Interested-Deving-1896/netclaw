import asyncio
import importlib
import json
from pathlib import Path
import sys
import time
import uuid
from types import SimpleNamespace

import pytest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'mcp-servers/zoom-rtms-mcp'))
from bgp.federation.zoom_channel import start_server, read_management_context
from models import registry, TranscriptEntry
import zoom_channel_client as client_module


def test_existing_authenticated_zoom_channel_reads_only_its_live_owned_registry(tmp_path,monkeypatch):
    async def run():
        home=tmp_path/'openclaw';state=home/'netclaw-hud';state.mkdir(parents=True,mode=0o700)
        identity=str(uuid.uuid4());file=state/'installation.json';file.write_text(json.dumps({'schemaVersion':1,'installationId':identity}));file.chmod(0o600)
        monkeypatch.setenv('OPENCLAW_STATE_DIR',str(home));monkeypatch.setenv('NETCLAW_RUNTIME','openclaw');monkeypatch.setenv('N2N_ZOOM_CHANNEL_SECRET','synthetic-shared-key')
        fed=SimpleNamespace(runtime=SimpleNamespace(installation=identity,home=home))
        server=await start_server(fed,0);client=client_module.ZoomChannelClient()
        monkeypatch.setattr(client_module,'BORDER_HOST','127.0.0.1');monkeypatch.setattr(client_module,'BORDER_PORT',server.sockets[0].getsockname()[1]);monkeypatch.setattr(client_module,'SHARED_SECRET','synthetic-shared-key')
        session=registry.create('owned-meeting');session.connection_state='live';session.buffer.append(TranscriptEntry(time.time(),'participant','Engineer','Synthetic retained meeting evidence.'))
        try:
            assert await client.connect() is True
            listing=await read_management_context(fed,None);assert listing['installationId']==identity;assert listing['meetings'][0]['id']=='owned-meeting'
            context=await read_management_context(fed,'owned-meeting');assert context['entries'][0]['text']=='Synthetic retained meeting evidence.'
            assert context['entries'][0]['source']=='live Zoom transcript';assert context['networkObservation'] is False
            assert 'participant' not in context['entries'][0] # Explicit projected field names only.
            registry.destroy('owned-meeting');missing=await read_management_context(fed,'owned-meeting');assert missing['available'] is False
            assert not hasattr(fed,'started_inference')
        finally:
            registry.destroy('owned-meeting');client.writer.close();await client.writer.wait_closed();client._read_task.cancel();server.close();await server.wait_closed()
            for channel in list(fed._zoom_management_channels):await channel.close()
    asyncio.run(run())


def test_unbound_or_ambiguous_zoom_processes_cannot_supply_meeting_context():
    async def run():
        identity=str(uuid.uuid4());fed=SimpleNamespace(runtime=SimpleNamespace(installation=identity),_zoom_management_channels=set())
        assert (await read_management_context(fed,None))['available'] is False
        class Channel:
            trusted=True;_closed=False;management_installation=identity
            async def call(self,*args,**kwargs):raise AssertionError('Ambiguous process must not be queried')
        fed._zoom_management_channels={Channel(),Channel()};assert (await read_management_context(fed,None))['available'] is False
    asyncio.run(run())


def test_management_handshake_uses_fresh_mutual_proofs_and_legacy_cannot_read(monkeypatch):
    from bgp.federation.zoom_channel import ZoomChannel, context_proof
    async def run():
        secret='synthetic-secret';identity=str(uuid.uuid4());nonce='a'*64
        monkeypatch.setenv('N2N_ZOOM_CHANNEL_SECRET',secret)
        responses=[]
        channel=ZoomChannel(None,None,installation_id=identity)
        async def send(value):responses.append(value['result'])
        channel._send=send
        base={'managementContext':1,'installationId':identity,'clientNonce':nonce}
        await channel._handle_request({'id':1,'method':'n2n/zoom/hello','params':base})
        challenge=responses[-1];assert challenge['trusted'] is False
        assert challenge['serverProof']==context_proof(secret,identity,nonce,challenge['serverNonce'],'server')
        proof=context_proof(secret,identity,nonce,challenge['serverNonce'],'client')
        await channel._handle_request({'id':2,'method':'n2n/zoom/hello','params':{**base,'clientProof':proof}})
        assert channel.management_installation==identity and channel.trusted
        await channel._handle_request({'id':3,'method':'n2n/zoom/hello','params':{**base,'clientProof':proof}})
        assert not channel.trusted and channel.management_installation is None
        await channel._handle_request({'id':4,'method':'n2n/zoom/hello','params':base})
        assert responses[-1]['serverNonce']!=challenge['serverNonce']
        await channel._handle_request({'id':5,'method':'n2n/zoom/hello','params':{**base,'clientProof':proof}})
        assert not channel.trusted
        await channel._handle_request({'id':6,'method':'n2n/zoom/hello','params':{'secret':secret}})
        assert channel.trusted and channel.management_installation is None
    asyncio.run(run())


def test_meeting_projection_bounds_hostile_content_and_keeps_citations():
    from context_read import read_context
    session=registry.create('bounded-meeting')
    try:
        for _ in range(100):session.buffer.append(TranscriptEntry(time.time(),'p'*1000,'<script>'*1000,'<img src=x onerror=evil()>\x01'*2000))
        result=read_context(str(uuid.uuid4()),'bounded-meeting')
        assert result['truncated'] and len(result['entries'])==60
        assert len(json.dumps(result).encode())<1024*1024
        assert result['entries'][0]['truncated'] and len(result['entries'][0]['text'])==1500
        assert result['entries'][0]['citation']['meetingId']=='bounded-meeting'
        assert result['historicalSearchAvailable'] is False
    finally:registry.destroy('bounded-meeting')


def test_client_rejects_impersonated_server_before_disclosing_any_context(tmp_path,monkeypatch):
    async def run():
        monkeypatch.setattr(client_module,'installation_identity',lambda:'owned-installation')
        monkeypatch.setattr(client_module,'SHARED_SECRET','synthetic-secret')
        monkeypatch.setattr(client_module,'BORDER_PORT',12345)
        calls=[]
        class Writer:
            def close(self):pass
            async def wait_closed(self):pass
        async def opened(*args):return None,Writer()
        monkeypatch.setattr(asyncio,'open_connection',opened)
        client=client_module.ZoomChannelClient()
        async def read():await asyncio.sleep(10)
        client._read_loop=read
        async def call(method,params,**kwargs):
            calls.append(params)
            return {'installationId':'owned-installation','serverNonce':'b'*64,'serverProof':'0'*64}
        client.call=call
        assert await client.connect() is False
        assert client.management_installation is None and len(calls)==1
        assert 'secret' not in calls[0] and 'clientProof' not in calls[0]
    asyncio.run(run())

"""Management capture uses exact private admission, enrollment and phone consent."""
import asyncio
import json
import os
import sqlite3
import time
import uuid
from types import SimpleNamespace

import pytest

from bgp.federation.manager import FederationManager
from bgp.federation.service import FederationService
from bgp.federation.runtime import Runtime
from bgp.federation import certs
from bgp.federation.management_mobile import ManagementMobile


def fixture(tmp_path):
    home = tmp_path / 'openclaw'; home.mkdir(mode=0o700)
    state = home / 'netclaw-hud'; state.mkdir(mode=0o700)
    installation = str(uuid.uuid4()); identity = state / 'installation.json'
    identity.write_text(json.dumps({'schemaVersion': 1, 'installationId': installation})); identity.chmod(0o600)
    private = state / 'management'; private.mkdir(mode=0o700)
    database = private / 'operations.sqlite'; db = sqlite3.connect(database); database.chmod(0o600)
    db.executescript('PRAGMA user_version=1; CREATE TABLE metadata(key TEXT,value TEXT); CREATE TABLE operations(id TEXT,kind TEXT,owner TEXT,input TEXT,state TEXT,lease TEXT,lease_until INTEGER); CREATE TABLE records(kind TEXT,id TEXT,owner TEXT,value TEXT);')
    db.execute('INSERT INTO metadata VALUES (?,?)', ('installationId', installation)); db.commit()
    fed = FederationService(local_as=65001, router_id='4.4.4.4', manager=FederationManager(base_dir=str(home / 'n2n')))
    fed.runtime = Runtime('openclaw', home, home/'openclaw.json', installation)
    fed.risk.set_role('border', risk_name='risk', enabled_stacks='in2n')
    member = 'risk/fixture-phone'; certificate, _ = certs.create_self_signed(member)
    token = fed.risk.issue_token(label='fixture-phone')['token']
    fed.risk.consume_token(token, member, certificate, scope=[], transport_binding='edge-ws', node_type='edge')
    fed.risk.set_capture_capabilities(member, ['camera.capture'])
    called = []
    async def capture(method, args, **kwargs):
        called.append((method, args)); return {'decision': 'captured', 'content_type': 'image', 'content': 'ZmFrZQ=='}
    fed.edge_channels[member] = SimpleNamespace(trusted=True, member_id=member, _closed=False, call=capture)
    bridge = ManagementMobile(fed)
    def admit(capability='camera.capture'):
        view = bridge.inventory()['items'][0]; request = str(uuid.uuid4()); consent = str(uuid.uuid4()); lease = str(uuid.uuid4())
        owner = json.dumps([f'os:{os.getuid()}', None, 0]); args = {'id': member, 'capability': capability, 'consentReference': consent}
        value = {'installationId': installation, 'memberId': member, 'capability': capability, 'enrollmentRevision': view['enrollmentRevision'], 'expiresAt': int(time.time()*1000)+300000}
        db.execute('INSERT INTO records VALUES (?,?,?,?)', ('capture-consent', consent, owner, json.dumps(value)))
        db.execute('INSERT INTO operations VALUES (?,?,?,?,?,?,?)', (request, 'mobile-capture', owner, json.dumps({'action':'mobile-capture-request','args':args}), 'running', lease, int(time.time()*1000)+60000)); db.commit()
        return request, lease
    return SimpleNamespace(fed=fed,bridge=bridge,db=db,called=called,admit=admit,member=member)


def test_exact_admission_and_enrollment_preserve_device_consent_and_never_replay(tmp_path):
    async def run():
        f=fixture(tmp_path)
        try:
            request,lease=f.admit(); first=await f.bridge.start(request,lease)
            await f.fed.tasks._workers[first['taskId']]
            result=f.bridge.status(request)
            assert result['state']=='succeeded' and result['decision']=='captured'
            assert result['media']['bytes']==4 and 'content' not in result
            assert f.bridge.content(request,0)['content']=='ZmFrZQ=='
            assert (await f.bridge.start(request,lease))['taskId']==first['taskId']
            assert f.called==[('n2n/edge/capture',{'capability':'camera.capture'})]
            assert f.bridge.inventory()['items'][0]['enrolled'] is True
        finally:f.db.close();f.fed.manager.close()
    asyncio.run(run())


def test_forged_expired_lease_stale_enrollment_disabled_capability_and_hermes_do_not_capture(tmp_path):
    async def run():
        f=fixture(tmp_path)
        try:
            request,lease=f.admit()
            with pytest.raises(ValueError):await f.bridge.start(request,'wrong')
            with pytest.raises(ValueError):await f.bridge.start(str(uuid.uuid4()),lease)
            f.db.execute('UPDATE operations SET lease_until=0');f.db.commit()
            with pytest.raises(ValueError):await f.bridge.start(request,lease)
            request,lease=f.admit();f.fed.risk.set_capture_capabilities(f.member,[])
            with pytest.raises(ValueError):await f.bridge.start(request,lease)
            f.fed.risk.set_capture_capabilities(f.member,['camera.capture'])
            request,lease=f.admit('audio.record')
            with pytest.raises(ValueError):await f.bridge.start(request,lease)
            request,lease=f.admit();f.fed.runtime=Runtime('hermes',f.fed.runtime.home,f.fed.runtime.config,f.fed.runtime.installation)
            with pytest.raises(ValueError):await f.bridge.start(request,lease)
            assert not f.called
        finally:f.db.close();f.fed.manager.close()
    asyncio.run(run())


@pytest.mark.parametrize('decision', ['declined','cancelled'])
def test_phone_decline_and_cancel_are_explicit_not_empty_success(tmp_path,decision):
    async def run():
        f=fixture(tmp_path)
        async def decline(*args,**kwargs):return {'decision':decision,'reason':'operator-declined'}
        f.fed.edge_channels[f.member].call=decline
        try:
            request,lease=f.admit();receipt=await f.bridge.start(request,lease);await f.fed.tasks._workers[receipt['taskId']]
            result=f.bridge.status(request);assert result['decision']==decision
            assert result['state']==('cancelled' if decision=='cancelled' else 'denied')
            with pytest.raises(ValueError):f.bridge.content(request,0)
        finally:f.db.close();f.fed.manager.close()
    asyncio.run(run())


def test_disconnected_phone_stays_enrolled_and_does_not_dispatch(tmp_path):
    async def run():
        f=fixture(tmp_path)
        try:
            request,lease=f.admit();f.fed.edge_channels.clear()
            view=f.bridge.inventory()['items'][0];assert view['enrolled'] is True and view['connected'] is False
            with pytest.raises(ValueError):await f.bridge.start(request,lease)
            assert not f.called
        finally:f.db.close();f.fed.manager.close()
    asyncio.run(run())


def test_cancellation_after_capture_dispatch_is_unknown_and_never_replayed(tmp_path):
    async def run():
        f=fixture(tmp_path);sent=asyncio.Event()
        async def wait_for_phone(*args,**kwargs):sent.set();await asyncio.Event().wait()
        f.fed.edge_channels[f.member].call=wait_for_phone
        try:
            request,lease=f.admit();receipt=await f.bridge.start(request,lease);await sent.wait()
            f.db.execute("UPDATE operations SET state='cancellation-requested' WHERE id=?",(request,));f.db.commit()
            f.bridge.cancel(request,lease)
            with pytest.raises(asyncio.CancelledError):await f.fed.tasks._workers[receipt['taskId']]
            result=f.bridge.status(request);assert result['state']=='unknown' and result['cancellationRequested'] is True
            f.db.execute("UPDATE operations SET state='running' WHERE id=?",(request,));f.db.commit()
            assert (await f.bridge.start(request,lease))['state']=='unknown'
        finally:f.db.close();f.fed.manager.close()
    asyncio.run(run())

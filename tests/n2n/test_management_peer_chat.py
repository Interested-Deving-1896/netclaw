"""Real task/chat persistence with a synthetic channel; journal admission is
covered separately by the Node/Python process test, not these unit fixtures.
"""
import asyncio
import hashlib
from types import SimpleNamespace
from uuid import uuid4

import pytest

from bgp.federation.management_peer_chat import ManagementPeerChat
from bgp.federation.management_peer_policy import ManagementPeerPolicy
from bgp.federation.service import FederationService


@pytest.fixture
def chat(manager, monkeypatch):
    service = FederationService(local_as=65001, router_id='1.1.1.1', manager=manager)
    peer = 'as65002-2.2.2.2'
    manager.local_consent(65002, '2.2.2.2'); manager.remote_consent(65002, '2.2.2.2')
    runtime = SimpleNamespace(installation=str(uuid4()), kind='hermes')
    monkeypatch.setattr(ManagementPeerPolicy, 'current', lambda self: runtime)
    calls = []
    async def call(method, args, **kwargs):
        calls.append((method, args))
        if method == 'n2n/chat/open': return {'accepted': True, 'session_id': args['session_id']}
        return {'text': 'Untrusted fixture answer\n<markup>', 'session_id': args['session_id']}
    channel = SimpleNamespace(peer_identity=peer, attestation='possession', _closed=False, call=call)
    service.channels[peer] = channel
    controller = ManagementPeerChat(service)
    args = {'peer': peer, 'text': 'Reviewed question', 'reviewId': str(uuid4())}
    review = {'conversationId': str(uuid4()), 'revision': controller.snapshot(peer)['revision'],
              'textDigest': hashlib.sha256(args['text'].encode()).hexdigest()}
    controller.admission = lambda *a, **kw: (runtime, args, review)
    return controller, service, channel, args, review, calls


async def completed(controller, service, operation):
    admitted = await controller.start(operation, 'synthetic-lease')
    worker = service.tasks._workers.get(admitted['taskId'])
    if worker: await worker
    return controller.status(operation)


def test_completed_receipt_is_retained_and_repeated_start_never_resends(chat):
    controller, service, channel, args, review, calls = chat
    async def run():
        operation = str(uuid4())
        result = await completed(controller, service, operation)
        assert result['state'] == 'succeeded' and result['result']['trust'] == 'remote-untrusted'
        assert result['result']['usage'] is None
        assert (await controller.start(operation, 'synthetic-lease')) == result
        assert [method for method, _ in calls] == ['n2n/chat/open', 'n2n/chat/message']
        # A second reviewed turn uses the owned session, without opening it again.
        assert (await completed(controller, service, str(uuid4())))['state'] == 'succeeded'
        assert [method for method, _ in calls].count('n2n/chat/open') == 1
        row = service.manager._conn.execute('SELECT * FROM n2n_chat_session').fetchone()
        assert row['peer_identity'] == args['peer'] and row['direction'] == 'initiated'
    asyncio.run(run())


def test_recipient_denial_is_definite_and_has_no_message_dispatch(chat):
    controller, service, channel, args, review, calls = chat
    async def deny(method, args, **kwargs):
        calls.append((method, args)); return {'accepted': False, 'reason': 'fixture denial'}
    channel.call = deny
    result = asyncio.run(completed(controller, service, str(uuid4())))
    assert result['state'] == 'denied' and result['result']['decision'] == 'denied'
    assert len(calls) == 1 and calls[0][0] == 'n2n/chat/open'


@pytest.mark.parametrize('change', ['permission', 'channel', 'lease'])
def test_opening_session_cannot_authorize_a_later_send(chat, change):
    controller, service, channel, args, review, calls = chat
    original = channel.call
    async def changed(method, value, **kwargs):
        result = await original(method, value, **kwargs)
        if change == 'permission': service.manager.set_chat_enabled(args['peer'], True)
        elif change == 'channel': service.channels[args['peer']] = SimpleNamespace(**vars(channel))
        else:
            def refused(*a, **kw):
                if kw.get('live'): raise ValueError('lease expired')
                return SimpleNamespace(), args, review
            controller.admission = refused
        return result
    channel.call = changed
    result = asyncio.run(completed(controller, service, str(uuid4())))
    assert result['state'] == 'unknown'
    assert [method for method, _ in calls] == ['n2n/chat/open']


def test_unattested_or_closed_channel_cannot_start(chat):
    controller, service, channel, args, review, calls = chat
    async def run():
        for attestation, closed in [('self-asserted', False), ('possession', True)]:
            channel.attestation = attestation; channel._closed = closed
            assert not controller.snapshot(args['peer'])['available']
            with pytest.raises(ValueError): await controller.start(str(uuid4()), 'synthetic-lease')
        assert not calls
    asyncio.run(run())


def test_dispatched_cancel_and_lost_worker_keep_unknown_and_do_not_replay(chat):
    controller, service, channel, args, review, calls = chat
    async def run():
        reached = asyncio.Event()
        async def hanging(method, value, **kwargs):
            calls.append((method, value)); reached.set(); await asyncio.Event().wait()
        channel.call = hanging
        operation = str(uuid4()); admitted = await controller.start(operation, 'synthetic-lease')
        worker = service.tasks._workers[admitted['taskId']]
        await reached.wait(); controller.cancel(operation, 'synthetic-lease')
        with pytest.raises(asyncio.CancelledError): await worker
        assert controller.status(operation)['state'] == 'unknown'
        assert (await controller.start(operation, 'synthetic-lease'))['state'] == 'unknown'
        assert len(calls) == 1
        service.manager._conn.execute("UPDATE delegated_task SET state='working' WHERE task_id=?", (admitted['taskId'],)); service.manager._conn.commit()
        assert controller.status(operation)['state'] == 'unknown'
        assert (await controller.start(operation, 'synthetic-lease'))['state'] == 'unknown'
        assert len(calls) == 1
    asyncio.run(run())


def test_foreign_session_and_replaced_result_file_are_refused(chat, tmp_path):
    controller, service, channel, args, review, calls = chat
    async def run():
        service.chat._register(review['conversationId'], 'different-peer', 'received')
        assert (await completed(controller, service, str(uuid4())))['state'] == 'unknown'
        assert not calls
        review['conversationId'] = str(uuid4())
        operation = str(uuid4()); result = await completed(controller, service, operation)
        row = service.manager._conn.execute('SELECT result_ref FROM delegated_task WHERE task_id=?', (result['taskId'],)).fetchone()
        from pathlib import Path
        file = Path(row[0]); other = tmp_path/'other.json'; other.write_text(file.read_text())
        file.unlink(); file.symlink_to(other)
        with pytest.raises(ValueError): controller.status(operation)
    asyncio.run(run())

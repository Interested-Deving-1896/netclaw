"""Real task receipts and cache policy; channel responses are synthetic.
Private management journal admission is exercised by the separate process test.
"""
import asyncio
import json
from types import SimpleNamespace
from uuid import uuid4

import pytest

from bgp.federation.channel import RpcError, ERR_NOT_ALLOWLISTED, ERR_EXECUTION_TIMEOUT
from bgp.federation.management_peer_execution import ManagementPeerExecution, validate, TOOL
from bgp.federation.management_peer_policy import ManagementPeerPolicy
from bgp.federation.service import FederationService


@pytest.fixture
def execution(manager, monkeypatch):
    service = FederationService(local_as=65001, router_id='1.1.1.1', manager=manager)
    peer = 'as65002-2.2.2.2'
    manager.local_consent(65002, '2.2.2.2'); manager.remote_consent(65002, '2.2.2.2')
    runtime = SimpleNamespace(installation=str(uuid4()), kind='hermes')
    monkeypatch.setattr(ManagementPeerPolicy, 'current', lambda self: runtime)
    card = {'identity': peer, 'harness': {'type': 'hermes', 'version': '0.21.6'},
            'mcp_servers': [{'name': 'subnet-calc-mcp', 'tools': ['subnet_calculator']}], 'skills': ['subnet-calculator']}
    service.inventory.cache_remote(peer, card)
    calls = []; remote = str(uuid4())
    async def call(method, args, **kwargs):
        calls.append((method, args))
        if method == 'n2n/tools/call': return {'content': [{'type': 'text', 'text': 'Synthetic /24 calculation'}], 'isError': False}
        if method == 'n2n/tasks/submit': return {'task_id': remote, 'state': 'submitted'}
        return {'task_id': remote, 'state': 'completed', 'output_text': 'Synthetic skill answer', 'usage_available': False, 'tokens_used': None}
    channel = SimpleNamespace(peer_identity=peer, attestation='possession', _closed=False, call=call)
    service.channels[peer] = channel
    controller = ManagementPeerExecution(service)
    review = {'installationId': runtime.installation, 'selection': {'peer': peer, 'mode': 'tool', 'cidr': '192.0.2.0/24'}, 'expiresAt': 9999999999999,
              'revision': controller.snapshot(peer)['revision']}
    controller.admission = lambda *a, **kw: (runtime, review)
    return controller, service, channel, review, calls, card


async def complete(controller, service, request):
    admitted = await controller.start(request, 'synthetic-lease')
    worker = service.tasks._workers.get(admitted['taskId'])
    if worker: await worker
    return controller.status(request)


@pytest.mark.parametrize('mode', ['tool', 'skill'])
def test_exact_profile_and_receipt_survive_repeat_without_resending(execution, mode):
    controller, service, channel, review, calls, _ = execution
    review['selection']['mode'] = mode
    async def run():
        request = str(uuid4()); result = await complete(controller, service, request)
        assert result['state'] == 'succeeded' and result['result']['trust'] == 'remote-untrusted'
        assert result['result']['usage'] is None
        count = len(calls); assert await controller.start(request, 'synthetic-lease') == result; assert len(calls) == count
        assert calls[0][1]['request_id'] == request
        if mode == 'tool': assert calls[0][1] == {'tool': TOOL, 'arguments': {'cidr': '192.0.2.0/24'}, 'request_id': request}
        else:
            assert calls[0][1]['skill'] == 'subnet-calculator'
            assert '192.0.2.0/24' in calls[0][1]['input_text']
            assert [method for method, _ in calls] == ['n2n/tasks/submit', 'n2n/tasks/result']
    asyncio.run(run())


@pytest.mark.parametrize('fault', ['channel', 'permission', 'inventory', 'stale', 'attestation'])
def test_changed_or_stale_destination_never_dispatches(execution, fault):
    controller, service, channel, review, calls, card = execution; peer = review['selection']['peer']
    if fault == 'channel': service.channels[peer] = SimpleNamespace(**vars(channel))
    elif fault == 'permission': service.manager.set_chat_enabled(peer, True)
    elif fault == 'inventory': card['skills'] = []; service.inventory.cache_remote(peer, card)
    elif fault == 'attestation': channel.attestation = 'self-asserted'
    else:
        file = service.inventory._cache_base(peer)/f'{peer}.meta.json'
        file.write_text(json.dumps({'received_at': '2000-01-01T00:00:00Z'}))
    with pytest.raises(ValueError): asyncio.run(controller.start(str(uuid4()), 'synthetic-lease'))
    assert not calls


def test_openclaw_advertisement_does_not_enable_the_protected_hermes_skill(execution):
    controller, service, _, review, _, card = execution
    card['harness']['type'] = 'openclaw'; service.inventory.cache_remote(card['identity'], card)
    assert [row['mode'] for row in controller.snapshot(card['identity'])['profiles']] == ['tool']


@pytest.mark.parametrize('error,expected', [(ERR_NOT_ALLOWLISTED, 'denied'), (ERR_EXECUTION_TIMEOUT, 'unknown'), (-32000, 'unknown')])
def test_definite_recipient_denial_is_distinct_from_uncertain_execution(execution, error, expected):
    controller, service, channel, review, calls, _ = execution
    async def refuse(method, args, **kw): calls.append(method); raise RpcError(error, 'Untrusted error detail')
    channel.call = refuse
    result = asyncio.run(complete(controller, service, str(uuid4())))
    assert result['state'] == expected and len(calls) == 1
    assert 'Untrusted error detail' not in json.dumps(result)


def test_lost_skill_poll_cannot_be_mislabeled_as_admission_denial(execution):
    controller, service, channel, review, calls, _ = execution; review['selection']['mode'] = 'skill'; original = channel.call
    async def call(method, args, **kw):
        if method == 'n2n/tasks/result': raise RpcError(ERR_NOT_ALLOWLISTED, 'Revoked after admission')
        return await original(method, args, **kw)
    channel.call = call
    assert asyncio.run(complete(controller, service, str(uuid4())))['state'] == 'unknown'


def test_local_wait_cancellation_leaves_dispatched_outcome_unknown(execution):
    controller, service, channel, review, calls, _ = execution
    async def run():
        reached = asyncio.Event()
        async def hang(method, args, **kw): calls.append(method); reached.set(); await asyncio.Event().wait()
        channel.call = hang
        request = str(uuid4()); admitted = await controller.start(request, 'synthetic-lease'); worker = service.tasks._workers[admitted['taskId']]
        await reached.wait(); controller.cancel(request, 'synthetic-lease')
        with pytest.raises(asyncio.CancelledError): await worker
        assert controller.status(request)['state'] == 'unknown'
        assert (await controller.start(request, 'synthetic-lease'))['state'] == 'unknown' and len(calls) == 1
    asyncio.run(run())


def test_large_hostile_result_is_bounded_and_missing_result_is_not_success(execution):
    controller, service, channel, review, calls, _ = execution
    async def large(*a, **kw): return {'content': [{'type': 'text', 'text': '<script>🦞</script>'*50000}]}
    channel.call = large
    result = asyncio.run(complete(controller, service, str(uuid4())))
    assert result['state'] == 'succeeded' and result['result']['response']['truncated']
    assert len(json.dumps(result).encode()) < 100000
    async def absent(*a, **kw): return {}
    channel.call = absent
    assert asyncio.run(complete(controller, service, str(uuid4())))['state'] == 'unknown'


@pytest.mark.parametrize('cidr', ['0.0.0.0/0', '::/24', '192.0.2.0/31', '192.0.2.0/24;exec', '1.2.3.999/24'])
def test_only_the_bounded_read_only_argument_shape_is_admitted(cidr):
    with pytest.raises(ValueError): validate({'peer': 'peer', 'mode': 'tool', 'cidr': cidr})
    with pytest.raises(ValueError): validate({'peer': 'peer', 'mode': 'tool', 'cidr': '192.0.2.0/24', 'arguments': {'command': 'unsafe'}})

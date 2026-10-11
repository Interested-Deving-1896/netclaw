"""Bounded, content-free estate reads; all peers/members are synthetic."""
import json

import pytest

from bgp.federation.management_estate import ManagementEstate
from bgp.federation.service import FederationService


def estate(manager):
    service = FederationService(local_as=65001, router_id='1.1.1.1', manager=manager)
    return service, ManagementEstate(service)


def peer(service, number=2):
    service.manager.upsert_peer(65000+number, f'10.0.0.{number}', display_name='Same name')
    return f'as{65000+number}-10.0.0.{number}'


def card(identity, kind='hermes', count=2):
    return {'identity': identity, 'version': 1, 'harness': {'type': kind, 'version': '1.0', 'qualified': True},
            'llm': {'primary_model': 'fixture/model', 'api_key': 'SECRET'},
            'mcp_servers': [{'name': 'fixture-mcp', 'tools': [f'tool_{i}' for i in range(count)], 'command': 'SECRET'}],
            'skills': [{'name': 'subnet-calculator', 'invocable': True, 'instructions': 'SECRET'}],
            'knowledge': [{'collection_id': 'fixture:manuals', 'content': 'SECRET'}]}


def test_external_summary_and_exact_detail_keep_advertisements_separate(manager):
    service, reader = estate(manager); ident = peer(service)
    service.inventory.cache_remote(ident, card(ident))
    summary = reader.read({'kind': 'peer'})
    assert summary['total'] == 1
    row = summary['peers'][0]
    assert row['inventory']['harness']['type'] == 'hermes'
    assert row['inventory']['llm']['primary_model'] == 'fixture/model'
    assert row['inventory']['counts'] == {'servers': 1, 'tools': 2, 'skills': 1, 'knowledge': 1}
    assert row['inventory']['detail'] is False
    assert row['inventory']['mcp_servers'] == []
    detail = reader.read({'kind': 'peer', 'id': ident})['peers'][0]
    assert detail['inventory']['mcp_servers'][0]['tools'] == ['tool_0', 'tool_1']
    assert detail['inventory']['skills'] == ['subnet-calculator']
    assert detail['inventory']['knowledge'] == ['fixture:manuals']
    assert 'SECRET' not in json.dumps(detail)
    assert 'qualified' not in json.dumps(detail)
    assert detail['stale'] is False


def test_unknown_stale_malformed_and_forged_inventory_do_not_poison_other_peers(manager):
    service, reader = estate(manager)
    identities = [peer(service, i) for i in range(2, 6)]
    service.inventory.cache_remote(identities[0], card(identities[0], 'invented-harness'))
    base = service.inventory._cache_base(identities[0])
    (base / f'{identities[0]}.meta.json').write_text(json.dumps({'received_at': '1999-01-01T00:00:00Z'}))
    service.inventory.cache_remote(identities[1], card('forged-peer'))
    service.inventory.cache_remote(identities[2], card(identities[2]))
    (service.inventory._cache_base(identities[2]) / f'{identities[2]}.json').write_text('{')
    rows = reader.read({'kind': 'peer'})['peers']
    assert len(rows) == 4
    assert rows[0]['stale'] is True and rows[0]['inventory']['harness']['type'] == 'unknown'
    assert rows[1]['inventory'] is None and rows[1]['inventory_error'] == 'identity-mismatch'
    assert rows[2]['inventory'] is None and rows[2]['inventory_error'] == 'unavailable'
    assert rows[3]['inventory'] is None and rows[3]['inventory_error'] == 'not-received'


def test_100_peers_and_large_inventory_are_paged_and_detail_is_bounded(manager):
    service, reader = estate(manager)
    for i in range(2, 102):
        ident = peer(service, i); service.inventory.cache_remote(ident, card(ident, count=1100))
    first = reader.read({'kind': 'peer', 'limit': 30})
    assert first['total'] == 100 and first['nextCursor'] == '30'
    assert len(first['peers']) == 30 and len(json.dumps(first).encode()) < 100000
    second = reader.read({'kind': 'peer', 'cursor': '30', 'limit': 30})
    assert set(row['identity'] for row in first['peers']).isdisjoint(row['identity'] for row in second['peers'])
    selected = first['peers'][0]['identity']
    detail = reader.read({'kind': 'peer', 'id': selected})['peers'][0]['inventory']
    assert detail['counts']['tools'] == 1100
    assert len(detail['mcp_servers'][0]['tools']) == 500 and detail['truncated'] is True
    assert reader.read({'kind': 'peer', 'query': selected})['total'] == 1


def test_cached_inventory_links_public_permissions_and_oversized_bytes_are_not_read(manager, tmp_path):
    service, reader = estate(manager); ident = peer(service)
    service.inventory.cache_remote(ident, card(ident))
    file = service.inventory._cache_base(ident) / f'{ident}.json'
    file.chmod(0o644)
    assert reader.read({'kind': 'peer'})['peers'][0]['inventory_error'] == 'unavailable'
    file.chmod(0o600); file.write_text('x'*(1024*1024+1))
    assert reader.read({'kind': 'peer'})['peers'][0]['inventory_error'] == 'unavailable'
    file.unlink(); file.symlink_to(tmp_path/'missing-private-target')
    assert reader.read({'kind': 'peer'})['peers'][0]['inventory_error'] == 'unavailable'


def test_actual_daemon_estate_route_is_additive_and_rejects_unknown_dispatch_fields(manager):
    import asyncio
    import importlib.util
    from pathlib import Path
    file = Path(__file__).resolve().parents[2]/'mcp-servers/protocol-mcp/bgp-daemon-v2.py'
    spec = importlib.util.spec_from_file_location('estate_read_test_daemon', file)
    daemon = importlib.util.module_from_spec(spec); spec.loader.exec_module(daemon)
    service, _ = estate(manager); ident = peer(service)
    service.inventory.cache_remote(ident, card(ident)); daemon._federation = service
    code, value = asyncio.run(daemon.handle_n2n('POST', '/n2n/management/estate', {'kind': 'peer', 'id': ident}))
    assert code == 200 and value['peers'][0]['inventory']['harness']['type'] == 'hermes'
    assert asyncio.run(daemon.handle_n2n('POST', '/n2n/management/estate', {'kind': 'peer', 'action': 'trust'}))[0] == 409
    legacy = asyncio.run(daemon.handle_n2n('GET', '/n2n/status', {}))[1]
    assert 'inventory' not in legacy['peers'][0]


def test_internal_member_scope_is_distinct_from_received_inventory_and_edge(manager):
    service, reader = estate(manager)
    # Source is the authenticated registry fixture, never a name claimed in a card.
    rows = [{'member_id': 'risk/claw', 'display_name': 'Same name', 'node_type': 'claw', 'state': 'active',
             'profile': 'custom', 'transport_binding': 'https://private-endpoint.invalid', 'scope': json.dumps([{'name': 'subnet', 'tier': 'specialty'}]),
             'health': json.dumps({'inventory': card('forged-member', 'openclaw'), 'inventory_at': '2000-01-01T00:00:00Z'})},
            {'member_id': 'risk/phone', 'node_type': 'edge', 'state': 'enrolled', 'health': '{}', 'scope': '[]'}]
    service.risk.list_members = lambda: rows
    service.member_liveness = lambda row: {'live': False, 'heartbeat_age_s': None}
    member = reader.read({'kind': 'member', 'id': 'risk/claw'})['members'][0]
    assert member['member_id'] == 'risk/claw' and member['inventory']['harness']['type'] == 'openclaw'
    assert member['skills'] == ['subnet'] and member['stale'] is True
    assert member['transport_binding'] is None and 'private-endpoint' not in json.dumps(member)
    assert reader.read({'kind': 'edge'})['members'][0]['member_id'] == 'risk/phone'
    assert reader.read({'kind': 'member', 'id': 'risk/phone'})['members'] == []


@pytest.mark.parametrize('selection', [None, {}, {'kind': 'url'}, {'kind': 'peer', 'id': '../private'},
    {'kind': 'peer', 'limit': True}, {'kind': 'peer', 'limit': 501}, {'kind': 'peer', 'cursor': '-1'},
    {'kind': 'peer', 'url': 'http://example.invalid'}, {'kind': 'peer', 'id': 'peer', 'cursor': '1'}])
def test_invalid_selectors_are_not_dispatchers(manager, selection):
    _, reader = estate(manager)
    with pytest.raises(ValueError): reader.read(selection)

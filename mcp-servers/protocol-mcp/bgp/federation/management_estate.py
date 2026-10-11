"""Local, bounded reads of received estate metadata. Never refreshes a peer,
opens a channel, changes trust or turns an advertisement into authority.
"""
import calendar
import json
import math
import os
import re
import stat
import time


def require(value):
    if not value:
        raise ValueError('Invalid or unavailable estate selection')


def label(value):
    return value[:200] if isinstance(value, str) and not re.search(r'[\x00-\x1f\x7f]', value) else None


def name(value):
    return value if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_.:/@+\-]{1,200}', value) else None


def identifier(value):
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:/\-]{0,199}', value) and '..' not in value


def private_json(file):
    require(file.resolve() == file and file.parent.resolve() == file.parent)
    info = file.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and not info.st_mode & 0o077 and info.st_size <= 1024*1024)
    descriptor = os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        actual = os.fstat(stream.fileno())
        require(actual.st_ino == info.st_ino and actual.st_dev == info.st_dev)
        raw = stream.read(1024*1024+1); require(len(raw) <= 1024*1024)
        value = json.loads(raw)
    require(isinstance(value, dict)); return value


def stale(received, refresh):
    try:
        age = time.time() - calendar.timegm(time.strptime(received, '%Y-%m-%dT%H:%M:%SZ'))
        return age < 0 or age > 2*refresh
    except (TypeError, ValueError, OverflowError):
        return True


def inventory(card, detail):
    require(isinstance(card, dict))
    advertised = card.get('harness'); advertised = advertised if isinstance(advertised, dict) else {}
    harness = {'type': advertised.get('type') if advertised.get('type') in ('openclaw', 'hermes') else 'unknown',
               'version': name(advertised.get('version'))}
    if harness['type'] == 'unknown': harness['version'] = None
    llm = card.get('llm'); llm = llm if isinstance(llm, dict) else {}
    servers, tool_count, remaining = [], 0, 1000
    source = card.get('mcp_servers'); source = source if isinstance(source, list) else []
    server_count = 0
    for server in source:
        if not isinstance(server, dict) or not name(server.get('name')): continue
        server_count += 1
        values = server.get('tools'); values = values if isinstance(values, list) else []
        tools = list(dict.fromkeys(n for value in values if (n := name(value if isinstance(value, str) else value.get('name') if isinstance(value, dict) else None))))
        tool_count += len(tools)
        if detail and len(servers) < 256:
            selected = tools[:min(500, remaining)]; remaining -= len(selected)
            servers.append({'name': server['name'], 'tools': selected})
    def names(key, field):
        values = card.get(key); values = values if isinstance(values, list) else []
        return list(dict.fromkeys(n for value in values if (n := name(value if isinstance(value, str) else value.get(field) if isinstance(value, dict) else None))))
    skills, knowledge = names('skills', 'name'), names('knowledge', 'collection_id')
    return {'harness': harness, 'llm': {'primary_model': name(llm.get('primary_model')), 'guarded': llm.get('guarded') if type(llm.get('guarded')) is bool else None},
            'available': card.get('available') is not False, 'detail': detail,
            'counts': {'servers': server_count, 'tools': tool_count, 'skills': len(skills), 'knowledge': len(knowledge)},
            'mcp_servers': servers, 'skills': skills[:100] if detail else [], 'knowledge': knowledge[:100] if detail else [],
            'truncated': detail and (server_count > len(servers) or tool_count > sum(len(server['tools']) for server in servers) or len(skills) > 100 or len(knowledge) > 100)}


class ManagementEstate:
    def __init__(self, service): self.service = service

    def peer(self, row, detail):
        ident = row['identity']; require(identifier(ident) and '/' not in ident)
        result = {'identity': ident, 'display_name': label(row.get('display_name')), 'state': label(row.get('state')),
                  'chat_enabled': bool(row.get('chat_enabled')), 'inventory': None, 'stale': None, 'inventory_received_at': None}
        try:
            base = self.service.inventory._cache_base(ident)
            try: card = private_json(base / f'{ident}.json')
            except FileNotFoundError: result['inventory_error'] = 'not-received'; return result
            if card.get('identity') != ident:
                result['inventory_error'] = 'identity-mismatch'; return result
            try: received = label(private_json(base / f'{ident}.meta.json').get('received_at'))
            except (OSError, ValueError, TypeError): received = None
            result.update(inventory=inventory(card, detail), inventory_received_at=received, stale=stale(received, self.service.refresh_s))
        except (OSError, ValueError, TypeError): result['inventory_error'] = 'unavailable'
        return result

    def member(self, row, detail):
        ident = row['member_id']; require(identifier(ident))
        live = self.service.member_liveness(row); age = live.get('heartbeat_age_s')
        result = {'member_id': ident, 'display_name': label(row.get('display_name')), 'state': label(row.get('state')),
                  'profile': label(row.get('profile')), 'node_type': label(row.get('node_type')),
                  'transport_binding': row.get('transport_binding') if row.get('transport_binding') in ('loopback', 'distributed', 'edge-ws') else None,
                  'live': live.get('live') is True, 'heartbeat_age_s': age if type(age) in (int, float) and math.isfinite(age) and age >= 0 else None,
                  'inventory': None, 'inventory_received_at': None, 'stale': None, 'skills': []}
        try:
            raw_scope = row.get('scope') or '[]'; require(isinstance(raw_scope, str) and len(raw_scope.encode()) <= 1024*1024)
            result['skills'] = [n for value in self.service.risk._scope_list(raw_scope)
                                if (isinstance(value, dict) and value.get('tier') == 'specialty' or isinstance(value, str) and value not in self.service.risk._BASE_NAMES)
                                and (n := name(value if isinstance(value, str) else value.get('name')))][:100]
            raw = row.get('health') or '{}'; require(isinstance(raw, str) and len(raw.encode()) <= 1024*1024)
            health = json.loads(raw); require(isinstance(health, dict))
            if not isinstance(health.get('inventory'), dict): result['inventory_error'] = 'not-received'; return result
            received = label(health.get('inventory_at'))
            # The receiver binds health to the authenticated member channel;
            # no identity claimed inside its inventory is adopted here.
            result.update(inventory=inventory(health['inventory'], detail), inventory_received_at=received, stale=stale(received, self.service.refresh_s))
        except (OSError, ValueError, TypeError): result['inventory_error'] = 'unavailable'
        return result

    def read(self, request):
        require(isinstance(request, dict) and not set(request)-{'kind', 'id', 'cursor', 'limit', 'query', 'status'})
        kind = request.get('kind'); require(kind in ('member', 'peer', 'edge'))
        selected = request.get('id'); require(selected is None or identifier(selected))
        cursor = request.get('cursor', '0'); require(isinstance(cursor, str) and re.fullmatch(r'0|[1-9][0-9]{0,8}', cursor))
        require(selected is None or cursor == '0')
        limit = request.get('limit', 100); require(type(limit) is int and 1 <= limit <= 500)
        query = request.get('query', ''); require(isinstance(query, str) and len(query) <= 256)
        status = request.get('status'); require(status is None or status in ('active', 'inactive', 'unknown'))
        key = 'identity' if kind == 'peer' else 'member_id'
        source = self.service.manager.list_peers() if kind == 'peer' else self.service.risk.list_members()
        require(len(source) <= 10000)
        rows = [row for row in source if (kind == 'peer' or (row.get('node_type') == 'edge') == (kind == 'edge'))
                and (selected is None or row[key] == selected) and (status is None or row.get('state') == status)
                and (not query or query.lower() in row[key].lower() or query.lower() in (label(row.get('display_name')) or '').lower())]
        rows.sort(key=lambda row: row[key]); require(len({row[key] for row in rows}) == len(rows))
        offset = int(cursor); items, size = [], 0
        for row in rows[offset:offset+limit]:
            item = self.peer(row, selected is not None) if kind == 'peer' else self.member(row, selected is not None)
            cost = len(json.dumps(item).encode())
            if items and size+cost > 800000: break
            require(cost <= 800000); items.append(item); size += cost
        return {'format': 1, 'identity': self.service.local_identity, 'peers' if kind == 'peer' else 'members': items,
                'total': len(rows), **({'nextCursor': str(offset+len(items))} if offset+len(items) < len(rows) else {})}

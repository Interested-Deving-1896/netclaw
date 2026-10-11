"""Reviewed read-only subnet work on an already connected external peer.

No dialing, trust mutation, arbitrary tool arguments or model-supplied authority.
Admission comes from the private operator journal; uncertain work is not resent.
"""
import asyncio
import hmac
import ipaddress
import json
import os
import re
import sqlite3
import time
import uuid
from pathlib import Path
from urllib.parse import quote

from .channel import RpcError
from .execution import digest
from .management_assistant import owned
from .management_estate import ManagementEstate
from .management_peer_policy import ManagementPeerPolicy, configuration, private_bytes
from .negotiate import allows

TOOL = 'subnet-calc-mcp/subnet_calculator'
SKILL = 'subnet-calculator'


def require(value):
    if not value: raise ValueError('Peer execution authority or source unavailable')


def validate(selection):
    require(isinstance(selection, dict) and set(selection) == {'peer', 'mode', 'cidr'})
    require(selection['mode'] in ('tool', 'skill') and isinstance(selection['cidr'], str))
    require(re.fullmatch(r'(?:[0-9]{1,3}\.){3}[0-9]{1,3}/(?:2[4-9]|30)', selection['cidr']))
    network = ipaddress.IPv4Network(selection['cidr'], strict=False)
    require(24 <= network.prefixlen <= 30)
    return selection


def bounded_response(value):
    require(isinstance(value, dict))
    encoded = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
    if len(encoded) <= 48000: return value
    return {'truncated': True, 'responseText': encoded[:48000].decode('utf-8', errors='ignore'), 'isError': value.get('isError') is True}


class ManagementPeerExecution:
    def __init__(self, service):
        self.service = service
        if not hasattr(service, '_management_execution_epoch'):
            service._management_execution_epoch = str(uuid.uuid4())

    def snapshot(self, peer):
        controller = ManagementPeerPolicy(self.service)
        runtime = controller.current()
        require(not controller.db.in_transaction)
        controller.db.execute('BEGIN')
        try:
            policy = controller.policy(peer)
            controller.db.commit()
        except BaseException:
            controller.db.rollback(); raise
        source = ManagementEstate(self.service).peer({'identity': peer, 'state': policy['state']}, True)
        inventory = source.get('inventory') or {}
        channel = self.service.channels.get(peer)
        connected = bool(channel and not getattr(channel, '_closed', True) and channel.peer_identity == peer)
        ready = connected and policy['state'] == 'federated' and all(policy['consent'].values()) and source.get('stale') is False
        advertised_tool = any(server['name'] == 'subnet-calc-mcp' and 'subnet_calculator' in server['tools'] for server in inventory.get('mcp_servers', []))
        # Broader or OpenClaw model delegation is not admitted by this profile.
        advertised_skill = inventory.get('harness', {}).get('type') == 'hermes' and SKILL in inventory.get('skills', [])
        profiles = []
        for mode, target, method, advertised in [('tool', TOOL, 'tools/call', advertised_tool), ('skill', SKILL, 'tasks/submit', advertised_skill)]:
            if ready and advertised and allows(getattr(channel, 'attestation', 'self-asserted'), method):
                profiles.append({'mode': mode, 'target': target})
        return {'format': 1, 'installationId': runtime.installation, 'harness': runtime.kind,
                'peer': peer, 'profiles': profiles, 'available': bool(profiles), 'connected': connected,
                'receivedAt': source.get('inventory_received_at'), 'advertisedHarness': inventory.get('harness'),
                'revision': digest([configuration(policy), source, self.service._management_execution_epoch,
                                    id(channel) if channel else None, getattr(channel, 'attestation', None)]),
                'scope': 'Reviewed IPv4 /24–/30 calculation only. Tool calls use no model; the subnet skill uses the peer’s protected Hermes runtime. The recipient independently authorizes or refuses. Received inventory is not execution proof. No connection, grant, device or configuration change.'}

    def admission(self, request, lease=None, *, live=False, cancelling=False):
        runtime = ManagementPeerPolicy(self.service).current()
        require(isinstance(request, str) and re.fullmatch(r'[a-f0-9-]{36}', request))
        file = runtime.home/'netclaw-hud/management/operations.sqlite'
        owned(file, 256*1024*1024)
        for suffix in ('-wal', '-shm'):
            side = Path(str(file)+suffix)
            if side.exists() or side.is_symlink(): owned(side, 256*1024*1024)
        with sqlite3.connect('file:'+quote(str(file), safe='/')+'?mode=ro', uri=True, timeout=2) as db:
            db.row_factory = sqlite3.Row
            require(db.execute('PRAGMA user_version').fetchone()[0] == 1)
            identity = db.execute("SELECT value FROM metadata WHERE key='installationId'").fetchone()
            row = db.execute('SELECT * FROM operations WHERE id=? AND length(input)<=16384', (request,)).fetchone()
            owner = [f'os:{os.getuid()}', None, 0]
            require(identity and identity[0] == runtime.installation and row and row['kind'] == 'peer-execution' and json.loads(row['owner']) == owner)
            args = json.loads(row['input'])['args']; require(set(args) == {'reviewId'})
            saved = db.execute("SELECT * FROM records WHERE kind='peer-execution-review' AND id=? AND length(value)<=16384", (args['reviewId'],)).fetchone()
            require(saved and json.loads(saved['owner']) == owner)
            review = json.loads(saved['value']); validate(review['selection'])
            require(review['installationId'] == runtime.installation)
            if live:
                require(isinstance(lease, str) and isinstance(row['lease'], str) and hmac.compare_digest(lease, row['lease'])
                        and row['state'] == ('cancellation-requested' if cancelling else 'running')
                        and row['lease_until'] > time.time()*1000 and (cancelling or review['expiresAt'] > time.time()*1000))
            return runtime, review

    def preflight(self, request, lease):
        runtime, review = self.admission(request, lease, live=True)
        selection = review['selection']; view = self.snapshot(selection['peer'])
        require(view['revision'] == review['revision'] and any(profile['mode'] == selection['mode'] for profile in view['profiles']))
        return runtime, review

    def task(self, request, review):
        selection = review['selection']
        row = self.service.manager._conn.execute("SELECT * FROM delegated_task WHERE direction='outbound' AND peer_identity=? AND client_request=?", (selection['peer'], 'management-peer-execution:'+request)).fetchone()
        if row: require(row['target_type'] == selection['mode'] and row['target_name'] == (TOOL if selection['mode'] == 'tool' else SKILL) and row['owner_generation'] == digest(review))
        return row

    async def start(self, request, lease):
        runtime, review = self.preflight(request, lease)
        if self.task(request, review): return self.status(request)
        selection = review['selection']; peer, mode = selection['peer'], selection['mode']
        target = TOOL if mode == 'tool' else SKILL
        task_id = self.service.tasks.create(direction='outbound', peer_identity=peer, target_type=mode, target_name=target,
            client_request='management-peer-execution:'+request, owner_generation=digest(review), request_payload=selection)

        async def execute(progress):
            self.preflight(request, lease)
            channel = self.service.channels[peer]
            progress('Awaiting the reviewed external peer calculation')
            self.service.tasks.mark_dispatch(task_id, context={'managementOperation': request}, runtime=runtime, execution_ref=request)
            remote_admitted = False
            try:
                if mode == 'tool':
                    result = await channel.call('n2n/tools/call', {'tool': TOOL, 'arguments': {'cidr': selection['cidr']}, 'request_id': request}, timeout=125)
                    require(isinstance(result, dict) and isinstance(result.get('content'), list) and len(result['content']) <= 100
                            and all(isinstance(item, dict) and item.get('type') == 'text' and isinstance(item.get('text'), str) for item in result['content']))
                    return {'peer': peer, 'mode': mode, 'target': target, 'response': bounded_response(result), 'trust': 'remote-untrusted', 'usage': None}, None
                # A canonical prompt contains only the validated CIDR, never peer instructions.
                submitted = await channel.call('n2n/tasks/submit', {'skill': SKILL, 'input_text': 'Calculate IPv4 subnet '+selection['cidr']+' using the subnet calculator. Return the calculation only.', 'request_id': request, 'deadline': time.time()+300}, timeout=30)
                remote = submitted.get('task_id'); require(isinstance(remote, str) and re.fullmatch(r'[a-f0-9-]{36}', remote))
                remote_admitted = True
                self.service.tasks._set(task_id, execution_ref=remote)
                deadline = time.time()+300
                while time.time() < deadline:
                    # Poll only the original channel; reconnect is an explicit operator action.
                    require(self.service.channels.get(peer) is channel and not channel._closed)
                    value = await channel.call('n2n/tasks/result', {'task_id': remote}, timeout=30)
                    require(value.get('task_id') == remote)
                    if value.get('state') in ('completed', 'failed', 'cancelled'):
                        if value['state'] == 'completed': require(value.get('result_available') is not False and 'output_text' in value)
                        return {'peer': peer, 'mode': mode, 'target': target, 'remoteTaskId': remote, 'remoteState': value['state'], 'response': bounded_response(value), 'trust': 'remote-untrusted', 'usage': None}, None
                    if value.get('state') in ('unknown', 'outcome_unknown', 'not_found'): raise ValueError('Remote outcome unavailable')
                    await asyncio.sleep(.25)
                raise TimeoutError('Remote outcome unavailable')
            except RpcError as error:
                # Only known admission refusals establish that no execution occurred.
                from .channel import ERR_NOT_ALLOWLISTED, ERR_APPROVAL_EXPIRED, ERR_BUDGET_EXHAUSTED, ERR_RATE_LIMITED, ERR_SEVERED, ERR_GUARDRAIL_BLOCKED
                if remote_admitted or error.code not in (ERR_NOT_ALLOWLISTED, ERR_APPROVAL_EXPIRED, ERR_BUDGET_EXHAUSTED, ERR_RATE_LIMITED, ERR_SEVERED, ERR_GUARDRAIL_BLOCKED): raise
                return {'peer': peer, 'mode': mode, 'target': target, 'decision': 'denied', 'reason': 'The recipient refused the reviewed request.', 'trust': 'remote-untrusted'}, None

        self.service.audit.record(direction='outbound', peer_identity=peer, target_type=mode, target_name=target, request_id=task_id,
            decision='operator-reviewed', outcome='submitted', channel_kind='en2n', event='management-peer-execution', actor=f'os:{os.getuid()}')
        self.service.tasks.run(task_id, execute)
        return {'operationId': request, 'taskId': task_id, 'state': 'running'}

    def status(self, request):
        _, review = self.admission(request); row = self.task(request, review)
        if not row: return {'operationId': request, 'state': 'unknown', 'reason': 'No retained admission; uncertain work is never resent.'}
        state = {'submitted': 'running', 'working': 'running', 'completed': 'succeeded', 'failed': 'failed', 'cancelled': 'cancelled'}.get(row['state'], 'unknown')
        if state == 'running' and row['task_id'] not in self.service.tasks._workers: state = 'unknown'
        value = {'operationId': request, 'taskId': row['task_id'], 'peer': review['selection']['peer'], 'state': state,
                 'cancellationRequested': bool(row['cancel_requested']), 'trust': 'remote-untrusted'}
        if state == 'succeeded':
            file = Path(row['result_ref']); require(file.parent == Path(self.service.audit.results_dir).resolve())
            result = json.loads(private_bytes(file, 1024*1024)).get('output_text')
            require(isinstance(result, dict) and result.get('peer') == review['selection']['peer'])
            value['result'] = result
            if result.get('decision') == 'denied': value['state'] = 'denied'
            elif result.get('remoteState') in ('failed', 'cancelled'): value['state'] = result['remoteState']
            elif result.get('response', {}).get('isError') is True: value['state'] = 'failed'
        return value

    def cancel(self, request, lease):
        _, review = self.admission(request, lease, live=True, cancelling=True)
        row = self.task(request, review)
        if row: self.service.tasks.cancel(row['task_id'])
        return self.status(request)  # Local waiting cancellation is not remote cancellation proof.

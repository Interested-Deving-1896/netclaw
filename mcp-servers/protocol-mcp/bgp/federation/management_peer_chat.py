"""Owned operator conversations through the existing external NCFED chat path.

The HTTP body carries an operation reference, never a prompt or claimed approval.
Reviewed destination/content and the live worker lease come from the private
management journal. Retained task admission is never replayed after loss.
"""
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
import uuid
from pathlib import Path
from urllib.parse import quote

from .execution import digest
from .management_assistant import owned
from .management_peer_policy import ManagementPeerPolicy, configuration, private_bytes
from .negotiate import allows


def require(value):
    if not value: raise ValueError('Peer conversation authority or source unavailable')


class ManagementPeerChat:
    def __init__(self, service):
        self.service = service
        if not hasattr(service, '_management_chat_epoch'):
            service._management_chat_epoch = str(uuid.uuid4())

    def snapshot(self, peer):
        controller = ManagementPeerPolicy(self.service)
        runtime = controller.current()
        require(not controller.db.in_transaction)
        controller.db.execute('BEGIN')
        try:
            policy = controller.policy(peer)
            controller.db.commit()
        except BaseException:
            controller.db.rollback()
            raise
        channel = self.service.channels.get(peer)
        connected = bool(channel and not getattr(channel, '_closed', True)
                         and channel.peer_identity == peer
                         and allows(getattr(channel, 'attestation', 'self-asserted'), 'chat/open'))
        ready = connected and policy['state'] == 'federated' and all(policy['consent'].values())
        return {'format': 1, 'installationId': runtime.installation, 'harness': runtime.kind,
                'peer': peer, 'connected': connected, 'available': ready,
                'revision': digest([configuration(policy), self.service._management_chat_epoch,
                                    id(channel) if channel else None, getattr(channel, 'attestation', None)]),
                'scope': 'Existing authenticated external peer channel. The recipient must independently allow chat and enforce its runtime/tool policy. No channel is dialed, trust changed or permission granted by this view.'}

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
            row = db.execute('SELECT * FROM operations WHERE id=? AND length(input)<=65536', (request,)).fetchone()
            owner = [f'os:{os.getuid()}', None, 0]
            require(identity and identity[0] == runtime.installation and row and row['kind'] == 'peer-chat' and json.loads(row['owner']) == owner)
            args = json.loads(row['input'])['args']
            require(set(args) == {'peer', 'text', 'reviewId'} and isinstance(args['text'], str)
                    and 0 < len(args['text'].strip()) and len(args['text'].encode()) <= 16000)
            def record(kind, key):
                saved = db.execute('SELECT * FROM records WHERE kind=? AND id=? AND length(value)<=16384', (kind, key)).fetchone()
                require(saved and json.loads(saved['owner']) == owner)
                return json.loads(saved['value'])
            review = record('peer-chat-review', args['reviewId'])
            require(review['installationId'] == runtime.installation and review['peer'] == args['peer']
                    and review['textDigest'] == hashlib.sha256(args['text'].encode()).hexdigest())
            conversation = record('peer-conversation', review['conversationId'])
            require(conversation['peer'] == args['peer'] and conversation['installationId'] == runtime.installation
                    and re.fullmatch(r'[a-f0-9-]{36}', review['conversationId']))
            if live:
                require(isinstance(lease, str) and isinstance(row['lease'], str) and hmac.compare_digest(lease, row['lease'])
                        and row['state'] == ('cancellation-requested' if cancelling else 'running')
                        and row['lease_until'] > time.time()*1000 and (cancelling or review['expiresAt'] > time.time()*1000))
            return runtime, args, review

    def preflight(self, request, lease):
        runtime, args, review = self.admission(request, lease, live=True)
        view = self.snapshot(args['peer'])
        require(view['available'] and view['revision'] == review['revision'])
        return runtime, args, review

    def task(self, request, args, review):
        row = self.service.manager._conn.execute("SELECT * FROM delegated_task WHERE direction='outbound' AND peer_identity=? AND client_request=?", (args['peer'], 'management-peer-chat:'+request)).fetchone()
        if row: require(row['target_type'] == 'chat' and row['target_name'] == review['conversationId'] and row['owner_generation'] == review['revision'])
        return row

    async def start(self, request, lease):
        runtime, args, review = self.preflight(request, lease)
        if self.task(request, args, review): return self.status(request)
        task_id = self.service.tasks.create(direction='outbound', peer_identity=args['peer'], target_type='chat', target_name=review['conversationId'],
            client_request='management-peer-chat:'+request, owner_generation=review['revision'], request_payload={'reviewId': args['reviewId'], 'textDigest': review['textDigest']})
        async def chat(progress):
            self.preflight(request, lease)
            channel = self.service.channels[args['peer']]
            session = review['conversationId']
            progress('Awaiting the reviewed external peer conversation')
            self.service.tasks.mark_dispatch(task_id, context={'managementOperation': request}, runtime=runtime, execution_ref=request)
            existing = self.service.manager._conn.execute('SELECT * FROM n2n_chat_session WHERE id=?', (session,)).fetchone()
            if not existing:
                opened = await channel.call('n2n/chat/open', {'session_id': session, 'operator_display': self.service.display_name}, timeout=15)
                if opened.get('accepted') is False:
                    return {'peer': args['peer'], 'conversationId': session, 'decision': 'denied', 'reason': 'The recipient refused this chat session.'}, None
                require(opened.get('accepted') is True and opened.get('session_id') == session)
                self.service.chat._register(session, args['peer'], 'initiated')
            self.preflight(request, lease)  # Opening a session cannot authorize a later send.
            result = await self.service.chat.open_and_send(args['peer'], args['text'], session)
            require(isinstance(result, dict) and result.get('session_id') == session and result.get('source') == args['peer'] and isinstance(result.get('text'), str))
            text = result['text']
            return {'peer': args['peer'], 'conversationId': session, 'text': text[:65536], 'truncated': len(text) > 65536,
                    'trust': 'remote-untrusted', 'usage': None}, None
        self.service.audit.record(direction='outbound', peer_identity=args['peer'], target_type='chat', target_name=review['conversationId'], request_id=task_id,
            decision='operator-reviewed', outcome='submitted', channel_kind='en2n', event='management-peer-chat', actor=f'os:{os.getuid()}')
        self.service.tasks.run(task_id, chat)
        return {'operationId': request, 'taskId': task_id, 'state': 'running'}

    def status(self, request):
        _, args, review = self.admission(request)
        row = self.task(request, args, review)
        if not row: return {'operationId': request, 'state': 'unknown', 'reason': 'No retained admission; uncertain work is never resent.'}
        state = {'submitted': 'running', 'working': 'running', 'completed': 'succeeded', 'failed': 'failed', 'cancelled': 'cancelled'}.get(row['state'], 'unknown')
        if state == 'running' and row['task_id'] not in self.service.tasks._workers: state = 'unknown'
        value = {'operationId': request, 'taskId': row['task_id'], 'peer': args['peer'], 'conversationId': review['conversationId'],
                 'state': state, 'cancellationRequested': bool(row['cancel_requested']), 'trust': 'remote-untrusted'}
        if state == 'succeeded':
            file = Path(row['result_ref'])
            require(file.parent == Path(self.service.audit.results_dir).resolve())
            result = json.loads(private_bytes(file, 1024*1024)).get('output_text')
            require(isinstance(result, dict) and result.get('peer') == args['peer'] and result.get('conversationId') == review['conversationId'])
            value['result'] = result
            if result.get('decision') == 'denied': value['state'] = 'denied'
        return value

    def cancel(self, request, lease):
        _, args, review = self.admission(request, lease, live=True, cancelling=True)
        row = self.task(request, args, review)
        if row: self.service.tasks.cancel(row['task_id'])
        return self.status(request)  # Cancelling local waiting never asserts remote cancellation.

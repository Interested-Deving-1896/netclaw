"""Exact operator-admitted mobile captures on the existing local control API.

This adapter cannot route to a different phone, grant device consent, notify,
enroll, quarantine, or invoke model/vendor tools. Mutation requires the private
management journal's current worker lease; arguments come from that journal.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import sqlite3
import stat
import time
from pathlib import Path
from urllib.parse import quote

from .management_assistant import owned
from .runtime import read_private
from .execution import digest

CAPABILITIES = ('camera.capture', 'audio.record')


def require(value):
    if not value:
        raise ValueError('Management capture authority or source unavailable')


class ManagementMobile:
    def __init__(self, service):
        self.service = service

    def current(self):
        runtime = getattr(self.service, 'runtime', None)
        require(runtime and runtime.installation)
        identity = read_private(runtime.home / 'netclaw-hud/installation.json')
        require(identity.get('schemaVersion') == 1 and identity.get('installationId') == runtime.installation)
        return runtime

    def member(self, row):
        names = sorted({e['name'] for e in self.service.risk._scope_list(row['scope'])
                        if isinstance(e, dict) and e.get('name') in CAPABILITIES})
        revision = digest([row['member_id'], row['key_fingerprint'], row['enrolled_at'], names])
        channel = self.service.edge_channels.get(row['member_id'])
        enrolled = bool(row.get('pinned_key') and row['state'] in ('enrolled', 'active', 'unreachable'))
        connected = bool(enrolled and channel and getattr(channel, 'trusted', False)
                         and channel.member_id == row['member_id'] and not getattr(channel, '_closed', True))
        return {'id': row['member_id'], 'label': row['display_name'] or row['member_id'],
                'enrolled': enrolled, 'enrollmentState': row['state'], 'connected': connected,
                'enrollmentRevision': revision, 'capabilities': names,
                'heartbeatAgeSeconds': self.service.member_liveness(row)['heartbeat_age_s'],
                'consent': 'Capabilities are advertised by the enrolled phone. Each request still requires its native consent.'}

    def inventory(self):
        runtime = self.current()
        return {'installationId': runtime.installation, 'harness': runtime.kind,
                'captureSupported': runtime.kind == 'openclaw' and self.service.risk.is_border(),
                'items': [self.member(row) for row in self.service.risk.list_members() if row['node_type'] == 'edge'],
                'source': 'Pinned enrollment, current authenticated edge channel and device-advertised capture capabilities',
                'limitation': 'Hermes media capture is unsupported. Offline does not mean unenrolled. No notification or quarantine is sent.'}

    def admission(self, request, lease=None, *, live=False):
        runtime = self.current(); require(isinstance(request, str) and re.fullmatch(r'[a-f0-9-]{36}', request))
        file = runtime.home / 'netclaw-hud/management/operations.sqlite'; owned(file, 256*1024*1024)
        with sqlite3.connect('file:'+quote(str(file),safe='/')+'?mode=ro', uri=True, timeout=2) as db:
            db.row_factory = sqlite3.Row
            require(db.execute('PRAGMA user_version').fetchone()[0] == 1)
            identity = db.execute("SELECT value FROM metadata WHERE key='installationId'").fetchone()
            row = db.execute('SELECT * FROM operations WHERE id=? AND length(input)<=65536', (request,)).fetchone()
            owner = [f'os:{os.getuid()}', None, 0]
            require(identity and identity[0] == runtime.installation and row and row['kind'] == 'mobile-capture' and json.loads(row['owner']) == owner)
            args = json.loads(row['input'])['args']; require(set(args) == {'id','capability','consentReference'} and args['capability'] in CAPABILITIES)
            saved = db.execute("SELECT * FROM records WHERE kind='capture-consent' AND id=? AND length(value)<=8192", (args['consentReference'],)).fetchone()
            require(saved and json.loads(saved['owner']) == owner)
            consent = json.loads(saved['value'])
            require(consent['installationId'] == runtime.installation and consent['memberId'] == args['id'] and consent['capability'] == args['capability'])
            if live:
                require(isinstance(lease,str) and isinstance(row['lease'],str) and hmac.compare_digest(row['lease'],lease)
                        and row['state'] == 'running' and row['lease_until'] > time.time()*1000 and consent['expiresAt'] > time.time()*1000)
            return runtime, args, consent

    def preflight(self, request, lease):
        runtime, args, consent = self.admission(request, lease, live=True)
        require(runtime.kind == 'openclaw' and self.service.risk.is_border())
        row = self.service.risk.get_member(args['id']); require(row and row['node_type'] == 'edge')
        view = self.member(row)
        require(view['enrolled'] and view['connected'] and args['capability'] in view['capabilities'] and view['enrollmentRevision'] == consent['enrollmentRevision'])
        return runtime, args, consent

    def task(self, request, args, consent):
        row = self.service.manager._conn.execute("SELECT * FROM delegated_task WHERE direction='outbound' AND peer_identity=? AND client_request=?", (args['id'], 'management-capture:'+request)).fetchone()
        if row:
            require(row['target_type'] == 'capture' and row['target_name'] == args['capability'] and row['owner_generation'] == consent['enrollmentRevision'])
        return row

    async def start(self, request, lease):
        runtime, args, consent = self.preflight(request, lease)
        previous = self.task(request, args, consent)
        if previous:
            return self.status(request)  # A retained admission can never restart.
        task_id = self.service.tasks.create(direction='outbound', peer_identity=args['id'], target_type='capture', target_name=args['capability'],
                                            client_request='management-capture:'+request, owner_generation=consent['enrollmentRevision'], request_payload={'consentReference':args['consentReference']})
        async def capture(progress):
            self.preflight(request,lease)
            channel = self.service.edge_channels[args['id']]
            progress('Awaiting the selected phone’s native consent')
            self.service.tasks.mark_dispatch(task_id, context={'managementOperation':request}, runtime=runtime, execution_ref=request)
            result = await channel.call('n2n/edge/capture', {'capability':args['capability']}, timeout=120.0)
            require(isinstance(result,dict) and result.get('decision') in ('captured','declined','cancelled'))
            if result['decision'] == 'captured':
                self.media(result)  # Validate bounded bytes before storing them.
                require(self.service.risk.get_member(args['id']) and self.member(self.service.risk.get_member(args['id']))['enrollmentRevision'] == consent['enrollmentRevision'])
            return result, 0
        self.service.tasks.run(task_id,capture)
        self.service.audit.record(direction='outbound',peer_identity=args['id'],target_type='capture',target_name=args['capability'],request_id=task_id,
                                  decision='operator-requested',outcome='submitted',channel_kind='in2n',event='management-capture',actor=f'os:{os.getuid()}')
        return {'operationId':request,'taskId':task_id,'state':'running'}

    @staticmethod
    def media(result):
        require(result.get('content_type') in ('image','audio','voice') and isinstance(result.get('content'),str) and 0 < len(result['content']) <= 8*1024*1024)
        try: raw = base64.b64decode(result['content'],validate=True)
        except (ValueError,TypeError):raise ValueError('Invalid captured media') from None
        require(0 < len(raw) <= 6*1024*1024)
        return raw, {'contentType':result['content_type'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}

    def result(self,row):
        require(row['result_ref'])
        file = Path(row['result_ref']); owned(file,9*1024*1024)
        require(file.parent == Path(self.service.audit.results_dir).resolve())
        before=file.lstat()
        descriptor=os.open(file,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
        with os.fdopen(descriptor,'rb') as stream:
            info=os.fstat(stream.fileno());require(stat.S_ISREG(info.st_mode) and info.st_ino==before.st_ino and info.st_dev==before.st_dev)
            data=stream.read(9*1024*1024+1);require(len(data)<=9*1024*1024);payload=json.loads(data)
        return payload.get('output_text')

    def status(self, request):
        _,args,consent = self.admission(request)
        row = self.task(request,args,consent)
        if not row:return {'operationId':request,'state':'unknown','reason':'No retained capture admission; never resend uncertain work.'}
        state={'submitted':'running','working':'running','completed':'succeeded','failed':'failed','cancelled':'cancelled','outcome_unknown':'unknown','interrupted':'failed'}.get(row['state'],'unknown')
        if state=='running' and row['task_id'] not in self.service.tasks._workers:state='unknown'
        value={'operationId':request,'taskId':row['task_id'],'memberId':args['id'],'enrollmentRevision':consent['enrollmentRevision'],'capability':args['capability'],'state':state,'cancellationRequested':bool(row['cancel_requested'])}
        if row['state']=='completed':
            result=self.result(row);require(isinstance(result,dict))
            value['decision']=result['decision']
            if result['decision']=='captured':_,value['media']=self.media(result)
            else:value.update(state='cancelled' if result['decision']=='cancelled' else 'denied',reason=str(result.get('reason','Device consent declined'))[:200])
        return value

    def content(self, request, offset):
        require(type(offset) is int and offset>=0)
        _,args,consent=self.admission(request);row=self.task(request,args,consent)
        require(row and row['state']=='completed');result=self.result(row);require(result.get('decision')=='captured')
        raw,metadata=self.media(result);require(offset<len(raw))
        # Fits the management projection's 64 KiB string bound after base64.
        end=min(offset+32768,len(raw))
        return {**metadata,'offset':offset,'nextOffset':end if end<len(raw) else None,'content':base64.b64encode(raw[offset:end]).decode()}

    def cancel(self, request, lease):
        # Human cancellation changes the original journal state first; it may
        # stop waiting but cannot claim that an already-sent capture was undone.
        runtime,args,consent=self.admission(request)
        file=runtime.home/'netclaw-hud/management/operations.sqlite'
        with sqlite3.connect('file:'+quote(str(file),safe='/')+'?mode=ro',uri=True) as db:
            row=db.execute('SELECT state,lease,lease_until FROM operations WHERE id=?',(request,)).fetchone()
            require(row and row[0]=='cancellation-requested' and isinstance(lease,str) and isinstance(row[1],str) and hmac.compare_digest(row[1],lease) and row[2]>time.time()*1000)
        task=self.task(request,args,consent)
        if task:self.service.tasks.cancel(task['task_id'])
        return self.status(request)

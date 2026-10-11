"""Compare-and-set peer permissions on the existing federation control plane.

HTTP callers cannot supply permission changes. A live private operator worker
lease selects the already reviewed proposal and its immutable baseline artifact.
The same SQLite transaction stores the effect and its non-replayable receipt.
"""
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
from .management_estate import identifier, name
from .runtime import read_private
from .controls import is_production


def require(value):
    if not value: raise ValueError('Peer policy authority, baseline or source unavailable')


def configuration(policy):
    # Work is reviewed before applying, but may legitimately advance after a
    # permission change. Verification/rollback concern the permission delta;
    # they never claim to rewind tasks that executed under it.
    return {key:value for key,value in policy.items() if key!='work'}


def install_schema(conn):
    conn.executescript('''
      CREATE TABLE IF NOT EXISTS management_peer_revision(identity TEXT PRIMARY KEY, revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS management_peer_change(
        operation TEXT PRIMARY KEY, installation TEXT NOT NULL, proposal TEXT NOT NULL,
        peer TEXT NOT NULL, action TEXT NOT NULL, baseline TEXT NOT NULL,
        after_state TEXT, state TEXT NOT NULL, created REAL NOT NULL);
    ''')
    # A real value change, including one made by old HUD/CLI routes, invalidates
    # pending review. Keep revision tombstones across removal/recreation (ABA).
    columns = {
        'federation_peer': ('identity', ['identity','peer_as','router_id','state','chat_enabled','endpoint_host','endpoint_port','trust_model','claw_domain','pinned_fp','pinned_fp_next','peer_cred_fp','verify_state','transport','edge_gate']),
        'consent_record': ('peer_identity', ['peer_identity','direction','granted_at','revoked_at']),
        'invocation_grant': ('peer_identity', ['peer_identity','target_type','target_name','requires_approval','timeout_s','revoked_at']),
    }
    for table, (key, fields) in columns.items():
        def bump(which):
            return f'INSERT INTO management_peer_revision VALUES ({which}.{key},1) ON CONFLICT(identity) DO UPDATE SET revision=revision+1;'
        for event, which in [('INSERT','NEW'),('DELETE','OLD')]:
            conn.execute(f'CREATE TRIGGER IF NOT EXISTS managed_{table}_{event.lower()} AFTER {event} ON {table} BEGIN {bump(which)} END')
        changed = ' OR '.join(f'OLD.{field} IS NOT NEW.{field}' for field in fields)
        conn.execute(f'''CREATE TRIGGER IF NOT EXISTS managed_{table}_update AFTER UPDATE ON {table} WHEN {changed}
          BEGIN {bump('OLD')}
          INSERT INTO management_peer_revision SELECT NEW.{key},1 WHERE NEW.{key} IS NOT OLD.{key}
          ON CONFLICT(identity) DO UPDATE SET revision=revision+1;
          END''')


def private_bytes(file, limit):
    owned(file, limit); before = file.lstat()
    descriptor = os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        actual = os.fstat(stream.fileno()); require(stat.S_ISREG(actual.st_mode) and actual.st_ino == before.st_ino and actual.st_dev == before.st_dev)
        value = stream.read(limit+1); require(len(value) <= limit); return value


class ManagementPeerPolicy:
    def __init__(self, service): self.service = service; self.db = service.manager._conn

    def current(self):
        runtime = self.service.runtime
        require(runtime and runtime.installation)
        identity = read_private(runtime.home/'netclaw-hud/installation.json')
        require(identity.get('schemaVersion') == 1 and identity.get('installationId') == runtime.installation)
        source=Path(self.service.manager.db_path); expected=runtime.base/'federation.db'
        require(source==expected and source.resolve()==expected and self.service.manager.base_dir==runtime.base)
        info=source.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid==os.getuid() and not info.st_mode&0o022
                and (info.st_dev,info.st_ino)==self.service.manager._management_db_identity)
        return runtime

    def policy(self, peer):
        require(identifier(peer) and '/' not in peer)
        row = self.service.manager.get_peer(peer); require(row)
        revision = self.db.execute('SELECT revision FROM management_peer_revision WHERE identity=?', (peer,)).fetchone()
        grants = self.db.execute('SELECT id,target_type,target_name,requires_approval,timeout_s FROM invocation_grant WHERE peer_identity=? AND revoked_at IS NULL ORDER BY id LIMIT 501', (peer,)).fetchall()
        work = self.db.execute("SELECT task_id,direction,target_type,state FROM delegated_task WHERE peer_identity=? AND state IN ('submitted','working','outcome_unknown') ORDER BY task_id LIMIT 501", (peer,)).fetchall()
        require(len(grants) <= 500 and len(work) <= 500)
        return {'identity': peer, 'revision': revision[0] if revision else 0,
                'state': row['state'], 'chatEnabled': bool(row['chat_enabled']),
                'trustModel': row.get('trust_model'), 'pin': row.get('pinned_fp'), 'nextPin': row.get('pinned_fp_next'), 'credential': row.get('peer_cred_fp'), 'verifyState': row.get('verify_state'),
                'consent': {direction: self.service.manager._has_consent(peer, direction) for direction in ('local_grant','remote_grant')},
                'grants': [dict(value) for value in grants], 'work': [dict(value) for value in work]}

    def targets(self, peer):
        runtime=self.current(); observed=self.service.inventory.runtime
        require(observed.kind==runtime.kind and observed.home==runtime.home and observed.config==runtime.config)
        card = self.service.inventory.build(peer)
        choices = []
        for server in card.get('mcp_servers', []):
            if not isinstance(server, dict) or not name(server.get('name')): continue
            for tool in server.get('invocable_tools', []):
                if name(tool) and name(server['name']+'/'+tool): choices.append({'type': 'tool', 'name': server['name']+'/'+tool})
        for skill in card.get('skills', []):
            if isinstance(skill, dict) and skill.get('invocable') is True and name(skill.get('name')):
                choices.append({'type': 'skill', 'name': skill['name']})
        # These are local grant candidates, not evidence of successful execution.
        return sorted({(row['type'],row['name']):row for row in choices}.values(), key=lambda row:(row['type'],row['name']))[:500]

    def snapshot(self, peer):
        runtime = self.current(); require(not self.db.in_transaction)
        self.db.execute('BEGIN')
        try:
            policy=self.policy(peer)
            try: candidates=self.targets(peer); available=True
            except (ValueError,TypeError,KeyError,OSError): candidates=[]; available=False
            self.db.commit()
            return {'format':1, 'installationId':runtime.installation, 'harness':runtime.kind, 'production':is_production(),
                    'policy':policy, 'grantCandidates':candidates, 'grantCandidatesAvailable':available,
                    'grantCandidatesLimit':500}
        except BaseException:
            self.db.rollback(); raise

    def admission(self, operation, lease, *, rollback=False):
        runtime = self.current(); require(isinstance(operation,str) and re.fullmatch(r'[a-f0-9-]{36}',operation))
        file = runtime.home/'netclaw-hud/management/operations.sqlite'; owned(file,256*1024*1024)
        for suffix in ('-wal','-shm'):
            side = Path(str(file)+suffix)
            if side.exists() or side.is_symlink(): owned(side,256*1024*1024)
        owner = [f'os:{os.getuid()}',None,0]
        with sqlite3.connect('file:'+quote(str(file),safe='/')+'?mode=ro',uri=True,timeout=2) as db:
            db.row_factory=sqlite3.Row
            require(db.execute('PRAGMA user_version').fetchone()[0] == 1)
            identity = db.execute("SELECT value FROM metadata WHERE key='installationId'").fetchone()
            row = db.execute('SELECT * FROM operations WHERE id=? AND length(input)<=65536',(operation,)).fetchone()
            require(identity and identity[0] == runtime.installation and row and row['kind']=='apply' and json.loads(row['owner'])==owner)
            require(isinstance(lease,str) and isinstance(row['lease'],str) and hmac.compare_digest(lease,row['lease']) and row['state']=='running' and row['lease_until']>time.time()*1000)
            args = json.loads(row['input'])
            saved = db.execute("SELECT * FROM records WHERE kind='proposal' AND id=? AND length(value)<=131072",(args['proposalId'],)).fetchone()
            require(saved and json.loads(saved['owner'])==owner); proposal=json.loads(saved['value'])
            require(proposal['proposalId']==args['proposalId'] and proposal['action'] in ('peer.trust','peer.untrust') and proposal['state']=='executing')
            require(proposal['expectedRevision']==args['expectedRevision'] and (rollback or proposal['expiresAt']>time.time()*1000))
            if not rollback and is_production():
                require(proposal['changeClass']=='production' and isinstance(args.get('approvalReference'),str) and args['approvalReference'])
            origin=proposal['originAuthority']; require(origin['surface']=='operator' and origin['principalId']==owner[0] and origin['installationId']==runtime.installation)
            targets=proposal['targets']; require(isinstance(targets,list) and len(targets)==2 and targets[0]==runtime.installation and identifier(targets[1]) and '/' not in targets[1])
            ref=proposal['baseline']; require(isinstance(ref['id'],str) and re.fullmatch(r'[a-f0-9-]{36}',ref['id']))
            artifact=db.execute("SELECT * FROM records WHERE kind='artifact' AND id=?",(ref['id'],)).fetchone()
            require(artifact and json.loads(artifact['owner'])==owner)
            metadata=json.loads(artifact['value']); raw=private_bytes(file.parent/'artifacts'/ref['id'],512*1024)
            require(metadata['kind']=='baseline' and metadata['hash']==ref['hash']==hashlib.sha256(raw).hexdigest())
            baseline=json.loads(raw); require(baseline['installationId']==runtime.installation and baseline['harness']==runtime.kind and baseline['policy']['identity']==targets[1])
            if not rollback:require(baseline.get('production') is is_production())
            return runtime,proposal,baseline

    def validate_patch(self, proposal, baseline):
        patch=proposal['patch']; require(isinstance(patch,dict) and patch.get('acknowledgeActiveWork') is True)
        policy=baseline['policy']; peer=policy['identity']
        if proposal['action']=='peer.trust':
            require(not set(patch)-{'chatEnabled','grant','acknowledgeActiveWork'} and ('chatEnabled' in patch or 'grant' in patch))
            require('chatEnabled' not in patch or type(patch['chatEnabled']) is bool)
            require(policy['state']=='federated' and all(policy['consent'].values()))
            if 'grant' in patch:
                grant=patch['grant']; require(isinstance(grant,dict) and set(grant)=={'type','name','requiresApproval','timeoutSeconds'})
                require(grant['type'] in ('tool','skill') and name(grant['name']) and grant['requiresApproval'] is True and type(grant['timeoutSeconds']) is int and 1<=grant['timeoutSeconds']<=600)
                require({'type':grant['type'],'name':grant['name']} in self.targets(peer))
                require(not any(row['target_type']==grant['type'] and row['target_name']==grant['name'] for row in policy['grants']))
        else:
            require(not set(patch)-{'disableChat','revokeGrantIds','acknowledgeActiveWork'})
            require('disableChat' not in patch or patch['disableChat'] is True)
            ids=patch.get('revokeGrantIds',[]); require(isinstance(ids,list) and len(ids)<=100 and len(set(ids))==len(ids) and all(type(value) is int and value>0 for value in ids))
            require(patch.get('disableChat') is True or ids)
            require(set(ids).issubset({row['id'] for row in policy['grants']}))

    def mutate(self, operation, lease, *, rollback=False):
        runtime,proposal,baseline=self.admission(operation,lease,rollback=rollback)
        peer=baseline['policy']['identity']; require(not self.db.in_transaction)
        self.db.execute('BEGIN IMMEDIATE')
        try:
            receipt=self.db.execute('SELECT * FROM management_peer_change WHERE operation=?',(operation,)).fetchone()
            current=self.policy(peer)
            if receipt:
                require(receipt['installation']==runtime.installation and receipt['proposal']==proposal['proposalId'] and receipt['peer']==peer and json.loads(receipt['baseline'])==baseline['policy'])
            if rollback:
                if not receipt:
                    require(current==baseline['policy']); self.db.rollback(); return {'verified':True,'state':'unchanged'}
                if receipt['state']=='rolled-back':
                    require(configuration(current)==configuration(json.loads(receipt['after_state']))); self.db.rollback(); return {'verified':True,'state':'rolled-back'}
                require(receipt['state']=='applied' and configuration(current)==configuration(json.loads(receipt['after_state'])))
                # Restore only our own permission delta. Newer policy generations
                # prevent this path; no peer, consent, pin or grant row is deleted.
                previous=baseline['policy']; original={row['id'] for row in previous['grants']}
                for grant in current['grants']:
                    if grant['id'] not in original:self.db.execute('UPDATE invocation_grant SET revoked_at=? WHERE id=?',(time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),grant['id']))
                for grant in previous['grants']:
                    self.db.execute('UPDATE invocation_grant SET revoked_at=NULL WHERE id=? AND peer_identity=?',(grant['id'],peer))
                self.db.execute('UPDATE federation_peer SET chat_enabled=? WHERE identity=?',(int(previous['chatEnabled']),peer))
                state='rolled-back'
            else:
                if receipt:
                    require(receipt['state']=='applied' and configuration(current)==configuration(json.loads(receipt['after_state']))); self.db.rollback(); return {'verified':True,'state':'applied','policy':current}
                require(current==baseline['policy']); self.validate_patch(proposal,baseline)
                patch=proposal['patch']; now=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
                if 'chatEnabled' in patch:self.db.execute('UPDATE federation_peer SET chat_enabled=?,updated_at=? WHERE identity=?',(int(patch['chatEnabled']),now,peer))
                if patch.get('disableChat'):self.db.execute('UPDATE federation_peer SET chat_enabled=0,updated_at=? WHERE identity=?',(now,peer))
                if 'grant' in patch:
                    grant=patch['grant']; self.db.execute('INSERT INTO invocation_grant(peer_identity,target_type,target_name,requires_approval,timeout_s,created_at) VALUES (?,?,?,?,?,?)',(peer,grant['type'],grant['name'],1,grant['timeoutSeconds'],now))
                for grant in patch.get('revokeGrantIds',[]):self.db.execute('UPDATE invocation_grant SET revoked_at=? WHERE id=? AND peer_identity=?',(now,grant,peer))
                self.db.execute('INSERT INTO management_peer_change(operation,installation,proposal,peer,action,baseline,state,created) VALUES (?,?,?,?,?,?,?,?)',(operation,runtime.installation,proposal['proposalId'],peer,proposal['action'],json.dumps(current,sort_keys=True),'applying',time.time()))
                state='applied'
            after=self.policy(peer)
            self.db.execute('UPDATE management_peer_change SET state=?,after_state=? WHERE operation=?',(state,json.dumps(after,sort_keys=True),operation))
            self.admission(operation,lease,rollback=rollback)  # No expired/replaced worker commits.
            self.db.commit(); return {'verified':True,'state':state,'policy':after}
        except BaseException:
            self.db.rollback(); raise

    def verify(self, operation, lease):
        runtime,proposal,baseline=self.admission(operation,lease)
        receipt=self.db.execute('SELECT * FROM management_peer_change WHERE operation=?',(operation,)).fetchone()
        require(receipt and receipt['installation']==runtime.installation and receipt['proposal']==proposal['proposalId'] and receipt['state']=='applied')
        observed=self.policy(baseline['policy']['identity']); require(configuration(observed)==configuration(json.loads(receipt['after_state'])))
        return {'verified':True,'state':'applied','policy':observed}

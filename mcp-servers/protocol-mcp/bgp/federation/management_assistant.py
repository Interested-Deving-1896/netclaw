"""Private management admissions for the existing protected Hermes runtime.

The model cannot select a principal, grant, target profile or permit. Scope is
reconstructed from the private management journal and checked before every
model/tool hop by the existing receiver broker. No new listener is introduced.
"""
import asyncio
import hashlib
import hmac
import json
import os
import re
import sqlite3
import stat
import time
from urllib.parse import quote
from .execution import ExecutionScope, Refused, digest
from .runtime import read_private


def require(value):
    if not value:raise Refused('management authority unavailable')


def owned(file,limit):
    require(file.resolve()==file and file.parent.resolve()==file.parent)
    info=file.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid==os.getuid() and not info.st_mode&0o077 and info.st_size<=limit)
    parent=file.parent.stat()
    require(stat.S_ISDIR(parent.st_mode) and parent.st_uid==os.getuid() and not parent.st_mode&0o022)


class AssistantBridge:
    def __init__(self,service,broker):
        self.service=service;self.broker=broker;self.runtime=service.runtime;self.jobs={}
        broker.db.execute('''CREATE TABLE IF NOT EXISTS management_assistant_request(
          request TEXT PRIMARY KEY, installation TEXT NOT NULL, fingerprint TEXT NOT NULL,
          conversation TEXT NOT NULL, state TEXT NOT NULL, result TEXT)''');broker.db.commit()

    async def readiness(self):
        companion=self.service.hermes_runtime
        if not companion or not companion.ready:return False
        try:
            status=await companion.call('status')
            return status.get('installationId')==self.runtime.installation and status.get('namespace')=='federation' and status.get('protected') is True and 'mcp__subnet_calc_mcp__subnet_calculator' in status.get('tools',[])
        except Exception:return False

    def admission(self,request,*,live=True):
        try:
            require(isinstance(request,str) and re.fullmatch(r'[a-f0-9-]{36}',request))
            require(read_private(self.runtime.home/'netclaw-hud/installation.json').get('installationId')==self.runtime.installation)
            file=self.runtime.home/'netclaw-hud/management/operations.sqlite';owned(file,256*1024*1024)
            with sqlite3.connect('file:'+quote(str(file),safe='/')+'?mode=ro',uri=True,timeout=2) as db:
                db.row_factory=sqlite3.Row
                require(db.execute('PRAGMA user_version').fetchone()[0]==1)
                identity=db.execute("SELECT value FROM metadata WHERE key='installationId'").fetchone()
                row=db.execute('SELECT * FROM operations WHERE id=?',(request,)).fetchone()
                require(identity and identity[0]==self.runtime.installation and row and row['kind']=='assistant-request')
                body=json.loads(row['input']);scope=body['authority']
                require(scope['surface']=='assistant' and scope['installationId']==self.runtime.installation)
                require(json.loads(row['owner'])==[scope['principalId'],scope['grantId'],scope['generation']])
                require(isinstance(body['prompt'],str) and 0<len(body['prompt'].strip()) and len(body['prompt'].encode())<=65536 and not body.get('contextIds'))
                require(re.fullmatch(r'[a-f0-9-]{36}',body.get('conversationId') or request))
                result={'body':body,'fingerprint':digest(body),'conversation':'management-assistant-'+(body.get('conversationId') or request)}
                if not live:return result
                saved=db.execute("SELECT value FROM records WHERE kind='grant' AND id=?",(scope['grantId'],)).fetchone();require(saved)
                grant=json.loads(saved[0]);now=time.time()*1000
                require(row['state']=='running' and row['lease_until'] and row['lease_until']>now)
                for key in ('surface','installationId','principalId','grantId','generation'):require(scope[key]==grant[key])
                require(not grant.get('revokedAt') and now<scope['expiresAt']<=grant['expiresAt'])
                for key in ('actions','targets','disclosure'):
                    require(isinstance(scope[key],list) and isinstance(grant[key],list) and set(scope[key])<=set(grant[key]))
                require('delegate' in scope['actions'] and self.runtime.installation in scope['targets'])
                require(re.fullmatch(r'NETCLAW_CLIENT_[A-F0-9]{32}_TOKEN',grant['credentialRef']))
                env_file=self.runtime.env_file;owned(env_file,1024*1024)
                from dotenv import dotenv_values
                token=dotenv_values(env_file,interpolate=False).get(grant['credentialRef']);require(isinstance(token,str) and len(token)>20)
                require(hmac.compare_digest(hashlib.sha256(token.encode()).hexdigest(),grant['credentialHash']))
                return result
        except Refused:raise
        except Exception:raise Refused('management authority unavailable') from None

    def current(self,request,fingerprint):
        try:return self.admission(request)['fingerprint']==fingerprint
        except Refused:return False

    def saved(self,request):
        row=self.broker.db.execute('SELECT * FROM management_assistant_request WHERE request=?',(request,)).fetchone()
        if row:
            require(row['installation']==self.runtime.installation)
            return {'state':row['state'],**(json.loads(row['result']) if row['result'] else {}),
                    'conversationId':row['conversation'].removeprefix('management-assistant-'),
                    'source':'Protected Hermes assistant request and broker ledger'}
        return None

    def record(self,request,state,value=None):
        text=json.dumps(value or {},ensure_ascii=False);require(len(text.encode())<=1024*1024)
        self.broker.db.execute('UPDATE management_assistant_request SET state=?,result=? WHERE request=?',(state,text,request));self.broker.db.commit()

    async def __call__(self,body):
        require(isinstance(body,dict) and set(body)<= {'operation','request'})
        operation=body.get('operation');require(operation in ('status','submit','observe','cancel'))
        companion=self.service.hermes_runtime
        if operation=='status':
            require(set(body)=={'operation'})
            return {'installationId':self.runtime.installation,'runtime':'hermes','ready':await self.readiness(),
                    'profile':'subnet','grantEnforced':True,'tools':['subnet-calc-mcp/subnet_calculator'],
                    'limits':'Local selected installation only; qualified IPv4 /24–/30 subnet calculation. No federation orchestration, writes, shell or unrestricted tools.'}
        request=body.get('request');admission=self.admission(request,live=operation=='submit')
        saved=self.saved(request)
        if saved:
            previous=self.broker.db.execute('SELECT fingerprint FROM management_assistant_request WHERE request=?',(request,)).fetchone()
            require(previous[0]==admission['fingerprint'])
        if operation in ('observe','cancel'):
            require(saved)
            if operation=='cancel' and saved['state'] not in ('succeeded','failed','cancelled'):
                require(companion and companion.ready)
                await companion.call('stop',conversationId=admission['conversation'],requestId=request)
                self.record(request,'cancellation-requested')
            if request not in self.jobs and saved['state'] not in ('succeeded','failed','cancelled'):
                return await self.observe(request,admission['conversation'])
            return self.saved(request)
        require(companion and companion.ready)
        if saved:return saved  # Retained admission never mints a new permit.
        require(await self.readiness())
        require(self.current(request,admission['fingerprint']))
        data=admission['body'];authority=data['authority']
        scope=ExecutionScope(self.runtime.installation,authority['principalId'],'assistant',request,admission['conversation'],
            'skill','subnet-calculator',digest(data['prompt']),min(time.time()+300,authority['expiresAt']/1000),'subnet',grant=authority['grantId'])
        permit=self.broker.issue(scope,lambda _:self.current(request,admission['fingerprint']))
        self.broker.db.execute('INSERT INTO management_assistant_request VALUES (?,?,?,?,?,NULL)',
            (request,self.runtime.installation,admission['fingerprint'],scope.conversation,'admitted'));self.broker.db.commit()
        task=asyncio.create_task(self.run(scope,permit,data['prompt']));self.jobs[request]=task
        task.add_done_callback(lambda _:self.jobs.pop(request,None))
        return self.saved(request)

    async def observe(self,request,conversation):
        companion=self.service.hermes_runtime
        if not companion or not companion.ready:
            self.record(request,'unknown',{'code':'UNKNOWN_OUTCOME'});return self.saved(request)
        try:
            value=await companion.call('request_status',conversationId=conversation,requestId=request)
            state={'completed':'succeeded','interrupted':'unknown','queued':'running','waiting_approval':'running','stopping':'cancellation-requested'}.get(value.get('state'),value.get('state'))
            require(state in ('succeeded','failed','cancelled','unknown','running','cancellation-requested'))
            self.record(request,state,{key:value[key] for key in ('output','usage') if key in value})
        except Exception:self.record(request,'unknown',{'code':'UNKNOWN_OUTCOME'})
        return self.saved(request)

    async def run(self,scope,permit,prompt):
        dispatched=False;stop_requested=False;companion=self.service.hermes_runtime
        try:
            await self.broker.check(permit,scope.request)
            await companion.call('open',conversationId=scope.conversation)
            await self.broker.check(permit,scope.request)
            self.record(scope.request,'running');dispatched=True
            await companion.call('submit',conversationId=scope.conversation,requestId=scope.request,text=prompt,scope=scope.as_dict(),permit=permit,deadlineMs=max(1000,int((scope.deadline-time.time())*1000)))
            while time.time()<scope.deadline+5:
                try:await self.broker.check(permit,scope.request)
                except Refused:
                    if not stop_requested:
                        stop_requested=True
                        await companion.call('stop',conversationId=scope.conversation,requestId=scope.request)
                result=await self.observe(scope.request,scope.conversation)
                if result['state'] in ('succeeded','failed','cancelled','unknown'):return
                await asyncio.sleep(.25)
            self.record(scope.request,'unknown',{'code':'UNKNOWN_OUTCOME'})
        except asyncio.CancelledError:
            if dispatched:
                try:await asyncio.shield(companion.call('stop',conversationId=scope.conversation,requestId=scope.request))
                except Exception:pass
            self.record(scope.request,'unknown' if dispatched else 'failed',{'code':'UNKNOWN_OUTCOME' if dispatched else 'DENIED'})
            raise
        except Exception:self.record(scope.request,'unknown' if dispatched else 'failed',{'code':'UNKNOWN_OUTCOME' if dispatched else 'DENIED'})
        finally:self.broker.permits.pop(digest(permit),None)

    async def close(self):
        jobs=list(self.jobs.values())
        for task in jobs:task.cancel()
        await asyncio.gather(*jobs,return_exceptions=True)

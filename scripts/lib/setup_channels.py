"""Explicit destination and receipt contracts for pinned channel CLIs.

Only concrete IDs are accepted. Names, default routes, URLs, files and fanout
expressions cannot turn a one-destination review into a different delivery.
"""
import re

PATTERNS={
    'slack':r'[CDG][A-Z0-9]{8,31}',
    'telegram':r'-?[1-9][0-9]{0,19}',
    'discord':r'[1-9][0-9]{15,20}',
    'webex':r'[A-Za-z0-9_-]{16,256}={0,2}',
}

def valid_destination(channel,value):
    return isinstance(value,str) and bool(re.fullmatch(PATTERNS.get(channel,r'(?!)'),value))

def arguments(harness,channel,destination,message):
    if not valid_destination(channel,destination):raise ValueError('channel_destination_invalid')
    if harness=='openclaw':return ['message','send','--channel',channel,'--target',destination,'--message',message,'--json']
    if harness=='hermes' and channel!='webex':return ['send','--to',channel+':'+destination,'--json',message]
    raise ValueError('channel_harness_unsupported')

def delivered(harness,channel,value):
    if not isinstance(value,dict):return False
    if harness=='hermes':return value.get('success') is True and not value.get('skipped') and not value.get('error')
    return (value.get('action')=='send' and value.get('channel')==channel and value.get('dryRun') is False
            and isinstance(value.get('messageId'),str) and bool(value['messageId'].strip())
            and not value.get('error'))

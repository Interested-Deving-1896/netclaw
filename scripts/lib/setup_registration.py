"""Translate catalog shell-style env defaults into native env references.

OpenClaw's config loader understands ${NAME}, not ${NAME:-default}. Values,
including resolved aliases, remain solely in this installation's private .env.
"""
import hashlib
import re
from setup_state import Conflict

REFERENCE=re.compile(r'\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}')

def native_environment(server,template,values):
    result={}
    for key,value in template.items():
        if not isinstance(value,str):raise Conflict('registration_environment_invalid')
        matches=list(REFERENCE.finditer(value))
        if not matches:
            if '${' in value:raise Conflict('registration_environment_invalid')
            result[key]=value;continue
        unresolved=False
        def resolve(match):
            nonlocal unresolved
            name,default=match.groups()
            selected=values.get(name)
            if selected is None or selected=='':selected=default if default is not None else selected
            if selected is None:unresolved=True;return match.group(0)
            return selected
        resolved=REFERENCE.sub(resolve,value)
        if unresolved:
            # Configure-later stays unresolved; never create a fake credential.
            result[key]=value;continue
        if '${' in resolved:raise Conflict('registration_environment_invalid')
        alias='NETCLAW_SETUP_MCP_'+hashlib.sha256((server+'\0'+key).encode()).hexdigest()[:24].upper()
        if alias in values and values[alias]!=resolved:raise Conflict('registration_environment_changed')
        values[alias]=resolved
        result[key]='${'+alias+'}'
    return result

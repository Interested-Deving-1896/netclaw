#!/usr/bin/env python3
"""Native manager entry point: fixed roles, private env, no credential arguments."""
import argparse
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_schema import loads
from setup_state import Conflict, guarded_read,revision
from setup_secrets import child_environment,read_owned_environment
from setup_service_binding import verify


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--home',required=True,type=Path)
    parser.add_argument('--role',required=True,choices=['gateway','hud','federation']);args=parser.parse_args()
    os.umask(0o077)
    home=args.home;owner=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
    data=loads(guarded_read(home/'.setup/services.json',65536,private=True))
    if data['home']!=str(home) or data['source']!=str(ROOT) or data['runId']!=owner['runId'] or data['owner']!=owner['installationId']:
        raise Conflict('service_owner_changed')
    if args.role not in [s['role'] for s in data['services']]:raise Conflict('service_role_unowned')
    verify(home,ROOT,data.get('sourceIndex'))
    # Native management can deliberately edit the owned environment after
    # setup. Read its current private revision atomically; scope variables and
    # executable injection keys remain rejected by child_environment.
    env=child_environment(home,data['harness'],read_owned_environment(home/'.env',revision(home/'.env')),tool_directories=data['toolDirectories'])
    if args.role=='gateway':
        if data['harness']!='openclaw':raise Conflict('service_role_unsupported')
        command=[str(home/'.setup/prefix/bin/openclaw'),'gateway','run']
    elif args.role=='hud':command=[data['node'],str(ROOT/'scripts/hud-launch.mjs'),'start','--runtime',data['harness'],'--home',str(home)]
    else:
        python=guarded_read(home/'python-runtimes/records/n2n',8192).decode().strip()
        if not Path(python).is_relative_to(home):raise Conflict('service_runtime_outside_home')
        command=[python,str(ROOT/'scripts/federation-control.py'),'run'] if data['role']=='border' else [python,str(ROOT/'scripts/in2n-member.py')]
    os.chdir(home);os.execve(command[0],command,env)


if __name__=='__main__':
    try:main()
    except Exception:sys.exit(1)

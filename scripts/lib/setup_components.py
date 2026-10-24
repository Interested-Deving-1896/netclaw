"""Observe dependency launch artifacts without starting MCPs or contacting peers.

Tier 1 establishes that the selected registration can locate its launcher and
owned source. Tier 2 separately proves native discovery. No exit-zero banner or
unrelated Python record is accepted as a substitute for these files.
"""
import os
from pathlib import Path
import shutil
from setup_deploy import helper
from setup_schema import loads
from setup_state import Conflict,guarded_read,directory

def selected_servers(component,claw,descriptor):
    if component=='threejs-viz' and claw.get('settings',{}).get('NETCLAW_SKETCHFAB_ENABLED',{}).get('value') is not True:return []
    return descriptor['servers']

def gait_runtime(home):
    """Resolve only this home's managed GAIT generation, never a shared venv."""
    home=Path(home);link=home/'gait-venv'
    if not link.is_symlink():raise Conflict('gait_generation_invalid')
    generation=link.resolve()
    if generation.parent!=home or not generation.name.startswith('.gait-venv-generation-'):
        raise Conflict('gait_generation_invalid')
    if guarded_read(generation/'.netclaw-gait-generation',1024,private=True)!=b'Verified GAIT generation; setup-gait-runtime.py\n':
        raise Conflict('gait_generation_invalid')
    guarded_read(generation/'netclaw-source/mcp-servers/gait_mcp/gait_mcp.py',1024*1024)
    python=generation/'bin/python'
    if not python.resolve().is_relative_to(home) or not os.access(python,os.X_OK):raise Conflict('component_runtime_outside_home')
    return python

def launcher_runtime(component,deploy,raw,server):
    record=deploy.root/'python-runtimes/records'/component
    # The fixed stdlib launcher may dispatch Node/Go/uvx. It needs the owned
    # bootstrap Python, not an unrelated component venv or engine interpreter.
    wrapper=raw.get('args')==['-u','scripts/component-launch.py',component,'--server',server]
    if not record.exists() and wrapper:record=deploy.root/'.setup/python312'
    if not record.exists():return None
    runtime=guarded_read(record,8192,private=True).decode().strip();candidate=Path(runtime)
    if not candidate.is_absolute() or not candidate.is_relative_to(deploy.root) or not candidate.resolve().is_relative_to(deploy.root) or not os.access(candidate,os.X_OK):
        raise Conflict('component_runtime_outside_home')
    if component=='gait' and candidate!=gait_runtime(deploy.root):raise Conflict('gait_generation_changed')
    return runtime

def wrapper_ready(component,server,deploy,harness,runtime):
    contract=loads(guarded_read(deploy.source/'config/installer-access.json',1024*1024))['components'].get(component)
    if not contract or server not in contract['servers']:return False
    from setup_generated import generated
    values=generated(deploy.claw,deploy.validator,runtime)
    if 'variants' in contract:
        parts=contract['variants'][server]
    else:
        command=values.get(contract.get('command_env','')) or contract.get('command')
        if not command:
            # A Python server still requires its own actual dependency runtime.
            record=deploy.root/'python-runtimes/records'/component
            if not record.exists():return False
            command=guarded_read(record,8192,private=True).decode().strip()
        script=values.get(contract.get('script_env','')) or (str(deploy.source/contract['script']) if 'script' in contract else None)
        parts=[command]+([script] if script else [])
    if not shutil.which(parts[0],path=harness.environment()['PATH']):return False
    for argument in parts[1:]:
        if isinstance(argument,str) and argument.startswith(str(deploy.source)+os.sep):
            file=Path(argument)
            with directory(file.parent):
                if file.is_symlink() or not file.is_file():return False
    return True

def dependency_ready(component,deploy,harness):
    descriptor=deploy.validator.components[component]
    template=loads(guarded_read(deploy.source/'config/openclaw.json',8*1024*1024))['mcpServers']
    binder=helper(deploy.source,'install-mcp-config.py')
    for name in selected_servers(component,deploy.claw,descriptor):
        if name=='hermes-hud-mcp':continue
        if name not in template:return False
        raw=template[name]
        if not raw.get('command'):continue
        runtime=launcher_runtime(component,deploy,raw,name)
        # A missing Python environment must not fall back to the engine's
        # interpreter just because it happens to have one package installed.
        if raw['command'] in ('python','python3') and not runtime:return False
        if raw.get('args')==['-u','scripts/component-launch.py',component,'--server',name] and not wrapper_ready(component,name,deploy,harness,runtime):return False
        entry=binder.bind_entry(raw,deploy.source,runtime)
        command=entry['command'];env=harness.environment()
        if not shutil.which(command,path=env['PATH']):return False
        for arg in [command,*entry.get('args',[])]:
            if not isinstance(arg,str):return False
            if arg.startswith(str(deploy.source)+os.sep):
                file=Path(arg)
                with directory(file.parent):
                    if file.is_symlink() or not file.is_file():return False
    return True

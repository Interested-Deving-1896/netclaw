#!/usr/bin/env python3
"""Run source-development tests in a real Windows desktop + current WSL host.

Explicit existing Windows Code/WSL-extension paths and supported Linux Node are
required. This creates synthetic homes and a fresh Windows user-data directory;
it does not install software, change owner settings, or restart a distribution.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import uuid


def windows_start(code, argv, profile_name):
    if not profile_name.startswith('netclaw150-') or not all(c.isalnum() or c == '-' for c in profile_name):
        raise ValueError('Only a generated test profile name is permitted')
    # Encode data separately, then quote Windows argv with the standard library.
    # No operator paths are interpolated as executable PowerShell source.
    payload = base64.b64encode(json.dumps(dict(code=code, arguments=subprocess.list2cmdline(argv))).encode()).decode()
    ps = f"""
      $ErrorActionPreference='Stop'
      $v=ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')))
      Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
      Remove-Item Env:VSCODE_IPC_HOOK_CLI -ErrorAction SilentlyContinue
      $profile=Join-Path $env:TEMP '{profile_name}'
      New-Item -ItemType Directory -Force -Path (Join-Path $profile 'User') | Out-Null
      '{{"update.mode":"none","extensions.autoUpdate":false,"telemetry.telemetryLevel":"off"}}' | Set-Content (Join-Path $profile 'User/settings.json')
      $quoted='"--user-data-dir='+$profile+'" '+$v.arguments
      $p=Start-Process -FilePath $v.code -ArgumentList $quoted -PassThru
      @{{pid=$p.Id;profile=$profile}} | ConvertTo-Json -Compress
    """
    powershell = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
    launch = subprocess.run([powershell, '-NoProfile', '-NonInteractive', '-EncodedCommand',
                             base64.b64encode(ps.encode('utf-16-le')).decode()],
                            capture_output=True, check=True, timeout=30)
    return launch.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--code', required=True, help='Existing Windows Code.exe path')
    parser.add_argument('--extensions-dir', required=True, help='Windows directory with compatible WSL extension')
    parser.add_argument('--node', required=True, help='Supported absolute Linux Node executable')
    parser.add_argument('--timeout', type=int, default=180)
    args = parser.parse_args()
    distro = os.environ.get('WSL_DISTRO_NAME')
    if not distro or not Path('/proc/sys/fs/binfmt_misc/WSLInterop').exists():
        parser.error('Run this in the actual intended WSL distribution, with Windows interop enabled.')
    if not Path(args.node).is_absolute() or not Path(args.node).is_file():
        parser.error('Select an existing absolute Linux Node executable.')
    root = Path(__file__).resolve().parents[2]
    private = Path(tempfile.mkdtemp(prefix='netclaw150-windows-editor-'))
    fixtures_script = """
      import {installationFixture} from './tests/operator/fixtures.mjs';
      console.log(JSON.stringify([installationFixture(),installationFixture(null,'hermes')]));
    """
    fixtures = json.loads(subprocess.check_output(
        [args.node, '--input-type=module', '-'], input=fixtures_script.encode(), cwd=root))
    report, failure = private / 'report.json', private / 'failure.txt'
    environment = dict(NETCLAW_TEST_FIXTURES=json.dumps(fixtures), NETCLAW_TEST_ROOT=str(root),
                       NETCLAW_TEST_NODE=args.node, NETCLAW_TEST_REPORT=str(report))
    wrapper = private / 'editor.cjs'
    wrapper.write_text('Object.assign(process.env,' + json.dumps(environment) + ');'
                       'exports.run=async()=>{try{await require(' +
                       json.dumps(str(root / 'extensions/netclaw-vscode/test/editor.cjs')) +
                       ').run();}catch(e){require("node:fs").writeFileSync(' +
                       json.dumps(str(failure)) + ',e.stack);throw e;}};')
    target = 'vscode-remote://wsl+' + distro
    argv = ['--new-window', '--remote=wsl+' + distro,
            '--folder-uri=' + target + str(root),
            '--extensionDevelopmentPath=' + target + str(root / 'extensions/netclaw-vscode'),
            '--extensionTestsPath=' + target + str(wrapper),
            '--extensions-dir=' + args.extensions_dir,
            '--disable-workspace-trust', '--disable-telemetry', '--skip-welcome', '--skip-release-notes']
    launch = windows_start(args.code, argv, 'netclaw150-editor-'+uuid.uuid4().hex)
    (private / 'launch.json').write_bytes(launch)
    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        if failure.exists():
            raise RuntimeError('Editor assertions failed; private evidence: ' + str(private))
        if report.exists():
            result = json.loads(report.read_text())
            if result.get('remoteName') != 'wsl' or result.get('platform') != 'linux' or not result.get('passed'):
                raise RuntimeError('Unexpected editor host/result; private evidence: ' + str(private))
            result.pop('backendNode', None)
            result['scope'] = 'Windows desktop/WSL host; synthetic installations; source development extension'
            print(json.dumps(result, indent=2))
            print('Private evidence:', private)
            return
        time.sleep(0.5)
    raise TimeoutError('No editor result; test window retained for diagnosis. Private evidence: ' + str(private))


if __name__ == '__main__':
    main()

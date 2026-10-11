#!/usr/bin/env python3
"""Opt-in installed VSIX lifecycle in a dedicated, explicitly named WSL distro.

Uses the actual Windows editor and existing WSL server CLI. Refuses to replace
an already installed NetClaw extension. Never run against an owner distribution.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import time
import uuid
import xml.etree.ElementTree as ET
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['code', 'extensions-dir', 'node', 'server-cli', 'vsix', 'test-distro']:
        parser.add_argument('--'+name, required=True)
    args = parser.parse_args()
    if os.environ.get('WSL_DISTRO_NAME') != args.test_distro:
        parser.error('Run inside the explicitly designated isolated test distribution.')
    root = Path(__file__).resolve().parents[2]
    launch = runpy.run_path(str(root/'tests/vscode/windows-wsl-runner.py'))['windows_start']
    server = [args.server_cli, '--extensions-dir', str(Path.home()/'.vscode-server/extensions')]

    def command(*arguments):
        return subprocess.check_output(server+list(arguments), stderr=subprocess.STDOUT, timeout=90).decode()

    if 'netclaw.netclaw' in command('--list-extensions').lower():
        raise RuntimeError('Existing NetClaw extension found; refusing to overwrite it.')
    private = Path(tempfile.mkdtemp(prefix='netclaw150-package-', dir=Path.home()))
    fixture = json.loads(subprocess.check_output([args.node, '--input-type=module', '-'], cwd=root,
        input=b"import {installationFixture} from './tests/operator/fixtures.mjs';console.log(JSON.stringify(installationFixture()));"))
    protected = [Path(fixture['configPath']), Path(fixture['home'])/'.env']
    baseline = [p.read_bytes() for p in protected]
    driver = private/'driver'
    driver.mkdir()
    (driver/'package.json').write_text(json.dumps(dict(name='netclaw-package-driver', publisher='netclaw-tests',
        version='0.0.1', engines=dict(vscode='^1.102.0'), main='index.js', activationEvents=['onStartupFinished'])))
    (driver/'index.js').write_text('exports.activate=()=>{};')
    old = private/'previous-fixture.vsix'
    # This is an explicitly synthetic prior candidate, never a published release.
    with zipfile.ZipFile(args.vsix) as source, zipfile.ZipFile(old, 'w', zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == 'extension/package.json':
                manifest = json.loads(data)
                current_version = manifest['version']
                manifest['version'] = '0.0.1'
                data = json.dumps(manifest).encode()
            elif item.filename == 'extension.vsixmanifest':
                document = ET.fromstring(data)
                for element in document.iter():
                    if element.tag.endswith('Identity'):
                        element.set('Version', '0.0.1')
                data = ET.tostring(document, encoding='utf-8', xml_declaration=True)
            target.writestr(item, data)
    profile = 'netclaw150-package-'+uuid.uuid4().hex
    reports = []

    def phase(name, version):
        report, failure = private/(name+'.json'), private/(name+'-failure.txt')
        env = dict(NETCLAW_PACKAGE_PHASE=name, NETCLAW_PACKAGE_VERSION=version,
            NETCLAW_PACKAGE_EXTENSIONS=str(Path.home()/'.vscode-server/extensions'),
            NETCLAW_PACKAGE_FIXTURE=json.dumps(fixture), NETCLAW_PACKAGE_RECEIPT=str(private/'receipt.json'),
            NETCLAW_TEST_ROOT=str(root), NETCLAW_TEST_NODE=args.node)
        wrapper = driver/(name+'.cjs')
        wrapper.write_text('Object.assign(process.env,'+json.dumps(env)+');exports.run=async()=>{try{await require('+
            json.dumps(str(root/'tests/vscode/package-editor.cjs'))+').run();const v=require("vscode");require("node:fs").writeFileSync('+
            json.dumps(str(report))+',JSON.stringify({passed:true,editor:v.version,remoteName:v.env.remoteName,platform:process.platform}));}catch(e){require("node:fs").writeFileSync('+
            json.dumps(str(failure))+',e.stack);throw e;}};')
        uri = 'vscode-remote://wsl+'+args.test_distro
        argv = ['--new-window', '--remote=wsl+'+args.test_distro, '--folder-uri='+uri+str(root),
            '--extensions-dir='+args.extensions_dir, '--extensionDevelopmentPath='+uri+str(driver),
            '--extensionTestsPath='+uri+str(wrapper), '--disable-workspace-trust', '--disable-telemetry',
            '--skip-welcome', '--skip-release-notes']
        if name == 'disabled':
            argv.append('--disable-extension=NetClaw.netclaw')
        (private/(name+'-launch.json')).write_bytes(launch(args.code, argv, profile))
        deadline = time.monotonic()+120
        while time.monotonic() < deadline:
            if failure.exists():
                raise RuntimeError(name+' failed; private evidence: '+str(private))
            if report.exists():
                result = json.loads(report.read_text())
                assert result['remoteName'] == 'wsl' and result['platform'] == 'linux' and result['passed']
                assert [p.read_bytes() for p in protected] == baseline
                reports.append(dict(phase=name, **result))
                print(name+': passed', flush=True)
                time.sleep(2)  # Let the test-owned editor exit before its next phase.
                return
            time.sleep(0.5)
        raise TimeoutError(name+' did not finish; private evidence: '+str(private))

    command('--install-extension', str(old), '--force')
    phase('initial', '0.0.1')
    command('--install-extension', str(Path(args.vsix).resolve()), '--force')
    phase('upgrade', current_version)
    phase('disabled', current_version)
    command('--uninstall-extension', 'NetClaw.netclaw')
    assert 'netclaw.netclaw' not in command('--list-extensions').lower()
    assert [p.read_bytes() for p in protected] == baseline
    command('--install-extension', str(old), '--force')
    phase('rollback', '0.0.1')
    command('--uninstall-extension', 'NetClaw.netclaw')
    report = dict(passed=True, sha256=hashlib.sha256(Path(args.vsix).read_bytes()).hexdigest(), phases=reports,
        uninstallVerified=True, configurationPreserved=True,
        scope='Actual installed VSIX in Windows/WSL editor; synthetic backend home; no live runtime or Marketplace qualification')
    (private/'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print('Private evidence:', private)


if __name__ == '__main__':
    main()

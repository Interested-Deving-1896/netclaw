#!/usr/bin/env python3
"""Fixed local skill-scan profile in an explicitly bound existing environment.

No component CLI startup, config loading, provider credentials, enforcement or
skill execution. Python audit hooks deny network/process APIs used by the pinned
SDK; they are not an OS sandbox against arbitrary native code or the host user.
"""
import contextlib
import hashlib
import importlib.metadata
import importlib.util
import io
import json
import os
from pathlib import Path
import resource
import stat
import sys
import threading

sys.dont_write_bytecode = True
PROFILE = 'defenseclaw-static-skill-v1'
# Qualified source tree at upstream tag 0.8.10 (package reports 0.8.6), and
# its pinned Cisco SDK 2.0.4 wheel. Changes require qualification, not adoption.
PINNED_SOURCES = {
    'defenseclaw': 'e127f755ec23208c99432fcae6665851c173c2819a47116395cc7b550464635f',
    'skill_scanner': 'e56897eff356312383b2c5532a2cd6930db67a2e8c22747235a8601b4f043707',
}
DENIED = []


def require(condition):
    if not condition: raise ValueError('Unsupported scan profile or source')


def fence(event, args):
    if event in ('socket.connect', 'socket.connect_ex', 'socket.getaddrinfo', 'socket.sendto',
                 'subprocess.Popen', 'os.system', 'os.posix_spawn', 'os.exec', 'os.fork', 'pty.spawn'):
        if len(DENIED) < 20: DENIED.append(event)
        raise PermissionError('Network and process execution are disabled for this profile')


sys.addaudithook(fence)


class BoundedOutput(io.TextIOBase):
    def __init__(self): self.characters = 0
    def write(self, value): self.characters += len(value); return len(value)
    def flush(self): pass


def source_digest(package):
    origin = Path(importlib.util.find_spec(package).origin).resolve().parent
    digest = hashlib.sha256(); count = total = 0
    for file in sorted(origin.rglob('*')):
        if file.suffix.lower() not in ('.py', '.json', '.yaml', '.yml', '.yar', '.yara', '.toml'): continue
        info = file.lstat()
        require(stat.S_ISREG(info.st_mode) and not info.st_mode & 0o022 and info.st_size <= 8*1024*1024)
        require(file.resolve().is_relative_to(origin))
        data = file.read_bytes(); count += 1; total += len(data)
        require(count <= 5000 and total <= 64*1024*1024)
        digest.update(str(file.relative_to(origin)).encode()); digest.update(b'\0'); digest.update(data); digest.update(b'\0')
    require(count > 0)
    return digest.hexdigest()


def probe():
    require(sys.version_info[:2] == (3, 12))
    versions = {name: importlib.metadata.version(name) for name in ('defenseclaw', 'cisco-ai-skill-scanner')}
    require(versions == {'defenseclaw': '0.8.6', 'cisco-ai-skill-scanner': '2.0.4'})
    dependencies = sorted((str(item.metadata['Name']).lower(), item.version) for item in importlib.metadata.distributions())
    sources = {name: source_digest(name) for name in ('defenseclaw', 'skill_scanner')}
    require(sources == PINNED_SOURCES)
    return {'profile': PROFILE, 'python': '.'.join(map(str, sys.version_info[:3])), 'versions': versions,
            'sources': sources,
            'dependencies': hashlib.sha256(json.dumps(dependencies, separators=(',', ':')).encode()).hexdigest()}


def watch_parent():
    # The independent Node worker owns fd 3. Parent loss closes it; do not leave
    # an orphan scanner after a worker crash. Normal closure happens after exit.
    try:
        while os.read(3, 1): pass
    finally:
        os._exit(75)


def scan(value):
    require(set(value) == {'action', 'directory', 'expected', 'files'})
    require(probe() == value['expected'])
    root = Path(value['directory']); require(root.is_absolute() and root.resolve() == root)
    require(root.is_dir() and not root.is_symlink() and root.stat().st_uid == os.getuid() and not root.stat().st_mode & 0o077)
    require(isinstance(value['files'], list) and 0 < len(value['files']) <= 256)
    names = set()
    for entry in value['files']:
        require(isinstance(entry, dict) and set(entry) == {'path', 'sha256'})
        relative = Path(entry['path']); file = root/relative
        require(not relative.is_absolute() and '..' not in relative.parts and str(relative) not in names)
        names.add(str(relative)); info = file.lstat()
        require(file.resolve().is_relative_to(root) and not file.is_symlink() and stat.S_ISREG(info.st_mode)
                and info.st_uid == os.getuid() and not info.st_mode & 0o077 and info.st_nlink == 1 and info.st_size <= 512*1024)
        require(hashlib.sha256(file.read_bytes()).hexdigest() == entry['sha256'])
    require('SKILL.md' in names)
    # The stage contains only the exact reviewed manifest, not caller-supplied
    # adjacent files or linked subtrees discovered by a recursive SDK scan.
    actual = set()
    for file in root.rglob('*'):
        require(not file.is_symlink())
        if file.is_file(): actual.add(str(file.relative_to(root)))
    require(actual == names)
    os.fstat(3)  # A scan always has an owned parent-liveness pipe.
    threading.Thread(target=watch_parent, daemon=True).start()
    resource.setrlimit(resource.RLIMIT_CPU, (45, 50))
    # LiteLLM otherwise fetches pricing metadata even during imports for a
    # scanner with no LLM analyzer. Use its shipped cost map before importing.
    os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
    captured = BoundedOutput()
    with contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
        from defenseclaw.config import SkillScannerConfig, LLMConfig
        from defenseclaw.scanner.skill import SkillScannerWrapper
        class QualifiedWrapper(SkillScannerWrapper):
            def _convert(self, sdk_result, target, elapsed):
                require(not sdk_result.analyzers_failed)
                require(set(sdk_result.analyzers_used) == {'static_analyzer', 'bytecode', 'pipeline'})
                self.completed_analyzers = sorted(sdk_result.analyzers_used)
                return super()._convert(sdk_result, target, elapsed)
        config = SkillScannerConfig(policy='balanced', use_llm=False, use_behavioral=False,
                                    use_trigger=False, use_virustotal=False, use_aidefense=False)
        scanner = QualifiedWrapper(config, llm=LLMConfig())
        result = scanner.scan(str(root))
    require(not DENIED)
    findings = []
    for finding in result.findings[:50]:
        location = str(finding.location or '')
        if location.startswith(str(root)+os.sep): location = location[len(str(root))+1:]
        # A location may have a :line suffix. Retain it only for a reviewed file.
        file, separator, line = location.rpartition(':')
        if separator and line.isdigit() and file in names:
            source = {'file': file, 'line': int(line)}
        elif location in names: source = {'file': location}
        else: source = {'file': None}
        findings.append({'severity': str(finding.severity)[:20], 'title': str(finding.title)[:200],
                         'id': str(finding.id)[:200], 'source': source})
        if len(json.dumps(findings).encode()) > 45000:
            findings.pop(); break
    return {'profile': PROFILE, 'scanner': result.scanner, 'observedAt': result.timestamp.isoformat(),
            'analyzers': scanner.completed_analyzers,
            'durationMs': int(result.duration.total_seconds()*1000), 'findingCount': len(result.findings),
            'findings': findings, 'truncated': len(result.findings) > len(findings),
            'severity': result.max_severity(), 'diagnosticCharactersOmitted': captured.characters,
            'networkAttempts': 0, 'enforcementPerformed': False,
            'scope': 'Static analysis of the reviewed staged skill bytes with the bundled balanced policy. No LLM/behavioral/trigger/VirusTotal/AI Defense analyzer, custom rule pack, skill execution, provider call, installation, quarantine or rule change. Findings are analysis, not proof of safety or running enforcement.'}


def main():
    raw = sys.stdin.buffer.read(512*1024+1); require(len(raw) <= 512*1024)
    value = json.loads(raw); require(isinstance(value, dict))
    if value == {'action': 'probe'}: return probe()
    require(value.get('action') == 'scan'); return scan(value)


if __name__ == '__main__':
    try:
        print(json.dumps({'ok': True, 'data': main()}, allow_nan=False))
    except BaseException:
        print(json.dumps({'ok': False, 'code': 'SCAN_UNAVAILABLE', 'blockedAttempts': len(DENIED)}))
        raise SystemExit(1)

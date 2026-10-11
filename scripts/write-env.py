#!/usr/bin/env python3
"""Read literal dotenv values or atomically update an assignment from stdin.

Environment files are data, not shell programs. Never source their contents.
"""
import json
import os
from pathlib import Path
import re
import shlex
import stat
import sys
import tempfile
import importlib.util

_lock_spec = importlib.util.spec_from_file_location('netclaw_management_lock', Path(__file__).with_name('management_lock.py'))
_lock_module = importlib.util.module_from_spec(_lock_spec)
_lock_spec.loader.exec_module(_lock_module)
configuration_lock = _lock_module.configuration_lock

ASSIGNMENT = re.compile(r'^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$')


def quote(value):
    if any(c in value for c in ('\r', '\n', '\0')):
        raise ValueError('Environment values must be single-line text')
    if re.fullmatch(r'[A-Za-z0-9_@%+=:,./-]+', value):
        return value
    # JSON double-quote escapes are also dotenv escapes. Unlike shell quote
    # concatenation, embedded apostrophes round-trip through dotenv readers.
    return json.dumps(value, ensure_ascii=False)


def values(text):
    result = {}
    for line in text.splitlines():
        match = ASSIGNMENT.match(line.strip())
        if not match:
            continue
        raw = match[2]
        try:
            decoded = json.loads(raw) if raw.startswith('"') else None
        except ValueError:
            decoded = None
        if isinstance(decoded, str):
            result[match[1]] = decoded
        else:
            if raw.startswith(('[','{')):
                try:
                    json.loads(raw)
                    result[match[1]]=raw
                    continue
                except ValueError:pass
            # Preserve existing simple/exported/shell-quoted assignments;
            # shlex parses only and never executes expansions or commands.
            result[match[1]] = ' '.join(shlex.split(raw, comments=True))
    return result


def systemd_quote(value):
    # EnvironmentFile double quotes preserve whitespace and dollar signs;
    # unlike dotenv/JSON, backslash-t is not a tab escape here.
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def update(path, key, value, systemd=False):
    path = Path(path).absolute()
    with _lock_module.configuration_lock(path.parent):
        return _update_locked(path, key, value, systemd)


def _update_locked(path, key, value, systemd=False):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
        raise ValueError('Invalid environment variable name')
    if any(c in value for c in ('\r', '\n', '\0')):
        raise ValueError('Environment values must be single-line text')
    if path.is_symlink() or (path.exists() and not stat.S_ISREG(path.stat().st_mode)):
        raise ValueError('Environment path must be a regular file, not a symlink')
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    original = path.read_bytes().decode() if path.exists() else ''
    lines = original.splitlines(keepends=True)
    retained = []
    index = 0
    while index < len(lines):
        line = lines[index]
        match = ASSIGNMENT.match(line.strip())
        span = [line]
        if match and match[2].startswith(('"', "'", '`')):
            quoted = match[2][0]
            text = match[2]
            def closed():
                for offset in range(1, len(text)):
                    if text[offset] != quoted:
                        continue
                    escapes = 0
                    previous = offset - 1
                    while previous >= 0 and text[previous] == '\\':
                        escapes += 1
                        previous -= 1
                    if escapes % 2 == 0:
                        return True
                return False
            while not closed() and index + 1 < len(lines):
                index += 1
                span.append(lines[index])
                text += lines[index]
            if not closed():
                raise ValueError('Unterminated environment value')
        if not match or match[1] != key:
            retained.extend(span)
        index += 1
    data = ''.join(retained)
    if data and not data.endswith('\n'):
        data += '\n'
    data += key + '=' + (systemd_quote(value) if systemd else quote(value)) + '\n'
    write_private(path, data)


def write_private(path, data):
    """Atomically replace a local text configuration with private permissions."""
    path = Path(path).absolute()
    if path.is_symlink() or (path.exists() and not stat.S_ISREG(path.stat().st_mode)):
        raise ValueError('Configuration path must be a regular file, not a symlink')
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix='.netclaw-config-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


if __name__ == '__main__':
    try:
        systemd = '--systemd' in sys.argv
        if systemd:
            sys.argv.remove('--systemd')
        if sys.argv[1] == '--get':
            print(values(Path(sys.argv[2]).read_text()).get(sys.argv[3], ''), end='')
        else:
            update(sys.argv[1], sys.argv[2], sys.stdin.read(), systemd=systemd)
    except (ValueError, OSError, IndexError) as error:
        # Do not print supplied values or file contents.
        print('Cannot update environment file: ' + type(error).__name__, file=sys.stderr)
        raise SystemExit(1)

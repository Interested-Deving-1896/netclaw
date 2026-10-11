"""Join the existing installation management lock without initializing state.

Used by legacy Python configuration writers. Expiry never permits stealing a
lock: an interrupted writer requires explicit recovery, not another write.
"""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
import stat
import time
import uuid


def _owned(path, directory=False):
    info = path.lstat()
    predicate = stat.S_ISDIR if directory else stat.S_ISREG
    if not predicate(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise ValueError('Management state must not be linked')
    if hasattr(os, 'getuid') and (info.st_uid != os.getuid() or info.st_mode & 0o077):
        raise ValueError('Management state requires private owner permissions')


@contextmanager
def configuration_lock(home):
    home = Path(home).absolute()
    state = home / 'netclaw-hud'
    directory = state / 'management'
    database = directory / 'operations.sqlite'
    if not database.exists() and not database.is_symlink():
        yield
        return
    if home.is_symlink():
        raise ValueError('Installation home must not be linked')
    _owned(state, True)
    _owned(directory, True)
    _owned(database)
    _owned(state / 'installation.json')
    identity = json.loads((state / 'installation.json').read_bytes())
    connection = sqlite3.connect(database.as_uri() + '?mode=rw', uri=True, timeout=5)
    token = None
    try:
        if connection.execute('PRAGMA user_version').fetchone()[0] != 1:
            raise ValueError('Unsupported management journal')
        stored = connection.execute("SELECT value FROM metadata WHERE key='installationId'").fetchone()
        if identity.get('schemaVersion') != 1 or not stored or stored[0] != identity.get('installationId'):
            raise ValueError('Management installation identity changed')
        candidate = str(uuid.uuid4())
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            if connection.execute("SELECT 1 FROM locks WHERE resource='configuration'").fetchone():
                raise ValueError('Configuration is owned by another operation')
            connection.execute('INSERT INTO locks VALUES (?,?,?,?)',
                               ('configuration', candidate, 'existing-python:' + str(os.getpid()), int(time.time()*1000)+30000))
        token = candidate
        yield
    finally:
        try:
            if token is not None:
                with connection:
                    changed = connection.execute("DELETE FROM locks WHERE resource='configuration' AND token=?", (token,)).rowcount
                    if changed != 1:
                        raise ValueError('Configuration lock ownership changed')
        finally:
            connection.close()

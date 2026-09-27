"""Exercise the CLI's actual environment helpers without starting services."""
import os
from pathlib import Path
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT/'scripts/netclaw').read_text()
FUNCTIONS = SOURCE[SOURCE.index('env_get() {'):SOURCE.index('\nngrok_up()')]


@pytest.mark.parametrize('systemd', [False, True])
def test_literal_role_round_trip_and_private_permissions(tmp_path, systemd):
    envfile = tmp_path/('mesh.systemd.env' if systemd else '.env')
    envfile.write_text('OTHER=preserved\nN2N_RISK_NAME=old\n')
    if systemd:
        (tmp_path/'.env').write_text('N2N_RISK_NAME=stale\n')
    value = 'lab & primary | "quote" apostrophe\' $HOME `id` \\path\ttab'
    env = dict(os.environ, RUNTIME_HOME=str(tmp_path), NETCLAW_ROOT=str(ROOT))
    result = subprocess.run(['bash','-c', FUNCTIONS+'\nenv_set N2N_RISK_NAME "$1" && env_get N2N_RISK_NAME', 'test',value],
                            env=env,capture_output=True,text=True)
    assert result.returncode == 0, result.stderr
    assert result.stdout.rstrip('\n') == value
    assert 'OTHER=preserved' in envfile.read_text()
    assert envfile.stat().st_mode & 0o777 == 0o600


def test_failed_cli_write_preserves_existing_file(tmp_path):
    path=tmp_path/'.env';path.write_text('OTHER=preserved\n')
    env=dict(os.environ,RUNTIME_HOME=str(tmp_path),NETCLAW_ROOT=str(ROOT))
    result=subprocess.run(['bash','-c',FUNCTIONS+'\nenv_set N2N_RISK_NAME "$1"','test','name\nINJECTED=yes'],
                          env=env,capture_output=True,text=True)
    assert result.returncode != 0
    assert path.read_text() == 'OTHER=preserved\n'

# Python installation compatibility

The interactive and CLI installers automatically isolate legacy Python components
under the selected runtime home: `~/.openclaw/python-runtimes/<component>` or
`~/.hermes/python-runtimes/<component>`. Each component has its own environment.
System Python protection remains enabled; the installer never passes
`--break-system-packages`.

`NETCLAW_PY` selects the base Python used to create these environments. Existing
component-specific runtimes, including pyATS and multivendor CLI, retain their
own installation paths. An explicit `NETCLAW_VENV` overrides automatic selection;
use it only for a compatible, deliberately selected component runtime.

The helper tries virtualenv, the standard library venv module, then installed uv
with pip seeding. If none can create an environment, installation fails with a
remedy. It does not bootstrap tools into protected system Python. Automatic
legacy environments retain `config/python-shared-constraints.txt` bounds to avoid
changing SDK major versions as part of this migration.

Successful Python installs record the exact interpreter. The installer uses it
for MCP Python commands and installed console entry points, with absolute repo
paths. Only successfully installed and artifact-verified selections are newly
registered. Existing onboarded OpenClaw configurations receive missing entries;
provider settings, credentials, unrelated servers and per-server options are
preserved. Custom launch commands produce a conflict requiring reconciliation,
rather than being overwritten. Changed configs get private timestamped backups.
Hermes consumes the same generated selected template through its existing
non-destructive YAML translator; an existing MCP block still requires the
translator's documented sidecar merge.

A failed pip call makes the component and final installer exit status fail even
if a legacy warning handler swallowed its return code. This is conservative:
if a fallback subsequently succeeds, rerun that component to establish a clean
result. Neither package installation nor an artifact check proves endpoint
connectivity. Credentials, reachable services and tool discovery still require
verification appropriate to the selected integration.

## Upgrade and rollback

Rerun the installer with the desired selection. Existing source-tree `.venv`
directories and system packages are not removed or migrated. Unknown directories
at an automatic runtime destination are refused rather than adopted. Keep the
prior environment until startup and tool discovery pass. To undo registration
changes, restore the recorded config backup and restart the gateway when ready.
Do not delete a runtime while a configured server uses it.

Direct users of `netclaw_pip_install` outside the installer still select their
runtime explicitly:

```bash
source scripts/lib/pip-helper.sh
netclaw_venv_create /path/to/component-venv
NETCLAW_VENV=/path/to/component-venv netclaw_pip_install -r /path/to/requirements.txt
```

Configure that server's launcher to use `/path/to/component-venv/bin/python`.
For pyATS, use the dedicated [HTTP migration](PYATS-HTTP-MIGRATION.md).

## Contract tests do not replace operator runtimes

`python3 scripts/run-contract-tests.py --suite all --prepare` creates named
environments under `.contract-test-envs/`, including ANTA, multivendor and Zabbix.
Existing `mcp-servers/*/.venv` operator runtimes stay in place; no manual move or
data migration is needed. Older test environments are not automatically removed.

Preparation refuses to replace an existing environment without its matching
NetClaw contract ownership marker. Preserve an unexpected directory separately
and inspect it before retrying; there is no force-delete option. Refreshing a
marked test environment retains a temporary recovery copy until installation
succeeds. A failed refresh restores the original path. An interrupted process
may leave `<environment>.previous-*` beside the new environment: preserve both,
move the partial new directory aside, then move the recovery copy back to the
original path before using its Python. A relocated virtualenv is not directly
runnable. Contract artifacts remain checksum-verified separately.

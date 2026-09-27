# Python installation compatibility

The installer uses the `python3` selected by PATH unless `NETCLAW_PY` specifies
another interpreter. Shared legacy MCP installations apply the tracked bounds in
`config/python-shared-constraints.txt`; conflicting packages fail resolution
instead of silently replacing an incompatible MCP major.

Modern pyATS (MCP2), Zabbix (FastMCP3), and other integrations with dedicated
runtimes install into their own environments. Do not point `NETCLAW_VENV` at an
arbitrary existing environment to bypass a shared constraint: its runtime must
match the server that will use it.

A distro-managed Python refusal (PEP 668) now stops installation. NetClaw no
longer retries using `--break-system-packages`. To migrate a manually managed
component, create a dedicated environment using the helper and configure that
component's launcher to use its interpreter:

```bash
source scripts/lib/pip-helper.sh
NETCLAW_PY="$(command -v python3)" netclaw_venv_create /path/to/component-venv
NETCLAW_VENV=/path/to/component-venv netclaw_pip_install -r /path/to/requirements.txt
```

Use an empty environment and the component's tested dependency bounds. Preserve
the prior runtime and configuration until startup and tool discovery pass. These
helper changes do not uninstall packages or move existing credentials/state.
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

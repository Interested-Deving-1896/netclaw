
## macOS keyboard follow-up — 2026-10-09

- PASS: `/bin/bash` is Apple Bash 3.2.57. Baseline `read -t 0.05`
  reports `invalid timeout specification`; PTY Down cancels the menu.
- Regression proof: execute the arrow-decoding and runtime-cancellation tests
  against temporary copies of HEAD's installer and TUI. Eight arrow subcases
  and two cancellation subcases fail before the patch.
- PASS: `python3 -m unittest discover -s tests/unit -p test_installer_tui.py -v`
  — all 10 tests pass using `/bin/bash` and real pseudo-terminals. Includes
  CSI/application arrows, j/k shortcuts, checklist selection, actual installer
  Hermes selection and q/Escape cancellation, EOF, explicit runtime, and
  non-interactive defaults. No installation steps run.
- PASS: `/bin/bash -n scripts/install.sh scripts/lib/tui.sh`.
- PASS: `python3 scripts/verify-spec-artifacts.py` — 128 specs checked.
- PASS: `python3 scripts/verify-catalog-coverage.py` — zero unexplained gaps.
- PASS: `scripts/reconcile-mcp.py --surface catalog --surface dependencies
  --surface docs --surface meraki-ids --surface packages --surface portability`
  using the app-bundled Python. System Python 3.9 cannot load the existing
  dependency check's union annotations; rerunning with bundled Python resolves
  the initial check failure. No dependency files changed.
- PASS: contract suite inventory and matrix commands; `git diff --check`.
- Pytest is absent from both available Python environments. The focused
  regression suite runs with standard-library unittest and remains collectable
  by the repository's pytest unit suite. The full unit suite was not run.
- Limits: Greg's exact macOS 15.7.9/Terminal session and Linux/modern Bash
  have not been tested. Standalone Escape waits up to one second.
- Local review patch only; no PR, release bump, push, or package installation.

Workaround on unpatched main: `./scripts/install.sh --runtime hermes
--profile recommended` (run as a single command). This bypasses both selection
menus; omitting `--profile recommended` keeps the component menu interactive.

## Python prerequisites/retry follow-up — 2026-10-09

Greg's log confirms missing uv. It uses `/usr/bin/python3` and pip 21.2.4,
consistent with Apple's Python 3.9; Greg's exact version is still pending.
Verified package metadata requires Python >=3.10 for fastmcp 4.0.11 and
mcp 2.3.0. The local `/usr/bin/python3` is 3.9.6 and the new minimum check
rejects it with actionable guidance. No package constraints were loosened.

- Baseline regression proof: previous code incorrectly accepts old installer
  Python, an old explicit base and missing uv; it reuses an old managed runtime.
  Four corresponding checks fail against temporary copies of prior code.
- PASS: 57 tests via isolated pytest 8.4.2 (`/private/tmp/netclaw-installer-tests/bin/python -m pytest ... -q`).
  Test files: test_installer_python_prerequisites.py,
  test_installer_prerequisite_isolation.py, test_installer_python_runtime.py,
  test_installer_tui.py, test_installer_exit_status.py,
  test_installer_constraints.py, test_installer_component_paths.py,
  test_pyats_runtime_recovery.py and test_gait_runtime_recovery.py.
  Includes prerequisite failure, selection-specific uv requirement, explicit
  old runtime refusal, supported runtime reuse, preserved state/records on
  failed retry, and rejection of unmanaged/symlink recovery destinations.
- PASS: actual Python 3.9 stdlib venv retained byte-for-byte for its config and
  sentinel; a new Python 3.12.14 runtime installed an offline fixture wheel
  and recorded the new interpreter. No system or MCP component packages changed.
  An initial smoke test incorrectly used `pip install --version`; it failed
  because pip requires an install requirement. The corrected fixture-wheel
  test exercises real installation and success recording.
- PASS: Bash 3.2 syntax checks for install.sh, install-steps.sh, pip-helper.sh
  and tui.sh; spec artifact checker; declaration reconciliation for catalog,
  dependencies, docs, meraki-ids, packages and portability; `git diff --check`.
- Pytest was installed only in an isolated temporary test environment.
- Limits: Greg's version/full log pending; no full 108-component install,
  real vendor/service discovery, Linux/modern Bash or existing config conflict
  resolution validated. This corrects confirmed prerequisite/retry gaps without
  claiming every reported component failure has been proven resolved.

PR 284 merged as c2cc6d4. Follow-up branch:
`codex/fix-installer-python-prerequisites`, based on that upstream merge.

## Full-log follow-up — 2026-10-09

The supplied version output confirms Python 3.9.6. Read 104 actual logs from
the archive without extracting it; excluded AppleDouble metadata. 42 contain
resolver failures, 11 modern editable-install errors, five no-matching-package
errors and two missing-uv staged failures. Counts describe messages, not a
validated number of failed components. The raw archive and private analysis
are not committed or uploaded to GitHub.

- PASS: 124 tests under isolated Python 3.12.14/pytest 8.4.2, using:

  ```bash
  /private/tmp/netclaw-installer-tests/bin/python -m pytest \
    tests/unit/test_installer_python_prerequisites.py \
    tests/unit/test_installer_python_runtime.py \
    tests/unit/test_installer_prerequisite_isolation.py \
    tests/unit/test_installer_exit_status.py \
    tests/unit/test_installer_constraints.py \
    tests/unit/test_installer_component_paths.py \
    tests/unit/test_installer_tui.py \
    tests/unit/test_installer_mcp_config.py \
    tests/unit/test_installer_log_followups.py \
    tests/unit/test_jev_installer.py \
    tests/unit/test_pyats_runtime_recovery.py \
    tests/unit/test_gait_runtime_recovery.py \
    tests/n2n/test_certs_060.py -q
  ```

  Includes dedicated-runtime preservation, ownership refusal and reuse,
  obsolete-pip/system-pip boundaries, recorded launch binding, installation
  and import failures, certificate runtime/dependency failures, and portable
  gtrace parsing with failed placement. The certificate tests exercise real
  cryptography 46.0.7 and temporary credential/database paths. One existing
  utcnow deprecation warning; no test failures. New tests are collected by
  the existing unit suite; certificate coverage belongs to the n2n suite.
- Regression proof: six new cases fail against temporary copies of the
  previous committed code (source venv recovery, three pip-upgrade boundary
  cases, certificate setup and gtrace). No checkout reset was used.
- PASS: `tests/installer/run-tests.sh`, with the temporary test interpreter
  on PATH and selected as NETCLAW_PY. Memory MCP wheel includes its SQLite
  schema; bgp-intel, gnmi, nautobot and suzieq install into temporary component
  runtimes. Generated registrations launch these four servers and obtain
  tool lists with both legacy and 2026-07-28 protocol versions. No endpoint
  tools are invoked. fwrule: BLOCKED_DEPENDENCY, optional checkout absent.
- PASS: Apple Bash 3.2 syntax, spec artifact checks, catalog/dependency/docs/
  Meraki/package/portability reconciliation, suite inventory/matrix and diff
  whitespace checks. No constraints for other integrations were loosened.
- Limits: no full 108-component installation, live vendor/service discovery,
  Greg's exact Terminal/macOS session, Linux or modern Bash validation.
  Dedicated external integrations are covered with sanitized fixtures, not
  live deployments. Docker, kubectl, Ollama, packet capture, browser setup and
  Linux Computer Use requirements remain operator prerequisites. Existing
  custom launch conflicts still require reconciliation before retiring old
  environments. pip upgrades require package-index availability.

This extends existing draft PR285. Release metadata remains pending maintainer
coordination under CONTRIBUTING.md/docs/RELEASING.md; no release is claimed.

### Spec 144 integration follow-up — 2026-10-09

Integrating main into PR #286 exposed stale standalone/reconciliation fake-Python
fixtures: they rejected the new sys.version_info prerequisite before reaching
intended PEP 668/install-error assertions. Add a successful version-probe response,
retaining the original pip failures and credential-preservation assertions.
Zabbix's source check now recognizes netclaw_component_venv only when that helper
retains netclaw_venv_create delegation and Python validation. This is test-only
compatibility repair for the already-merged installer behavior.

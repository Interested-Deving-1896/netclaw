
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

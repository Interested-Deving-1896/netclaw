
## 2026-10-09 — macOS installer keyboard investigation

Local branch: `codex/fix-macos-installer-arrows`, base `95bb17e`. GAIT MCP/CLI
is unavailable in this session; this append-only file records the work rather
than claiming a GAIT tool run. No network devices or services were operated.

Request: investigate Greg's report that arrows skip the runtime prompt and
default to OpenClaw. Reproduced Bash 3.2's rejected fractional read timeout,
identified swallowed runtime cancellation, updated the existing modular TUI
spec before implementation, patched both paths, and added PTY regressions.
All 10 focused tests and repository reconciliation checks pass. See
verification.md for commands, regression evidence, environment limitations and
the explicit Hermes CLI workaround. Changes remain local and uncommitted.

### Follow-up: commit authorization

The user requested committing the verified fix to the repository. Prepared
the installer changes, PTY regression tests and spec 049 follow-up artifacts
for a local commit on `codex/fix-macos-installer-arrows`. No push requested.

## 2026-10-09 — Python prerequisites/retry follow-up

Greg's next log confirmed uv missing and showed dependency resolution failures
under Apple's python3/pip. Source/package metadata exposed absent Python
minimum checks and blind reuse of old managed venvs. Updated spec/plan/tasks
before implementation, added early minimum and uv checks, preserved old
automatic runtimes while recovering into a separate compatible target, and
documented the Homebrew remedy. 57 focused tests and declaration checks pass;
real Python 3.9-to-3.12 retry verified with an offline fixture wheel.

Greg's exact version remains unconfirmed; no full fleet installation claimed.
Original PR 284 is merged. Prepared a separate follow-up commit/PR on
`codex/fix-installer-python-prerequisites` from c2cc6d4. GAIT tools remain
unavailable; this file records the session. No devices or credentials accessed.


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

# Mac assistant client evidence — 2026-10-10

This evidence belongs to `150-vscode-extension-release`, following WSL commit
`413d532`. It is not WSL, Remote SSH, Copilot inference, or runtime-delegation
acceptance. No owner NetClaw was selected by these tests.

## Actual installed clients

- Codex CLI 0.162.1: local authentication status reports logged in.
- Claude Code 2.1.286: local authentication reports logged in using claude.ai.
- VS Code 1.108.0 is installed. The isolated extension-host check used the
  separate minimum editor 1.102.0, macOS arm64, Darwin 25.5.0.
- Publisher verification through locked vsce 4.0.0 failed with `TF400813`, user
  not authorized. No token was printed and no publication was attempted.

## Reproducible provider-backed CLI check

`tests/assistant-clients/live-cli.mjs` allocates fresh private runtime homes,
creates a one-hour inspect/propose grant using actual GAIT, and supplies only
the fixed assistant launcher through per-invocation MCP configuration. It does
not add global registrations. Built-in command/file tools are excluded for
Claude and shell/browser/apps/plugins are disabled for the Codex test invocation.
The external client's existing authentication is reused; provider calls contain
synthetic installation status, an empty operation inventory and a budget proposal.

```sh
NETCLAW_TEST_LIVE_CLIENTS=1 NETCLAW_TEST_CLIENT=claude-code node tests/assistant-clients/live-cli.mjs
NETCLAW_TEST_LIVE_CLIENTS=1 NETCLAW_TEST_CLIENT=claude-code NETCLAW_TEST_HARNESS=hermes node tests/assistant-clients/live-cli.mjs
NETCLAW_TEST_LIVE_CLIENTS=1 NETCLAW_TEST_CLIENT=codex node tests/assistant-clients/live-cli.mjs
```

Use supported Node 24.19.0 and installed GAIT. These commands intentionally make
small external provider requests. Claude's per-run API budget is capped at $0.50;
observed successful costs below are client-reported, not NetClaw usage.

| Client / synthetic binding | Observed result |
|---|---|
| Claude / OpenClaw | Status and inventory succeeded; actual `netclaw_propose_change` created one `pending-approval` proposal. No apply. Successful run reported $0.0356144. Settings, MCP registrations and client-state file hashes unchanged on that run. |
| Claude / Hermes | Status and inventory succeeded; actual budget proposal call returned `UNSUPPORTED`; zero proposals and no apply. Reported $0.0175264. Settings, registrations and state-file hashes unchanged. |
| Codex / OpenClaw | Status and inventory succeeded. Client attempted the proposal tool but refused it with “MCP tool call requires approval, but approval policy is never.” Zero backend proposals. Settings file unchanged. This row is partial, not a pass. |

Initial Claude runs exposed that a root `oneOf` input schema caused the client
to omit the proposal tool. Discovery now has root object properties; dispatch
still uses the narrower action-specific union. The successful rerun above
demonstrates the correction. One earlier run changed the Claude CLI's state-file
hash; the harness now separately measures settings/registration preservation.
No rollback of client-owned state or credentials was attempted.

## Automated boundary checks

Tests cover the seven-tool surface, private-method denial, spoofed roles,
credential references without values/hashes, cross-grant ownership, expiry and
revocation, result withholding after revocation during an asynchronous read,
and refusal to finish preparing a proposal after revocation during audit.
Delegation remains denied instead of borrowing an operator runtime.

Extension tests cover opt-in discovery, no discovery side effects, immutable
installation/host/grant definitions, resolve-time revocation, cancellation,
Restricted Mode, disconnect and safe SSH quoting.

## Required remaining acceptance

Interactive Codex proposal confirmation; actual Copilot tool calls; qualified
NetClaw delegated requests and cancellation on both harnesses; nested/federated
grant enforcement; named-client expiry, revocation and lost-response workflows
on real WSL and Remote SSH. T048–T055 are not collectively complete.

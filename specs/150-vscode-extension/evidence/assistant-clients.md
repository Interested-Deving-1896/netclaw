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
OpenClaw delegation remains denied. The separate protected Hermes checkpoint
below does not borrow an operator runtime or its authority.

Extension tests cover opt-in discovery, no discovery side effects, immutable
installation/host/grant definitions, resolve-time revocation, cancellation,
Restricted Mode, disconnect and safe SSH quoting.

## Required remaining acceptance

Interactive Codex proposal confirmation; actual Copilot tool calls; qualified
NetClaw delegated requests and cancellation on both harnesses; nested/federated
grant enforcement; named-client expiry, revocation and lost-response workflows
on real WSL and Remote SSH. T048–T055 are not collectively complete.

## Mac protected Hermes delegation — 2026-10-11

The actual existing federation broker, pinned Hermes v0.21.6 companion, official
subnet MCP and detached management worker now execute the local assistant subnet
profile. The test uses fresh installation homes and a loopback controlled provider.
It is not a hosted-provider or named-client acceptance result.

`tests/assistant-clients/hermes-process.test.mjs` passed on macOS 26.5.2 arm64,
Node 24.19.0, isolated federation Python 3.12 and companion Python 3.14.6:

- Official MCP handshake exposes seven tools. A submitted subnet request survives
  MCP client exit and retains real tool evidence plus its answer.
- Exactly two provider requests complete the tool round trip. Reconnecting and
  repeating the admission nonce does not create another request.
- A forged shell tool returned by the controlled provider fails with no tool effect.
- Revocation while the provider is blocked prevents the subsequent subnet tool
  and further inference. Cached MCP reads are denied; the human sees the actual
  failed/cancelled outcome. The existing companion stays alive and config bytes
  are preserved.

The Python assistant bridge, execution-scope and actual prior Hermes lifecycle
suite passed **17 tests**. The transport guard suite passed **6 tests**, including
a reused HTTP client after revocation, SDK retry enablement and redirect refusal.
The management/assistant suite passed **125 tests**, with **7 explicit platform/
process opt-in skips**; extension tests passed **40**. These counts are separate
from the one real MCP/worker/runtime process check above.

An initial real test produced model text without a subnet tool. The isolated
checkout lacked the ignored installed subnet source. The reviewed installed
source (SHA-256 `bfb8bb548aa7096c0b2324a3798c581ce917a26388aa6193ae66eb0708e7dd45`)
was copied into this test checkout, leaving the owner's installation untouched.
Readiness was tightened to require the actual companion's qualified tool list;
missing source/tool now refuses admission before inference. This was a test
prerequisite correction, not acceptance from a text-only model response.

Additional boundary cases cover first-turn conversation overlap, unknown-outcome
continuation, result disclosure through inventory/status/replay/cancel, source
grant mutation and operator cancellation after revocation. Native setup offers
delegation only for the exact qualified local profile, and answer disclosure is
reviewed separately. T049/T050/T053 implementation is complete; T054 and the
remaining broad runtime/federation/platform acceptance remain open.

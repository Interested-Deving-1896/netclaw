# Mac implementation checkpoint — 2026-10-10

Branch: `150-vscode-extension-release`, based on the returned WSL commit
`413d532`. This checkpoint advances implementation; it is not release acceptance
and is not the requested final validation-only WSL handoff yet.

## Implemented and exercised

- Strict versioned MCP output envelopes, bounded JSON and visible truncation.
  Invalid adapter output cannot cross the protocol boundary. Assistant proposal
  discovery is compatible with Claude Code while dispatch retains action unions.
- Opaque revisions include Hermes companion authentication state. Shared
  configuration locks remain held through asynchronous completion. The Python
  CLI writer and HUD writer participate in the same lock; edits preserve
  unrelated CRLF, comments and multiline assignments.
- Reviewed provider/model and OpenClaw session-budget saves preserve unrelated
  configuration. Legacy OpenClaw and Hermes credentials can be normalized into
  private `.env` references, without rotation. Conflicting values are refused;
  rollback restores original bytes and refuses intervening manual edits.
  Saved state is reported as pending restart/effective verification.
- Native settings dialogs, grant/disclosure/expiry review, grant revocation,
  opt-in stable Copilot discovery and credential-free terminal setup previews.
- Bounded selected-installation logs, recorded-usage time windows, scoped Hermes
  usage, configured network inventory and read-only memory search with temporal
  validity. No live topology or aggregate Hermes pricing is invented.
- Searchable bundled documentation with backend version/context, inert document
  content and fixed official external destinations.

## Validation

Supported Node 24.19.0 was selected explicitly. Existing system Node and owner
services/configuration were not upgraded, restarted or changed by implementation.

| Check | Observed result |
|---|---|
| Backend/assistant behavior after schema and nonce regressions | 80 passed, 5 skipped; the skips are four opt-in process tests and actual Linux binding on this Mac. Includes the Hermes credential-source regression. |
| Package allowlist | One passed; exact 22-file runtime allowlist and synthetic private-file exclusion. |
| Extension unit and TypeScript checks | 20 passed; TypeScript passed. |
| Real minimum desktop editor | VS Code 1.102.0, macOS arm64, Darwin 25.5.0: 13 assertion groups passed with separate synthetic OpenClaw/Hermes homes, rendered Chat/Canvas/Avatar/RAG and actual cached-model retrieval. |
| Real separate processes | Four passed: installed OpenClaw 2026.7.1-2, pinned Hermes v0.21.6, detached GAIT/configuration worker and actual cached-model RAG indexing. Controlled loopback providers for runtime tests. |
| Existing HUD suite | 372 passed, zero failures/skips after shared env/budget/usage changes. |
| Existing Python environment/CLI suite | 37 passed using isolated Python 3.12. System Python lacked pytest; it was not modified. |
| Actual named CLI clients | Claude positive proposal and Hermes refusal; Codex inspection succeeds but client proposal approval is blocked. See [client evidence](assistant-clients.md). |

The former WSL-specific host-binding test incorrectly expected a distro variable
to change Mac identity. A pure fingerprint test now covers Linux and Mac rules;
the actual Linux integration assertion is explicitly skipped on Mac.

Cross-artifact analysis maps all 57 FR/SC identifiers to 79 tasks with no unmapped
requirement or task. Twenty-eight tasks are complete. It found assistant-directory
path drift (corrected) and legacy JSON credential fallback in the new management
Hermes path (removed and tested, with companion port retained during normalization).
Unimplemented workflows are release gaps, not acceptance passes or constitutional
waivers. Current artifact coherence is complete; it must be maintained as remaining workflows are implemented.

## Remaining implementation and release gates

Assistant runtime/federation attenuation and delegation, lifecycle/runtime/role
transactions, exact Terminal Intent and production authority integration, full
DefenseClaw/OpenShell controls, peer/member mutation workflows and remaining
Jev/GCF/meeting/mobile workflows are incomplete. Hermes per-conversation model/effort overrides and effective
restart verification remain limited. Domain/performance/accessibility coverage,
complete real client/platform qualification, Spec149 dependencies, exact VSIX
lifecycle and public Marketplace installation remain mandatory.

The owner has authorized publication once ready. Local publisher verification
currently fails; successful publisher authentication and the remaining gates are
required. No public extension or completed 100% state is claimed.

## Artifact checkpoint

Setup/recovery, compatibility and assistant guides, private MCP tool inventories,
root capability references, `.env` guidance, the operator guidance skill and a
local milestone draft are present. The generated HUD documentation index now
exposes these guides through its existing Documentation panel. Current inventory:
238 skills, 124 registered plus 52 external integrations; the two private
management surfaces stay outside the agent registry. Inventory and catalog
coverage checks pass. T072 covers the current implementation coherence; remaining domain code must maintain it. The local draft is not published.

## Owned model settings and durable progress

The actual OpenClaw 2026.7.1-2 gateway verified the selected configured model and
`low` effort before both contextual turns. This exposed upstream's admin scope
requirement for session model/effort settings: only the explicit owned-session
settings action uses a short-lived, fixed-method admin connection. Ordinary
inference retains read/write scope. No assistant gains operator access.

Public answer events are correlated with the owned request, coalesced, redacted
and retained independently of the editor. A real-process assertion caught fast
answers being overwritten by a lifecycle event before the coalescing deadline;
the fix flushes the buffered answer before a different event kind. The real
assertion now passes. Private reasoning and tool arguments are excluded. Hermes
reads owned tool-ledger milestones. Unit faults preserve partial evidence without
resending uncertain work and enforce a 1,000-update bound.

Chat/Canvas/RAG now capture a bound caller for every operation so a profile switch
during an asynchronous dialog cannot redirect its subsequent requests. Opening
conversations also requires successful GAIT recording. Native model-selection
review is read-only and never invokes inference. The actual rendered editor run
passed all 13 groups; the new Chat screenshot was inspected at native resolution.

Installed CLI probes passed using Codex 0.162.1 and Claude Code 2.1.286. Terminal
setup now probes the fixed `--version` command before grant creation/export and
refuses unknown versions, mismatched hosts and unsupported command grammars.

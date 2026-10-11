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
| Backend/assistant behavior after schema and nonce regressions | 74 passed, 5 skipped; the skips are four opt-in process tests and actual Linux binding on this Mac. Includes the Hermes credential-source regression. |
| Package allowlist | One passed; exact 22-file runtime allowlist and synthetic private-file exclusion. |
| Extension unit and TypeScript checks | 16 passed; TypeScript passed. |
| Real minimum desktop editor | VS Code 1.102.0, macOS arm64, Darwin 25.5.0: 13 assertion groups passed with separate synthetic OpenClaw/Hermes homes, rendered Chat/Canvas/Avatar/RAG and actual cached-model retrieval. |
| Real separate processes | Four passed: installed OpenClaw 2026.7.1-2, pinned Hermes v0.21.6, detached GAIT/configuration worker and actual cached-model RAG indexing. Controlled loopback providers for runtime tests. |
| Existing HUD suite | 372 passed, zero failures/skips after shared env/budget/usage changes. |
| Existing Python environment/CLI suite | 37 passed using isolated Python 3.12. System Python lacked pytest; it was not modified. |
| Actual named CLI clients | Claude positive proposal and Hermes refusal; Codex inspection succeeds but client proposal approval is blocked. See [client evidence](assistant-clients.md). |

The former WSL-specific host-binding test incorrectly expected a distro variable
to change Mac identity. A pure fingerprint test now covers Linux and Mac rules;
the actual Linux integration assertion is explicitly skipped on Mac.

Cross-artifact analysis maps all 57 FR/SC identifiers to 79 tasks with no unmapped
requirement or task. Seventeen tasks are complete. It found assistant-directory
path drift (corrected) and legacy JSON credential fallback in the new management
Hermes path (removed and tested, with companion port retained during normalization).
Unimplemented workflows are release gaps, not acceptance passes or constitutional
waivers. Full artifact-coherence work remains T072.

## Remaining implementation and release gates

Assistant runtime/federation attenuation and delegation, lifecycle/runtime/role
transactions, exact Terminal Intent and production authority integration, full
DefenseClaw/OpenShell controls, peer/member mutation workflows and remaining
Jev/GCF/meeting/mobile workflows are incomplete. Model effort and effective
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
coverage checks pass. T072 remains open until all implementation coherence and
required regression gates are complete; the local draft is not published.

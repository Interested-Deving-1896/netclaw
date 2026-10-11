# Mac return — HUD repaired; WSL qualification still open

Return branch: `150-vscode-extension-wsl-followup-20261011`.
Evidence commit: `940a90ccdd3ea10ee6cc0fba2b874bb25161d2ed`.
The following return-document commit changes only this file; its exact branch-tip
commit is supplied in the handoff message. No merge or publication occurred.

Incoming Mac review: `4e3cd2627ac80b7d160af7b135d30dec6580f202` on
`150-vscode-extension-wsl-review-20261011`. The prior `1aaaafa` return remains an
ancestor, and [its evidence](evidence/wsl.md) is preserved unchanged.

VSIX: `specs/150-vscode-extension/artifacts/netclaw-0.1.0.vsix`.
SHA-256: `71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005`.
It is unchanged. No extension or NetClaw source code was changed in this follow-up.

Actual results are in [evidence/wsl-followup.md](evidence/wsl-followup.md) and the
[sanitized report](evidence/wsl-followup-checks.json):

- The explicitly authorized HUD repair succeeded. Restored already-locked
  dependencies with retained rollback backups and selected the existing Node
  24.19 for the HUD alone. Its API reports the preserved OpenClaw identity and
  readiness; gateway status reports online/reachable/chat enabled. Actual provider
  execution remains unverified.
- All 12 protected file observations stayed unchanged. Owner source, credentials,
  native identity, selection descriptor, testbed edits and core gateway/federation
  service identities are preserved. The HUD was intentionally restarted; scheduled
  DDNS and already-restarting Zoom RTMS identities also varied independently.
- The single isolated Windows editor attempt exited 255 before logging or running
  the observer. Read-only inspection found live updater processes and the
  `vscode-updating` mutex still present. The owner must finish the update normally.
  No owner window/updater was terminated. The temporary editor isolation hook was
  restored to its original absence.
- Exact VSIX installation into prepared private WSL storage passed, as did payload
  comparisons of that install and the preserved owner install. Actual launched-host
  storage isolation and upgrade/disable/re-enable/uninstall remain unqualified.
- Fifteen of 17 real API GET probes returned HTTP 200. RAG stats/documents returned
  HTTP 500 because its existing Python launcher sees FastMCP 2.14.7 / MCP 1.28.1,
  while source requires FastMCP/tasks 4.0.11 / MCP 2.3.0. The missing import is
  `fastmcp.utilities.async_utils`. No Python repair was performed; it falls outside
  the approved HUD repair scope and needs a separately reviewed correction.
- Actual editor connection/panels, Chat/provider, Canvas/Avatar, RAG retrieval,
  settings cancellation, trust/reconnect and interactive Copilot/Claude Code/Codex
  remain pending. No assistant registrations or provider requests were submitted.

**T022 and T023 remain open. This checkpoint is not release acceptance.**
The prior Mac publisher authentication stays on Mac; no additional publisher
account, token transfer or WSL publication is needed.

## Prompt for the Mac continuation

```text
Continue NetClaw Spec150 from origin/150-vscode-extension-wsl-followup-20261011.
Use the exact returned branch tip supplied in the handoff; require evidence commit
940a90ccdd3ea10ee6cc0fba2b874bb25161d2ed as an ancestor. The following commit only
updates mac-return.md. Preserve work and services and use an isolated checkout.
Read AGENTS.md, startup files, daily memory, constitution, Spec150 spec/plan/tasks,
scope-recovery.md, windows-wsl-handoff.md, wsl-prerequisite-recovery.md,
evidence/wsl.md, evidence/wsl-followup.md and evidence/wsl-followup-checks.json.
Follow GAIT startup, recording and session-end requirements.

Exact unchanged NetClaw.netclaw@0.1.0 VSIX SHA256:
71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005.

The owner-approved bounded HUD repair is DONE on WSL: locked dependencies with
rollback backups, existing Node 24.19 for HUD only, preserved source/credentials/
identity/core services. Do not repeat or roll back that successful repair merely
to resume. The old dependency tree is retained locally and intentionally untracked.

This is a partial checkpoint. The Windows editor update still needs normal owner
completion; do not kill owner windows/updater or bypass its mutex. RAG has a separate
reproduced Python/FastMCP dependency mismatch. Review a concrete bounded runtime
correction separately before applying it; do not silently extend the HUD approval
into Python upgrades, backend source changes, policy changes or broader restarts.

Complete the remaining checks on real Windows VS Code with its host running in WSL
once prerequisites permit. Verify actual separate WSL storage before lifecycle
mutations. Use the exact candidate, live provider and RAG, and each signed-in
interactive Copilot/Claude Code/Codex with normal consent. Preserve the owner install
and unrelated MCP registrations. Do not substitute API observations, CLI presence,
source fixtures or Mac tests for WSL UI and assistant acceptance. Fix only reproduced
extension defects; preserve and requalify an exact replacement if package inputs change.

T022/T023 remain open. Do not merge or publish until actual acceptance and Mac review
permit release. Then use existing Mac-local publisher authentication to publish the
qualified exact VSIX and verify Marketplace listing/install in an isolated profile.
Do not export credentials or weaken approvals. Follow the constitution's milestone/
blog-draft requirement; external blog/message publication needs its separate review.
```

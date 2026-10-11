# Mac return — partial WSL validation, release still blocked

Mac reviewed this return in `150-vscode-extension-wsl-review-20261011`.
See [the review](evidence/mac-wsl-return-review.md) and
[bounded WSL prerequisite recovery](wsl-prerequisite-recovery.md).
The original return and its limitations below remain valid. No repair or
acceptance is implied by preparing that plan.

Return branch: `150-vscode-extension-wsl-20261011`.
Evidence commit: `5983cc37e192ba4954ff50fa65d502a5fa385d8f`.
The following return-document commit changes only this file; the final branch-tip
commit is supplied with the handoff message. No merge or publication occurred.

Incoming candidate: `c21b4f802ee7909bfb9ee1e258b0e5c668702f0d` on
`150-vscode-extension-only`, implementation source
`8db2c2144e169f4c2ab832d3d62c40f1b1c6a807`.

VSIX: `specs/150-vscode-extension/artifacts/netclaw-0.1.0.vsix`.
SHA-256: `71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005`.
It is unchanged. No extension code or backend code was changed in WSL.

Actual results are in [evidence/wsl.md](evidence/wsl.md) and the sanitized
[check report](evidence/wsl-checks.json):

- Exact VSIX installed and activated in the real Windows VS Code 1.140 / WSL host;
  installed payload bytes match. TypeScript/build passed; 16 tests passed and one
  optional local RAG test was skipped.
- Existing owner HUD API is unavailable: startup fails on missing installed
  `@modelcontextprotocol/client`, using unsupported owner Node 25.1.0. The owner
  explicitly selected this installation and requested blocked-live reporting.
- Live identity, panels, Chat/provider, RAG and interactive Copilot/Claude Code/Codex
  remain blocked. An isolated Windows editor launch failed on the existing
  `vscode-updating` mutex, so full installed lifecycle is also unqualified.
- Owner configuration/testbed/assistant configuration hashes were preserved. A WSL
  interruption changed service identities during the session; no restart command
  was issued by the validation. Continuous uptime preservation is not claimed.

**T022 and T023 remain open. This return is not permission to skip acceptance.**

## Prompt for the Mac continuation

```text
Continue NetClaw Spec150 from origin/150-vscode-extension-wsl-20261011.
Read evidence commit 5983cc37e192ba4954ff50fa65d502a5fa385d8f and the following
mac-return.md commit; use the exact returned branch tip supplied in the handoff.
Preserve existing work and services. Use an isolated checkout. Read AGENTS.md,
startup files, the constitution, and Spec150 spec/plan/tasks, scope-recovery.md,
windows-wsl-handoff.md, evidence/wsl.md and evidence/wsl-checks.json.
Follow GAIT startup, recording and session-end requirements.

The incoming VSIX is unchanged, SHA256:
71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005.
The WSL return is partial and blocked, not release acceptance. T022/T023 are open.
Review the observed missing HUD dependency/unsupported owner Node prerequisite
and Windows editor update-lock failure. Any existing-installation correction
requires its own concrete review; do not fold backend work into this extension.
Do not repair/upgrade/restart the owner installation under this validation scope.

Once prerequisites are separately resolved, complete the real Windows/WSL matrix,
including the actual signed-in interactive Copilot, Claude Code and Codex workflows,
live provider/RAG checks, isolated installed lifecycle and preservation evidence.
Do not substitute Mac fixtures, assistant CLI presence or package activation for
those checks. Fix confirmed extension defects only. Preserve the incoming VSIX;
if code changes, build from a clean commit and qualify the new artifact digest.

Do not merge or publish until review and actual acceptance permit release.
The previous Mac publisher authentication remains a Mac-local prerequisite;
no publisher token was transferred to WSL. When actual acceptance is complete,
follow the existing owner authorization to publish the qualified exact VSIX,
verify its Marketplace listing/install in an isolated profile and record the
evidence. Never request/export credentials or weaken assistant approvals.
Follow the constitution's release milestone/blog draft requirement; external
blog/message publication still needs its separate review.
```

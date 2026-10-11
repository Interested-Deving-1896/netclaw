# Final Windows/WSL validation handoff

Use **150-vscode-extension-only**, not the preserved expanded-backend release/WSL
branches. This candidate is an extension client of unchanged NetClaw. Implementation
source is `8db2c2144e169f4c2ab832d3d62c40f1b1c6a807`; later commits add evidence and the
exact VSIX. There are no NetClaw base code changes on this recovery branch.

## Transfer and artifact verification

From your WSL shell, using the existing clone only to fetch/create another checkout:

```sh
git -C "$HOME/netclaw" fetch origin 150-vscode-extension-only
git -C "$HOME/netclaw" worktree add -b 150-vscode-final-wsl-validation "$HOME/netclaw-spec150-final-wsl" origin/150-vscode-extension-only
cd "$HOME/netclaw-spec150-final-wsl"
git merge-base --is-ancestor 8db2c2144e169f4c2ab832d3d62c40f1b1c6a807 HEAD
sha256sum specs/150-vscode-extension/artifacts/netclaw-0.1.0.vsix
```

Expected digest:
`71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005`.
If the branch/directory already exists, inspect and preserve it; do not overwrite,
reset or recreate it blindly. Do not rebuild or substitute the old release VSIX.

## Scope and startup

Read AGENTS.md, SOUL.md, USER.md, TOOLS.md, daily memory, constitution, this handoff,
spec.md/plan.md/tasks.md, scope-recovery.md, contracts/existing-interfaces.md and all
recovery evidence. Start GAIT and follow recording/session-end requirements. This
is validation/fix/return, not a new management backend implementation phase.

Record Windows version, WSL version/distribution, Linux version, VS Code and Remote
WSL versions, extension host location, supported Node/Python and existing NetClaw
source/runtime/home/installation identity/readiness. Do not print secrets or copy
credentials. Verify current services before changing anything. Preserve active work.

If the running installation lacks the required existing HUD/identity APIs, record
that prerequisite explicitly. Do not silently retrofit Spec150 backend components,
upgrade it or substitute a fake installation for live acceptance. Any necessary
backend prerequisite/change requires its own concrete review.

## Validation matrix

- [ ] Install the **exact committed VSIX** into the intended WSL extension host.
  From a WSL VS Code terminal: `code --install-extension "$PWD/specs/150-vscode-extension/artifacts/netclaw-0.1.0.vsix" --force`.
  Confirm **Developer: Show Running Extensions** places NetClaw in WSL, not Windows.
  Check `code --list-extensions --show-versions` reports `NetClaw.netclaw@0.1.0`.
- [ ] Add a host-local HUD API connection, review/pin actual identity and harness.
  Connection/profile selection must not change configuration or restart services.
  Confirm Windows local host directs the user to WSL and cannot execute operations.
- [ ] Exercise actual populated Overview, Risk/iN2N/eN2N, tokenomics, GAIT projection,
  network/Intent inventory, integration/skills, provider/environment, logs/docs,
  DefenseClaw/OpenShell and Science/mobile panels. Record real unavailable features;
  do not infer healthy state from empty data. The capability matrix is authoritative.
- [ ] Send one harmless Chat question through the real configured provider. Verify
  the actual owned answer/history, explicit selected context, new conversation and
  model choices supported by that harness. Never exercise device config through a
  casual question. Record actual provider use without exposing keys.
- [ ] Exercise Canvas branch/save/reopen/export/import and local Avatar alongside
  that conversation. Imported content must not execute itself. Confirm stale views
  cannot act after a connection change. Inspect interrupted outcomes; do not retry
  uncertain work automatically.
- [ ] RAG: search existing permitted data; upload a uniquely named non-sensitive
  fixture through native review, wait for actual indexing, retrieve a citation and
  explicitly stage it for Chat/Canvas. Record document ID/title so the owner can
  retain or separately remove it. No broad corpus deletion/reindex.
- [ ] Exercise environment/budget review cancellation against the real installation
  (no write). Use an isolated test installation for actual replacement, unrelated
  field preservation and verification. Never replace a real credential just to test.
  Inspect service command staging, including identity mismatch; do not press Enter
  on lifecycle changes to the active owner service.
- [ ] If both existing harnesses are available, validate each separately; selecting
  profiles must not switch a runtime. Report unavailable harness/platform scope.
  Hermes nonce/status/stop must use its actual existing companion. OpenClaw lacks
  a request-status/stop endpoint: do not claim the extension added one.
- [ ] **Copilot, Claude Code, Codex:** use each actual signed-in interactive client.
  Opt in through the extension, confirm exact installation/tool inventory, invoke
  status and inspect, create an inert proposal, explicitly consent to one harmless
  delegated question and inspect its result. Verify no approval/apply/raw CLI/HTTP
  tool is exposed. Disable the registration and confirm a cached call is refused.
  Preserve unrelated MCP servers and restore any test-only tool selections.
  Mac Codex noninteractive delegation was refused because approval was required;
  do not disable approval controls to force acceptance. Mac Copilot inference is
  still unqualified for this replacement implementation.
- [ ] Reload/reconnect, disconnect during a pending observation/review, installation
  mismatch, untrusted workspace and WSL host/profile separation. A WSL restart or
  second-distribution/SSH check must not interrupt active owner work; schedule it
  only if safe or record the exact limitation. Do not claim simulated WSL restart
  or Mac tests as real WSL evidence.
- [ ] Installed lifecycle in an isolated editor profile: install, synthetic older
  version -> candidate upgrade, disable/re-enable, uninstall. Compare actual
  configuration/credential hashes and service identity before/after, without
  exporting contents. Preserve owner NetClaw and extension profile data.

Developer checks can run in this isolated checkout using supported Node:

```sh
npm --prefix ui/netclaw-visual ci --ignore-scripts
cd extensions/netclaw-vscode
npm ci --ignore-scripts
npm run check
npm run build
npm test
```

These install only checkout-local dependencies; do not install/upgrade the running
NetClaw. They do not replace the real Windows desktop + WSL VSIX validation above.
`test:editor`/`scripts/lifecycle.mjs` can target a Linux desktop executable when
available, but that is separate evidence from Windows VS Code's WSL host.
Optional RAG fixture tests require an isolated Python environment with the repository's
RAG dependencies and cached local embedding model; do not point them at owner data.

## Results and return

Write `evidence/wsl.md` with source/VSIX digest, exact commands/results, host versions,
real-vs-fixture boundaries, relevant screenshots, before/after preservation,
remaining failures and reproducible steps. Fix confirmed extension defects only,
add focused verification, and identify any artifact changes. If code changes, build
from a clean commit and record/test the new VSIX digest; preserve the incoming VSIX.
No requirement is closed just because a command was attempted or a fixture passed.

Commit and push the validation branch and any reviewed extension fixes. Do not merge,
publish, change peering or production policy, manufacture approval, or transfer
publisher credentials. The Mac publisher authentication is already ready; no PAT
belongs in chat or Git. Return branch, commit, digest and results with mac-return.md.
Only mark T022 complete when the required real checks are supported by evidence.
The public release remains T023, after review of returned acceptance.

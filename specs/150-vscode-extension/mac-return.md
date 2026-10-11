# WSL return checkpoint — development remains incomplete

Fetch `origin/150-vscode-extension-wsl` into an isolated checkout. This branch
contains the Mac baseline plus WSL fixes, reproducible Windows/WSL runners and
sanitized observations. It is not release-ready: **8/79 tasks complete**. No
publication or merge was performed. The VSIX digest/source actually exercised
is recorded in `evidence/wsl-acceptance.md`; do not associate that older artifact
with a later source commit or describe it as a final release.

## Prompt for the Mac session

```text
Continue NetClaw Spec150 from the latest pushed origin/150-vscode-extension-wsl.
Record the exact fetched commit. Use an isolated checkout; preserve the running
Mac installation, credentials and active work. Read AGENTS.md, the constitution,
specs/150-vscode-extension/{spec.md,plan.md,tasks.md,windows-wsl-handoff.md},
evidence/{mac-development.md,wsl-acceptance.md}, and the contracts.
Follow SDD and GAIT startup, recording and session-end requirements.

Review the WSL changes before continuing. Eight of 79 tasks are complete; this
is a development checkpoint, not a completed implementation or release approval.
Finish the remaining foundations and stories. Keep assistant delegation refused
until runtime and per-hop authorization are enforceable and actually qualified.
Do not infer live execution from a rendered control, advertised tool or fixture.

Preserve separate Mac and WSL evidence. WSL has actual minimum/current Windows
editor connection checks, minimum installed-VSIX synthetic lifecycle checks,
real runtime/provider and local RAG evidence within their recorded limits.
Full E3/E8, named clients, runtime/editor restart and Spec149 host qualification
remain incomplete; keep those rows open for the WSL host. Complete the remaining
Mac/native/Remote SSH and client gates on the appropriate actual hosts.

Record actual evidence, fix failures, update only fully completed checkboxes,
and commit sanitized work to a feature branch. No credentials/private runtime
state in Git or chat. Do not publish or merge at this checkpoint. Return exact
remaining gates and request release authorization only after the final artifact
and complete qualification evidence are ready for review.
```

Do not use this checkpoint as a prompt to close the spec. The remaining work
includes foundational/shared concurrency and response contracts, estate/federation,
lifecycle/settings/security/approval workflows, scoped named-assistant integration,
observability and supporting workspace domains, accessibility/performance, full
platform qualification and eventual authorized Marketplace acceptance. Mac-only
acceptance remains open wherever the platform matrix is unrun; prior Mac evidence
retains its original limited development scope.

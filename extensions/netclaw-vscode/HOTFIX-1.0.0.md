# VS Code 1.0.0 button hotfix

Owner-requested hotfix on `hotfix/vscode-1.0.0-buttons`, October 12, 2026.
The owner explicitly requested no new spec, a five-pass button audit, and
Marketplace publication as extension version 1.0.0. The NetClaw runtime version
and website are unchanged.

## Reproduction and changes

The exact published 0.1.1 VSIX reproduced the reported Testbed Edit failure in
VS Code 1.108.0 on macOS arm64. With 60 synthetic devices, clicking the first
Edit button revealed a form 5,682 pixels below the viewport and focused nothing.
The host had disabled inputs while the webview attempted to focus the form.

Forms and reviews now scroll into view and receive focus after controls are
enabled. The audit also corrected input focus loss during draft invalidation,
restored connection selection in kept drafts, overlapping button submissions,
empty recovery-list feedback, MCP reload after initial metadata failure,
off-screen security reviews and stale visible reviews after selecting another
rule. Chat and Canvas serialize actions. Canvas releases controls after an
unchanged pre-admission failure or interrupted request; unresolved requests stay
blocked. Late messages cannot reactivate disconnected Chat/Canvas views.

## Five review passes

| Pass | Coverage and evidence |
| --- | --- |
| 1 — Reproduce and trace | Published 0.1.1 installed in an isolated native editor; real button → message → host → form path. Regression failed on viewport/focus before the fix. |
| 2 — Inventory workflows | Existing device and connection edit; uninterrupted keyboard input; preview, native Cancel and Save; credentials/other-connection preservation; recovery preview/cancel; Remove; Add/Close; YAML/cards; search and both pagination directions. Import/export/restore contracts are covered by source-HUD tests; no owner inventory writes. |
| 3 — MCP and security | Scoped field replacement and private reset; Reload/setup cancellation; binding, rule/policy preview, native Cancel, weakening acknowledgment and verified isolated CLI-fixture writes; read-only capability and stale-target fences. |
| 4 — Other workbench controls | All generic view action IDs/command mappings reviewed; Chat toolbar/Send/stop and Canvas toolbar/Send recovery tests; RAG overlap/recovery tests; graph selection/zoom/reset/hide/show; Avatar controls and view-family layout checks. |
| 5 — Release artifact | Clean committed-source packaging, installed VSIX payload comparison, native experience and conversation/Canvas regressions, compatibility run and public Marketplace validation are required before declaring the release live. Final results are recorded below after execution. |

## Source verification

- `npm run check`, `npm run build`: passed.
- `npm test`: 61 passed, one optional cached-embedding RAG test skipped.
- HUD `npm run test:experience`: nine passed, including YAML/JSON/CSV, revision checks and credential preservation.
- `npm audit --audit-level=high`: no vulnerabilities.
- Native source experience: 17 checks, 149 layout cases, 43 screenshots, including the new existing-device hotfix workflows. The packaged run adds MCP setup cancellation and additional graph controls.

Tests use synthetic local gateway data and isolated filesystem/CLI fixtures.
They do not establish new Windows/WSL, remote-host, live network-device or native
vendor-enforcement qualification. No backend change is needed for this hotfix;
the existing requirement for an updated HUD to support full Testbed/MCP editing
still applies. Earlier 0.1.1 qualification remains separately documented in
[production readiness](../../specs/151-extension-experience/production-readiness.md).

The first source-editor attempt used stale pre-merge dependencies/bundles and
timed out on security loading. `npm ci` restored the locked dependencies; clean
typecheck/build and the full source UI run then passed. This was a local test
setup issue, not evidence against the exact published artifact reproduction.

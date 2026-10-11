# Mac workbench qualification — partial

Date: 2026-10-11. This checkpoint follows `ba91ecb`; the committing revision
identifies the source changes. Extension 0.1.0, backend source version 1.8.0,
Node 24.19.0, macOS 26.5.2 (25F84), Darwin 25.5.0 arm64. Actual local desktop
VS Code **1.102.0 and 1.141.0** ran isolated development profiles. No WSL,
Remote SSH, native Linux or Marketplace result is implied.

## Inspection reliability and bounds

The inspection bridge now waits for a strict ready message after its listener
is installed. A connection change clears the old result, including a change
before webview startup and a late response from the previous binding. Forged
actions, extra authority fields, wrong view IDs and replayed messages do not
cause reads. Views load no more than 1 MiB and render at most 10,000 visited
nodes/16 levels, with visible bounds. Strings use inert text nodes.

Loaded arrays page at 50 items and support local filtering without another
backend request. Source/policy metadata remains visible when no rows match.
Keyboard paging preserves focus on an available control. High-contrast buttons
now use the editor's contrast border. These controls do not page the source API
or imply that unloaded records were searched.

## Actual renderer measurements

The actual Overview webview received explicitly synthetic cached observations:
100 members, 100 peers and 1,000 tools. The test intercepts only that source
read and restores it afterward. No peer was contacted. Each row below includes
20 local filter samples (80 ms debounce included), keyboard next-page/refresh,
inert hostile tool text, and a screenshot. Backend fixture latency was 0 ms;
these numbers measure rendering/filtering, not production backend latency.

| VS Code | Theme | Local filter p95 | Refresh observed | Result |
|---|---|---:|---:|---|
| 1.102.0 | Dark | 91 ms | 27 ms | Passed |
| 1.102.0 | Light | 91 ms | 23 ms | Passed |
| 1.102.0 | High contrast | 90 ms | 24 ms | Passed |
| 1.141.0 | Dark | 91 ms | 25 ms | Passed |
| 1.141.0 | Light | 91 ms | 18 ms | Passed |
| 1.141.0 | High contrast | 90 ms | 17 ms | Passed |

The existing real-renderer Chat draft, Canvas branch, Avatar, RAG entry point,
Network historical/configured provenance and local simulation checks also passed.
They verify no backend dispatch from opening views or editing drafts. RAG
retrieval was not rerun in this checkpoint; its separate evidence still applies.
Both editor runs reported 15 assertion groups and successful exit.

Commands, with the supported isolated Node executable on PATH:

```sh
npm --prefix extensions/netclaw-vscode run check
npm --prefix extensions/netclaw-vscode test
npm --prefix extensions/netclaw-vscode run build
VSCODE_VERSION=1.102.0 NETCLAW_TEST_PLAYWRIGHT=<existing-playwright-module> node tests/vscode/runner.mjs
VSCODE_VERSION=1.141.0 NETCLAW_TEST_PLAYWRIGHT=<existing-playwright-module> node tests/vscode/runner.mjs
node --test tests/vscode/package.test.mjs
```

All **82 extension tests** passed, including five new inspection behavior cases;
TypeScript/build and the exact 25-runtime-file package allowlist check passed.
Local editor reports/screenshots are under the system temporary directory in
`netclaw150-editor-Dxul1N` (minimum) and `netclaw150-editor-zpU5PS` (current).
Logs: `/tmp/netclaw150-data-view-final-{1.102.0,1.141.0}.log`.
Light/dark/high-contrast screenshots were visually inspected; the final current
high-contrast screenshot confirms the corrected visible button border.

## Remaining gate

T073, SC-004 and SC-010 remain open for the complete 23-domain workflow matrix,
native estate/integration navigation measurements and keyboard-only connection,
chat, settings approval and GAIT inspection. Inspection-panel measurements do
not establish those results. Missing underlying workflows remain blockers;
truthful unavailable states are not replacements for required implementation.
A new committed-source VSIX is required after this frontend change.

# WSL follow-up — HUD repaired; acceptance remains incomplete

Observed 2026-10-11 on the owner's existing Windows/WSL installation. This is a
checkpoint for continuation, not release acceptance. The original
[WSL evidence](wsl.md) and [structured report](wsl-checks.json) are unchanged.

Incoming review: `4e3cd2627ac80b7d160af7b135d30dec6580f202` on
`150-vscode-extension-wsl-review-20261011`, with prior return `1aaaafa` as an
ancestor. Work uses isolated branch `150-vscode-extension-wsl-followup-20261011`.
Owner source remains `aa2795313b487e00ccbe85d53f6a78db07b10a94`; its pre-existing
testbed modification and backup are preserved.

The exact committed `NetClaw.netclaw@0.1.0` VSIX is unchanged:

```text
specs/150-vscode-extension/artifacts/netclaw-0.1.0.vsix
SHA256 71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005
2220783 bytes
```

No extension or NetClaw source changes, new package build, merge or publication
were performed. The previously passing source suite was not repeated.

## Approved HUD prerequisite repair

The owner explicitly authorized the bounded repair in
[wsl-prerequisite-recovery.md](../wsl-prerequisite-recovery.md). That approval
supersedes the prior session's instruction to leave the unavailable HUD alone.

Before applying, observed the real unit and its dependencies, selected runtime,
existing installation identity, Node/npm/OpenClaw executables, package/lockfile,
available space, protected files and services. The HUD unit had no stop propagation
to other application services. Its dependency directory was owned and not a symlink.
The package and lock matched the reviewed source and already pinned the MCP client.

Staged copies of the two package files on the same filesystem, then ran the
existing Node 24.19.0 executable with the existing npm CLI:

```sh
"$HUD_NODE" "$HUD_NPM_CLI" --prefix "$HUD_DEP_STAGE" ci --ignore-scripts --no-audit --no-fund --include=dev
```

The stage explicitly included development dependencies needed by the unchanged
`npm run dev` service. Its lockfile stayed identical. Imports of
`@modelcontextprotocol/client` and `@modelcontextprotocol/client/stdio` passed;
Vite and concurrently entry files were present. No unrestricted install scripts
or global package/runtime upgrades were used.

Confirmed the HUD was idle with no established connections on its two ports,
stopped only `netclaw-hud.service`, and verified its ports were free. Renamed the
old dependency tree to `node_modules.spec150-backup-20261011-0805` beside the HUD;
renamed the staged tree into place. The backup is deliberately retained and appears
as an untracked directory in the owner checkout. Do not commit or remove it.

Added only the HUD unit drop-in `50-spec150-supported-node.conf`: it prefixes PATH
with the existing supported Node directory and runs that Node with the existing
npm CLI and unchanged `run dev` arguments. The original unit, working directory,
remaining PATH entries, runtime/home and ports are preserved. OpenClaw resolves
to the same executable before and after. Saved original unit bytes/mode and a
rollback helper before applying; rollback was not needed. It would restore the
prior **degraded** dependency/runtime state, not a working HUD.

After a user-systemd daemon reload, started only the HUD. The actual API,
concurrently and Vite child executables all resolve to Node 24.19.0. The existing
native installation identity and selection descriptor are unchanged.

| Probe | Actual result |
| --- | --- |
| `GET /api/runtime` | HTTP 200; existing OpenClaw identity; `readiness.ready=true`, `executionVerified=false` |
| `GET /api/gateway/status` | HTTP 200; online, reachable and chat completions enabled |
| Protected file observations | All 12 unchanged, including credentials/configuration, testbed/backup, assistant configuration, identity, actual selection descriptor, package and lock |
| Core services | Gateway, mesh, four members and security service identities unchanged |
| Other services | HUD changed intentionally; two scheduled DDNS services and the already-restarting Zoom RTMS service changed naturally |

This proves the repaired API prerequisite. It does not prove a provider answer or
the extension's live UI workflows.

## Fresh API observations and separate RAG prerequisite

Seventeen bounded GET requests used the actual native installation header. Fifteen
returned HTTP 200. Native federation, graph, runtime, configuration, tokenomics,
budget, security, OpenShell, documentation, reference, logs and endpoint-inventory
responses were available. The structured report records routes and field/count
observations without configuration contents, private identities or topology.
These are API observations; no rendered-panel acceptance is claimed. Empty fields
and an HTTP 200 response alone do not establish feature health.

Both `GET /api/rag/stats` and `GET /api/rag/documents` returned HTTP 500:

```text
No response to initialize
ModuleNotFoundError: No module named 'fastmcp.utilities.async_utils'
```

Read-only launcher inspection establishes that the current RAG command does not
match a managed component binding. It runs the system Python 3.14.4 and sees
FastMCP 2.14.7 / MCP 1.28.1. Existing `mcp-servers/rag-mcp/pyproject.toml` requires
FastMCP 4.0.11, fastmcp-tasks 4.0.11 and MCP 2.3.0. The source imports the missing
module during startup. This is a reproduced installation prerequisite failure;
no extension defect is established by it.

No Python package/runtime/launcher repair was made: that is outside the approved
HUD Node/dependency repair. A concrete, separately reviewed runtime correction is
needed before RAG acceptance. No upload, search, reindex or deletion was submitted.
The GET routes did start the existing RAG process, whose native startup can perform
its own integrity work; this report does not assert a byte-level corpus comparison.

## Windows editor prerequisite

Windows still reports build `26300.9550`; the installed VS Code executable reports
1.140.0. Existing Remote WSL is 0.104.3, WSL 3.0.1.0, Ubuntu 26.04 LTS, kernel
`6.18.40.1-microsoft-standard-WSL2`. The distribution's older display label is not
used to infer its OS version. Boot identity stayed the same throughout this repair.

Prepared separate Windows user data/extensions and a private WSL server-data and
extension directory. The server CLI installed the exact VSIX there successfully.
Both this private install and the owner's preserved install match all 21 packaged
payload files; manifests match after excluding editor-added metadata.

A temporary conditional `server-env-setup` hook was prepared to select private
WSL storage only for a marked test launch. A workspace observer was prepared to
verify the actual extension host and storage location without replacing product
code or consent handlers. One normal isolated Windows launch exited **255** before
writing a session log; the observer did not run. A subsequent read-only Windows
inspection found live VS Code updater processes and the `vscode-updating` mutex
still present. The silent exit alone does not establish its exact internal cause.

The owner was asked to save work and complete the update through its normal UI.
No window/updater was terminated, lock removed, mutex check bypassed, or WSL
shutdown requested. The conditional hook was checked against its recorded hash
and moved back into private evidence, restoring its original absence. Preparation
files remain private for continuation. No launched-host storage isolation, upgrade,
disable/re-enable or uninstall result is claimed.

## Remaining matrix

| Required check | Follow-up disposition |
| --- | --- |
| Exact VSIX installation / WSL activation | Prior real-host activation stands; private install and payload comparison passed here; new observer did not run |
| Connection, native identity review, host placement | API identity/readiness verified; actual editor binding and visual Running Extensions check pending |
| Populated panels | API observations recorded; actual panel rendering pending |
| Real provider Chat, history, model/context choices | Not attempted in this follow-up; isolated editor prerequisite blocked |
| Canvas branch/save/reopen/export/import, Avatar | Pending actual editor session |
| RAG upload/index/citation/context | Blocked by reproduced Python dependency mismatch and editor prerequisite; no fixture substituted |
| Settings cancellation, service command staging | Pending actual editor session; no owner setting/lifecycle write submitted |
| Other harnesses | Only selected OpenClaw observed; no harness switch or Hermes qualification claimed |
| Copilot / Claude Code / Codex interactive consent and tools | Not attempted; no extension opt-in, registrations or delegated provider requests created |
| Reconnect, stale views, trust, identity/host separation | Pending actual editor session; no owner restart/second-host test substituted |
| Upgrade / disable / re-enable / uninstall | Blocked before launched WSL storage isolation could be verified; owner install preserved |
| Preservation | 12 protected file observations unchanged; same boot; core service identities retained; approved HUD changes explicitly enumerated |

**T022 and T023 remain open. No release acceptance or publication is authorized
by this checkpoint.** Resume after the Windows update completes normally; address
the separate RAG prerequisite within a reviewed scope. Do not repeat dependency
replacement or the passing source suite merely to resume.

## Audit and private evidence

GAIT branch `spec150-wsl-hud-repair-acceptance-20261011` was created and checked out.
Startup inventory listed five entries with `pyats_list_devices`; no device-health
or configuration call was made. Milestones: `a55e3a31` startup, `8ea7cb80` baseline,
`c909efc7` repair verification, `82d8b900` editor/RAG prerequisites. Session-end audit
and daily memory accompany the checkpoint; MemPalace is unavailable here.

Raw observations, service backup, rollback helper, failed launch log, prepared
observer and private installed VSIX remain under the owner's private follow-up
cache. No credentials or raw network responses are committed. See
[wsl-followup-checks.json](wsl-followup-checks.json) and the updated
[Mac return](../mac-return.md) for the exact transfer checkpoint.

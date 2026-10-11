# Production readiness — VS Code 0.1.1

Date: 2026-10-11. Branch: `prod-ready`. This is an unpublished candidate. The owner requested a deep release audit, compatibility fixes and real native security integration qualification. This supersedes the original Spec151 source-only checkpoint for the checks explicitly recorded here.

## Findings and changes

| Finding | Resolution |
| --- | --- |
| A running HUD predating the new document/configuration routes returned 404 and prevented all testbed/MCP access | Only a missing route permits compatibility reads. Device details and field presence remain visible. Legacy environment replacement opens the existing native review, scoped to the chosen integration. Full document/configuration editing still requires the updated HUD process. Authentication, identity, conflict and server errors never downgrade to a compatibility path. |
| Installed OpenShell 0.0.32 rejects `--workspace`, JSON policy output and `--base` | Probe supported flags; use explicit gateway/default workspace/sandbox, parse the native YAML response and inspect gateway-global policy. Unknown/global scope stays read-only. Save with native `policy set --wait`, verify the exact policy and active revision, preserve non-network fields. Empty network maps omitted by native serialization are normalized. |
| Installed DefenseClaw 0.8.4 lacks the assumed config get/set writer; tool rules reside in SQLite | Use native tool list/allow/block/unblock and readback for one configured connector. Preserve global/source rows. Global mutation is withheld because that CLI clears other connector overrides. Enforcement defaults remain visible but read-only on this version. |
| Security pages lacked visible YAML and permission details | Add redacted policy YAML, configuration location, filesystem/process/asset permissions, actual tool scopes, and policy/active revision. Suggest the identity-matching local runtime home and discover native OpenShell sandboxes. |
| Structured `api_key` values could escape the security redactor | Mask API-key fields in displayed configuration and protected network drafts. Tests cover hidden values and inert rendering. |
| Production DefenseClaw audit DB exceeded the proposed read bound | Validate DB file type/path without reading the audit database into memory; all rule access uses native CLI. |
| The packaged topology renderer was omitted | Include topology bundle/notices and verify all generated runtime bundles are included when packaging. |
| Dependency license texts were not all captured by esbuild's comment extraction | Collect notices from every bundled package using esbuild metadata and ship `THIRD-PARTY-NOTICES.txt`. Missing license text fails the build. |
| Extension lacked a dedicated CI release gate | Add read-only CI for clean installs, typecheck/build, extension and HUD contract tests, dependency audit, package validation and candidate artifact upload. It does not publish. |
| Native editor acceptance could load development source alongside a candidate and reported a hard-coded Mac scope | Exact-artifact runs now load only the installed extension, compare every payload file, and report the actual platform. |

## Executed qualification

Host: Ubuntu 22.04 under Windows WSL2. Supported build Node: 24.19.0. Existing active user HUD and device/security configuration were preserved; security mutations used isolated targets.

- Extension typecheck/build: passed.
- Extension suite: **57 passed, zero skipped**, including real source-HUD integration, actual local cached RAG ingestion/retrieval, assistant MCP transport, ownership/identity, testbed/configuration round trips, preservation, cancellation, stale revisions, native CLI formats and webview invalidation.
- HUD unit suite: **372 passed**. Testbed/MCP document/configuration suite: **9 passed**. HUD production build passed; existing large-chunk warnings remain informational.
- Extension and HUD npm audits: zero known vulnerabilities at qualification time.
- Minimum supported VS Code **1.102.0** desktop activation and core interaction suite: passed on the Linux extension host under WSL. Includes actual Electron MCP launch, theme rendering, chat through the isolated HUD, Canvas, Avatar and invalidation.
- Native desktop experience suite: **14 checks, 149 layout cases, 42 screenshots**. All generic views, testbed create/preview/review/save, draft/theme preservation, MCP secret replacement/reset, security binding/cancellation/acknowledgment/readback, BGP/WebGL fallback, search, keyboard, narrow widths and 200% zoom passed against isolated fixtures. The original report's hard-coded Mac label was incorrect; the runner now records platform explicitly.
- All **22** domain inspections returned successfully from the actual running NetClaw. Compatible inventory returned **5 devices** and **88 integrations**. HTTP success does not certify every optional service or tool's operation.
- Actual configured OpenClaw provider: one extension-owned no-tool smoke conversation completed with the expected response. No automatic retry occurred.
- Existing real DefenseClaw **0.8.4** and OpenShell **0.0.32** profiles inspected through the new adapter; permissions and redacted YAML available. Existing OpenShell sandbox exposed **29 network rules**.
- Separate DefenseClaw profile: native **allow → block → remove** operations verified through `tool status` with effective states `allow`, `block`, `none`; configuration bytes unchanged. The first run found an actual `block` versus assumed `blocked` status mismatch, retained an unknown outcome without retry, and was explicitly reconciled after native inspection before continuing with the corrected parser.
- Separate Docker-backed OpenShell sandbox: network update and active revision readback passed; real curl request **denied → allowed → denied** when adding and restoring a reviewed explicit rule. Filesystem/process policy was preserved. The initial hostname probe exposed DNS failure inside the sandbox; the successful probe used public IP `1.1.1.1`. This does not certify DNS or every destination/protocol. The test sandbox used native `--no-keep` lifecycle; the existing `netclaw` sandbox was untouched.
- Live testbed SHA256 remained `0765b65271a064ca3077a1ae9db52d2c46791b5512da6f8c8c51eaee910d466c`, matching the pre-change baseline.

Private machine evidence lives in `~/.cache/netclaw-prod-ready-20261011/`; raw native configuration, logs, recovery snapshots and live screenshots are deliberately not committed. Exact packaged-artifact results are recorded after packaging below.

## Remaining release gates and limits

1. The currently running user HUD was started before the new safe editing routes existed. The compatibility UI restores reads and native environment review. Full testbed/scoped MCP editing requires a controlled HUD restart/update; the extension cannot add server routes to an already-running process. No restart was imposed while the owner was testing.
2. Marketplace publishing credentials and publisher access have not been verified in this session; no configured VSCE PAT, Azure identity or VSCE store was found. Authenticate as an authorized member of publisher `NetClaw` before publication. No credentials belong in the repository or report.
3. Push the reviewed source before publication so commit-pinned Marketplace README links resolve, and complete the owner's publication approval. No push or Marketplace publication is part of this qualification checkpoint.
4. This patch's real native CLI and desktop acceptance was on the Linux host under WSL. Native Mac and Remote SSH requalification for this exact artifact remain separate; original Mac Spec151 fixture evidence is not new native-provider evidence. Native Windows runtime hosting and browser VS Code remain unsupported as documented.
5. Native OpenShell and legacy DefenseClaw CLI writes lack an atomic compare-and-swap interface. Immediate rechecks, native scope, readback and private evidence protect against common mistakes; another editor or external writer can still race. Unknown outcomes block replay. Runtime traffic, connector hook enforcement and stored policy are separate states.

The test results establish the stated coverage; they are not a claim that all possible deployments are defect-free.

## Primary references

- [VS Code publishing requirements](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [OpenShell v0.0.32 native policy implementation](https://github.com/NVIDIA/OpenShell/blob/v0.0.32/crates/openshell-server/src/grpc/policy.rs)
- [OpenShell v0.0.32 CLI](https://github.com/NVIDIA/OpenShell/blob/v0.0.32/crates/openshell-cli/src/run.rs)
- [DefenseClaw upstream](https://github.com/cisco-ai-defense/defenseclaw), with installed 0.8.4 `commands/cmd_tool.py` and `enforce/policy.py` used to verify connector/global/source semantics.

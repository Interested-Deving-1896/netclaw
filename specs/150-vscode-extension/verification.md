# Spec 150 verification ledger

Status: implementation and qualification in progress on macOS, 2026-10-11.
52/79 tasks are checked. This ledger covers all 44 functional requirements and
13 success criteria; it is not a release sign-off. Unimplemented behavior cannot
pass by being disabled, and synthetic fixtures do not qualify physical hosts.

Owner authorization includes implementation, Git push and publication when
ready. Local Marketplace authentication for publisher `NetClaw` succeeded and
was independently verified. No token is stored here. No extension is published.
The previous TF400813 authentication failure is resolved.

Current candidate checkpoint: source `f95a32294f466deae27d63e5ad9c81ef82c2ef6b`,
version `NetClaw.netclaw` 0.1.0, SHA-256
`eac6dbf4c1f56f65edb88b65ec731825c2348a44d91c404da695ac30dca84750`.
Evidence applies only to its identified source/artifact; later implementation
requires a new build and the affected checks. See [package evidence](evidence/package.md).

## Functional requirements

| Requirement | Implementation and available Mac evidence | Still required |
|---|---|---|
| FR-001 | Installable allowlisted candidate and versioned docs | Public listing, exact public download/install, final compatibility |
| FR-002 | Byte-identical mobile icon; Activity Bar mark and manifest tests | Complete light/dark/high-contrast visual matrix |
| FR-003 | Native trees, commands, status, rich panels and domain entry points | Complete supported workflows and all-domain acceptance |
| FR-004 | Add/select/rename/disconnect/remove profiles and identity tests | Complete environment workflow |
| FR-005 | Fixed launcher, strict SSH identity, contract/harness binding and denial tests | Actual remote destination matrix |
| FR-006 | Private per-profile files, principal/host/distro ownership, stale response rejection | Full multi-window/remote/restart acceptance |
| FR-007 | Existing-installation management and owned service controller; no bootstrap | Full service/harness/platform controls |
| FR-008 | Workspace-host placement and Linux/WSL identity design | Mandatory actual Windows/WSL, native Linux and Remote SSH matrix |
| FR-009 | Existing runtime credentials retained; actual isolated OpenClaw/Hermes requests | Complete supported runtime/provider/context acceptance |
| FR-010 | Owned Chat, progress, artifacts and model/effort selection | Full conversation/runtime/grant acceptance |
| FR-011 | Actual editor Chat/Canvas/Avatar; reviewed native UI destination | Authenticated native UI and preservation in remote contexts |
| FR-012 | Explicit selected context and RAG upload/citations; actual local retrieval | Full host boundary and supporting-domain acceptance |
| FR-013 | Durable journal/workers, no replay, observed runtime recovery | All mutation receipts/reconciliation and real host faults |
| FR-014 | Distinct native estate branches and cached source freshness | Full mixed estate/editor/platform matrix |
| FR-015 | Exact bounded received capability details; advertisement is not execution | All posture/details and independently qualified execution |
| FR-016 | Exact reviewed external-peer permission changes; reviewed peer conversations, retained history and durable receipts | Membership lifecycle, peering establishment/severing, remote tools/skills; live runtime conversation matrix |
| FR-017 | Both harness identities enforced; unsupported paths denied | Full internal/external runtime matrix and Linux/WSL host-control dependency |
| FR-018 | Provider/model, budgets, existing runtime default and Risk role proposals | Full effective-state and platform acceptance |
| FR-019 | Presence-only secrets, explicit replacements, multiline preservation tests | Complete release UI/export/client matrix |
| FR-020 | Redacted review, revision locks, baselines, verification and rollback | Remaining domains and exact host acceptance |
| FR-021 | Owned services and active-work review; actual Mac process preservation | All supported service kinds and platforms |
| FR-022 | Independent authoritative CR contract, incident/state checks, refusal tests | Real production authority/device qualification; no synthetic approval claim |
| FR-023 | Durable operator Intent around existing scoped Local/Lab engine | Physical designated endpoints and real preparation/APPLY/rollback proof |
| FR-024 | Installation GAIT records and native inspection; audit-loss denials | Full domain/session outcome and remote acceptance |
| FR-025 | Bound DefenseClaw settings/events/scans, reviewed connector tool rules and observed OpenShell state | Scanner execution and qualified OpenShell lifecycle/policy writes; running enforcement acceptance |
| FR-026 | Independent controls and truthful degraded/unknown posture | Full actual enforcement and production matrix |
| FR-027 | Recorded usage/cost/gap reconciliation; scoped budgets | Complete domain/platform acceptance; no invented Hermes totals |
| FR-028 | Catalog/config/install inventory and reviewed configuration | Remaining supported management and actual execution qualification |
| FR-029 | Bounded source/time/severity logs, redaction and editable local exports | Release-wide UI/privacy matrix |
| FR-030 | Configured/historical/federation/simulated layers; actual collector and editor checks | Platform matrix; physical device health is not inferred |
| FR-031 | Separate RAG/memory/GCF/meeting stores and reviewed context | Actual meeting account and complete platform acceptance |
| FR-032 | Owned Jev assessment, budget review and reconsideration | Complete real originating-runtime assessment proof and supporting matrix |
| FR-033 | Exact existing mobile consent and retained capture; authenticated simulated phone | Physical phone and remaining supported runtime/platform acceptance |
| FR-034 | Searchable bundled references and contextual guides | Final versions/support/diagnostics/release documentation |
| FR-035 | Restricted Mode and workspace trust boundaries tested | Actual restricted remote-context matrix |
| FR-036 | Inert rendering, fixed endpoints/paths, private-file checks and secret tests | Complete hostile-content and package/client release sweep |
| FR-037 | Bounded pages, explicit unavailable/stale states, native controls | All-domain scale, keyboard and theme checks |
| FR-038 | No telemetry, reviewed selected sharing and local diagnostic save | Full client/remote disclosure matrix |
| FR-039 | Shared existing backends, writer locks and domain regressions | Remaining implementations and full applicable regression rollup |
| FR-040 | Actual candidate lifecycle and package checks | All required environments plus exact public Marketplace installation |
| FR-041 | Opt-in Copilot MCP discovery, immutable grants and revocation | Actual Copilot inference and remote/WSL policy scenarios |
| FR-042 | Actual Claude/Codex inspection; Claude proposal; reviewed setup | Codex client confirmation, permitted delegation and remote/WSL matrix |
| FR-043 | Inspection/proposals, immutable grants, protected Hermes local subnet profile | Broader OpenClaw/federated delegation with enforceable per-hop grants |
| FR-044 | Principal/grant/installation ownership, disclosure and expiry/revocation | Actual named-client/runtime/remote end-to-end matrix |

## Success criteria

| Criterion | Evidence available | Release disposition |
|---|---|---|
| SC-001 | Actual isolated Mac editor connections | Required physical/native/WSL/SSH onboarding times unrun |
| SC-002 | Implemented domain handlers and honest limitations | Incomplete workflows remain blockers |
| SC-003 | Retained Spec149 reference proof and selected Spec150 domain processes | Full Spec150 harness/host action matrix incomplete |
| SC-004 | Bounded 100-member/100-peer backend reads with measured latency | Actual all-domain editor p95 and 1,000-row matrix incomplete |
| SC-005 | Synthetic identity/grant/window/distro denial tests | Physical cross-context fault matrix incomplete |
| SC-006 | Reviewed changes and production/Local-Lab refusal fixtures | Remaining domain and actual-authority checks incomplete |
| SC-007 | Real worker/facade loss, lease expiry and no replay in isolated requests | All actions and WSL restart reconciliation incomplete |
| SC-008 | Configuration/log/export/package synthetic-secret tests | Final release security sweep incomplete |
| SC-009 | Exact fixture costs, missing data and explicit scope | Mac reconciliation passed; full domain acceptance remains |
| SC-010 | Native controls and rendered minimum/current panels | Full keyboard and three-theme matrix unrun |
| SC-011 | Actual candidate lifecycle preserves independent OpenClaw and saved work | Mac result only; required other contexts incomplete |
| SC-012 | Local VSIX and authenticated publisher | Not published; no public install claim |
| SC-013 | Actual Claude and Codex partial evidence; protected Hermes process proof | Actual Copilot and full three-client WSL/SSH/harness matrix incomplete |

## Evidence index and next closure sequence

- [Configuration](evidence/configuration.md), [services](evidence/services-mac.md),
  [conversations](evidence/conversations.md) and [workspace](evidence/workspace.md).
- [Federation](evidence/federation.md), [assistant clients](evidence/assistant-clients.md),
  [security](evidence/security.md) and [security components](evidence/security-components.md).
- [Observability](evidence/observability.md), [package](evidence/package.md) and
  [prior real WSL findings](evidence/wsl-acceptance.md).

Finish missing Mac implementation first: remaining estate and
remote work controls, per-hop assistant delegation and the remaining security
controls. Then close durable recovery, full editor coverage/performance, named
client and runtime regressions against a fresh committed candidate. Prepare the
final real-host handoff with exact source/VSIX digests and preserve unrun native
Linux and Remote SSH rows. Publication follows required qualification; existing
publication authorization does not convert a missing test into acceptance.

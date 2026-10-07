# Feature Specification: Optional Agent Substrate execution

**Feature Branch**: `143-agent-substrate`
**Created**: 2026-10-07
**Status**: Assessed — NO-GO for implementation now; candidate requirements retained for reconsideration.
**Input**: Assess Agent Substrate for NetClaw / Risk of Claws, create a branch and spec, and try Docker/Kubernetes with a clear on-premises reachability design.

## Decision and scope

Do not implement or deploy Substrate now. The owner clarified: “if its a bad idea / doesnt work lets not proceed.” Source review found enough incompatibilities and no measured workload benefit to justify proceeding. This is an architectural no-go for the current product, not a claim that the upstream runtime failed a live test. See [research](research.md) and [verification](verification.md).

Substrate remains a possible future runtime for idle investigation sessions and HTTP-based analysis tools. Border, federation transport, collectors, device connections, and write gates remain in their existing runtime. Ordinary containerization can support cloud/Kubernetes placement without adding Substrate; it still needs packaging, connectivity and security qualification.

**This branch delivers the assessment and deferred spec only.** The experiment, adapter, and production qualification described below are candidate follow-on scope, not authorized execution after the no-go decision. No new installer component, skill, MCP catalog entry, or HUD production posture is claimed.

## User Scenarios & Testing

### User Story 1 — Make an evidence-based adoption decision (P1)

As the owner, I can distinguish workload placement, network reach, security, and cost benefits from upstream performance claims.

**Independent test:** inspect research, source revision, architecture, limitations, and adoption gates.

1. Given a small always-on Risk, the recommendation includes ordinary containers/systemd as a valid choice.
2. Given many intermittently active investigations, the recommendation explains multiplexing and measures economics before a default changes.
3. Given a managed GKE offering with different limitations, its guarantees are not inferred from upstream main.

### Candidate User Story 2 — Exercise a real dependency in isolation (deferred)

As a developer, I can run a Python/Genie parser probe against explicitly synthetic CLI output in Docker and a dedicated local Kubernetes cluster.

**Independent test:** build the image, parse the fixture, compare the exact expected interface facts, and distinguish memory state from persisted file state after a restart.

1. The probe accepts no user-supplied command, device address, credential, or arbitrary input file.
2. Container runs without host networking, host workspace mounts, device credentials, service-account credentials, or privileged mode.
3. Docker/ordinary Kubernetes success does not count as a Substrate suspend/resume success.

### Candidate User Story 3 — Evaluate Substrate lifecycle (deferred)

As a developer, I can use version-specific WorkerPool and ActorTemplate artifacts with the pinned upstream runtime, and test RAM/files across suspend/resume.

**Independent test:** call actor A, suspend it, run actor B, resume A, compare both counters; separately test a cold process restart. Record an actual failure or environmental block instead of claiming a pass.

1. WorkerPool is installed through Kubernetes; ActorTemplate/Actor use the ate API, not invented Kubernetes CRDs.
2. A private lab kubeconfig and explicit context prevent ambient production deployment.
3. No existing cluster is replaced. No cloud project or paid resource is created implicitly.

### User Story 4 — Understand on-premises connectivity (P1)

As an operator, I can select all-on-premises, hybrid, or private routed cloud placement without assuming Substrate supplies network routes.

**Independent test:** trace actor → authenticated HTTP tool boundary → site executor → SSH target, including return traffic, identity, revocation, and data residency.

## Candidate requirements if the decision is reopened

- **FR-001:** Pin and cite inspected upstream source and record GKE/kagent evidence separately.
- **FR-002:** Preserve current installation, federation, change control, DefenseClaw and GAIT behavior.
- **FR-003:** Keep Border, NCFED transport, telemetry listeners, schedulers and persistent device sessions outside hibernating actors.
- **FR-004:** Do not offer direct actor SSH/NETCONF/SNMP/raw-protocol access against a runtime whose egress contract blocks it. VPN connectivity alone does not remove that constraint.
- **FR-005:** For Stage B, expose existing tools through authenticated MCP over supported HTTP; bind identity to tenant/Risk/site/member/tool/device scope on the trusted server. An actor header or model-supplied identifier is not authorization.
- **FR-006:** Keep device credentials, raw configs and topology local by default. Moving private data to cloud actors, snapshots, logging or models requires an explicit data policy and authorization.
- **FR-007:** Stage A uses synthetic fixtures only; network configuration tools are absent.
- **FR-008:** Specify snapshot boundaries: sockets reconnect, credentials refresh, observed device state expires, and actor rollback cannot rewind device changes or approval/audit records.
- **FR-009:** Stage B requires durable externally authoritative operation IDs, current authorization checks, single active ownership/fencing and outcome reconciliation. Never retry an uncertain write automatically after resume.
- **FR-010:** Isolate tool dependency sets and verify platform/wheel availability. Do not assume Apple Silicon, x86 Linux and gVisor are equivalent.
- **FR-011:** Report Docker, Kubernetes, real Substrate, live pyATS reachability and production acceptance as separate verification rows.
- **FR-012:** Runtime scripts must target only the named local lab and must not delete/recreate existing clusters or upload private configuration.
- **FR-013:** Before production, validate exact runtime/distribution network isolation, snapshot encryption/access/retention, sandbox confinement, audit durability and per-tenant authorization. No claim of spec 057 production enforcement until equivalent controls are measured.

### Key entities

- **Logical session:** Risk/member/session identity, actor UID, image/template revision; independent of worker/pod/IP.
- **Site executor:** always-on device-facing member or MCP service, approved inventory, scoped secrets, operation journal.
- **Operation record (Stage B):** tenant, actor UID, site/device/tool, request hash, expiry, approval reference, baseline/rollback hashes, owner epoch, status and verification reference. External to actor snapshots.
- **Experiment evidence:** exact versions, commands, observed output, elapsed times and explicit untested cases.

### Edge cases

Expired credentials after resume; interrupted tool calls; WAN loss; duplicate request delivery; actor clone or rollback; stale evidence; denied SSH/UDP/WebSocket; pool exhaustion; snapshot store outage; worker-version/CPU mismatch; unsupported wheels; failed GAIT; long-running MCP Tasks that outlive a session.

## Assessment acceptance

- Source-grounded adoption decision, compatibility matrix and on-premises connectivity patterns are reviewable.
- No runtime implementation follows the owner's conditional stop instruction once the no-go is determined.
- Spec, research, plan, task dispositions and verification distinguish assessment from deployment.

## Deferred implementation success criteria

- **SC-001:** A source-grounded go/no-go recommendation and three on-prem connectivity patterns are reviewable.
- **SC-002:** Docker and Kubernetes parse the same synthetic fixture with real Genie, or report a reproducible blocker.
- **SC-003:** Real Substrate RAM/file continuity is demonstrated or explicitly left unverified with exact cause; restart persistence is never called teleportation.
- **SC-004:** No operator device, credential, private inventory, live Risk, cloud resource, or external communication is changed by the experiment.
- **SC-005:** All spec artifacts and relevant tests pass; follow-on integration and adoption gates remain visible.

## Assumptions

The original request authorized branch-local SDD and a local experiment, conditional on a favorable assessment. The owner's clarification and no-go decision stop the experiment before deployment. No cloud project, network path or budget was supplied. A future implementation requires a new decision based on the reopening gates in research.md.

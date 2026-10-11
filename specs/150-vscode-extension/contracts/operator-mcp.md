# Private operator MCP contract — major 1

Design, not an existing endpoint. Official Node MCP SDK 2.3.1 supplies protocol negotiation and JSON-RPC lifecycle. Transport is stdio; stdout contains MCP messages only. Local process or existing OpenSSH alias launches a fixed installed `scripts/netclaw-operator.mjs` with explicit installation selection. No listener is added, no HUD Origin rule changes, no arbitrary command dispatcher. It is never registered in an agent's tool catalog.

## Authentication and binding

The backend derives local/SSH OS principal and installation from the verified launcher context. Remote SSH uses the user's normal credentials and known-host verification; no forwarded agent or automatic new/changed host-key acceptance. Arguments use a fixed safely quoted remote launcher and nonsecret installation identifier; structured inputs travel through stdin. `shell:false` on the client alone does not sanitize remote-shell arguments. Workspace settings cannot supply executable code.

`operator_identity` returns `{contract:{major:1,minor:0}, installationId, principalId, sourceVersion, harness, role, configurationRevision, capabilities, observedAt}`. All later calls bind that immutable connection. Supplying a different installation or principal is an error. Runtime drift triggers re-handshake and draft invalidation. Capabilities report supported and qualified separately, with version/evidence and denial reasons.

This interface trusts the authenticated operator account for initiation. It cannot distinguish a human from an unrestricted shell agent holding the same account. Human approval of production work therefore comes from independently verified change control with approver authority separate from the executing principal; no approve-CR tool or approver credential is exposed here. Grant separation confines authenticated MCP calls, not unrestricted same-UID filesystem/process access. Stronger OS confinement must be separately qualified before claiming it.

## Common shapes and bounds

Read calls return `{contractVersion:1, installationId, source, observedAt, data, freshness, warnings, nextCursor?}`. Command/admission calls return `{operationId, state, sequence, proposalId?, approvalRequired?, retryAfterMs?}`. `isError` results include a stable code and safe explanation: `UNAUTHENTICATED`, `DENIED`, `INCOMPATIBLE`, `IDENTITY_CHANGED`, `UNSUPPORTED`, `UNQUALIFIED`, `STALE_REVISION`, `NONCE_CONFLICT`, `EXPIRED`, `AUDIT_UNAVAILABLE`, `BUSY`, `UNKNOWN_OUTCOME`, `INVALID_INPUT` or `SOURCE_UNAVAILABLE`. Errors never echo secrets or private exception dumps.

All schemas reject unknown fields. Reads default to 100 rows, maximum 500; response maximum 1 MiB, visible truncation plus pagination. Prompts maximum 64 KiB UTF-8, reviewed attachments maximum 10 MiB each/20 MiB per request; binary content uses bounded staged opaque upload IDs, not inline tool-result expansion. Read deadlines default 15 seconds and may return partial state with reason; admission is separate from job duration. Events have monotonic per-operation sequence and cursor replay; gaps request a snapshot, never replay the action. MCP disconnect closes only the façade, not durable work.

## Tool inventory

Each row becomes fixed JSON schemas in `mcp-servers/netclaw-operator-mcp/schemas.mjs`. Action/kind enums below are closed unions, not routing to arbitrary methods. Health and diagnostics use the same identity gate.

| Tool | Inputs | Result / restrictions |
|---|---|---|
| `operator_identity` | none | Verified handshake; no secret values. |
| `operator_resources` | kind overview/member/peer/edge/advisor/integration/skill/network, filters, cursor, limit; exact `resourceId` only for member/peer/edge | Scoped observations and explicit supported actions. Estate lists contain paged summaries; exact IDs read bounded cached capabilities with counts/truncation and receipt time. No remote refresh or execution. |
| `operator_snapshot` | domain settings/security/usage/knowledge/documentation, resource ID, optional window/cursor | Typed domain snapshot; separate configured/effective and measured/estimated state. |
| `operator_conversation_open` | nonce, optional owned conversation ID, selected view and qualified model/effort | Opens/resumes owned session; opening/switching view does not send a prompt. |
| `operator_request_submit` | nonce, conversation ID, prompt, reviewed context IDs | Durable request and runtime policy binding; downstream authorization and audit enforced. |
| `operator_operation_get` / `operator_events` | owned operation ID, sequence/cursor | Durable status, permitted artifacts, approval and usage references. No implicit resubmission. |
| `operator_cancel_request` | owned operation ID, nonce | Requests backend cancellation, never reports confirmed cancellation without evidence. |
| `operator_change_prepare` | nonce, action enum, exact target IDs, expected revision, typed patch/intents | Observe and record real baseline/rollback, impact and redacted proposal. Preparation has no configuration effect. |
| `operator_change_apply` | proposal ID, nonce, expected revision, authoritative approval reference where required, transient secret replacements | Revalidate identity, grant, revision, qualification, audit and independent approval; execute exact admitted change, verify and roll back on failure. No `approved` boolean or arbitrary shell. |
| `operator_evidence` | kind gait/log/artifact/approval, owned ID or approved filters, cursor | Bounded redacted evidence; GAIT is inspect-only except backend-generated session/turn recording. |
| `operator_workspace` | action rag-list/rag-search/rag-stage/rag-upload/rag-index/rag-context/memory-search/gcf-read/meeting-read/assessment-read/assessment-preview/assessment-reconsider/canvas-import/canvas-export/mobile-inventory/mobile-capture-preview/mobile-capture-request/mobile-capture-content, typed arguments | Per-action permission and consent. Advice is never authority. Assessment preview accepts an owned ID and question; reconsideration also requires its immutable review ID and a nonce. Index/reconsider/capture are admitted owned operations with budget/consent. Capture accepts only qualified `camera.capture` or `audio.record`, an exact enrolled edge ID and current consent; preserve declined/cancelled/offline and Hermes unavailable states. No arbitrary file path or automatic notification. |

RAG actions keep staging distinct from indexing. `rag-list` paginates the existing
document/snapshot/replica store and returns actual indexing states. `rag-search`
accepts a query of 1–4000 characters, a bounded collection identifier and `k` of
1–20; its owned search ID identifies the returned citations and confidence/age
metadata. `rag-context` takes that ID plus selected result indices and a nonce;
it stages the cited text without inference. `rag-stage` stages explicit text only.
`rag-upload` accepts one reviewed basename, category and canonical base64 file up
to 10 MiB, storing private content with only its digest in admission input.
`rag-index` takes the upload ID, nonce and optional exact reviewed replacement
document ID. A separately owned worker calls the existing RAG ingestion tool;
closing the façade cannot cancel it. Unknown results are never automatically
replayed. Shared RAG ownership protects active ingestion and replica publication
from another client's recovery sweep.
| `operator_client_prepare` / `operator_client_apply` | client type, installation, targets/actions/disclosure, expiry; reviewed proposal ID on apply | Owner-scoped grant configuration, exact preview and existing change-control rules where applicable; generates only the intended client credential in backend `.env` source. No client can mint its own grant. |
| `operator_client_revoke` | grant ID, nonce | Revoke that grant generation, invalidate cached tools and prevent further dispatch; report actual in-flight cancellation state. |

Supported managed action enum: `settings.patch`, `runtime.select`, `service.start`, `service.stop`, `service.restart`, `risk.role`, `member.enroll`, `member.disable`, `member.enable`, `peer.trust`, `peer.untrust`, `security.patch`, `budget.patch`, `integration.configure`, `terminal-intent.prepare`, `terminal-intent.apply`. Each action must map to a reviewed shared domain adapter; enum presence is not qualification. Enrollment only targets existing installations. Production and external-communication effects require their actual existing gates. Forbidden destructive device operations are never added through generic enum values.

`operator_workspace` action `peer-policy` takes `{id}` for an exact existing
external peer and returns local permissions, known work, current production mode,
bounded local grant candidates and the configuration review revision. It does
not contact that peer. `peer.trust` targets exactly `[installationId, peerId]`,
requires `acknowledgeActiveWork:true`, and takes `chatEnabled` and/or one `grant`
with `{type:tool|skill,name,requiresApproval:true,timeoutSeconds:1..600}`.
`peer.untrust` uses the same targets/acknowledgment and takes `disableChat:true`
and/or 1–100 distinct existing `revokeGrantIds`. These names refer to local inbound
permission changes, not certificate trust, new peering or a network kill switch.
Unselected grants, consent and pins remain unchanged. Both actions are currently
operator-only, have exact private baselines, shared SQLite policy revisions and
durable daemon receipts, and require live worker admission at the receiver.
Production on either the configured or running side requires independent approval.
Rollback cannot undo work that already ran; intervening policy changes prevent
overwrite. Peer task progress can advance independently of permission verification.

`runtime.select` accepts a registered installation UUID as `runtimeId`, explicit
`acknowledgeActiveWork:true`, and the exact distinct source/target installation
IDs in `targets`. It changes only a registered existing default descriptor for
future launches, preserving overrides, running work and the connection's original
binding. Registration is an explicit backend operator procedure; the MCP accepts
no arbitrary home/selector paths. Both configurations, identities, known work,
target readiness and production policy are checked. CLI and management selection
share exclusive descriptor ownership.

`risk.role` accepts a role and `acknowledgeActiveWork:true` for the bound
installation only. It requires current complete Risk metadata from the
installation-verified daemon and preserves it in the selected `.env`. It saves a
startup role with `pendingRestart:true`; it does not modify live membership,
trust, listeners or processes. Settings reports configured and observed roles
separately. Missing Border/member prerequisites or legacy incomplete API
metadata deny preparation. The optional subsequent restart is a separate service
proposal, never inferred from saving the role.

## Configuration and lifecycle transaction

1. Read current source/effective state; validate supported schema and exact targets. Unknown executable/path/environment injection keys are refused; advanced unsupported fields receive external-editor guidance without claiming managed support.
2. Lock resource, verify opaque revision, capture real baseline/rollback privately, record GAIT before effects. Secret intents are `keep`, `replace`, `clear`; blank/mask/omission means keep. Prepare stores no replacement bytes.
3. Human reviews target/diff/affected requests. Production incident precheck and live Implement-state CR validation precede execution; CR withdrawal stops further dispatch and invokes authorized recovery. No automatic ticket/message creation.
4. Atomically preserve unrelated `.env`/configuration data and private file permissions. Use env references for provider/companion credentials, with reviewed migration and fallback compatibility; do not silently rewrite legacy config on connect.
5. Start/stop/restart only verified installation-owned services using narrow adapters outside the service being stopped. No install/build/upgrade, broad `pkill`, unit deletion or remote bootstrap. Explicitly resolve active-work impact before disruption.
6. Verify effective running state. A saved field alone is pending restart. Failure attempts captured authorized rollback, verifies recovery, retains failed/unknown outcome, leaves production CR open or failed and reports escalation for human action.

Terminal Intent is a separate scoped path, not an estate-wide lab mode. Only designated endpoints, API-created local record, explicit configuration intent, real baseline/rollback and the API's APPLY phase permit local execution; question/delegation text alone does not create that approval. Collector grants stay read-only.

The operator workspace adds `intent-state`, `intent-preview`, `intent-submit`
and `intent-read`. Submit accepts a nonce, explicit request kind and change mode,
exact testbed IDs, opaque configuration/testbed revision and, where applicable,
the existing Local/Lab policy revision or authoritative production CR reference.
Preview returns scope and the matching production action digest without gateway
dispatch. Admission creates a `terminal-intent` operation for the independent
worker; operation/events/cancel use their normal owned interfaces. A cancelled
in-flight segment is not claimed to have stopped its gateway tools. Unknown
work blocks new Intent admission and is never auto-reconciled from model text.
Records identify reports separately from actual transcript activity and set
`verifiedNetworkOutcome:false`. These operator methods are not exposed through
assistant discovery or dispatch. The adapter reuses the existing OpenClaw engine;
protected Hermes Intent remains explicitly unqualified.

## Durability and GAIT

Persist canonical admission/ownership before effects, then dispatch to an existing durable runtime or installation-owned worker. Worker startup uses only the admitted operation ID, not user command text, and rechecks authority. Lost receipts resolve through nonce lookup. Do not retry uncertain writes; reattach/read authoritative state instead. WSL shutdown can interrupt services; restart reads journal and preserves unknown outcomes.

Use explicit per-installation GAIT root and sticky-file location; verify root before branch/record/log. Missing required GAIT denies dispatch except the already defined scoped Local/Lab record. Existing CLI/HUD operations must share concurrency controls for resources managed by this interface.

## Implemented configuration and evidence refinements

The private resource kind `client` lists redacted grant setup references for human
onboarding/revocation; it is not an assistant inventory capability. Settings
proposals support reviewed legacy credential normalization. OpenClaw budget saves
use existing session controls (`sessionBudgetUsd`, `maxToolCallsPerTurn`,
`contextWarningTokens`, `allowOverride`, `overrideIncrementUsd`); hypothetical
daily/monthly caps remain unsupported. Saved state is distinct from effective
runtime verification. All responses carry validated output shapes and bounded
JSON; any content truncation is visible. Usage windows are recorded-time filters,
not account quota resets. Memory search is a bounded lexical read of the selected
installation database and retains recorded temporal validity.

### Owned conversation settings and progress

Opening/resuming a conversation is audited and never sends inference. Explicit
model/effort choices are stored immutably for that conversation; changed choices
require a new one. OpenClaw restricts them to configured models and declared
reasoning capabilities, then verifies the exact live gateway resolution before
Send dispatch. Upstream requires `operator.admin` for `sessions.patch`: only
this fixed owned-session settings operation opens a short-lived connection with
that scope. Ordinary inference retains read/write scope. There is no general
admin method exposed, and the assistant surface cannot enter this adapter.
Hermes per-conversation overrides remain unsupported.

Public OpenClaw answer events and tool milestones are filtered by owned run ID;
private reasoning, tool arguments and other runs are excluded. Hermes contributes
its owned tool-ledger events. Progress is redacted and bounded to 1,000 retained
updates per operation, with answer coalescing and explicit truncation markers.
Journal sequence and runtime source sequence remain distinct. Unknown operations
retain partial evidence; neither reopening a view nor checking status resends them.

### Exact production authority implementation

Managed production configuration and service adapters use the fixed read-only
ServiceNow verifier described in [change-control setup](../../../docs/VSCODE-CHANGE-CONTROL.md).
The private installation binding declares the verified Implement value, executor
user, target CIs and administrator-provisioned protected digest fields. These are
explicit customer mappings, not invented observations of an existing instance.
The verifier neither approves nor closes a CR. Contract fixtures pass; real
ServiceNow deployment qualification remains outstanding.

Pending assistant proposals retain their originating immutable grant snapshot.
Human apply checks that snapshot against current backend authority before and
after asynchronous approval/audit steps and at execution checkpoints. Expiry,
revocation or attenuation cannot be undone by opening a human review. Legacy
assistant proposals without this snapshot require fresh preparation.

Mobile capture review binds one enrolled device, capability and enrollment revision
for five minutes. Capture admission requires its consent reference and nonce. The
receiver independently validates the private operator record and live worker lease.
Content reads require a completed owned capture and a byte offset; 32 KiB chunks
retain total size, content type and SHA-256. They never add media to model context.

### Selected GCF and meeting context

`gcf-read` without `id` returns a bounded page of retained, explicitly selected
contexts (`cursor`/`limit`, default 100, maximum 500). With an owned context ID it
returns local serializer measurements and separately labeled token estimates,
actual fallback/profile and analysis settings. No provider usage, historical
savings or session/delta state is inferred.

`meeting-read` reads one uniquely bound existing live Zoom process. The fixed
backend route is `POST /n2n/management/meetings` with only optional `id`. Absence
is an explicit `available:false` envelope with `freshness:unknown`. A selected
meeting returns bounded source/citation-bearing excerpts, never execution
permission. The existing Zoom channel adds `n2n/zoom/context` and a two-step
`hello` proof: HMAC-SHA256 over the compact JSON tuple
`["netclaw-management-context-v1", installationId, clientNonce, serverNonce, role]`.
The server nonce is fresh per connection challenge, expires after ten seconds
and is consumed once. Client/server roles differ. Neither proof carries the key;
legacy secret-only hello remains investigation-only. The client verifies the
server proof before sending its proof or providing context. Private installation
identity is rechecked when context is read. No recording/listener is started.

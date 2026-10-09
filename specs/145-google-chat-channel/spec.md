# Feature Specification: Google Chat channel for NetClaw

**Feature branch**: `145-google-chat-channel`
**Created**: 2026-10-09
**Status**: Draft — specification only; runtime installation/upgrade, public ingress and Google configuration have not been performed.
**Input**: Close spec 144 through PR/merge, return to main, and design Google Chat integration using OpenClaw's channel guide. Clarify what a user can run now and which NetClaw patches are needed.

## Direction

Use the official OpenClaw Google Chat channel for transport. NetClaw should supply
repeatable setup, compatibility checks, visible status and its existing policy
boundaries. Do not implement a second Google Chat webhook or a device adapter.
No Google Drive/Docs connector, Gemini API key or incoming-only space webhook
substitutes for a bidirectional Chat app.

The first supported slice is a private Workspace pilot with synthetic/public
questions and an isolated NetClaw explanation agent. Operational access is a
separate gated stage: it must preserve Border/MCP authorization and keep private
network evidence local. Native chat transport alone does not enforce that export
boundary. A prompt asking the main agent to redact its reply is insufficient.

## User Scenarios & Testing

### User Story 1 — Determine whether this installation is ready (Priority: P1)

An owner runs a read-only check and receives the installed runtime/plugin versions,
missing prerequisites and the exact next setup action. They can distinguish a
native channel install from an application patch.

**Independent test**: Fixtures for missing plugin, incompatible peer range,
missing service-account file and wrong audience produce separate outcomes without
writing config, restarting services or exposing secrets.

**Acceptance scenarios**:

1. Given the observed OpenClaw 2026.7.1-2 host, selecting the current 2026.9.9 plugin
   reports its >=2026.9.9 peer requirement and blocks blind installation.
2. The older 2026.7.1 plugin remains a candidate only: plain semver does not match
   2026.7.1-2 against >=2026.7.1. A release-looking suffix is not compatibility proof.
3. Missing credentials, invalid credentials, unconfigured channel and unsupported
   runtime are distinct. No Google key, private key or gateway token is displayed.

### User Story 2 — Ask NetClaw from a private Chat app (Priority: P1)

An explicitly admitted user sends a synthetic question to the private app and gets
an attributable NetClaw answer in the same DM or originating space thread.

**Independent test**: Two admitted test users and one denied user exercise DMs and
one allowlisted test space; replies and transcripts never cross identities/spaces.

**Acceptance scenarios**:

1. A verified event reaches only the selected agent/account. Missing/expired/wrong-
   audience tokens fail before agent dispatch. Valid Google origin alone does not
   authorize the human sender.
2. Stable user and space resource IDs gate access; names/emails are not authorities.
   Space messages require mention. Unlisted spaces/users and bot loops are denied.
3. DMs are isolated per account/channel/peer. Spaces are shared-context boundaries;
   everyone admitted to a space must be entitled to that space's output. Threads
   organize replies, not tenant isolation. The pilot admits one trust domain.
4. A private operational question cannot invoke tools or disclose bootstrap/memory
   in the public-only pilot. Unavailability is explicit, never fabricated evidence.
5. Ordinary replies to an admitted user's request are within the configured channel
   interaction. Proactive/cross-space messages and reports require separate explicit
   operator authorization; mention gating never grants broadcast permission.

### User Story 3 — Run and disable the channel predictably (Priority: P2)

The owner can see configured/running/verified states separately, diagnose failed
delivery, rotate a key and disable the channel without altering other channels.

**Independent test**: Simulate invalid auth, unavailable gateway, duplicate delivery,
restart, expired credential and disablement. Show real state and preserve audit.

**Acceptance scenarios**:

1. Only the exact chosen webhook path is public; dashboard, HUD, chat-completions,
   WebSocket and tool endpoints are unreachable through that ingress.
2. Replayed messages do not silently replay a mutating operation. Admission records
   use provider message identity; uncertain task outcomes are reconciled, not retried
   as new writes. Transport delivery is not an exactly-once guarantee.
3. Disabling stops new dispatch and documented ingress rollback removes the route;
   local transcripts/audit are retained under the installation's retention policy.
4. Verification names the tested runtime/plugin pair and live test space. Static
   configuration validation alone is never reported as a working Google connection.

### Edge cases

- Multiple operators in one space, removed members, duplicate messages after crash,
  revoked pairing, renamed accounts/spaces and attempted cross-thread disclosure.
- HTTPS path normalization/trailing slashes, wrong token audience, expired token,
  unauthorized admin UI paths and proxy rules that accidentally match siblings.
- Attachment text that looks like instructions, Drive links, missing app membership,
  throttling and delayed work. Pilot accepts text only; unsupported media is explicit.

## Requirements

- **FR-001**: Optional/off by default; preserve Slack, HUD, Canvas, Avatar, mobile and
  existing agent bindings. No changes to unrelated runtime settings.
- **FR-002**: Discover versions and official plugin metadata before installation.
  Pin a tested pair and record package integrity. Never force peer compatibility,
  install floating latest over an old runtime, or silently upgrade/restart a gateway.
- **FR-003**: Use a private Google Chat app and a server-side service-account file.
  Prefer an environment variable containing the private path; no inline key material
  in repository examples, CLI arguments, logs, browser payloads or exported diagnostics.
  Use app auth with the minimum Chat scope; no domain-wide delegation for this pilot.
- **FR-004**: Verify Google-issued requests against the configured audience and
  expected issuer/principal using the official plugin. Preserve auth headers at the
  reverse proxy; reject invalid auth, content types and oversized bodies.
- **FR-005**: Default to explicit user/space allowlists, stable IDs, mention gating,
  bot rejection and isolated DMs. Initial enrollment is operator-controlled.
- **FR-006**: Bind the channel to an isolated explanation agent with a reviewed
  public bootstrap and tools denied. It must not inherit private main workspace,
  memory, sessions or auto-loaded files. Test this on the selected runtime.
- **FR-007**: Operational mode stays disabled until a separate policy implementation
  binds user/account/space/task to authorized Border/MCP actions and provides a
  deterministic outbound projection. It may emit fixed completion notices and
  owner-accessible local evidence references; raw tools/configs/topology/secrets
  must not reach Google. Do not claim an LLM redaction prompt enforces this.
- **FR-008**: Google text/cards cannot approve production changes outside the existing
  approved ServiceNow workflow. Terminal Intent Local/Lab remains exclusive to its
  API-created scoped requests. Quarantine and external communications retain explicit
  human confirmation. Native exec/plugin approval is distinct from a production CR.
- **FR-009**: Bind audit to stable sender, account, space, thread/message and local
  task references. Do not log bearer tokens or unnecessary private message bodies.
  GAIT failure blocks any future operational dispatch; never fabricate audit success.
- **FR-010**: Define bounded admission, retry/replay handling and task deadlines.
  Prove the installed plugin's actual persistence semantics; never infer those from
  current upstream docs for an older version. No blind retry of uncertain writes.
- **FR-011**: Pilot is text-only; no proactive notifications, attachments, recordings,
  Drive retrieval, public Marketplace listing, Workspace add-on deployment, multitenant
  MSP routing or arbitrary file uploads in this slice.
- **FR-012**: Deliver a dry-run-first setup/preflight utility, configuration example,
  optional installer entry, channel health view, troubleshooting and rollback guide,
  operating skill and meaningful security/compatibility regression coverage.
- **FR-013**: Keep MCP/tool inventory truthful: native channel registration does not
  increment the MCP count. New operational tools, if later required, remain MCP-native.
- **FR-014**: Live app publication, public ingress and test messages must be bounded
  to the owner-selected project/account/test audience. This draft authorizes none
  of those actions and does not create credentials or Google resources.

### Key Entities

- **ChannelProfile**: runtime/plugin pair, credential path, audience, webhook path,
  agent/account binding, policy revision and explicit enablement.
- **PrincipalBinding**: stable Google user ID, admitted spaces and local authority.
- **DeliveryRecord**: provider message/thread/space identity, admission/task state,
  replay disposition and sanitized audit reference.
- **ReadinessReport**: observed versions and individual config, auth, transport,
  policy and live-test outcomes; never credentials.

## Success Criteria

- **SC-001**: An owner can follow the quickstart on a recorded tested version pair
  to complete one synthetic DM and one mention/thread exchange in the pilot space.
- **SC-002**: Negative auth/identity/space/scope tests produce zero agent dispatch;
  a second user's DM context and private sentinel bootstrap cannot reach a reply.
- **SC-003**: Public probes reach only the webhook, never HUD or gateway control APIs.
- **SC-004**: Duplicate/restart tests document actual delivery semantics; no duplicate
  network mutation or false exactly-once claim.
- **SC-005**: Disable/rollback leaves existing channels and local evidence intact.
- **SC-006**: Repository artifact/declaration, affected HUD and policy tests pass;
  live gaps and compatibility uncertainty are stated before release.

## Decisions left for implementation

Owner supplies the Workspace project, permitted test users/space, HTTPS hostname
and preferred ingress (existing proxy, Tailscale or Cloudflare). Select the tested
runtime/plugin pair first. Ratify this scope before implementation; do not infer
Google project access from an unrelated connected Google app.

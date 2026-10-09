# Google Chat integration research — 2026-10-09

## What exists upstream

OpenClaw documents an official `@openclaw/googlechat` channel using HTTP events
for DMs and spaces. Setup requires a private Chat app, service-account credentials
and a public HTTPS webhook. The guide recommends exposing the webhook alone.
It documents sender/space restrictions, thread reply configuration and pairing.
Its current delivery notes explicitly retain at-least-once behavior at agent
handoff; durable acknowledgement is not exactly-once execution. Native approval
cards concern exec/plugin approval, not NetClaw ServiceNow changes. Attachment
and action support have service-account limitations and are outside this pilot.
[OpenClaw Google Chat guide](https://docs.openclaw.ai/channels/googlechat).

Google authenticates inbound Chat requests with a bearer token whose verification
depends on the configured audience. An HTTPS URL audience uses a Google-signed
ID token; verify the expected Chat identity and audience, and reject invalid
requests. This authenticates event origin, not permission for a particular human
to operate network infrastructure.
[Google request verification](https://developers.google.com/workspace/chat/verify-requests-from-chat).

App authentication uses a service account. The `chat.bot` scope supports app-level
Chat API operations; it is distinct from user OAuth and domain-wide delegation.
The pilot needs no delegated access to users' Gmail/Drive data or general cloud
project administrative roles.
[Google app authentication](https://developers.google.com/workspace/chat/authenticate-authorize-chat-app),
[scope reference](https://developers.google.com/workspace/chat/authenticate-authorize).

OpenClaw documents DM scoping and explicit channel/agent bindings. Default shared
main-session behavior is unsuitable for a multi-user pilot. Session isolation
also does not protect a shared operational workspace by itself.
[Session management](https://docs.openclaw.ai/concepts/session),
[agent bindings](https://docs.openclaw.ai/concepts/agent-bindings).

## Observed local and registry evidence

Read-only inspection on 2026-10-09:

| Item | Finding |
|---|---|
| Active CLI package | OpenClaw 2026.7.1-2, Node 24.19.0 |
| `openclaw plugins list` | No Google Chat channel listed; enabled `google` entry is the Google model/media provider plugin |
| Latest package metadata | `@openclaw/googlechat` 2026.9.9, peer `openclaw >=2026.9.9` |
| Older candidate | 2026.7.1, peer `openclaw >=2026.7.1` |
| Standard semver check | 2026.7.1-2 does not satisfy >=2026.7.1; suffix is interpreted as prerelease |
| Live Google setup | Not attempted; no project/account/space/hostname selected |

Metadata came from `npm view`, not package execution. No plugin install, gateway
upgrade/restart, channel activation, credential read, app creation, public tunnel
or test message was performed. Registry metadata can change: repeat the check at
implementation time. The older candidate is not a tested workaround; do not force
peer dependencies to install it. Test an exact supported pair in isolation.

## Repository fit and patch boundary

NetClaw already uses OpenClaw as a runtime with channel onboarding in
`scripts/lib/install-steps.sh`. `config/openclaw.json` is primarily the MCP
registration surface, not evidence of a configured Google channel. HUD `/api/chat`
is a private authenticated interface and should not be made the Google webhook.
Existing GAIT, MCP and production approvals continue to apply.

Basic messaging can use the native plugin on a supported runtime without a custom
bridge. What NetClaw still needs: tested version/setup guidance, idempotent private
configuration, honest readiness/status, explicit identity/session policy and
coverage proving privacy and change controls. Full operational use also requires
a deterministic export boundary. These are planned work, not claimed existing
features. Do not connect an unrestricted main agent merely because a valid Google
event arrives.

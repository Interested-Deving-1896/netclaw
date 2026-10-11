# Scoped NetClaw assistant MCP — development candidate

Official MCP SDK 2.3.1, stdio only, installed through explicit backend catalog
component `netclaw-assistant`. The component also installs its private operator
module dependencies; it creates no grant, client registration, runtime identity
or service. Do not add either management surface to the default OpenClaw registry.

The fixed launcher is `scripts/netclaw-assistant.mjs`; use its explicit installed
home/runtime and reviewed backend credential-reference arguments. Credentials
remain in the backend `.env`, and the journal retains hashes only. Grants bind
installation, principal, generation, target/action/disclosure scope and expiry.
Every call rechecks revocation. An unrestricted same-UID shell is outside this
MCP authorization boundary; clients cannot independently approve their proposals.

Exactly seven tools are exposed: `netclaw_status`, `netclaw_inventory`,
`netclaw_evidence`, `netclaw_request`, `netclaw_request_status`, `netclaw_cancel`,
and `netclaw_propose_change`. Unknown/private methods and caller-supplied
authority are denied. **Delegation and cancellation remain unqualified** pending
runtime permission propagation; schema presence is not execution support.

See the [assistant contract](../../specs/150-vscode-extension/contracts/assistant-mcp.md)
for disclosure, independent human review and named-client acceptance requirements.
No Copilot, Claude Code or Codex acceptance is implied by installing this component.
The backend uses supported HUD Node and installation-specific isolated GAIT;
provider credentials must never be copied into editor or assistant configuration.

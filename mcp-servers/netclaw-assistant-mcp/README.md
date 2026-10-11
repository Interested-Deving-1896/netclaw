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

| Tool | Inputs / authority |
|---|---|
| `netclaw_status` | No arguments; scoped inspection |
| `netclaw_inventory` | `kind` overview/integration/skill, bounded paging |
| `netclaw_evidence` | `kind`, optional ID, paging; explicit disclosure required |
| `netclaw_request` | **Execution request**, nonce, prompt, optional conversation/context; currently refused pending attenuation |
| `netclaw_request_status` | Exactly one request ID or nonce; owned status only |
| `netclaw_cancel` | **Cancellation request**, request ID and nonce; no unrelated service control |
| `netclaw_propose_change` | **Proposal only**, nonce, fixed action, targets, revision and typed patch; no apply/approval |

Create access through **NetClaw: Manage Copilot, Claude Code and Codex Access**.
The generated registration supplies `--home`, `--runtime`, `--installation` and
`--grant-ref`, a reference to a generated `NETCLAW_CLIENT_<32-hex-grant-id>_TOKEN`
entry in the selected backend `.env`. Never pass a token value on the command
line. The token is resolved locally at launch and revalidated on every call.
No HTTP transport or listener is provided.

See [client setup and exact observed versions](../../docs/VSCODE-ASSISTANTS.md)
and [actual client results](../../specs/150-vscode-extension/evidence/assistant-clients.md).
Claude inspection/proposal observations do not qualify delegated execution or
the remaining Copilot/Codex and remote platform matrix.

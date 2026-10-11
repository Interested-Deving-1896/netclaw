# Private NetClaw operator MCP — development candidate

Official MCP SDK 2.3.1, stdio only. Launch the fixed
`scripts/netclaw-operator.mjs` with supported HUD Node and explicit `--home`,
`--runtime openclaw|hermes`, and optionally the expected `--installation` UUID.
The OS principal and existing private installation identity bind every call.
No network listener, credential argument, bootstrap or automatic runtime switch
is provided. Never register this interface with an assistant or in
`config/openclaw.json`. Same-UID shell access is not an OS security boundary.

The owner can select catalog component `netclaw-operator` through the normal
backend installer. It installs locked Node dependencies without lifecycle scripts;
the extension does not run it. Supported Node is 24.19–24.x or 26.1+. Existing
installation identity/configuration and a separately installed isolated GAIT
runtime are prerequisites. GAIT failure prevents audited dispatch. Credentials
stay in the selected installation's approved `.env`; `GAIT_VENV` selects an
existing private audit interpreter for direct launcher use. Hermes companion
Python 3.14 and bridge Python 3.12 remain separate.

The fixed tool inventory and bounded schemas are in `schemas.mjs` and the
[operator contract](../../specs/150-vscode-extension/contracts/operator-mcp.md):
identity, resources, snapshots, owned conversations/requests/events/cancellation,
proposal preparation/application, evidence, workspace/RAG and client grants.
Preparation is not approval. Production operations require independent approval;
unsupported adapters fail closed. Secret replacements are transient explicit
inputs, never ordinary snapshots. Review actual supported/qualified capabilities.

This is incomplete development software. Current scope and observed tests are
recorded in [WSL evidence](../../specs/150-vscode-extension/evidence/wsl-acceptance.md)
and separate Mac evidence. Installing dependencies is not platform acceptance.

## Tool inventory

All inputs are strict schema-validated objects; paging uses a bounded `limit`
and opaque `cursor`. Mutating requests require a timestamped UUID `nonce`.
See `schemas.mjs` for the complete action-specific limits and `responses.mjs`
for bounded response schemas.

| Tool | Purpose / principal inputs |
|---|---|
| `operator_identity` | Bound identity, contract, runtime and capabilities |
| `operator_resources` | `kind`, filters, paging; selected installation inventory |
| `operator_snapshot` | `domain`, resource ID, window; source-labeled snapshot |
| `operator_conversation_open` | **Writes** owned conversation; nonce, view, optional prior ID |
| `operator_request_submit` | **Dispatches** owned request; nonce, conversation, prompt, reviewed context IDs |
| `operator_operation_get` | Owned operation receipt by ID; reconciles uncertain execution |
| `operator_events` | Owned operation events after a sequence; bounded paging |
| `operator_cancel_request` | **Writes** cancellation request; operation ID and nonce |
| `operator_change_prepare` | **Writes** proposal only; action, targets, revision and typed patch |
| `operator_change_apply` | **Applies** reviewed proposal; nonce, revision, approval reference, transient replacements |
| `operator_evidence` | Bounded GAIT, log or owned approval evidence |
| `operator_workspace` | Fixed RAG/Memory/Canvas actions; writes require nonce; unsupported actions refuse |
| `operator_client_prepare` | **Writes** grant proposal; named client, targets, actions, disclosure, expiry |
| `operator_client_apply` | **Creates credential** only after operator review; proposal, revision, nonce |
| `operator_client_revoke` | **Revokes** a backend grant; grant ID, nonce |

`HOME`, `PATH` and the explicit selected home locate installed prerequisites;
credentials are read only from that selected home's `.env`. Generated
`NETCLAW_CLIENT_<32-hex-grant-id>_TOKEN` values are never exported. Reviewed
Hermes operation additionally requires `NETCLAW_HERMES_HUD_API_KEY` and the
configured companion port. The bridge remains on its isolated Python runtime.
See [setup/recovery](../../docs/VSCODE.md) and [compatibility](../../docs/VSCODE-COMPATIBILITY.md).

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

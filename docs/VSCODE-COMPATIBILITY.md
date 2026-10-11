# VS Code compatibility and qualification

This is an implementation checkpoint, not a support promise. Exact evidence is
in [Mac development](../specs/150-vscode-extension/evidence/mac-release-development.md),
[actual assistant clients](../specs/150-vscode-extension/evidence/assistant-clients.md)
and the separate [WSL return](../specs/150-vscode-extension/evidence/wsl-acceptance.md).

| Component | Observed version / current result |
|---|---|
| Extension candidate | NetClaw.netclaw 0.1.0; unpublished |
| Minimum editor | VS Code 1.102.0, real Mac extension host and rendered views passed |
| Installed current editor | VS Code 1.108.0; full release-current matrix still open |
| Mac | arm64, Darwin 25.5.0; isolated synthetic installations and real process checks |
| Backend Node | Isolated 24.19.0; host Node 25 remains unsupported and unchanged |
| OpenClaw | 2026.7.1-2 real process, controlled provider |
| Hermes | v0.21.6 / 818c13be1dc4fd28987e1e881a9408224afd4535; Python 3.14.6, bridge 3.12.12 |
| MCP | Official Node SDK 2.3.1; stdio only |
| Claude Code | 2.1.286; actual hosted-provider inspection/proposal and Hermes refusal passed |
| Codex | 0.162.1; actual inspection passed, proposal blocked by client confirmation policy |
| Copilot | Opt-in stable MCP provider implemented/tested; actual inference acceptance open |
| Publisher | NetClaw exists; local credential verification refused authorization |

Mac fixture results do not qualify owner services, WSL, native Linux or remote
SSH. Returned WSL tests predate the current Mac implementation. All required
environment rows E1–E8, named clients, both harnesses and federation pairs remain
subject to the [qualification contract](../specs/150-vscode-extension/contracts/qualification.md).

Current implementation gaps include runtime-enforced assistant delegation,
owned service and role/harness lifecycle transactions, production/Local-Lab
authority adapters, remaining security/federation/domain workflows and complete
performance/accessibility/release acceptance. Required workflows cannot be
replaced by an “unavailable” label to close the release.

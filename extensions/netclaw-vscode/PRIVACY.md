# Privacy

The extension contains no analytics, telemetry service or remote asset loader.
It connects to the explicitly selected loopback NetClaw HUD from the VS Code
extension host. WSL/SSH hosting is provided by VS Code's remote extensions.

Explicit prompts, selected text and selected RAG passages go to your existing
NetClaw and may reach its configured model provider or tools. Uploaded files are
retained/indexed by that NetClaw. Copilot/Claude Code/Codex receive the data returned
to their enabled MCP tools and may disclose it to their own providers. Their
telemetry, billing, retention and organizational policy remain separate.

Environment inventory exposes presence, not existing secret values. A replacement
is entered with password input and sent only to the selected existing environment
writer. No workspace file is harvested automatically. Returned content is rendered
as inert text. Redaction is best-effort defense, not a guarantee that arbitrary
model replies, logs or selected text contain no sensitive data. Review before export
or disclosure. Do not place secrets in assistant draft proposals.

Host-local extension storage retains profiles, conversations, opted-in drafts,
Canvas data and assistant proposal/request records. HUD cookies for the editor are
stored in VS Code SecretStorage. Each terminal MCP registration has private session
state under extension storage (0700 directory, 0600 files). The adapter does not
copy provider credentials or browser sessions. Settings Sync is not used for profiles.

Disconnect invalidates current views but does not cancel backend work. Disabling an
assistant registration denies later calls, including calls through a cached server.
Uninstall does not revoke already-submitted NetClaw work or erase NetClaw data.
Review/delete extension storage separately if desired after disabling registrations.

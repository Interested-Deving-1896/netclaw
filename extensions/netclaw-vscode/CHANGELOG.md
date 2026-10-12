# Changelog

## 1.0.0 — button hotfix

- Bring Testbed Edit/Add forms and YAML/review panels into view, then focus an enabled field. Existing-device edits no longer appear to do nothing beneath a long device list.
- Keep keyboard focus while typing, retain the selected connection in saved drafts, prevent overlapping actions, and explain when no recovery copies exist.
- Reveal security reviews, invalidate the old visible review when editing a different rule, and keep MCP Reload available after metadata errors.
- Serialize Chat and Canvas actions, recover Canvas Send after a failed admission or interrupted request, and prevent delayed responses from enabling disconnected views.
- Add existing-device edit/save/cancel/preservation and button-recovery regression coverage. No HUD upgrade is required for this hotfix beyond the existing full-editor prerequisites.

## 0.1.1 — release candidate

- Restore testbed details and MCP configuration access with older running HUDs. Safe editing uses the updated HUD; legacy environment changes retain native review.
- Show native security ACLs, tool scopes, filesystem/process permissions and redacted YAML. Support actual DefenseClaw 0.8.4 connector commands and OpenShell 0.0.32 YAML policy commands.
- Preserve policy fields, refuse stale or unknown outcomes, and qualify native changes against isolated real targets.
- Include the topology renderer and its license notice in the VSIX; packaging now checks every emitted runtime asset.


## 0.1.0 — release candidate

Initial extension client for existing NetClaw: host-bound profiles, HUD observations,
Chat/Canvas/local Avatar, integrated RAG, reviewed environment/budget settings,
existing Intent/peer chat, prepared service commands and opt-in assistant MCP.
Uses unchanged NetClaw interfaces. Publication is on hold by the owner.

WSL qualification fix: restore Chat, Canvas, RAG and observation views after
switching tabs by retaining their message sequence across webview reloads.
Installation binding and replay checks remain enforced.

Windows local hosts now show explicit WSL guidance and filter the command palette
to WSL commands before any connection can be added.

Mac qualification fix: RAG controls show an operation in progress and prevent
overlapping submissions while collections refresh, retrieval runs or native
review is open. Controls recover on completion/cancellation/error and remain
disabled after disconnection. No operation is automatically replayed.

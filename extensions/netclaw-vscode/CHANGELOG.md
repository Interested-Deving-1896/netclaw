# Changelog

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

# Changelog

## 0.1.0 — development candidate

- Connect to an existing installation using a local extension host or an existing SSH alias.
- Inspect installation identity, integrations, configuration presence, usage and GAIT evidence.
- Use owned Chat conversations, an integrated Canvas and the existing local Avatar.
- Browse the existing RAG collections, upload a reviewed document, track indexing and search with citations. Select retrieved passages as context for Chat or Canvas.
- Prepare and review supported environment changes with retained baseline and verification evidence.
- Review provider/model and session-budget saves and normalize legacy credentials into backend `.env` references.
- Manage expiring assistant grants, opt-in Copilot MCP discovery and Claude Code/Codex setup previews; recheck revocation across asynchronous work.
- Browse bounded installation logs, filter recorded usage, inspect configured network inventory and search recorded memory with validity windows.
- Search local backend documentation through a safe native editor workflow.

This candidate is not a completed Spec150 release. Real Windows/WSL, Remote SSH,
named-assistant workflows and remaining domain acceptance must pass before publication.

### WSL development fixes

- Separate distributions sharing hostname/UID and pin operator identity on reconnect.
- Require explicit rebinding of earlier ambiguous WSL profiles; retained files are not deleted.
- Keep reviewed secret changes bound to their original connection across dialogs.
- Deny assistant principals at the private operator dispatcher and wait for concurrent GAIT turns during disconnect.

- Added owned OpenClaw model/effort selection, verified before inference; durable public answer/tool progress, bounded and redacted.
- Bound every rich-view call across asynchronous dialogs to its original connection generation. Terminal registration now checks the installed client version.

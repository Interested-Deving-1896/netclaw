# Spec150 recovery tasks

This list supersedes the expanded branch's 79 tasks. No old checkmark transfers.
Paths below are relative to the repository. All stories remain in scope.

## Foundation
- [x] T001 Record source audit and preserved branches in specs/150-vscode-extension/scope-recovery.md.
- [x] T002 Correct spec, plan, research and contracts in specs/150-vscode-extension/.
- [x] T003 Reuse extension assets and isolate package/build inputs in extensions/netclaw-vscode/.
- [x] T004 Implement and test bounded existing-HUD client in extensions/netclaw-vscode/src/client/.

## US1: connect and inspect
- [x] T005 [US1] Implement host-local profiles, trust and identity binding in extensions/netclaw-vscode/src/state/ and src/connection/.
- [x] T006 [US1] Map domain inventory and native navigation in extensions/netclaw-vscode/src/views/ and src/extension.ts.
- [x] T007 [US1] Verify existing HUD connection and identity changes in extensions/netclaw-vscode/test/.

## US2: conversation and knowledge
- [x] T008 [US2] Implement owned chat, model selection and uncertain-outcome behavior in extensions/netclaw-vscode/src/client/ and src/views/chat.ts.
- [x] T009 [US2] Reuse Canvas/Avatar and selected-context UX in extensions/netclaw-vscode/src/views/ and webview/.
- [x] T010 [US2] Implement integrated RAG search, citations and reviewed upload in extensions/netclaw-vscode/src/views/rag.ts.
- [x] T011 [US2] Verify chat/session/context/RAG boundaries in extensions/netclaw-vscode/test/.

## US3: management
- [x] T012 [US3] Implement supported configuration review and actual result reporting in extensions/netclaw-vscode/src/views/settings.ts.
- [x] T013 [US3] Integrate existing federation, audit, security and other HUD domains; record specific gaps in specs/150-vscode-extension/evidence/capabilities.md.
- [x] T014 [US3] Verify no new backend runtime/configuration dependencies in extensions/netclaw-vscode/test/.

## US4: assistants
- [x] T015 [US4] Implement official-SDK bounded stdio adapter in extensions/netclaw-vscode/src/assistants/.
- [x] T016 [US4] Implement explicit Copilot discovery and terminal setup in extensions/netclaw-vscode/src/assistants/.
- [x] T017 [US4] Test inspection, delegation, proposal and denied approval/apply tools in extensions/netclaw-vscode/test/.
- [x] T018 [US4] Record named-client Mac checks in specs/150-vscode-extension/evidence/assistants.md.

## US5: qualification and release
- [x] T019 [US5] Complete real Mac editor/VSIX lifecycle tests and evidence in specs/150-vscode-extension/evidence/mac.md.
- [x] T020 [US5] Finalize extension README/privacy/package documentation in extensions/netclaw-vscode/.
- [x] T021 [US5] Package committed source, push and provide final specs/150-vscode-extension/windows-wsl-handoff.md.
- [ ] T022 [US5] Receive real Windows/WSL results and resolve defects in specs/150-vscode-extension/evidence/wsl.md.
- [ ] T023 [US5] Publish qualified VSIX and verify Marketplace installation in specs/150-vscode-extension/evidence/publication.md.

Dependencies: foundation -> US1 -> US2/US3 -> US4 -> US5. Domain mapping and
read-only research can run independently; implementation changes are sequential.
Each story has the independent acceptance test specified in spec.md. Stop backend
scope expansion at a demonstrated gap and report it; do not silently add a service.

T018 records actual results and limitations; it does not assert full named-client acceptance.
Interactive Copilot/Codex consent remains a T022 validation gate. See evidence/assistants.md.

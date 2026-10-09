# Tasks: Google Chat channel

Status: draft. Only research/specification work is complete.

## Research and specification

- [x] T001 Read OpenClaw Google Chat guide and Google authentication references.
- [x] T002 Inspect installed runtime/plugin state and public npm peer metadata without installing.
- [x] T003 Separate immediate native setup from NetClaw-managed integration work.
- [x] T004 Define pilot scope, privacy/approval boundaries, architecture, quickstart and acceptance criteria.

## Compatibility and approval

- [ ] T005 Ratify pilot scope and select Workspace project/users/space and ingress hostname.
- [ ] T006 Test a pinned runtime/plugin pair in isolation; record schema/SDK and package integrity.
- [ ] T007 If needed, prepare an explicit runtime upgrade/migration with private baseline and rollback.

## Implementation

- [ ] T008 Build dry-run-first preflight/setup with redacted output, atomic backup/apply and unrelated-config preservation.
- [ ] T009 Add a disabled example, isolated public agent, stable allowlists, DM isolation and thread/mention configuration.
- [ ] T010 Prove private bootstrap/memory/tools cannot enter pilot replies; keep operational mode disabled.
- [ ] T011 Add optional installer/catalog component, HUD channel status, skill and all documentation surfaces.
- [ ] T012 Add sanitized meaningful policy/config/version/transport regressions and contract-suite registration as applicable.

## Acceptance

- [ ] T013 Run offline checks including invalid/expired/wrong-audience tokens, denied users/spaces, replay/restart and proxy path isolation.
- [ ] T014 With explicit selected scope, configure the private app and ingress; test one synthetic DM and one space-thread exchange.
- [ ] T015 Test revocation, unavailable gateway, disablement, key rotation procedure and rollback.
- [ ] T016 Record actual installed-pair evidence, known limits and GAIT; prepare feature release metadata only on completion.

## Separate follow-up gate

- [ ] F001 Design/ratify operational Google Chat authorization and typed outbound projection before allowing private network tools. Do not treat native chat installation as completion of this control.

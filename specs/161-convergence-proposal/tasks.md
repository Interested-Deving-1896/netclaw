# Tasks: Convergence scope proposal

## Proposal preparation

- [x] T001 Inspect current upstream, contribution policy, existing fork boundaries and spec collisions.
- [x] T002 Record user scenarios, requirements, delivery alternatives and maintainer decisions.
- [x] T003 Record isolated fork prototype evidence and distinguish unqualified platforms/layers.
- [x] T004 Run proposal artifact/declaration checks and publish a draft for scope review.
- [ ] T005 Obtain maintainer agreement on scope, sequence and required qualification matrix.

## Implementation gates after agreement

- [ ] T006 Coordinate numbered specs and API/case contracts; verify provenance and third-party notices.
- [ ] T007 Port the smallest agreed API/persistence slice with failure and recovery coverage.
- [ ] T008 Port portable deployment/docs/skill with actual fresh-install, restart, upgrade and restore evidence.
- [ ] T009 Adapt optional HUD integration to current upstream boundaries and verify browser/access behavior.
- [ ] T010 Review selected telemetry, investigation and IDS slices independently.
- [ ] T011 Complete required platform qualification, release preparation and maintainer review.

Dependencies: T005 precedes upstream implementation. T006 precedes T007–T010;
T011 depends on the agreed implementation scope. Existing fork work does not mark
these upstream port tasks complete.

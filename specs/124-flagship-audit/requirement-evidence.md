# Spec124 requirement evidence — Mac checkpoint

This maps evidence, not completion certification. Broad review and platform acceptance remain open.

| Requirement | Tasks | Evidence / remaining gate |
|---|---|---|
|FR-001|T003–004,T013,T026|coverage.json: complete baseline inventory; targeted, executed, generated and reference methods distinguished;1168 baseline paths still pending semantic disposition|
|FR-002|T005,T014,T026|findings.md stable001–055, task-linked repairs and verification.md; final report remains open|
|FR-003|T007–012,T028–094|finding-specific negative cases across HTTP/WS, TLS, identity, filesystem, change gates and rendering; broad source review still open|
|FR-004|T007–013,T016,T018|24contract suites,217 HUD tests/browser,430mobile tests, actual MCP startup, CML/FRR/NSM/Redfish fixtures; live provider/device limitations remain|
|FR-005|T014–016,T026,T028–094|all 55confirmed findings repaired with appropriate Mac verification; newly discovered defects must be added before repair|
|FR-006|T017,T032,T065,T084–086,T093|GCF lossless benchmark; bounded receiver/dispatch admission verified; no broad speedup claim|
|FR-007|T019–020,T030,T049,T053–056,T060,T062,T067,T073–078,T088–091|contracts/audit-and-migration.md, migration guides, temporary-fixture failure/repeat/recovery tests; full host adoption remains separate|
|FR-008|T004,T015,T018,T036,T041,T057,T059,T061,T087–088|isolated test environments, actual runtime-preservation tests, explicit live opt-ins, WSL handoff procedures|
|FR-009|T021,T053–055,T064,T077–078,T088–091|actual pyATS migration/GAIT isolated install and recovery fixtures; full operator install/upgrade acceptance remains open|
|FR-010|T006,T022–024,T033–035,T040,T047,T052,T070|all six reconciliation surfaces pass; changed Markdown rendered/local links checked; full README editorial rewrite deferred to phase3b|
|FR-011|T002,T022,T027,T082,T085|GAIT branch audit124-mac-completion-2026-09-27, daily private log, checked-in handoff; final phase completion journal still required|
|FR-012|T006,T025|spec/clarification/plan/tasks/analysis, this map,111 spec artifact gate; planning consistency is not full audit completion|
|FR-013|T014,T028–094|finding-specific analysis precedes implementation; continue this cycle for newly found defects|
|FR-014|T001,T003,T016,T018,T021|macOS evidence and wsl-handoff.md; Linux/WSL have not passed; native Windows is not a full host|

## Compatibility inventory

The following require explicit operator adoption or intentionally reject an old insecure configuration:001,005,018–019,021–022,025–026,028,030,036–041,049–050,052. Executable interfaces and exact recovery limitations are in [the migration contract](contracts/audit-and-migration.md) and linked guides. For041, the isolated-runtime setup and existing migration workflow replace the removed implicit system-package override. For049, test environments move to dedicated caches and never adopt/delete an operator runtime. For050, restore refuses unknown legacy state; it does not rewrite existing backups.

All other findings preserve supported persisted schemas and ordinary tool interfaces. Dependency refresh uses the committed manifests/lockfile; malformed/unsafe cache input is rejected without overwriting it. Receiver and federation resource limits intentionally reject overload and expose that condition; no conversion of stored data is necessary. New telemetry GAIT records begin now, without inventing historical records. Invalid arbitrary pickle objects are not a supported cache format to migrate.

Migration regression tests cover temporary preserved-state fixtures, not every operator installation. The actual Mac pyATS environment was migrated; other available migrations were not silently applied to active user configuration. Full install/adoption/recovery on the required hosts remains T021.

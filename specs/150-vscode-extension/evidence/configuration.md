# Shared configuration and launcher evidence — Mac 2026-10-11

This record covers isolated temporary installations on macOS 26.5.2 arm64,
supported Node 24.19.0 and Python 3.12. It does not qualify Windows/WSL, native
Linux or Remote SSH. No owner credentials, running services or configuration
were changed by these tests.

## Shared writers

The HUD's environment/budget operations and private management proposals use
the same installation SQLite configuration lock. The remaining NetClaw writers
now join it for the complete read/merge/write: dotenv import, MCP registration
merge, cwd normalization, Hermes registration translation, Pal preparation,
Twitter token persistence, Jev registration adoption and the existing voice,
Zoom, change-gate, SSH, TLS and iN2N transport migrations/restores. Preview-only
paths retain their read-only behavior. A genuinely unmanaged home keeps its
existing workflow; no management journal is initialized by these writers.

An existing management directory with a missing, empty or linked database is
refused. Node opens existing journals without schema initialization; Python uses
`mode=rw`, validates schema/installation ownership and checks private SQLite
sidecars. Expired locks remain interrupted ownership, never permission for a
new writer to steal the lock. Direct external/manual edits still invalidate
prepared revisions and rollback comparisons; upstream tools that do not use
NetClaw's helpers are not represented as cooperative lock participants.

Nine dedicated shared-writer cases passed. They reproduce the previous bypasses
and cover Node-to-Python exclusion, Python-to-Node exclusion in a separate real
process, preserving newer assignments/unrelated configuration, migration apply
and restore denial before creating recovery files, and damaged journals retaining
all original bytes. The five original cases failed before the correction.

## Hermes normalization compatibility

The HUD launcher previously required a literal `key` in `companion-auth.json`
after management could normalize that key into the selected `.env`. Launch and
read-only status now share explicit selected-installation auth resolution.
Launch credential/port writes join the configuration lock and verify the exact
environment baseline after asynchronous port probes. An existing normalized
source with a missing credential fails; it does not silently generate a new key.
The normalized key is never reinserted into the JSON file. Conflicting legacy
and environment keys fail for operator review.

The actual `hud-launch.mjs status` CLI was run against a controlled loopback
health endpoint with normalized synthetic auth. It sent exactly one authenticated
health read, reported the matching installation, did not print the key, preserved
both configuration files and started no service. This checks the real launcher
status path, not a live Hermes provider run or full service restart acceptance.

## Validation

- Shared-writer suite: **9 passed**.
- Operator/assistant regression: **163 passed, 12 opt-in skipped**. Skipped real
  process/platform cases are not included as passes.
- Relevant Python installer/env/Hermes/Pal/OAuth/Zoom regressions: **33 passed**.
- Additional migration/adoption/restore regressions: **18 passed**.
- Runtime selection and CLI environment: **7 passed, 9 subtests passed**.
- HUD runtime recovery/federation/private files: **7 passed**.
- Existing configuration/foundation/private-file subset before the final launcher
  cases: **39 passed, 1 opt-in skipped**.

Local logs: `/tmp/netclaw150-writers-{before,shared,python,migrations,selection,node,hud,backend}.log`.
T013 is complete for these shared non-listening managed domains. T038/T039/T041
remain open for runtime/role controls, their native forms and full transaction/
platform acceptance. This checkpoint does not mark those broader tasks complete.

## Harness and role implementation checkpoint — 2026-10-11

T038 and T039 are now implemented. Their controls use the existing review/apply
protocol and detached worker. T041 remains open for the full transaction and
service/platform qualification beyond the controlled cases below.

`runtime.select` operates on an explicitly registered existing runtime descriptor
and existing source/target installation identities and journals. It preserves
running processes, stored work and the current connection. The target must pass
authenticated readiness. Both installations' configuration and active/unknown
work enter the baseline; production on either side requires authoritative
approval. Assistant proposals need both targets in their grant. A shared
exclusive selector lock also covers the existing CLI selector, and target/source
configuration locks exclude cooperative writers. Changed identities/configuration,
work and selector bytes deny stale apply. An interrupted selector lock is retained
for explicit recovery; newer manual edits prevent rollback overwrites.

`risk.role` saves the startup role and preserves current Risk name, description,
enabled stacks, Border endpoint and self member ID. Its read baseline must come
from the installation-verified daemon. Stored/live metadata conflicts are denied.
Missing existing Border/member prerequisites cannot create a Risk or enrollment.
Known work and attested service process identity are captured. Saved versus
observed roles and pending restart are distinct; no live mesh mutation or implicit
restart occurs. Service impact review now includes mobile and Science operations
as well as conversations, assistants, RAG and Terminal Intent work.

The first real Risk test failed: `/n2n/risk` omitted `border_endpoint`, which could
erase that persisted value on startup sync. The read API now includes the existing
field, and the adapter refuses legacy responses lacking any preservation field.
The unchanged test passed after the correction; no missing endpoint is interpreted
as empty authorization/configuration.

Validation on Mac, supported Node 24.19.0:

- Role transaction cases: **9 passed**, covering both harnesses, exact file
  preservation, no fabricated prerequisites, stale work/service/metadata,
  production and withdrawal, verified rollback, rollback failure, lost-response
  recovery, unavailable/foreign/legacy API sources.
- Selector transaction cases: **8 passed**, covering the real resolver, two-target
  grant scope, target drift, readiness failure, competing legacy CLI/configuration
  writer, target production policy, rollback/manual edits, non-initializing
  registration and replay preservation.
- Native settings cases: **3 passed**; complete extension suite **55 passed**.
  TypeScript check and build passed.
- Operator/assistant regression: **180 passed, 14 opt-in skipped**.
- Relevant Risk/API/runtime-selection/CLI Python regression: **22 passed,
  9 subtests passed**. Catalog coverage passed; references regenerated.
- Actual process selector test: **1 passed**. Installed OpenClaw 2026.7.1-2 and
  pinned Hermes v0.21.6 ran in separate disposable homes. Both direction changes
  used installation-specific GAIT and detached workers after facade closure.
  The actual resolver selected each target while the original bindings and both
  processes/configurations remained intact. Provider requests: **0**.
- Actual Risk integration test: **1 passed**, running three roles for each
  harness. A disposable Python process used the shipped federation API handler,
  Risk SQLite store and `_sync_risk_from_env`. Read-only loopback transport
  provided identity-checked observations; Node's real independent worker and
  GAIT saved the pending role. Explicit fixture invocation of startup sync then
  verified the observed role and preserved all existing metadata. This is **not**
  a real mesh listener restart, remote member transition or Windows/WSL evidence.

Local logs: `/tmp/netclaw150-{role-targeted,selection-targeted,selection-process,role-process,runtime-backend,runtime-extension-tests,runtime-extension-check,runtime-extension-build,runtime-ui,runtime-python,runtime-catalog}.log`.
Runtime registration/operator guidance is in `docs/VSCODE-RUNTIMES.md`. Release,
federation matrix, named-client and Windows/WSL gates remain separate and open.

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

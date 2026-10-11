# Observability evidence — Mac 2026-10-11

This checkpoint covers usage/log projections, native diagnostic review and the
network provenance workflow, completing T059/T060. It is not a WSL, Linux,
remote-host or physical-network qualification.

Log reads now support inclusive ISO time filters and debug/unknown severity.
Unknown or ambiguous timestamps are counted when excluded rather than assigned
a guessed time. Numeric values require explicit epoch units. Configured secret
values are redacted before query matching, fixing a reproducible case where a
secret-only query selected an otherwise redacted row. Opened file descriptors
must still match the observed owned inode; linked/replaced or writable-by-other
sources cannot be accepted as that source. Tail byte references, row/file caps
and truncation remain visible.

Native log and identity-diagnostic previews support explicit local export. The
export saves the visible editor document, including the user's additional
redaction, rather than an earlier hidden string. Cancelled export, connection
change or a nonlocal destination scheme cannot write a file. Identity diagnostics
use the extension manifest version and fetch no logs or network/config content.

The two initially failing log cases demonstrated the absent time contract and
pre-redaction secret-query matching. Current targeted observability tests cover
usage reconciliation/gaps, owned Hermes usage, bounded secret-redacted logs,
configured inventory, time/provenance, query redaction, numeric-time ambiguity
and descriptor identity. Native tests verify exact filters, edited-text export,
cancellation, connection changes and nonlocal-destination denial. All use
synthetic temporary files and mocked editor surfaces; no owner logs were read
or exported. Validation: 180 operator tests passed (16 optional process tests
skipped), 24 assistant contract tests passed (one optional process test skipped),
and the shared HUD observability regression passed without provider contact.
The eight observability cases include multiline configured-value redaction
across log line boundaries. All 63 extension tests and TypeScript checking passed. GAIT: `d6d8087c`.

## Network provenance checkpoint

The existing HUD collector now retains a private, normalized installation-bound
projection after collection and authorization-state changes. It preserves each
source timestamp, failure state, instance/revision reference and truncation count.
The reader verifies ownership, canonical paths, identity and bounded schema. It
rejects foreign identities, linked/public files, unknown fields and dangling
edges. It never invokes collection or changes grants. Normal stop is retained as
stopped; an abrupt exit leaves historical data whose age continues to increase.
Collector/process/device liveness remains unknown. No snapshot is promoted to a
live health check or verified physical cabling.

Native Network offers configured inventory, retained observations, separate
internal/external federation relationships and an explicitly simulated local
node-removal view. It renders inert text, bounds graph/list sizes, exposes source
details and pagination, clears on installation switch and offers explicit entry
to Terminal Intent. Simulation sends no backend mutation or inference and makes
no routing/convergence prediction. Advertised names are not merged into managed
device identities without proof.

Validation on Mac arm64, Darwin 25.5.0, supported Node 24.19.0:

- 208 operator/assistant tests passed, 17 optional process checks skipped. Four
  new topology cases cover both harness identities, zero reads-to-poll effects,
  failure/stale/revocation, private-file/schema denial and 600-record source caps.
  The final stricter schema and log subset passed all 12 cases.
- All 65 extension tests and TypeScript checking passed at integration; the two
  native network tests and typecheck passed again after UI refinement.
- Four existing topology parser/consent/correlation regressions passed.
- The actual HUD server, HTTP authorization/login routes and real SSH collector
  ran against a loopback synthetic SSH router through `test/topology-api.mjs`.
  Approved command sets, host-key challenges and revocation passed. Management
  reads returned CDP/LLDP and interface provenance, issued zero additional SSH
  commands, and reflected revoke. The test now uses a private explicit runtime
  home and minimal environment, avoiding ambient owner runtime selection.
- Actual isolated VS Code 1.102.0 and 1.141.0 development hosts rendered the view,
  switched configured/historical/simulated sources and removed a node locally.
  No operation was admitted by those interactions. Both editor runs also covered
  Chat drafts, Canvas branching, Avatar and RAG panel entry; this run did not
  requalify RAG embeddings, provider inference or physical topology. The final
  compact graph layout was rechecked in 1.102.0 and 1.141.0; screenshots
  were visually inspected. GAIT: `4ee82915`.

Commands: `node --test tests/operator/*.test.mjs tests/assistant-clients/*.test.mjs`,
extension `npm run check`, `npm test`, and `npm run test:editor` with the isolated
Playwright driver; HUD `node test/topology-api.mjs` and the four topology tests.
Raw logs/screenshots remain local under `/tmp/netclaw150-network-*` and isolated
`netclaw150-editor-*` profiles. Published VSIX/WSL/remote performance and the full
domain UI matrix remain separate release gates.

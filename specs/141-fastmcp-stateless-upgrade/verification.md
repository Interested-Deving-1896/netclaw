# Verification — 2026-10-04

**Status: implementation verified for the migrated scope; fleet-wide completion is
still blocked by the explicit external exceptions below.** No deployment, Git push,
provider tool call, device configuration, ServiceNow ticket, or external message occurred.

## Evidence

| Check | Result |
| --- | --- |
| Owned FastMCP inventory and exact pins | 35 servers; static audit passes. |
| Owned dependency resolution | All 35 manifests resolve for Python 3.12 (`dependency-resolution.json`). |
| Owned real client catalogs | All 35 pass both `legacy` and `2026-07-28`, identical catalogs within each server; 450 tools (`upgraded-catalogs.json`). |
| Baseline catalogs | 29 available; six old-environment imports lacked dependencies. No baseline parity claim for those six. |
| Before/after contracts | All 29 preserve names and required arguments. 28 input contracts match after metadata/strictness normalization; Claroty's `Any` schema correction reviewed below. |
| External real client catalogs | 33 pass both modes (767 tools, including seven in retired Catalyst Center reference); RADKit fails honestly on missing `radkit_client`. |
| External source resolution | 26 active components resolve under exact framework bounds; RADKit's licensed client is unavailable from the public index; two retired entries excluded. |
| GAIT staging/rebuild/restore | Real isolated candidate built and catalog-checked; existing SDK1 mcp-call wrapper successfully called gait_status against it; a second generation was built and the first restored. Operator runtime untouched. |
| Additional published components | NSO 3.1.0, Infoblox 2.2.3, AWS Network 0.0.17 installed successfully under FastMCP4/MCP2 bounds and passed catalog probes. |
| Auvik / Halo | 387 / 135 tests pass. |
| N2N | 554 pass; existing datetime deprecation warnings remain. |
| Memory / RAG unit / RAG integration / Jevons | 62 / 73 / 18 / 82 pass, in separate processes. |
| Protocol, GNS3, Zoom regression selection | 71 pass. |
| Framework migration/security and installer/GAIT selection | 43 pass after final patch and rollback coverage additions. |
| Itential OAuth / serialization selection | 41 pass using patched source and real framework dependencies; not live identity-provider validation. |
| Domain shell suites | analysis, ANTA, BGP Intel, CatC, Cisco PSIRT, document, Fortinet, NSM, Redfish pass; optional live/host capability skips remain explicit. |
| Repository checks | Dependency pins, SDD artifacts, contract-suite matrix parity, catalog/dependencies/docs/package/portability reconciliation, shell syntax and diff whitespace pass. |

Tests used an isolated `/tmp/netclaw-fastmcp141` Python 3.13 environment. Dependency
resolution separately targets 3.12. This is not a claim of execution testing every
supported Python minor version. Tests ran on macOS; CI now includes the new
framework suite on Linux, but that workflow has not run remotely.

`inventory.json` and `baseline-catalogs.json` are pre-migration snapshots.
`fleet-disposition.json` is the final classification. Source patches are checked
into the parent repository; no ignored operational clone was edited. External
verification used disposable source copies. Both catalog runners reject outbound
socket connections and use fixture credentials. CML's eager vendor client
constructor is stubbed for discovery. No vendor tool is invoked.

Claroty previously advertised `Any` values as `string` under SDK1. FastMCP4
correctly exposes unrestricted JSON for those same annotated Python functions,
including numeric IDs and list filters. This is an intentional schema correction,
not an application argument change. Framework metadata adds titles, dedented
descriptions and output schemas, and rejects unknown arguments. See
`catalog-comparison.json`; its Claroty `review` entry records the observed delta.

## Remaining external integrations — do not claim upgraded

| Integration | Evidence and remaining work |
| --- | --- |
| Atlassian | Published 0.23.1 caps FastMCP below 4 and SDK below 2. Reviewed source overrides private tool dispatch/visibility methods and session-based user-token middleware, and imports removed `EventStore`. A native port must preserve read-only filters and per-user authentication for both protocol eras, with dedicated security tests. Its existing launcher is retained. |
| AWS Cost Explorer | Published 0.0.21 imports SDK1 FastMCP in six modules. Current upstream no longer contains its former source directory. Preserve its existing isolated uvx backend until a reviewed source-distribution port or replacement migration is specified; replacing it with a differently catalogued billing server is not transparent. |
| AWS Diagram | Published 1.0.23 imports SDK1 FastMCP; current upstream no longer contains its former source directory. Needs a reviewed source-distribution port or explicit replacement; no forced SDK2 pin is applied to it. |
| PagerDuty | Published local 1.1.0 uses SDK1 FastMCP, callable `add_tool` registration and Python 3.12-only metadata. The official local repository was archived on 2026-09-04 in favor of a hosted OAuth server. A maintained local fork or deliberate remote/auth migration is required. Existing launcher remains. |
| Blender | `blender-mcp` 2.0.0 delegates to `mcp-for-blender` 2.1.3, which explicitly requires MCP below 2. Source combines SDK1 FastMCP with interactive Apps, Blender socket lifecycle, telemetry and addon negotiation. Needs a tested native port covering those contracts; existing isolated launcher remains. |
| RADKit | Reviewed framework patch and modern bounds exist, but public dependency resolution cannot obtain `cisco-radkit-client==1.9.0`, and catalog discovery cannot import `radkit_client`. Requires the licensed dependency and an authorized read-only smoke test. No stub is counted as a pass. |

CML and Itential originally had upper-bound blockers too. They were ported:
CML exception conversion and Itential lifespan access are included in reviewed
patches, their dependencies resolve, and both protocol catalogs pass. Their live
vendor/API and full HTTP authorization matrices remain operational validation work.

ServiceNow's legacy SSE module has an unused FastMCP import; the server is actually
low-level SDK1 and is not converted. Junos also uses low-level SDK1; MemPalace uses
its own protocol implementation. AWS CloudWatch, IAM and CloudTrail currently use
SDK2 `MCPServer`, not FastMCP. Remote/vendor-hosted and Node/Go integrations are not
Python FastMCP source migrations. The retired community Meraki and old Catalyst
Center clones are recorded separately from active registrations.

## Issues found and corrected during verification

- SDK1 imports survived the presence of a standalone FastMCP distribution.
- Removed constructor options and private manager methods affected external servers.
- Azure's subscription client moved to a separately installed SDK package.
- UML required modern FastAPI/Starlette, Rich and multipart bounds plus HTTP launcher changes.
- F5 pinned an incompatible old dotenv version.
- CVP's embedded dependency metadata, foreign log path and missing HTTP client broke fresh startup.
- GAIT could select host Python with an obsolete framework, and runtime-only rollback could mismatch source. Generations now bundle and verify source before promotion.
- Cross-suite `storage` module collisions and RAG fixture dimension contamination occurred when unrelated suites shared one process; separate runs passed. These failed exploratory runs were not counted as product regressions or hidden as passes.
- New test runner initially used unsupported client mode `modern`; corrected to the actual `2026-07-28` API.

## Operational limits and audit

`pyats_list_devices` was attempted and failed because `PYATS_TESTBED_PATH` was
missing. No device state was inferred. MemPalace and WordPress connectors are not
available in this session; daily memory is the fallback. Publish a milestone post
manually after reviewing the implementation and its remaining exceptions.

GAIT branch: `fastmcp-upgrade-2026-10-04`. Initial implementation checkpoint:
`95109018`; verification progress checkpoint: `ea54308b`. Final audit log is
recorded at session end. Git branch remains separate from `main`.

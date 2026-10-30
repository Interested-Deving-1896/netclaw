# Verification: scope proposal

## This PR

Only `specs/161-convergence-proposal/` is added relative to upstream main. There are
no runtime, installer, dependency, catalog, HUD, deployment or version changes.
Checks passed before publication:

- `python3 scripts/verify-spec-artifacts.py`: PASS, 144 specs checked, four legacy exceptions.
- `python3 scripts/reconcile-mcp.py --surface catalog --surface dependencies --surface docs --surface meraki-ids --surface packages --surface portability`: PASS on all six surfaces.
- `git diff --check`: PASS; proposal is confined to five Markdown artifacts.

No runtime tests are claimed for this documentation-only diff. Fork execution
results below are explicitly separate.

## Existing fork prototype evidence — not an upstream implementation pass

On 30 October 2026, isolated tests exercised an Ubuntu x86_64 host with Docker
29.5.3 / Compose 5.1.4 and a disposable K3s v1.33.5 cluster hosted by k3d 5.9.0.
Both Helm 4.3.1 and Helm 3.19.0 installed/upgraded the generated release.

Observed passes:

- Fresh Docker project with alternate ports/site, private bundle path containing
  spaces, and conflicting exported credentials/profiles deliberately present.
- Fresh K3s namespace/release/site using local-path PVCs and a locally built/imported API image.
- Authenticated cases, unauthenticated/wrong-site rejection, API probe ingestion,
  Grafana provisioning and actual datasource queries.
- Synthetic case write/read/archive; K3s collector OTLP log round-trip to VictoriaLogs.
- Helm test metric/log ingestion and OTLP metric/log round-trips.
- Repeat upgrade and PostgreSQL/Grafana restart with original case persistence.
- PostgreSQL logical dump restored into a separate test database.
- Uninstall retained eight PVCs and the external credentials Secret; reinstall read
  the original canary.

This evidence supports feasibility only. It does not qualify a clean upstream
port, public exposure, arbitrary migrations, real-device coverage, automatic
investigations, full disaster recovery or every OS/architecture. macOS Desktop,
WSL2 and ARM64 runtime execution remain to be qualified. Available ARM64 image
manifests are not runtime tests. The existing upstream installer platform limits
remain applicable too.

## Audit and attribution

The work used checked-in Spec Kit instructions manually because native slash
commands were unavailable. A private local GAIT CLI record and Git/spec history
record proposal preparation. No network-device operations or live-runtime changes
were needed. API provenance was confirmed by its author; a later implementation
must retain the MIT notice and review third-party chart/dashboard licenses.

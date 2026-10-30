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
WSL2 and mixed-architecture scheduling remain to be qualified. Available image
manifests alone are not runtime tests. The existing upstream installer platform limits
remain applicable too.

## Audit and attribution

The work used checked-in Spec Kit instructions manually because native slash
commands were unavailable. A private local GAIT CLI record and Git/spec history
record proposal preparation. No network-device operations or live-runtime changes
were needed. API provenance was confirmed by its author; a later implementation
must retain the MIT notice and review third-party chart/dashboard licenses.

## Follow-up architecture evidence

[Dedicated fork acceptance run 41097779673](https://github.com/byrn-baker/netclaw-convergence/actions/runs/41097779673)
passed all four Docker/K3s jobs on native Ubuntu x86_64 and ARM64 runners at fork
commit `95482b37`. The K3s jobs use v1.37.1-k3s1 with Helm 3.19.0 and exercise fresh
installation, authenticated site access, Grafana datasource queries, canaries,
upgrade and PostgreSQL restart persistence. This remains fork feasibility evidence,
not acceptance of an upstream implementation or of macOS/WSL2/mixed-node behavior.
The [current fork qualification matrix](https://github.com/byrn-baker/netclaw-convergence/blob/1009-convergence-onboarding/docs/convergence/verification.md)
records precise coverage and the separate inherited fork-wide CI failures.

## Source and specification follow-up

Reviewed the author-supplied [standalone repository](https://github.com/byrn-baker/Convergence/tree/fff81b52fdd9b792e375208abfa8d091adf9949a), README and MIT license on 30 October 2026. Recorded its exact copyright notice and separated observability-stack ancestry from API ancestry. Confirmed this PR includes the numbered `specs/161-convergence-proposal/` directory with specification, research, plan, tasks and verification; the lowercase `specs/` layout follows CONTRIBUTING.md. This follow-up changes documentation only.

Validation: local Markdown links and `git diff --check` PASS. Spec artifact check PASS: 144 specs, four existing legacy exceptions. No runtime tests were rerun for these documentation changes.

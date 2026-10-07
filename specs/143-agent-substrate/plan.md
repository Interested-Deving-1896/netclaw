# Implementation plan

## Completed scope — assessment and decision record

1. Read repository operating rules, initialize GAIT and branch from clean main.
2. Inspect and pin upstream; contrast core networking/API with GKE distribution documentation. Map current Risk transport, systemd confinement, MCP Tasks and pyATS dependencies.
3. Record the no-go decision, workload placement, on-prem connectivity choices and reopening gates before implementation.
4. Honor the owner's conditional stop: defer container images, manifests, adapters and deployment.
5. Validate spec completeness and references. Record daily memory and GAIT; commit locally without push/release.

## Deferred Stage A experiment if reopened

Build a fixed synthetic Genie parser/lifecycle probe with independent RAM/file counters; no credential or private workspace mounts. Run in Docker, ordinary Kubernetes, then pinned Substrate, treating each as a separate acceptance result. Use private kubeconfig/explicit context and non-destructive lab creation. Test actor A → suspend → actor B → resume A and compare with a cold restart. Test reconnects and exact egress restrictions. A parser probe is not an OpenClaw agent and cannot establish Risk compatibility by itself. The experiment was deliberately not implemented in this branch.

## Stage B — separately reviewed production-code integration

Build an HTTP session adapter behind the existing Border authorization layer; expose approved existing MCP reads through authenticated HTTP site execution. Maintain NCFED identity and policy outside actors. Add backend-aware posture to spec 057 rather than claiming systemd probes attest Kubernetes. Reuse spec 142 Tasks with durable site-owned results. Never register an arbitrary shell/SSH forwarding escape. Add source-level authorization, tenant isolation, replay/fencing and disconnect tests before real network use. Update installer, environment, HUD, skills and catalog surfaces when this becomes an installable capability.

## Constitution review

- I–IV, VIII: no live device writes; current change control and GAIT retained.
- V–VII: no new production tools; future tool bridge uses MCP and existing vendor owners.
- IX/XIII: no credentials or private network output in build contexts or snapshots.
- X–XII: assessment lives in the numbered spec; no released capability, README integration claim, installer entry or count change is warranted.
- XIV: no publication, PR, ticket or chat message without authorization.
- XV: existing runtime files and installers remain unchanged.
- XVI: spec → research/plan → tasks → implementation, bounded by the owner's request.
- XVII: the architectural decision draft stays local; WordPress connector unavailable.

## Production acceptance (Stage C)

Measure full idle/active workload mix against ordinary Kubernetes and current host runtime. Include worker floor, control plane, snapshot I/O/storage, VPN, logging, egress and operator effort. Proposed gate: at least 25% total cost reduction at the owner's representative concurrency, successful fault/recovery and authorization tests, and an operator-agreed end-to-end p95 latency (including model/tools). These are acceptance targets, not measured benefits. Preserve a tested route back to the existing runtime.

# Research: contribution boundary

## Evidence reviewed

- Upstream `main` at `b18d51c091fe4c854f970a9c55c84342eb173018` (source 1.14.0).
- `CONTRIBUTING.md`: numbered Spec Kit artifacts, maintainer discussion for substantial
  scope, focused verification and release coordination.
- The existing Convergence fork: API/diary, HUD integration, collector/storage charts,
  operator setup skill, optional receiver/Guardian and IDS features.
- [K3s storage](https://docs.k3s.io/add-ons/storage): local-path is node-local storage;
  persistence does not establish replication or backups.
- [Docker Compose installation](https://docs.docker.com/compose/install/): local
  Engine/Compose and Desktop are distinct host setup paths.

## Decisions proposed

**Clean proposal, then focused ports.** The fork includes substantial unrelated work.
A fork-wide merge would obscure review and import site-specific operational history.
This branch therefore contains specification documents only.

**K3s for persistence; Docker for trial.** Helm can own per-project stores and queues,
while shared Grafana keeps its existing owner. A smaller Compose project provides a
credential-free entry point for core evaluation. Neither path automatically grants
network-device or model access.

**Explicit qualification.** Linux execution, ARM image availability, documentation
review and actual macOS/WSL execution are different evidence. No claim of universal
support should be inferred from a successful home deployment.

**Keep upstream integration boundaries.** Do not port the fork's entire module loader,
classic UI, model controls or SSH terminal to obtain a Convergence view. Adapt a
focused HUD integration to upstream navigation, runtime contracts and access policy.

**Preserve provenance.** The API declares MIT licensing and credits Brian Baker. The
author confirmed that its predecessor `network-guardian-web` was his own code and
was not separately released. A later port must retain the MIT notice and attribution;
surrounding NetClaw contributions retain the repository's Apache-2.0 terms. Audit
bundled chart/dashboard licenses before importing those assets.

## Alternatives considered

- Whole-fork PR: rejected because unrelated changes and operational examples prevent
  focused review.
- Docker-only production recommendation: insufficient for the requested reusable
  per-project Victoria deployment model.
- Require an existing Grafana/model/device inventory: rejected as unnecessary friction
  for first core verification.
- Automatic migration/adoption: deferred; ownership, history and rollback need an
  explicit separate operation.

See [verification](verification.md) for fork prototype evidence and its limits.

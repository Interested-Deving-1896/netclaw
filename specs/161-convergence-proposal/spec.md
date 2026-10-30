# Feature Specification: Optional Convergence monitoring for NetClaw

**Feature Branch**: `161-convergence-proposal`
**Created**: 2026-10-30
**Status**: Draft — maintainer scope review requested; no implementation in this PR
**Input**: Propose Convergence as an optional NetClaw add-on with a documented K3s/Helm deployment, a local Docker trial, an operator setup skill and separately verified network observations, cases and investigations.

## Problem

Operators need a persistent place to collect network observations and retain case
history alongside NetClaw. A working prototype exists in a fork, but importing
that fork wholesale would couple the feature to personal deployment settings,
unrelated extensions and unqualified installation assumptions. New users need a
clear path from an empty environment to verified core services before connecting
network devices or enabling investigations.

This PR requests agreement on the product boundary and contribution sequence.
It does not ship Convergence or claim its fork implementation is upstream-ready.

## User Scenarios & Testing

### User Story 1 — Install persistent monitoring (Priority: P1)

An operator installs an isolated release on an existing K3s cluster, with their
own context, namespace, site, image source and storage class. They understand
what each service stores, how to reach it and how to recover it.

**Independent Test**: From a clean checkout and empty namespace, install without
an existing Grafana or site-specific configuration, query a synthetic observation
and case, then restart and upgrade while retaining credentials and data.

**Acceptance Scenarios**:

1. Given a supported cluster and storage class, when the operator follows the
   guide, then the core services become ready and authenticated site access works.
2. Given repeated setup with the same identity, when preparation runs again,
   then credentials remain unchanged; mismatches stop with actionable recovery.
3. Given uninstall without data removal, then retained data and credentials can
   be reused by a documented reinstall procedure.

### User Story 2 — Try locally without device/model credentials (Priority: P1)

An operator starts a smaller Docker trial and sees a basic health dashboard before
connecting NetClaw or granting access to devices.

**Independent Test**: Use a new project, non-default site/ports and paths containing
spaces. Verify authenticated cases and datasource queries, reject wrong-site
access, stop/start and recover the same canary.

**Acceptance Scenarios**:

1. Given a local Linux-container daemon, when the trial starts, then only its
   selected services start and its endpoints bind to loopback by default.
2. Given exported host settings, when setup runs, then they cannot silently
   override the generated project's credentials or activate unrelated profiles.
3. Given no device feeds, then empty network observations remain unknown rather
   than appearing as proof of a healthy network.

### User Story 3 — Ask NetClaw for setup and scoped observations (Priority: P2)

An operator asks NetClaw to install or complete Convergence. A setup skill discovers
existing resources, uses the same documented helpers and hands over verified
capabilities. Optional HUD integration follows upstream's existing runtime,
authentication and navigation conventions.

**Independent Test**: Exercise skill-guided setup against a fresh and an existing
fixture; verify preservation, explicit target selection and honest partial readiness.

**Acceptance Scenarios**:

1. Given an existing runtime, setup preserves its credentials, models and settings.
2. Given a request for monitoring only, no automatic investigation, public exposure
   or device configuration is enabled implicitly.
3. Given unavailable telemetry or models, the HUD and handover distinguish those
   gaps from core service failures.

### Edge Cases

Wrong context; missing storage; mixed CPU architectures; private registry access;
occupied local ports; remote Docker daemon; existing PostgreSQL data with missing
credentials; read-only Kubernetes permission; unavailable Grafana plugin; interrupted
installation; stale feeds; duplicate delivery; rollback across schema changes.

## Requirements

### Functional Requirements

- **FR-001**: One entry point MUST explain K3s as the persistent path and Docker as
  a smaller trial, with prerequisites, exact commands, expected results and recovery.
- **FR-002**: Every deployment MUST bind an explicit identity and preserve credentials,
  data and unrelated resources on rerun; secrets MUST stay out of values, Git and reports.
- **FR-003**: Optional telemetry adapters, IDS capture, external notifications and
  investigations MUST remain separately enabled and verified capabilities.
- **FR-004**: Core access MUST enforce authentication, site scope and mutation roles;
  eventual HUD integration MUST retain upstream access controls and token secrecy.
- **FR-005**: Setup MUST distinguish service readiness, collection freshness, actual
  capture coverage and investigation completion, with no universal compatibility claim.
- **FR-006**: Each implementation slice MUST include clean-checkout, restart, upgrade,
  recovery and relevant platform evidence; unsupported combinations remain explicit.
- **FR-007**: Shared Grafana and existing monitoring MUST retain their configuration
  owner; a new release MUST not replace another project's defaults.
- **FR-008**: The contribution MUST preserve attribution and exclude private topology,
  live profiles, unrelated fork changes and generated operational state.

### Key Entities

Deployment identity; private credential bundle; site; telemetry source and freshness;
case and version history; optional investigation request; capability verification.
Detailed wire/data contracts belong to agreed implementation slices.

## Success Criteria

- **SC-001**: A fresh installation can be completed using only the chosen guide and
  declared prerequisites, without developer intervention or inherited home settings.
- **SC-002**: Automated checks and a recorded live canary prove core function and
  persistence through restart/upgrade; restoration is exercised independently.
- **SC-003**: The operator can identify every enabled layer and every unverified gap.
- **SC-004**: Each implementation PR is reviewable independently against its numbered
  spec, with platform limits and license provenance clearly documented.

## Maintainer decisions requested

1. Is an optional monitoring/case workspace within NetClaw's desired scope?
2. Is K3s/Helm plus a smaller local Docker trial the preferred deployment boundary?
3. Should delivery begin with the API/case contract, then deployment/skill, then HUD?
4. Which runtime/platform combinations must pass before the first supported release?

The specification number is proposed after checking current main, branches and
open PRs; it remains subject to maintainer coordination.

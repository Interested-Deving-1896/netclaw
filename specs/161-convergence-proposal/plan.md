# Implementation Plan: proposed contribution sequence

**Status**: Scope review only. No implementation task is authorized by maintainer
agreement yet, and no production code is changed in this PR.

## Summary

Keep Convergence optional. Use a clean upstream branch for each agreed slice, carry
only required dependencies and update all applicable declarations in that slice.
The existing fork is research evidence, not the implementation to merge wholesale.

## Constitution check

Numbered spec, research, plan, tasks and verification are included before upstream
implementation. No device operations, runtime edits, model calls or external data
sharing are part of this proposal. The checked-in Spec Kit instructions were
followed manually through specify, clarify, plan, tasks and consistency review.
No release bump is appropriate for an unapproved draft specification.

## Delivery slices, subject to agreement

1. **API and cases:** authentication/site/role contracts, PostgreSQL persistence,
   version history, bounded ingestion and failure/recovery tests.
2. **Deployment and onboarding:** K3s Helm chart, local Docker trial, source-image
   delivery, private repeatable bundles, operator setup skill, health dashboard,
   platform matrix and backup/restore evidence.
3. **Optional HUD:** upstream navigation/runtime/access integration, read/mutation
   boundaries, token non-disclosure and unavailable-feed browser behavior.
4. **Selected integrations:** separately reviewed telemetry adapters, bounded
   investigation/feedback contracts and passive IDS ingestion/capture evidence.

Each slice may receive its own coordinated spec number. Maintainer feedback may
reduce or reorder this sequence; this proposal does not reserve a release version.

## Exclusions from the first port

Personal cluster profiles, private topology, image registry accounts, home capture
plans, historical fork specs/reports, unrelated MCP integrations, personality changes,
local model controls, general SSH features, automatic quarantine or production
cutover. Do not import the fork's general module-loader architecture incidentally.

## Validation strategy

Use isolated fixtures and explicit deployment identities. Test clean install,
repeated preparation, wrong credentials/context, alternate ports/site/storage,
restart, upgrade, uninstall retaining data and restoration. Assert authentication
and site isolation. Verify source-specific telemetry and IDS independently from
liveness. Use real browser evidence for HUD changes. Record unsupported platforms
and ownership/migration limitations without converting them into passes.

## Release and compatibility

An agreed implementation must use current upstream contracts and preserve existing
runtime credentials and services. Coordinate a minor feature release only when the
first supported implementation spec completes. Helm rollback is not database
rollback; schema compatibility and restore instructions belong in the same slice.

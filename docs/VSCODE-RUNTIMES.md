# Harness defaults and Risk roles

**NetClaw: Configure Settings** offers two separate workflows. Neither installs
a harness, provisions a host or migrates saved work.

## Default harness for future launches

Register the existing installations on their backend host first. Both homes
must already have stable HUD installation identities, private configuration
and management journals. Connect to each existing installation normally to
establish management access. Registration checks the candidate's authenticated
runtime health; it sends no model request.

```sh
node scripts/netclaw-bind-runtime.mjs \
  --home /absolute/current/home --runtime openclaw \
  --installation CURRENT_INSTALLATION_UUID \
  --selector /absolute/owner/.config/netclaw/runtime.json \
  --candidate-home /absolute/existing/hermes --candidate-runtime hermes \
  --candidate-installation CANDIDATE_INSTALLATION_UUID
```

The first invocation is a preview. Review the exact homes, identities and
selector; add `--record` to save the private registration with GAIT. The selector
must already exist and point to one of these registered installations. No home,
identity, management journal or selector is initialized for a missing candidate.
To select in the other direction from another installation's connection,
register the same selector and candidates there explicitly.

In VS Code, choose **Default harness for future launches**, select an existing
registration and prepare its review. Review lists the source/target identities,
known active or uncertain work and the effect on future launches. Applying the
proposal updates only the registered runtime descriptor. Both installations'
configuration, requests, services, files and the current VS Code connection stay
in place. Use **Select Connection** separately to manage the other installation.
Explicit runtime, home and config overrides retain their normal precedence over
this default. The extension never silently changes those values.

The target must pass authenticated readiness again at apply. Changed identities,
configuration, work or selector bytes invalidate the review. Production policy
on either installation requires the existing authoritative change approval.
An assistant proposal needs grants covering both installation IDs; it cannot
apply or approve its proposal.

Managed writes and `netclaw hud select` share the selector's exclusive lock.
Source and target configuration writers are also excluded during managed apply.
An interrupted selector owner leaves `runtime.json.lock` in place: inspect the
recorded process and operation before explicit owner recovery. A timeout never
automatically steals it. Retain an uncertain operation; do not resubmit it with
a fresh nonce. Manual edits invalidate review and are preserved on failed
rollback.

## Standalone / Risk role

This workflow saves the existing installation's **startup role**. Settings
shows both the saved role and the role currently reported by the identity-checked
federation daemon. A different saved role is shown as **pending restart**.

The daemon must expose its complete current Risk metadata. Existing Risk name,
description, enabled stacks, Border endpoint and member ID are preserved in the
selected `.env`; conflicting values already saved there require reconciliation
through the normal backend workflow first. Border selection requires an existing
Risk name and enabled stack. Member selection requires an existing Risk name,
member ID and Border endpoint. This control does not enroll a new member, create
credentials, change trust or designate lab devices.

Prepare the role review, inspect the affected work and apply it through the
normal proposal review. Running requests and listeners remain unchanged. A
separately reviewed **federation service restart** uses the normal startup role
synchronization; it may interrupt mesh work or change listeners. Inspect the
observed role and resulting service/mesh readiness afterward. Saving a role is
not proof that this restart or a real estate transition succeeded.

For scoped Terminal Intent Local/Lab authorization, use that workflow's existing
designated endpoints and API-created change record. A Risk role is not a lab
approval and does not waive production change control.

Mac evidence and platform limitations are in
[Spec 150 configuration evidence](../specs/150-vscode-extension/evidence/configuration.md).

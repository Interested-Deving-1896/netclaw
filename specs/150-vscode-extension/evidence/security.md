# Security and Terminal Intent — Mac implementation checkpoint

2026-10-11, macOS 26.5.2 arm64, supported Node 24.19.0. This is not T047's
complete real-device or platform acceptance. No owner device/service/configuration
was changed and no ServiceNow ticket or external message was sent.

## Durable Terminal Intent

T043 implements an operator-only adapter around the existing non-listening
Terminal Intent engine. The independent management worker retains request
admission, its owned gateway session, each dispatch segment, reports, observed
tool activity and final/unknown states in the private installation journal.
Engine persistence/authorization hooks are optional for existing HUD callers.
Production changes validate the live independent CR and incident/scope/digest
rules before admission and each segment; withdrawal prevents later segments.
The adapter does not provide per-tool-hop enforcement on behalf of the runtime;
existing tool controls remain mandatory and their real-device qualification is
not inferred from these tests.

The explicit request kind distinguishes read-only from configuration. A model
report cannot promote a selected read-only request into the Local/Lab APPLY
phase. The existing policy creates a request-specific local record before
gateway contact, requires exact designated endpoint identity and current policy,
then verifies private owned baseline/rollback files and stores their hashes
before APPLY. It cannot establish the truth of network observations from model
text or arbitrary file contents: real precheck and rollback evidence still
requires actual device qualification. Collector state and global lab flags are
not consulted as write authority. The existing exact local-record GAIT exception
is retained; production audit loss prevents dispatch.

Cancellation before worker claim prevents dispatch. Cancellation during an
in-flight gateway request stops later segments but does not claim to stop the
gateway's tools. Loss after dispatch retains `unknown`. A new nonce cannot bypass
unresolved Intent work. The extension stores only the original connection
identity and pending nonce during admission and looks it up after a lost reply.
Model reports remain distinct from actual transcript events and the result
explicitly reports `verifiedNetworkOutcome:false`.

The adapter uses configured, normalized OpenClaw token authentication and an
already enabled HTTP chat-completions endpoint; it changes neither. Private
testbed endpoints use the shared HUD connection preference. There is no endpoint
designation, installer, credential update, arbitrary command/URL or collector
write entry in these operator methods. Protected Hermes Intent is unavailable.

## Results

- New backend Intent tests: **8 passed**, using explicitly synthetic endpoint and
  artifact content. They cover owned durable results/nonces, assistant denial,
  missing production CR, stale inventory, undesignated endpoints, actual private
  artifact hashes/APPLY ordering, read-only promotion denial, missing/public/
  linked artifacts, live policy/CR withdrawal, the scoped local GAIT exception,
  production audit loss, and cancellation before/during dispatch.
- Native Intent tests: **3 passed**, including exact review, no retained request
  text in pending metadata, cancelled/changed-connection denial and nonce lookup
  after a lost submission response. Complete extension suite: **58 passed**;
  TypeScript validation passed.
- Backend/assistant regression: **188 passed, 15 opt-in skipped**. No skipped
  actual process or platform case is counted as a pass.
- Existing HUD Terminal Intent, change-policy, live-transcript and terminal
  profile scripts: **4 passed**; their internal synthetic assertions also passed.
- Separate actual process check: **1 passed** with installed OpenClaw
  2026.7.1-2, real token-authenticated HTTP endpoint, installation GAIT, detached
  management worker and loopback controlled provider. The first request completed
  after facade closure. A second worker was deliberately terminated after the
  provider observed dispatch; its **real unrenewed lease** expired to unknown.
  Reconnection, nonce replay and a fresh request could not repeat it. Both
  retained records, the gateway and configuration were preserved. Exactly **2**
  controlled provider requests, **0** network-device contacts, runtime tools
  denied. No fabricated network verification is represented as acceptance.

Logs: `/tmp/netclaw150-intent-{targeted,backend,hud,extension-check,extension-tests,process}.log`.

## Outstanding security acceptance

T042/T044/T046/T047 remain open for their full scope. DefenseClaw retained
history and reviewed stored modes, separate OpenShell observations, real
configuration tool enforcement, production/lab rollback faults and platform
qualification must be reconciled with their existing component evidence.
This checkpoint does not qualify physical endpoint changes, mesh operations,
Hermes Intent, Windows/WSL, native Linux or Remote SSH.

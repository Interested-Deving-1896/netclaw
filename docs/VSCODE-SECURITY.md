# DefenseClaw and OpenShell in VS Code

Open **DefenseClaw** from NetClaw’s Security navigation to inspect stored guard
configuration, the selected federation daemon’s current posture, retained scans,
tool rules and security events. Stored policy is not evidence that a running
guard enforced a request. Host confinement and OpenShell remain separate controls.

An existing DefenseClaw component needs an explicit backend binding. The current
adapter supports config version 8 and one connector whose absolute `claw.home_dir`
and `claw.config_file` exactly identify the selected NetClaw installation. The
component directory/configuration/database must be private and owned by the
authenticated backend user. A global or multi-connector component is not adopted
automatically. Run this preview on the backend host, with supported Node:

```sh
node scripts/netclaw-bind-defenseclaw.mjs \
  --home /absolute/netclaw/home --runtime openclaw \
  --installation INSTALLATION_UUID --directory /absolute/defenseclaw/home
```

After reviewing the preview, run the same command with `--record`. This records
the binding in GAIT. It does not install DefenseClaw, initialize/migrate its
database, change hooks, start a service or contact a provider. Use `--runtime
hermes` for a matching existing Hermes connector.

The panel reads bounded snapshots of the component database and WAL. It excludes
raw scan payloads, prompts, event details and rule reasons, shows at most 100
records per section, and reports truncation. Tool rules identify connector,
global fallback and source/audit-only scope. These are retained policy records,
not an assertion that every process enforces them. Missing or incompatible stores
remain unavailable; reading a panel never creates one.

**Review guard mode change** prepares a normal managed proposal. For an already
enabled connector, `observe` saves observation mode, `enforce` maps to DefenseClaw
`action`, and `disabled` saves its disabled setting. Exact private baseline bytes,
revision checks, independent production change authority where required and
verified rollback apply. Saving is reported as pending restart; no hooks or
processes are changed. Re-enabling a disabled guard uses its normal backend setup,
because hook installation may modify additional runtime files.

## Connector tool rules

**Review connector tool rule** accepts an exact runtime tool name and shows its
current connector override, global fallback and resolved stored policy. Review
`block`, `allow`, or `inherit` before preparing the normal human-approved change.
The target is always `@<selected connector>/<tool>` in the explicitly bound v8
store. Global rules and other connectors are not edited. A rule does not install
a tool or establish that the runtime exposes that name.

`allow` follows the pinned upstream semantics: it bypasses rule/pattern/judge
scanning for that tool and clears the same scoped row's logical file/runtime
flags. Existing write-tool content inspection remains a separate CodeGuard path.
No file is restored, moved or quarantined. `inherit` removes the scoped install
override; the global fallback may still allow or block the tool. Native review
shows these effects. Already dispatched work may continue.

The proposal binds both configuration and exact rule/fallback revisions. Apply
checks the original private database inode and compares rows inside a SQLite
write transaction. Unknown schemas and action triggers are refused. Private
baseline/recovery records and GAIT retain the change; rollback restores only the
exact scoped row and refuses a newer owner's edit. Production changes use the
existing independent change-control verifier. Assistant origins cannot apply or
prepare this operator-only rule workflow.

Success verifies stored policy resolution. Running hook/proxy enforcement still
requires its own observed evidence; no tool or provider is invoked by a rule edit.

## OpenShell

The OpenShell panel observes an explicitly bound existing gateway and sandbox.
It supports the official CLI/gateway 0.1.3 contract with existing mTLS credentials.
The sandbox must already carry the label `netclaw.installation-id` equal to the
selected installation UUID. Normal backend setup owns that label; the extension
never assigns itself ownership of an unlabelled sandbox.

```sh
node scripts/netclaw-bind-openshell.mjs \
  --home /absolute/netclaw/home --runtime openclaw \
  --installation INSTALLATION_UUID \
  --executable /absolute/openshell \
  --config-home /absolute/xdg-config-home \
  --gateway GATEWAY --workspace WORKSPACE --sandbox SANDBOX
```

Review the exact destination and sandbox ID, then repeat with `--record`. The
binding pins the executable, metadata and certificate bytes. A certificate
rotation or binary update requires another review. Credentials remain on the
backend host; the CLI receives a temporary private copy and has telemetry
disabled. There is no fallback to an active gateway, last-used sandbox, insecure
TLS, bearer-token refresh or another user's registry.

The panel distinguishes authenticated gRPC access from HTTP health, observed
sandbox phase, configured policy revision, runtime-reported revision and policy
admission. A stopped, failed or pending sandbox remains degraded. A gateway may
materialize an existing policy revision while servicing its own read API; the
extension does not submit a new policy. A reported active policy is not proof
that every denial path has been tested. Private annotations and middleware
credential configuration are excluded from the projection.

Scanner execution and OpenShell gateway/sandbox writes
are still under implementation. The upstream 0.1.3 CLI's start/stop calls omit
request IDs and do not accept an expected sandbox identity/revision. Those calls
are not exposed as qualified managed writes. Current controls do not invoke broad
installer, upgrade, quarantine or ambient gateway commands.

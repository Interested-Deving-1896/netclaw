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

Scanner execution, component rule mutations and OpenShell gateway/sandbox actions
are still under implementation. Current controls do not invoke broad installer,
upgrade, quarantine or ambient gateway commands.

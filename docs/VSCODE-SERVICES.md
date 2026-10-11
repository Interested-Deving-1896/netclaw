# Binding existing NetClaw services

The extension manages existing services only after the backend operator records
an exact, reviewed installation binding. It does not install a service or adopt
one by matching a process name. This development interface supports a narrow
set of user-owned launchd and systemd definitions.

On the managed host, use the supported Node executable and the same runtime home
and stable installation UUID shown by the extension. Preview first:

```sh
node scripts/netclaw-bind-service.mjs \
  --home /absolute/existing/runtime/home --runtime openclaw \
  --installation EXISTING-INSTALLATION-UUID --service gateway \
  --manager launchd --unit ai.netclaw.YOUR-EXISTING-LABEL \
  --definition /Users/YOUR-USER/Library/LaunchAgents/ai.netclaw.YOUR-EXISTING-LABEL.plist
```

For Linux, use `--manager systemd`, the existing `netclaw-*.service` or
`openclaw-gateway*.service` unit and its exact file under
`~/.config/systemd/user/`. Service IDs are `gateway`, `federation` and
`hermes-companion`; runtime is `openclaw` or `hermes`. Values above are
placeholders, not commands to create a new installation.

Inspect the returned target and definition digest. Repeat the exact command with
`--record` to write only the private binding metadata, under the shared
configuration lock and installation GAIT. This does not start or stop the service.
Reopen Settings and use **Manage Service** to prepare the separate operation.

The controller verifies UID, canonical paths, non-writable-by-others definitions,
selected runtime home/configuration, known command signatures and current manager
state. For an active systemd unit it also checks the process environment and
current invocation identity. For launchd it checks the loaded job's path,
arguments and selected environment, not merely the plist on disk.

Systemd drop-ins, stale loaded units, execution hooks, alternate root/user
directives, complex continuation syntax and absent environment files are refused.
Environment files must exist, be owned and be unchanged from review; an optional
missing file is currently unsupported. Symlinks and arbitrary commands are not
accepted. Unsupported existing definitions need separate backend qualification;
do not weaken the checks or replace a working owner unit automatically.

Stop/restart explicitly acknowledge potentially interrupted work, including work
outside the management journal that cannot be counted here. Apply rechecks the
reviewed process instance and active management work. A worker independent of
the editor calls only the bound manager target. Verification observes real state
and service readiness. Failed verification attempts scoped recovery and retains
the failure; production approvals are never closed automatically.

Actual Mac gateway start/restart/stop and façade-disconnect preservation have
passed in a unique disposable launchd installation. Linux/WSL systemd,
federation and Hermes companion process qualification remain open. These are
release gates, not implied by passing the controller's fixture tests.

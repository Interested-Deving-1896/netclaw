# Actual VSIX lifecycle — Mac

Status: passed for the artifact below on macOS 26.5.2 (25F84), Darwin 25.5.0,
arm64. This is a candidate preservation result, not publication or full release
qualification. No owner service/configuration or external provider was changed.

- Candidate: `NetClaw.netclaw` 0.1.0, source
  `f95a32294f466deae27d63e5ad9c81ef82c2ef6b`.
- VSIX SHA-256:
  `eac6dbf4c1f56f65edb88b65ec731825c2348a44d91c404da695ac30dca84750`.
- Size: 2,956,383 bytes. Package allowlist: 24 extension files plus two VSIX
  metadata entries. No runtime trees, private state or synthetic secret markers.
- Real desktop versions: VS Code 1.102.0 and 1.141.0, separate clean profile and
  extension directory per run.
- Real installed runtime: OpenClaw 2026.7.1-2, supported Node 24.19.0. Fresh
  installation home and identity; controlled loopback-only synthetic provider.

The harness installed a synthetic previous candidate 0.0.1, connected the
packaged extension, staged explicit context, saved Canvas and completed an owned
conversation. It then upgraded to the exact candidate VSIX, disabled it,
uninstalled it, reinstalled the previous candidate and checked the retained
profile. It observed the same gateway process and unchanged configuration/.env
bytes after every phase. Completed request, saved Canvas and selected context
survived upgrade and rollback. Provider request count remained exactly one.
The 0.0.1 package is explicitly a fixture; no previous public release is claimed.

Reproduction from a clean candidate build, using supported Node on PATH:

```sh
NETCLAW_TEST_LIVE_GAIT=1 \
NETCLAW_TEST_OPENCLAW_ENTRY=/absolute/installed/openclaw/openclaw.mjs \
VSCODE_VERSION=1.102.0 node tests/vscode/package-acceptance.mjs
# Repeat with VSCODE_VERSION=1.141.0.
```

Local raw reports (not portable release artifacts):
`netclaw150-vsix-89Oaqf/report.json` (minimum) and
`netclaw150-vsix-80xF5Z/report.json` (current) under the Mac temporary directory.
The committed harness identifies the candidate source and digest in each report.

This checkpoint includes Science Officer, mobile capture, selected knowledge,
shared configuration writers, runtime/Risk changes, durable Intent, estate detail,
peer permissions, reviewed logs and Network provenance. Later profile-rename
implementation requires a new matching package checkpoint.
T070 remains open until that new artifact is built and exercised. E1/E2/E3 and
other platform/client rows, complete lifecycle management (service start/stop),
full release regression and public Marketplace installation remain separate.

The first 1.102.0 lifecycle run failed during editor CLI uninstall with a native
`v8::ToLocalChecked Empty MaybeLocal` fatal error in Node package loading. An
unchanged retry completed every phase. Both results are retained; no extension
fix is attributed to the retry. Local failure log:
`/tmp/netclaw150-vsix-f95a322-min.log`; passing retry/current logs use suffixes
`-min-retry.log` and `-current.log`. Package allowlist inspection also passed.


## Scanner and actual-Copilot checkpoint candidate

After committed source `ba91ecb45b89e8619fcff01c8c30a06b5ac01615`, a fresh
`NetClaw.netclaw` 0.1.0 VSIX was packaged with **26 archive files** (24 allowlisted
runtime files and two VSIX metadata entries), **2,959,957 bytes**, SHA-256
`ea5db2b929f5dbbcf96abf980530a806cac4b75a0a09b250f7f597572745984a`.

Actual isolated **VS Code 1.102.0 and 1.141.0** lifecycle checks both passed on
Mac arm64: clean previous-candidate install, upgrade to the exact new VSIX,
disable, uninstall and rollback/retained profile. Each run kept an independently
owned installed OpenClaw process alive, made one controlled loopback-provider
request and preserved configuration/.env bytes, its completed request, saved
Canvas/context and profile identity. Actual installation GAIT was enabled.
The previous version is a synthetic `0.0.1` candidate, not a public release.

Local reports (sanitized summary above):

- Minimum: `/private/var/folders/ln/99pzcfd950j6vxf7gbfjjm5w0000gq/T/netclaw150-vsix-T7B2KM/report.json`
- Current: `/private/var/folders/ln/99pzcfd950j6vxf7gbfjjm5w0000gq/T/netclaw150-vsix-pJCqsl/report.json`
- Logs: `/tmp/netclaw150-vsix-ba91ecb-{1.102.0,1.141.0}.log`

This supersedes the older candidate for these identified Mac lifecycle rows.
Subsequent inspection-rendering changes need a fresh candidate. No public
publication, clean Marketplace installation, real WSL/native Linux or Remote SSH
acceptance is claimed. T070 remains open for the final source/platform artifact.

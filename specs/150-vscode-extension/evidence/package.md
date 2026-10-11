# Actual VSIX lifecycle — Mac

Status: passed for the artifact below on macOS 26.5.2 (25F84), Darwin 25.5.0,
arm64. This is a candidate preservation result, not publication or full release
qualification. No owner service/configuration or external provider was changed.

- Candidate: `NetClaw.netclaw` 0.1.0, source
  `cb3e1a4caaa26338d93017a86cddcf965efcba92`.
- VSIX SHA-256:
  `0a423b5d21e87f9c45354a1cc10a54d44e7cc0ef2f0559a2d10f675a4ed5400c`.
- Size: 2,777,232 bytes. Package allowlist: 22 extension files plus two VSIX
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
`netclaw150-vsix-IPheDp/report.json` (minimum) and
`netclaw150-vsix-I2bij5/report.json` (current) under the Mac temporary directory.
The committed harness identifies the candidate source and digest in each report.

The newer native-management source needs its own matching package checkpoint.
T070 remains open until that new artifact is built and exercised. E1/E2/E3 and
other platform/client rows, complete lifecycle management (service start/stop),
full release regression and public Marketplace installation remain separate.

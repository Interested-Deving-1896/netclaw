# Security component implementation — Mac

The explicit DefenseClaw v8 component binding, retained scan/event/tool-rule
projections and reviewed saved-mode transaction are implemented. T044/T046 remain
open: scanner execution and complete OpenShell actions are still incomplete.

The implementation reads no ambient DefenseClaw home. It validates the existing
component's exact single connector, absolute runtime/configuration paths, private
ownership and schema. It copies bounded database/WAL snapshots into temporary
management state, so SQLite never opens or migrates the original component store.
Raw findings, prompts, reasons and credentials are omitted. Mode proposals retain
the original YAML comments and exact rollback bytes, reject concurrent changes,
use the existing authority pipeline and report pending restart. Effective
enforcement remains unverified until independently observed.

Behavior tests in `tests/operator/defenseclaw.test.mjs` cover preview versus
recording, database/configuration preservation, cross-installation and schema
refusals, managed review, concurrent revisions and missing-store behavior. Native
view tests cover proposal-only preparation and installation changes during the
dialog. The assistant request tests additionally verify that answer permission
without usage permission cannot reveal usage through status, nonce replay,
cancellation or inventory.

Actual component result on macOS 26.5.2, supported Node 24.19.0: the isolated
upstream DefenseClaw Python `Store` created and retained an open WAL database.
The adapter read a real event, scan result and connector tool rule while all
original database/WAL/SHM bytes remained identical. A reviewed mode save was
subsequently interpreted as `action` by the actual upstream configuration reader;
the writer process remained alive. This is component-store/config compatibility,
not a real enforced hook, scanner or provider acceptance claim.

```sh
NETCLAW_TEST_DEFENSECLAW_PYTHON=/absolute/isolated/defenseclaw/venv/bin/python \
  node --test tests/operator/defenseclaw-process.test.mjs
```

Local raw log: `/tmp/netclaw150-defense-process.log` (one passed process case).
At this checkpoint, the backend/assistant regression run reports 133 passed and
eight opt-in cases skipped; the actual component case above was run separately.
All 44 extension tests and TypeScript checking pass. Local logs are
`/tmp/netclaw150-defense-regression.log` and
`/tmp/netclaw150-defense-extension.log`.
Upstream source was pinned to release tag `0.8.10`, commit
`bf45995c7fa691f34ffa89b6f0468c93a6207dea`; its Python project and `--version-json`
report **0.8.6**, recorded without relabeling it. Its locked environment used
Python 3.12 in a separate temporary checkout. No owner component was installed,
upgraded or initialized. The release's Darwin archive is a 134-byte explanatory
upgrade-bridge message, despite matching its published checksum; it is not an
executable archive and was not executed.

OpenShell research uses tag `v0.1.3`, source
`e1f3c82caa3ed3b65de22889ae7ef32a774878ef`. Its actual arm64 Darwin CLI reports
`openshell 0.1.3`; archive SHA-256
`2eda3676aa85ff60551b403847090942e119c89f37c84d1635ac166c6b879826`
matches the official release manifest. The official gateway archive digest is
`a0cff0699f4a608a644805dbbf898c42caa59856274ff3cc2cdd6b3af4bacabe`.

The OpenShell ownership/read adapter is now implemented. Five behavioral tests
cover exact gateway/workspace/sandbox/installation selection, certificate and
executable changes, replacement sandbox IDs, HTTP-only health and unsupported
bearer auto-refresh/plaintext modes. The native panel shows the observed component
alongside separate host confinement evidence. No gateway/sandbox mutation is
advertised as qualified: upstream 0.1.3 start/stop messages lack identity/revision
preconditions and its CLI leaves the durable request ID empty.

The actual CLI and gateway ran in a fresh private Mac test home with generated
test mTLS, telemetry disabled, a unique Docker driver label and image pulls set
to `never`. Existing local Docker 29.7.2 supplied the 0.1.3 runtime/supervisor
images and `python:3.11` arm64 workload image
`sha256:e33bce801053f329b16f5cf139453277cd23ab68f75478b4eeff102a4654aed7`.
The workload only slept as numeric UID/GID 65534, with an empty network policy;
no provider, imported credential or owner mount was requested. The real sandbox
reached Ready with accepted configuration. The adapter and operator snapshot
returned its exact ID and reported-active state while original metadata and mTLS
bytes remained identical. After the test stopped that sandbox, the adapter
reported Stopped/degraded and the gateway remained running. The test's own
gateway was then stopped. Backend registration used actual installation-specific
GAIT in the final run. No owner gateway, sandbox or configuration changed.

```sh
NETCLAW_TEST_LIVE_GAIT=1 \
NETCLAW_TEST_OPENSHELL_GATEWAY=/absolute/openshell-gateway \
NETCLAW_TEST_OPENSHELL_CLI=/absolute/openshell \
NETCLAW_TEST_DOCKER_SOCKET=/absolute/docker.sock \
  node --test tests/operator/openshell-process.test.mjs
```

Local raw log: `/tmp/netclaw150-openshell-process.log`. The Mac-only harness uses
Docker Desktop's `host.docker.internal` callback and separate loopback gateway
port; this does not qualify WSL/native Linux callbacks. Initial manual trials
retained honest failures: a runtime-only image lacks `/etc/passwd`; a Docker
supervisor cannot use the Mac host's loopback as its own callback. A fresh
workload image and the documented host callback passed. Failed sandbox records
were not relabelled as success. No inference or network/device change occurred.

After both component adapters, backend/assistant regression reports **138 passed,
nine opt-in skipped**; actual OpenShell/GAIT and DefenseClaw process cases were
run separately. All **44 extension tests**, TypeScript checking and the extension
build pass. The assistant disclosure check also covers nested retained cancel
receipts returned through overview inventory. Local logs:
`/tmp/netclaw150-openshell-regression.log` and
`/tmp/netclaw150-openshell-extension.log`.

Primary sources: [DefenseClaw release](https://github.com/cisco-ai-defense/defenseclaw/releases/tag/0.8.10),
[OpenShell release](https://github.com/NVIDIA/OpenShell/releases/tag/v0.1.3).

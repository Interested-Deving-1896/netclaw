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
matches the official release manifest. Only isolated version inspection has run
so far. No gateway, sandbox or owner configuration was changed.

Primary sources: [DefenseClaw release](https://github.com/cisco-ai-defense/defenseclaw/releases/tag/0.8.10),
[OpenShell release](https://github.com/NVIDIA/OpenShell/releases/tag/v0.1.3).

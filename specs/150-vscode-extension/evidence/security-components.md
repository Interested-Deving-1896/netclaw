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

## Reviewed connector tool rules

The operator now previews and reviews `block`, `allow` and `inherit` for one
exact runtime tool in the selected, explicitly bound DefenseClaw v8 connector.
The normal proposal/independent production approval/GAIT pipeline applies.
The proposal includes both configuration and rule/fallback content revisions.
Private baselines retain the exact scoped row, original database inode and
configuration; native output omits private reasons and source paths. Reads use
stable copied DB/WAL snapshots and never initialize the component store.

The write uses an exact-row SQLite transaction, checking the scoped row and
global fallback again under the write lock. It updates only the encoded
`@connector/tool` row in the global storage partition used by upstream's
connector tool resolver. Global fallback and other connector rows remain intact.
Unknown action columns, uniqueness contracts or triggers are refused. A private
recovery record retains the intended row before effect; it is never considered
proof of commit. Rollback compares actual state and refuses later owner changes.
Generic interrupted-worker reconciliation remains part of open T009.

The implementation follows upstream allow semantics: install becomes `allow`
and scoped logical `file`/`runtime` flags are removed. Native review discloses
the scanner bypass and these logical changes. No physical file/quarantine action
occurs. Inherit removes the install override and may resolve to a global block
or allow; it is not mislabeled as necessarily scanning. Completed changes report
stored state verified and running enforcement unverified.

Mac checks on isolated fixtures:

- **7 backend cases passed**, both connectors where applicable: exact allow/
  inherit semantics and unrelated-row preservation; ordinary CLI-style
  change/restore with later timestamp; changed fallback; replaced database;
  interleaved fallback change at the transaction boundary; approval withdrawal,
  exact rollback and newer-owner rollback refusal; audit/assistant/production
  denial; linked/public files, schema/trigger refusal; new override/removal.
- **2 native cases passed**, covering exact tool/connector/revision review,
  scanner-bypass disclosure, proposal-only behavior, cancellation and changed
  connection. Entire extension suite: **73 passed**, TypeScript/build passed.
- Full operator/assistant regression before the final added transaction-race
  case: **221 passed, 19 opt-in skipped**. The seven-case focused suite then
  passed including that race. Skipped process cases are not counted as passes.
- **2 actual component process cases passed**: the existing retained-WAL/mode
  reader regression and the new real upstream `Store`/`PolicyEngine`, detached
  worker and installation GAIT scenario. The latter ran both OpenClaw/Hermes
  connector selections. After facade exit, the same still-running Python writer
  observed allow, block and global fallback through upstream's actual resolver.
  Foreign/global rules and component/runtime configurations were preserved.
  Zero providers, runtime tools, physical file actions or owner services were
  contacted or changed. Fixture logical flags are not real quarantine evidence.

Pinned source and its tag/package version discrepancy are unchanged from above.
Logs: `/tmp/netclaw150-defense-rules-{regression,extension,process-final}.log`.
T044/T046 remain open for scanner execution and qualified OpenShell controls;
actual runtime enforcement and host acceptance remain separate release gates.


## Reviewed local static skill scanner — Mac, 2026-10-11

A separate existing-environment binding pins Python/venv identity, helper bytes,
DefenseClaw source, Cisco SDK source and installed dependency versions. The
supported source is the existing upstream 0.8.10 checkout (package 0.8.6), with
Cisco skill-scanner 2.0.4. No installer, owner component, hook or service changed.

Native Security navigation now offers exact installed-skill manifest review,
static scan admission, retained report history and cancellation. The operator
schema accepts only a reviewed ID and nonce; it cannot supply commands, custom
profiles, paths or analyzers. Assistant calls are refused. Snapshot hashes,
component/environment identity and five-minute expiry are checked again at
worker dispatch. Private snapshots exclude environment files and linked files;
results contain bounded finding metadata, never raw source snippets. Two active
scans maximum, and same-skill active/uncertain overlap is refused.

The pinned SDK initially attempted a remote model-pricing fetch during import,
even with LLM analysis disabled. The isolated audit hook blocked it; this trial
was not acceptance. Inspection identified `LITELLM_LOCAL_MODEL_COST_MAP=True`.
The corrected profile uses bundled metadata and requires all three analyzers
(`static_analyzer`, `bytecode`, `pipeline`) to complete. It rejects failed/partial
analysis or any blocked network/process attempt. Python hooks are not a general
OS sandbox or protection against arbitrary native code/the host user.

Mac checks (fresh private fixtures, supported Node 24.19.0):

- **9 backend boundary tests passed**: both harness selections, exact reviewed
  source/environment, expiry, assistant/extra-field denial, concurrency beyond
  100 unrelated records, audit failure, cancellation, confirmed failure versus
  uncertainty, final-audit-loss receipt reconciliation, bounded paginated
  metadata, symlink/hardlink/traversal/oversize refusal and secret-file omission.
- **4 native workflow tests passed**: exact manifest and installation review,
  metadata-only pending storage, cancellation/connection/destination changes,
  nonce-only reconnect and plain-text findings. Entire extension suite:
  **77 passed**, with TypeScript check passed. These are native API fixtures,
  not proof of a rendered editor interaction.
- **3 actual process cases passed**, separately enabled with the existing pinned
  Python environment. The direct SDK case used both harness selections and
  proved all analyzers completed, no network attempts, no execution of a marker
  script, source-change refusal and stage cleanup. The detached worker case used
  both harness selections and actual installation GAIT, survived facade exit,
  retained one dispatch, preserved component/runtime/environment bytes and
  removed normal staging. The fault case observed real child PIDs: cancellation
  stopped the child; killing the worker closed its liveness pipe and stopped the
  scanner. Actual 30-second lease expiry retained `unknown` without replay.
  After abrupt loss a private stage may remain until local interruption cleanup;
  the test removed its own fixture after proving child exit. No clock mutation
  or synthetic expired lease was used in that fault case.

```sh
NETCLAW_TEST_LIVE_GAIT=1 \
NETCLAW_TEST_DEFENSECLAW_PYTHON=/absolute/existing-scanner-venv/bin/python \
  node --test tests/operator/defenseclaw-scanner-process.test.mjs
```

Logs: `/tmp/netclaw150-scanner-operations-process.log`,
`/tmp/netclaw150-scanner-extension.log`, `/tmp/netclaw150-scanner-regression.log`.
Full operator/assistant regression: **231 passed, 22 opt-in skipped**.
No model inference, network/device execution, enforcement, quarantine or owner
installation mutation occurred. This qualifies the Mac isolated local-skill
profile only. Other scanner families, running enforcement, OpenShell writes,
WSL/native Linux and full security acceptance remain open; T044/T046 are not
closed by these results.

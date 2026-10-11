# Knowledge and Science Officer — Mac implementation checkpoint

2026-10-11; isolated `150-vscode-extension-release` checkout. No owner runtime,
provider credential, ledger, configuration or installed editor was changed.

Science Officer now registers new managed OpenClaw runtime tool-result proofs
against the originating Jev task ledger. It preserves conversation/request
ownership, original/reconsidered links, typed advice, costs and budget totals.
Runtime-authored influence is explicitly interpretation, never approval.
Read-only source snapshots preserve the original SQLite database and sidecars;
missing or unsafe sources are not initialized or adopted.

The native Science Officer command adds retained advice inspection and reviewed
reconsideration. The existing Jev MCP receives only the exact retained typed
advice and the new question, explicitly excluding original raw state/current
observations. A private immutable review binds task, input and configuration;
the host-only MCP configuration digest freezes the reviewed evaluation settings.
Existing Jev disclosure, budget and one-reconsideration gates remain effective.
Detached workers survive façade exit. Uncertain results reconcile by exact
ledger task/parent/digest/review ID and never resend.

Behavioral evidence:

- Seven backend Science Officer cases cover ownership, foreign task/parent,
  private source preservation, exact transcript mapping, stale/mismatched
  reviews, audit loss, nonce replay and lost-response reconciliation.
- Conversation coverage verifies proof registration uses the owned operation
  and does not expose internal ledger task identifiers in request receipts.
- Two native-view tests cover reviewed admission and connection switching
  during final confirmation.
- Actual existing Jev MCP, Python 3.12, fixed detached management worker,
  installation-scoped GAIT and controlled loopback HTTP provider: **passed**.
  The seed assessment and reconsideration produced exactly two provider calls.
  The façade exited after admission; the worker completed and its response,
  exact task charges and original/reconsidered relation survived reconnection.
  Nonce replay and a second direct reconsideration produced no additional
  provider call. A zero daily budget prevented a new provider call.
- Jev core/stdio/read-only/environment regression: **53 passed**, including a
  stale host configuration digest refusing evaluation before ledger creation.
- Backend/assistant regression: **146 passed, 10 opt-in skipped**. The actual
  Jev process case above ran separately. Extension: **46 passed**.
- Existing HUD assessment/session binding regression: **14 passed**. Actual
  isolated OpenClaw contextual-turn/selection/stream and façade-disconnect
  regression also passed with exactly two controlled-provider requests. That
  test denies tools, so it does not close the full OpenClaw-to-Jev exchange.

Reproduction (supported Node on PATH):

```sh
node --test tests/operator/science.test.mjs tests/operator/conversations.test.mjs
NETCLAW_TEST_LIVE_GAIT=1 \
NETCLAW_TEST_JEV_PYTHON=/absolute/isolated/jev-compatible-venv/bin/python \
node --test tests/operator/science-process.test.mjs
/absolute/isolated/jev-compatible-venv/bin/python -m pytest -q \
  tests/unit/test_jev_core.py tests/unit/test_jev_stdio.py \
  tests/unit/test_jev_hud_read.py tests/unit/test_jev_envfile.py
```

Local logs: `/tmp/netclaw150-science-process.log`,
`/tmp/netclaw150-science-jev-regression.log`,
`/tmp/netclaw150-science-backend.log`,
`/tmp/netclaw150-science-extension.log`.

Limits of the Science Officer checkpoint remain explicit: the process case's originating transcript proof is a
fixture; it qualifies the real Jev boundary and detached worker, not a complete
OpenClaw-to-Jev model/tool exchange. Protected Hermes assessment proofs, physical
mobile capture, GCF and meeting adapters, and supporting-domain WSL/Remote SSH
acceptance remain open. That checkpoint alone did not complete T061/T062/T064/T066.
RAG and recorded memory results remain documented in the earlier Mac evidence.

## Mobile implementation and authenticated simulator checkpoint

The native mobile view now separates enrollment/connectivity and advertised
capture capabilities. It requires an exact operator review before requesting
the selected phone's consent, preserves declined/cancelled outcomes and reports
Hermes capture as unsupported. An owned durable worker calls a fixed existing
federation route. The receiver independently reconstructs the private journal
admission and checks its worker lease, review expiry, pinned enrollment revision,
live authenticated channel and exact capability before sending. No alternate
phone, routing fallback, push, enrollment mutation or quarantine is used.

Capture is retained in the private federation result store. Only type, size and
SHA-256 appear in ordinary receipts; an explicit local save retrieves 32 KiB
chunks and verifies the final digest before writing the selected destination.
Lost receipts reconcile through the original operation ID and existing task;
restarting the view never dispatches again. Cancellation after dispatch retains
unknown rather than claiming the phone did not act.

Evidence:

- Six receiver tests: exact admission/replay; forged/expired lease; changed
  capability/enrollment; unsupported Hermes; decline/cancel; disconnected but
  enrolled; cancellation after dispatch. Related existing capture, enrollment,
  shared liveness and control-route tests also pass: **29 total**.
- Four Node management tests cover reviewed scope, durable ownership, audit
  denial, nonce replay, decline, pre-dispatch cancellation, media access and
  lost-receipt reconciliation.
- Three native-view tests cover exact confirmation, connection replacement and
  multi-chunk final integrity checks, including corruption refusing a write.
- Actual federation control handler and HTTP transport, authenticated signed
  enrollment/WebSocket channel, simulated phone, detached Node worker and real
  installation GAIT: **passed**. The façade exited after admission. Exactly one
  device capture request occurred; reconnect and nonce replay did not resend.
  A 70,000-byte synthetic image was retrieved in three chunks with its original
  SHA-256. The existing federation process remained alive.
- Backend/assistant regression: **150 passed, 11 opt-in skipped**. Extension:
  **49 passed**; TypeScript check and build pass. Actual process cases are run
  separately and are not counted as ordinary skipped-test passes.

```sh
NETCLAW_TEST_LIVE_GAIT=1 \
NETCLAW_TEST_FEDERATION_PYTHON=/absolute/isolated/federation-venv/bin/python \
node --test tests/operator/mobile-process.test.mjs
```

Local logs: `/tmp/netclaw150-mobile-process.log`,
`/tmp/netclaw150-mobile-federation.log`, `/tmp/netclaw150-mobile-backend.log`,
`/tmp/netclaw150-mobile-extension.log`. The simulator is not a physical phone;
native camera/microphone prompts, actual device cancellation, WSL and Remote SSH
remain unverified. T061's supporting-domain behavioral coverage and T064's native
views are now complete. T062/T066 remain open for the outstanding adapters and
full supporting-domain acceptance.

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

Limits remain explicit: the process case's originating transcript proof is a
fixture; it qualifies the real Jev boundary and detached worker, not a complete
OpenClaw-to-Jev model/tool exchange. Protected Hermes assessment proofs, physical
mobile capture, GCF and meeting adapters, and supporting-domain WSL/Remote SSH
acceptance remain open. T061/T062/T064/T066 are not completed by this checkpoint.
RAG and recorded memory results remain documented in the earlier Mac evidence.

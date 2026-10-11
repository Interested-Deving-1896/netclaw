# Federation implementation evidence — Mac 2026-10-11

This checkpoint improves read-only estate inspection and scoped assistant
inventory. It does not close T029/T030/T032/T033/T034, the full federation story,
named-client inference, Windows/WSL or native Linux acceptance. No owner Risk,
peer, service, credentials or network devices were changed.

## Implementation

The prior external list used `/n2n/status`, which never included the inventory
expected by its projector. Actual external cards therefore lacked harness/model
and tool data. A new fixed read handler on the existing daemon now returns paged
summary cards and exact-target cached detail. Both internal and external cards
include received harness/model, explicit counts/freshness, and missing/malformed
inventory states. Legacy `/n2n/status` remains unchanged. The reader verifies the
selected installation and harness before and after each bounded response.

Caches are read from canonical, owned private regular files, with byte limits
and no symlink following. External inventory identity must match its peer.
Internal inventory remains attached to the authenticated receiver's member row;
an identity claimed inside that card cannot choose another member. Metadata is
whitelisted; no commands, endpoints, secrets, schema bodies, skills content or
knowledge text enter the projection. Detail bounds retain original counts and
explicit truncation. Cache failures remain per-row, not a whole-estate failure.

Native inspectors now perform a fresh exact-ID read rather than displaying the
old branch snapshot indefinitely. Refresh is read-only and generation-bound.
Assistant inventory requires the bound installation's inspect grant and summary
disclosure. Exact capability detail additionally requires evidence disclosure;
post-read grant validation still withholds results after revocation.

## Validation and limitations

- Targeted operator/assistant contracts: **22 passed**.
- Python estate, received member inventory and existing inventory boundaries:
  **34 passed**. Includes the actual daemon route, unchanged legacy response,
  100 peers, bounded large detail, unknown/stale/forged/malformed cards and
  linked/public/oversized cache denial.
- Extension suite: **59 passed**, including exact inspector refresh, vanished
  target and connection-generation denial. TypeScript check passed.
- Full operator/assistant regression: **191 passed, 16 opt-in skipped**. The
  estate and role process cases were run separately, not counted from their
  skipped default-suite entries. Extension build and catalog coverage passed.
- Existing real role/startup-sync/GAIT worker regression: **1 passed**, both
  harnesses, after the shared isolated HTTP fixture gained estate reads.
- Real separate Python process with shipped daemon handler, Risk SQLite and
  private inventory cache: **1 passed**, both OpenClaw/Hermes selections.
  The HTTP listener is a loopback test fixture; the 100 members and 100 peers are
  synthetic records, each advertising 1,000 tool names. No member/peer channel,
  provider call, device operation or federation write occurred during reads.
  Both selected configurations were preserved.
- Twenty successive full summary reads of both 100-member and 100-peer sets
  measured backend p95 **93.63 ms OpenClaw / 85.84 ms Hermes** on this Mac.
  This is local control transport/projection latency; it excludes editor
  rendering, SSH and WSL. It does not close SC-004 or T073.

The real-process test first exposed the common response redactor's 500-entry
array bound: a 1,000-tool detail was shortened without a corresponding truncation
flag. The adapter now bounds each server's list to 500 and reports retained
counts/truncation. The unchanged scenario then passed on both selections.

Commands use supported Node 24.19.0 and isolated Python 3.12:

```sh
node --test tests/operator/federation.test.mjs tests/assistant-clients/contract.test.mjs
python -m pytest tests/n2n/test_management_estate.py tests/n2n/test_hud_member_inventory.py tests/n2n/test_inventory.py tests/n2n/test_inventory_boundaries.py -q
NETCLAW_TEST_FEDERATION_PYTHON=/private/tmp/netclaw149-venv/bin/python node --test tests/operator/estate-process.test.mjs
npm --prefix extensions/netclaw-vscode run check
npm --prefix extensions/netclaw-vscode test
```

Local logs: `/tmp/netclaw150-estate-{targeted,python,extension,process}.log`.
Tests do not substitute for the four internal runtime pairings, both-direction
external interactions, reviewed lifecycle/trust mutations or exact-action
execution/denial. Those implementations and their qualification remain open.

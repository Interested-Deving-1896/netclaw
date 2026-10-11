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

## Reviewed peer permissions checkpoint

T029's capability, stale/legacy inventory and exact-action denial tests are now
complete for the implemented boundary. This does not close T030/T032's remaining
membership, peering, remote conversation/tool/skill workflows or T033/T034's full
runtime and host qualification.

The native peer workflow prepares one exact local inbound permission delta and
opens the existing human review/apply UI. `peer.trust` can enable chat admission
and/or add one current local tool/skill grant with per-request approval mandatory.
`peer.untrust` disables chat admission and/or revokes selected existing grant IDs.
Both target the selected installation plus exact existing peer. They cannot
change consent, certificate pins, endpoints, BGP or unselected permissions, create
peers, contact a remote service, or terminate already dispatched work.

The fixed daemon receiver reads the proposal and hash-verified baseline from the
private journal using the current operator worker lease. The caller supplies no
permission delta. Installation, original database path/inode, owner, proposal
origin, exact targets, revision, expiry, worker state and artifact bytes are
checked. The receiver checks authority again before committing. SQLite triggers
on peer/consent/grant values detect old HUD/CLI writes and preserve revision
tombstones across delete/recreate and change/restore sequences. The permission
effect and durable receipt are one transaction; retrying its reference cannot
add a second grant. Rollback touches only the reviewed delta and refuses newer
policy. Task progress remains independent and is never represented as undone.

Both stored and actual running production mode require independent ServiceNow
approval. A saved testing value cannot downgrade a running production daemon.
The shared configuration/service approval classifier now matches the existing
daemon's case/whitespace normalization. This fixed a real mismatch for values
such as `" Production "`. Positive/withdrawal approval cases use a synthetic
authoritative service, not an actual external ServiceNow change.

Validation on isolated Mac fixtures:

- Receiver transaction/fence suite: **11 passed**; current real SQLite semantics
  with explicit synthetic admission in these unit cases.
- Node peer boundary suite: **8 passed**; exact target, lease-only dispatch,
  consent/assistant denial, stale policy, audit loss, current production approval,
  withdrawal rollback, rollback failure and post-response identity mismatch.
- Full operator/assistant suite: **200 passed, 17 opt-in skipped**.
- Extension suite: **61 passed**; TypeScript check/build passed. Native tests cover
  exact enable/disable/grant/revoke review, cancellation and connection changes.
- Full existing NCFED suite after the shared revision-trigger change:
  **634 passed, 6 opt-in skipped**, with 37 existing UTC deprecation warnings.
  The subsequently added task-progress/rollback case passed in the 11-case
  receiver subset. No skipped live-runtime case is counted as a pass.
- Actual separate-process receiver/private journal/GAIT/detached worker:
  **1 passed**, both OpenClaw/Hermes selections. The shipped daemon handler,
  SQLite transaction and Node proposal/worker code were real; the HTTP listener
  and local tool catalog were controlled fixtures. No actual tool/provider/peer
  execution occurred. Both configurations and credential files were preserved.

The process case enables chat plus one approval-required grant, reconnects after
facade exit, verifies state, disables chat while retaining that grant, then
revokes only its ID. It denies forged/expired leases, changed targets, assistant
origin, approval-free grants and altered baseline bytes. It deliberately loses
the HTTP response after a committed change; the worker verifies exact rollback
from the retained receipt without repeating the apply. Finally it switches only
the synthetic daemon to production and verifies that absent independent approval
blocks a change even though the saved fixture environment remains non-production.

Logs: `/tmp/netclaw150-peer-{process,python,n2n-regression,backend,extension}.log`.
The native permission implementation is ready for further controlled acceptance,
not a claim of full federation, named-client, actual ServiceNow, WSL or Linux
qualification. Public release remains gated.

## Reviewed peer conversations checkpoint

The native operator workflow now reviews an exact existing peer and message,
opens/resumes a privately owned conversation through the existing NCFED chat
path, and retains request/history/cancellation evidence independently of the
editor. No channel is dialed and no permission or trust is changed. The recipient
still decides admission and applies its existing runtime/tool policy. Assistant
origins cannot enter the operator path. Remote answers render as plain text;
usage remains unavailable rather than inferred.

The five-minute review binds installation, peer, message digest, conversation and
local policy/channel revision. The fixed daemon route reads it from the private
journal using the live worker lease. It validates owner, identity, state, content
and expiry, then repeats preflight between remote session opening and message
send. Retained task receipts deduplicate admission and support read-only status
reconciliation. A lost worker or uncertain remote outcome never replays work;
it blocks another turn in that conversation. Local cancellation does not assert
remote cancellation. History uses independent cursor paging, so unrelated
management operations cannot push an older conversation out of reach.

Mac results using isolated synthetic installations:

- Node peer-conversation boundaries: **7 passed**. Exact review/content/peer,
  ownership, expiry, policy/channel change, audit loss, explicit recipient
  denial, cancellation, lost receipt/status reconciliation, independent history
  paging, large Unicode/escaped answers and response byte bounds.
- Python task/chat boundaries: **8 passed**. These use real SQLite/task/chat
  implementations but synthetic journal admission and peer channel. They cover
  recipient denial, repeat admission, follow-up ownership, authority loss after
  opening, unattested/closed channels, cancellation, missing worker and linked
  result-file rejection. Combined existing peer-policy and chat regressions:
  **31 passed**.
- Separate real Node worker + Python receiver + private journal + GAIT process
  check: **1 passed**, both OpenClaw and Hermes selections. It preserves work
  after facade exit and reconciles a deliberately lost start response. Forged/
  expired leases, altered content/owner/state, expired review and changed live
  installation identity are denied before dispatch. Exactly one synthetic
  session-open and two synthetic message calls occurred per selection, with no
  provider, real peer or network-device contact. Config and environment bytes
  remained identical. Existing peer-permission and Risk process regressions also
  passed (**3 process cases total**).
- Native boundaries: **4 passed**, including exact destination/content review,
  cancellation/connection changes, lost admission nonce lookup, retained history
  follow-up and inert remote text. Entire extension suite: **71 passed**;
  TypeScript and build passed.
- Entire operator/assistant suite: **215 passed, 18 opt-in skipped**. The process
  checks above were run separately; skipped entries are not acceptance evidence.

The large-answer test exposed the journal's 64 KiB encoded-event limit. Receipts
now bound encoded text with visible truncation while preserving Unicode, and
history paginates early at 512 KiB. A long valid answer no longer becomes unknown
merely because its receipt exceeds that limit.

Logs: `/tmp/netclaw150-peer-chat-{regression-final,extension,final-process}.log`.
Live remote-model/runtime combinations, exact platform acceptance and the
remaining membership/peering/tool/skill workflows are still open. This checkpoint
does not close T030/T032/T033/T034 or publish the extension.

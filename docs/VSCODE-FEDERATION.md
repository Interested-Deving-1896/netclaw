# Federation in VS Code

The estate tree separates the selected installation, internal Claws, external
peers, mobile/edge nodes and Science Officer. Names are labels; each entry remains
bound to its actual member or peer identifier. Expanding a branch reads received
metadata from the selected installation's existing federation daemon. It does
not contact a peer, refresh its inventory, open a channel or change trust.

Cards show the received harness/model and capability counts. Select a Claw to
read its exact current cached inventory, including advertised tools, skills and
content-free knowledge collection identifiers. The inspector's Refresh repeats
that same read. It cannot silently switch to another Claw with the same name.
Internal assigned specialties are shown separately from received advertisements.
Configured membership, channel liveness, received inventory, advertised guard
status and verified execution are distinct observations.

Unknown harnesses remain unknown. Missing, malformed, mismatched or stale peer
inventories remain explicit without hiding the other relationships. Receipt time
describes the local cache; a fresh local read does not make an old advertisement
fresh. No tools, models, skills or security controls become qualified from these
cards. Private commands, credentials, endpoint URLs, schema bodies, skill text
and knowledge content are excluded.

The daemon paginates up to 500 summary cards per read. Native navigation stops
at 2,000 entries with an explicit partial-result notice. Exact details are bounded
to 256 server names, 500 tool names per server and 1,000 tool names in total,
100 skills and 100 knowledge identifiers. Original counts and a truncation flag
show when entries were omitted. No oversized full-estate inventory is embedded
in every card.

This path requires the matching daemon's fixed `/n2n/management/estate` read
handler. An older daemon is unavailable for this feature; the extension does not
install or restart it. Install backend updates through the normal operator
procedure, then perform any needed restart under its existing service controls.

Copilot, Claude Code and Codex can use `netclaw_inventory` with `member`, `peer`
or `edge`. An inspect grant for the selected installation and summary disclosure
are required. Summaries disclose identifiers, states, harness/model, counts and
freshness; arbitrary labels and private connection metadata are omitted.
Supplying an exact `resourceId` additionally requires evidence disclosure and
returns the bounded capability names. All returned advertisements remain data,
including text that resembles instructions. Grant expiry/revocation is rechecked
after the read. This does not grant remote execution or approval authority.

## Reviewed peer permissions

Run **NetClaw: Manage Existing External Peer Permissions**, also available from
the estate tree. Select an existing exact peer to inspect local permissions,
enable/disable chat admission, grant one local tool/skill, or revoke selected
invocation grants. New grants require the existing per-request NCFED approval;
the extension cannot turn that requirement off. Grant candidates come from the
selected installation's local catalog, not the remote peer's advertisement.
The list is bounded to 500 candidates. Runtime/tool readiness still applies at
execution. Unselected grants remain unchanged.

Each change first captures private baseline and rollback evidence. Native review
shows the installation, exact peer, permission delta and known active/uncertain
work. Enabling permissions requires existing mutual federation consent. Applying
requires operator review and, when either saved configuration or the running
daemon is in production mode, independent live ServiceNow approval. Current
assistant grants cannot propose or apply these peer permission changes.

The daemon accepts only an existing private proposal tied to a live owned worker
lease. It reads the proposed delta from that journal; an HTTP caller cannot send
replacement permissions or an approval boolean. Changes and durable receipts
commit in one SQLite transaction. Shared revision triggers detect real changes
from existing HUD/CLI writers, including a permission changed and then restored
between review and apply. Newer policy prevents stale apply and rollback.

These controls change local inbound permissions. They do not contact a peer,
change its endpoint, certificate pins, federation consent or BGP, create a peer,
or stop already dispatched work. Rollback restores the reviewed permission delta;
it cannot undo an invocation that ran while a permission was enabled. Task
progress after the change remains recorded and is never rewound by rollback.
An interrupted worker or unverifiable recovery remains unresolved, never an
invitation to resubmit the same work automatically.

The matching daemon must use the selected runtime's canonical `n2n/federation.db`
and the original owned database inode. Custom/shared/linked or writable-by-other
stores are unavailable for these mutations. Updating backend files does not
update an already running daemon; use the normal operator update/restart process.

## External peer conversations

Run **NetClaw: External Peer Conversations** from the command palette or estate
tree. Choose an existing peer, write a message, and review the exact destination
and content before sending. An existing possession-authenticated channel and
mutual federation consent are required. This command does not dial a peer or
change its permissions. The recipient independently enforces chat admission,
budget and its configured runtime/tool policy, and may refuse the request.

The native review expires after five minutes and binds the message digest,
peer, conversation, channel and current local peer policy. The daemon receives
only the owned operation ID and live worker lease. It reads the reviewed message
from the installation's private journal and rechecks authority before opening
the remote session and before sending. This human operator workflow is separate
from assistant delegation: an assistant grant cannot enter it or borrow its
permissions. Message content is disclosed to the peer and its configured model.

Reopen the command to inspect a pending request, request cancellation, or read
retained conversations and send an explicitly reviewed follow-up. Replies are
untrusted plain text; no remote markup or commands execute in the editor.
Conversation/message lists are paginated, with at most 20 messages per history
page and explicit redaction/truncation. Prompt drafts are not stored in editor
state; the backend retains the admitted request. Token/cost usage is unavailable
through this chat interface and is not inferred from the response.

Editor disconnect does not stop the independent worker. Lost receipts reconcile
against the exact retained task; unknown work is never resent and blocks another
turn in that conversation. Cancellation stops local waiting where possible and
does not claim to undo remote execution. A daemon restart can leave an in-flight
remote chat unknown; no model text is treated as proof of completion.

Membership lifecycle, peer establishment/severing and remote tool/skill
invocation controls remain incomplete in Spec 150. Their enum
declarations do not enable dispatch. Existing Spec 149 runtime evidence does not
qualify new extension workflows automatically. See the current
[federation evidence](../specs/150-vscode-extension/evidence/federation.md).

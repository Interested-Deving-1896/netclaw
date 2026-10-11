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

Federation trust, membership lifecycle, remote conversations and remote tool/skill
controls are still incomplete in Spec 150. Their enum declarations do not enable
dispatch. Existing Spec 149 runtime evidence does not qualify new extension
workflows automatically. See the current
[federation evidence](../specs/150-vscode-extension/evidence/federation.md).

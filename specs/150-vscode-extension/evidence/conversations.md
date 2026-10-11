# Chat, Canvas, Avatar and native navigation

Status: implementation checkpoint, **not complete US2/platform acceptance**.
The runtime and rendered-editor observations previously recorded in
[Mac release development](mac-release-development.md) remain separate from
the remaining source-grant, full runtime-pair and remote platform gates.

## Native navigation checkpoint — 2026-10-11

The existing bundled local Avatar shares the same installation-bound chat and
saved draft. Canvas retains versioned imports/exports and explicitly selected
ancestor context. Opening views or branching does not submit inference. The
existing real-editor harness renders these behaviors with a separate test profile.

The new native harness action derives only scheme, loopback port and path from
the selected OpenClaw configuration. A native dialog reviews the destination;
connection identity is checked again before opening the browser. No credential
or authenticated fragment/query is copied into the URI. Native authentication
is left to OpenClaw. Hermes' private API is explicitly unavailable as a browser
UI. Separate SSH profiles require an existing reviewed local forward; editor
managed WSL/Remote SSH forwarding still requires real-platform acceptance.

Backend native-navigation/federation checks: **8 passed**. Extension checks:
**42 passed**, including cancellation, changed-connection rejection, forbidden
URI forms and no agent dispatch from navigation. TypeScript validation passed.
This is not evidence of an authenticated native browser session on WSL/SSH.
The federation display regression additionally covers actual namespace-shaped
member identifiers such as `risk/subnet`; display projection supplies no authority.

T027 implementation is complete. T024/T028 and the platform acceptance tasks
remain open; the candidate is not a published release.

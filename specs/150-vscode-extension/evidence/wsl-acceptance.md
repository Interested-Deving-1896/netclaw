# Windows/WSL implementation qualification — in progress

Source baseline: `3c01a37`, isolated branch `150-vscode-extension-wsl`.
This report records WSL observations independently of Mac evidence. It is not
release acceptance; no publication was performed.

## Development checks

Supported private Node 24.19.0; locked dependencies installed only in the isolated
checkout. Initial backend suite: 42 pass, 4 opt-in skips. Initial extension checks:
8 pass, TypeScript/build/package allowlist pass.

Three failures were reproduced and corrected with failing-then-passing regressions:

- Direct private service dispatch accepted assistant principals. The dispatcher
  now verifies the bound operator surface, principal and installation. The separate
  scoped assistant interface remains available; delegation remains unqualified.
- Facade close could fail with BUSY while its independent worker recorded GAIT.
  Audit acquisition now waits for a bounded interval without stealing the lock,
  skipping audit, or retrying the managed operation.
- WSL profiles used only hostname and UID, which can match across distributions.
  WSL context now incorporates a digest of distribution label and machine identity.
  Existing ambiguous WSL profiles are retained on disk but require explicit new
  binding; they are not silently migrated to the current distribution.

After corrections: backend suite **48 pass, 4 opt-in skips**; extension **12 pass**;
TypeScript passes. Separate real process tests:

| Check | Observed result | Scope |
|---|---|---|
| GAIT / detached configuration worker | Pass | New synthetic home; actual private Python 3.12.10 GAIT runtime, FastMCP 4.0.11/MCP 2.3.0. Initial missing bundled source failed closed; isolated normal setup supplied it. |
| OpenClaw contextual conversation | Pass | Installed OpenClaw 2026.6.11 under Node 24.19.0; isolated gateway; deterministic loopback provider; two contextual turns, stable nonce, facade disposal. |
| Hermes contextual conversation | Pass after audit contention fix | Pinned v0.21.6 source; existing isolated Python 3.14 companion and 3.12 bridge; fresh synthetic home and deterministic loopback provider. Two contextual turns, stable nonce, companion preserved. |

These process tests do not prove hosted-provider, device-tool, assistant delegation
or Windows editor acceptance. RAG process/model acceptance has not run here.

## Host and disruption scope

The owner authorized use of a test distribution and interruption, stating NetClaw
was not in use. A separate `NetClaw-Spec150` Ubuntu **24.04.5** WSL2 distribution
was created using the official WSL installer. Existing owner and Docker
 distributions were not restarted or repurposed. A real terminate/reopen of only this distribution preserved a synthetic journal
request as `unknown`, with one retained dispatch intent and no replay. The first
probe failed because `/tmp` was cleared; the corrected probe uses explicitly
selected durable home storage. This is journal-level evidence, not a complete
editor/runtime restart gate. Two-distro connection checks are recorded below; full E3/E8 remains pending. Windows desktop VS Code **1.140.0** was observed;
minimum VS Code **1.102.0** with WSL extension **0.99.0** passed **eight**
connection assertion groups in the actual Windows desktop/WSL extension host.
These exercise synthetic OpenClaw/Hermes homes, inventory, changed identity,
profile separation and disconnect. Restricted Mode first correctly denied
connection; a disposable explicitly trusted profile completed the positive run.
No rendered-view, paid-provider or full E3 acceptance is implied by that run.

Owner checkout testbed edits, configuration and credentials are preserved.
Private logs and preservation fingerprints stay outside Git. Startup pyATS
returned status `completed` and five devices. The initial text diagnostic check
incorrectly matched the `isError` key; structured inspection corrected that
observation, with an append-only GAIT correction. Device identities remain private.

## Outstanding gates

T006 is additionally complete for the implemented binding/revision behavior;
its positive/negative foundation tests and real WSL MCP handshakes pass. This
does not close the separate full connection/platform acceptance tasks. Foundation closure,
remaining story implementation, real named clients, permission propagation,
full domain coverage, real Windows/WSL editor and restart checks, Spec149 host
qualification and the other required platforms remain open. Mac evidence retains
its original scope; remaining Mac and Remote SSH rows must be completed on the
appropriate hosts. Marketplace publication is prohibited during this WSL phase.

## Additional isolation and regression evidence

Linux backend host fingerprints now include OS machine identity and WSL context;
a cloned UUID/path cannot rely only on a shared Windows hostname. Raw machine
identity is not returned. macOS host fingerprint construction remains unchanged.
Profiles pin the authenticated operator principal; reconnect rejects a changed
principal even when installation and host IDs match. Reviewed configuration
commands retain their original connection generation across dialogs, refusing
secret transmission after a profile switch. Regression tests cover each boundary.

The existing HUD unit suite passed **372/372** on WSL with Node 24.19.0. These
unit results do not qualify the remaining federation, mobile or live tool paths.

## Recovered Windows editor and package results

The actual Windows desktop **portable** VS Code 1.102.0 (commit
`cb0c47c0cfaad0757385834bd89d410c78a856c0`) with WSL extension 0.99.0 passed
8 connection assertion groups in each of the owner Ubuntu 26.04 WSL distribution
and the dedicated Ubuntu 24.04.5 distribution. Portable **1.140.0** also passed
8 groups on the owner distribution. Each report identifies `remoteName=wsl`,
`platform=linux`, x64 and kernel `6.18.40.1-microsoft-standard-WSL2`. These tests
use synthetic backend homes and the source development extension; no rendered
view assertions were made. The installed Windows editor attempt timed out with
no report; a pending editor update was observed, but causation was not established.

Reproduction: `tests/vscode/windows-wsl-runner.py --help` describes explicit
Windows executable/WSL-extension and Linux Node paths. It creates a disposable
Windows profile and retains private diagnostics. `windows-wsl-package.py --help`
requires an explicitly designated test distro and refuses an existing NetClaw
extension. No owner extension installation was replaced.

Installed VSIX lifecycle on the dedicated distro passed using Windows VS Code
1.102.0: initial synthetic 0.0.1 candidate, upgrade to 0.1.0, disable, uninstall,
rollback to the synthetic candidate, then uninstall. Binding/profile retention
and unchanged synthetic backend configuration passed. The previous version is
an explicitly version-adjusted test artifact, not a published previous release.

- Candidate source: `4204bb44c3e4c05b343854be26fe0e0a0acdfca7`.
- Artifact: `netclaw-0.1.0.vsix`, 2,769,535 bytes.
- SHA-256: `83eb0599770b60b29ff49d76a5cc5756462a61c074881024134f793701f68d92`.
- Full live backend-process preservation, real previous-release compatibility and
  Marketplace installation were not tested; T070 remains open.

Actual cloned installation UUID and absolute path in both WSL distributions
produced distinct backend host IDs. Those actual distribution hostnames differed;
the same-hostname case is covered separately by synthetic regression tests.

## Hosted provider and installer checkpoint

The existing dedicated Hermes test home completed an owned management request
through its already configured hosted Anthropic provider. The synthetic prompt
requested only `SPEC150_WSL_LIVE_OK` and no tools. After facade close/reopen the
operation was succeeded and the returned marker matched; configuration and `.env`
fingerprints were unchanged. Credentials and request IDs remain in private local
evidence. This is provider wiring, not device-tool or assistant delegation proof.

Explicit backend catalog components `netclaw-operator` and `netclaw-assistant`
install their locked dependencies, without identity creation, grant registration,
service restart or runtime selection. Both functions were executed successfully
in the isolated checkout. Shell syntax checks passed. Catalog coverage passes:
113 entries, 124 registered servers, 52 tracked external integrations, zero
unexplained gaps. Neither component is in the default agent registry. T071 is
complete; broad HUD/documentation coherence under T072 remains open.

T016 profile/manifest tests are complete in the repository's `.test.mjs` harness:
multiwindow persistence, process restart, host isolation, changed-principal denial,
stale-response discard and the exact mobile logo. This closes the test task,
not full real-platform acceptance.

Additional reproduced failures: populated unversioned SQLite was previously
adopted; it is now rejected without changing its bytes. Managed action schemas
previously accepted unrelated patch fields, and workspace schemas accepted missing
required arguments; action-specific strict unions now reject both on operator and
assistant interfaces. Both new schema regressions failed before the fix and pass
after it. Full response/domain contract qualification under T005 remains open.

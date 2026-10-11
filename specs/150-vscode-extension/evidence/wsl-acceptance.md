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

After corrections: backend suite **44 pass, 4 opt-in skips**; extension **9 pass**;
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
 distributions were not restarted or repurposed. Restart/no-replay and two-distro
editor acceptance remain pending. Windows desktop VS Code **1.140.0** was observed;
its test-window launch is being qualified, not counted as a passing E3 row.

Owner checkout testbed edits, configuration and credentials are preserved.
Private logs and preservation fingerprints stay outside Git. Startup pyATS
inventory returned a diagnostic; it is not a verified device inventory.

## Outstanding gates

Only the five previously completed tasks remain checked. Foundation closure,
remaining story implementation, real named clients, permission propagation,
full domain coverage, real Windows/WSL editor and restart checks, Spec149 host
qualification and the other required platforms remain open. Mac evidence retains
its original scope; remaining Mac and Remote SSH rows must be completed on the
appropriate hosts. Marketplace publication is prohibited during this WSL phase.

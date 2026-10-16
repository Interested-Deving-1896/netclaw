# Spec152 production release verification — 2026-10-16

The owner authorized fetching the WSL work, committing remaining changes, creating
and merging the PR, removing completed feature branches, returning to main and
pushing to production. This supersedes the earlier Spec152 release holds. Source
release **1.11.0** carries the host helper/HUD changes; extension **1.1.0** is the
separately versioned Marketplace component.

## WSL findings and remediation

The [WSL report](wsl-verification.md) is retained verbatim as historical evidence.
Commit `524a263` corrects native OpenClaw user-home/tilde expansion without changing
its pinned state/config directory. The existing extension bundle was unchanged.
WSL verified the loaded candidate in a Windows renderer/WSL extension host and real
file reads/typing/Undo. Four workspace files were symlinks and were intentionally
refused. No real file save or live lifecycle action was exercised there.

The five recorded WSL suite failures shared one discovery defect: systemd lookup
qualified each candidate's EnvironmentFiles against the selected fixture's home
before establishing the candidate's actual installation. An unrelated real gateway
therefore disabled isolated fixture controls, including Hermes fixtures.

The follow-up limits gateway discovery to the selected runtime; parses the bounded
literal systemd environment-file subset; resolves explicit foreign scope before
selected-home checks; accepts private `gateway.systemd.env`; and rejects conflicting
home/config, outside-home selected files, missing required files, unsafe permissions
and unsupported syntax. Environment files override inline values before ownership
is decided. The strict subset avoids treating dotenv's comment/escape semantics as
systemd semantics. See the upstream [systemd environment documentation](https://github.com/systemd/systemd/blob/main/man/systemd.exec.xml).

Six host-independent contract cases reproduce foreign gateway discovery, cross-runtime
isolation, selected gateway environment ownership/hashing, effective overrides,
conflicting identity and unsafe/missing/outside/unsupported environment rejection.
These pass on Mac; actual Linux CI and release artifact evidence are recorded below
as they complete. They are not a claim that live WSL Stop/Start has been exercised.

## Verification so far

- Extension check/build: passed under Node 24.19.0.
- Full Mac extension suite: 91 total, 90 passed, one optional cached-RAG skip.
- Exact initial 1.1.0 bundle already passed 35 native installed Mac checks and the
  reported Windows/WSL regular-file inspection. Release packaging must retain that
  runtime bundle; updated docs/source provenance require recording the final digest.
- An initial concurrent HUD test run hit two existing short-delay Avatar/Pal UI
  assertions. A separate full rerun is recorded below; failed runs are not counted
  as passes.
- Publisher `NetClaw` credential verification succeeded without exposing credentials.

## Qualification boundaries

Symbolic-link workspace entries remain unsupported and are never silently followed or
converted. Full controls require provable ownership of every configured component;
unknown owners, unsupported native wrappers or unavailable managers remain disabled.
The WSL inspection used an API-only sidecar and did not establish a durable HUD owner.
Production read latency and the sub-second renderer progress SLA are unqualified
(the earlier cold native CLI read took about 2.9 seconds). Save alone never restarts;
Save & Restart requires verified saved bytes and revalidated scope. No owner runtime,
provider or device was changed while preparing this release.

Local gate completion: the separate full HUD rerun passed **372/372**; HUD production
build passed. All six reconciliation surfaces, catalog coverage, 136-spec artifact
validation and six release-helper tests passed. Extension dependency audit reports
zero vulnerabilities. Raw local logs are `/tmp/netclaw152-release-*.log`.

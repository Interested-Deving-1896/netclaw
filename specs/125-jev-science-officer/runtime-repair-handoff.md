# Runtime repair handoff — 2026-09-27

## Failure and correction

Two CML member discovery turns produced complete final reports, but Border received a successful task containing `(no reply text in agent response)`. A real Node reproduction showed a large JSON write followed by immediate process exit being truncated through the subprocess pipe. Merging diagnostic stderr into stdout also made result extraction unreliable.

Embedded agent turns now capture stdout and stderr separately in anonymous temporary files, reap the process on cancellation or timeout, reject nonzero exits, and reject missing or malformed results instead of reporting success. Parsing recognizes the current nested agent usage totals. Result reads are limited to 16 MiB. Production containment controls remain enforced.

The lab testbed disables Unicon's automatic configuration initialization for R1, R2, SW1 and SW2. The original discovery sessions had changed console logging/timeout settings through connection defaults; their recovered reports explicitly disclose this. This setting prevents those automatic commands; it does not authorize configuration or prevent deliberately requested configuration commands.

## Evidence

- 31 targeted transport, robustness, gateway cleanup, task, delegation and production-gate tests passed; three existing datetime deprecation warnings.
- The regression uses an actual Node child writing a 560 KB JSON result and exiting immediately, with a competing diagnostic JSON message on stderr.
- A guarded live CML member turn returned a complete 12,607-character conceptual response through Border, with 67,974 tokens accounted. No device work or Jev call was requested for that test.
- Both original final reports were recovered from retained member transcripts. SQLite backups preceded recovery. New immutable result records preserve the original failed artifacts and include explicit evidence limitations. Both member references and Border's cached references were repaired; Border readback succeeded.
- Model-guard posture was restored through explicit guarded model routing in local Border/member configuration, without weakening the production gate. Live CML inventory and gateway/Slack connection health were checked earlier in this repair session.
- Private backups, report recovery manifests and detailed test evidence remain under `~/.openclaw/member-result-repair-20260927` and `~/.openclaw/model-guard-repair-20260927`. Credentials are not part of this patch.

## Continue from another development box

Pull main to obtain the source fixes and Jev tool-schema guidance. No mobile-side code changed in this repair; it does not require a mobile rebuild. The source changes apply to Linux/WSL and macOS, but this repair's live runtime acceptance was on WSL; no new native Linux or macOS acceptance is claimed.

Runtime credentials, provider configuration, member environment files, task databases and recovery artifacts are private local state, not transferred by Git. Use the existing private migration/backup procedure when moving the runtime. Preserve guarded provider routing for primary, override and fallback models, the actual reachable CML endpoint, existing task records and Jev spend ledger. Do not copy stale endpoint values or reset budgets. Verify posture and a read-only member result before using the destination runtime.

On the repaired WSL runtime, retrieve recovered task `92337c86-086d-42f9-be3c-6428f0a656af` and continue from its report. Repeating discovery is unnecessary merely to retrieve that report. Proposed designs still require evidence review, Jev's requested advisory checkpoint, applicable change approval and post-change verification.

## Honest limits and follow-up

The complete Slack-to-deployment workflow has not passed acceptance. No lab protocol configuration was deployed by this repair. Recovered report claims are not automatically verified facts; in particular, running/startup equality and connection initialization side effects require care. No fresh RAG-quality, interruption-edge-case or mobile acceptance is claimed.

The CML member's separate federation Git audit store reported an empty Git object and failed commits. Its history was preserved, not reinitialized. SQLite task/audit data and the primary session GAIT records remain available, but full member Git audit integrity is not established. Repair that store from verified backups before claiming complete audit health. Successful transport testing does not resolve this separate limitation.

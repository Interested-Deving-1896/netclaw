# Spec 124 — Mac checkpoint and WSL continuation

**Spec 124 is not complete.** 83/94 tasks are checked (88% by task count, not weighted audit coverage). All 55 confirmed findings have repairs and passing relevant Mac verification. Eleven broad tasks remain: T007–014, T021, T026–027. Continue the audit in WSL before starting 125. Apple review is explicitly nonblocking; do not infer Apple approval from this decision.

## Git checkpoint

Branch: `124-flagship-audit`; baseline: `ad6a4a8`. The exact verified source checkpoint and remote status are recorded here after the transfer commit. Do not reset or clean user changes. Credentials, raw device outputs, .env files, testbeds, audit stores, signing keys, archives and virtualenvs stay outside Git.

## Programme and decisions

1. Spec 124: full audit and authorized security/performance/quality/skills/docs fixes. Warranted breaking fixes require explicit migration/recovery.
2. Spec 125: HUD redesign for an approachable network-engineer audience. Preserve Adam Mason's context/canvas chat and Border/NetClaw chat; modest integration changes allowed. Discuss Beginner/Advanced modes during clarify.
3. Spec 126 **Jev**: reserved after 125; discuss scope then, do not invent it.
4. Phase 3a: formal upgrade/update workflow. Phase 3b: professional README rewrite, including RAG, iPhone/watch, Zoom and GCF.

Use SpecKit specify → interactive clarify → plan → tasks → analyze/fix findings → implement. Clear context between completed phases with handoffs. Required hosts: macOS, Linux, WSL2. Native Windows is not a full pyATS host. User will work directly in WSL; remote WSL access is unnecessary. No subagents are authorized.

## Verified Mac checkpoint

- 24 declared contract families PASS,0 FAIL/ERROR/dependency blockers. Optional live capabilities remain separate.
- 490 federation tests pass after RPC pending cleanup and global dispatch limits.
- 217 HUD Node tests, build and npm audit: 0 vulnerabilities; synthetic real-browser malicious HTML cannot execute, and HUD plus Adam's canvas load without JS errors. This is not a real model-provider chat acceptance test.
- 430 Flutter tests, clean analyze, all 5 release bundle versions consistent. iOS 1.0.2 (4) signed, uploaded, VALID and internal beta available; public review submitted with AFTER_APPROVAL release. Last verified Apple state WAITING_FOR_REVIEW. Actual iPhone/watch flows remain unverified and do not block continuing the host audit.
- CML:12/12 read-only show version/interfaces/CPU checks across 4 devices; discovery/native pCall version repeated September 27. Stateless HTTP pyATS 2.2 runtime pinned to upstream d4971436328369ef0a581ca5359dc8700fb2939b. Actual Mac runtime migrated, original environment/testbed preserved.
- FRR trusted/unknown/mismatched SSH checks passed. NSM Docker 19 tests passed. Official digest-pinned Redfish mock 15 tests passed with 0 skips. Audit-owned FRR/Redfish containers are stopped; unrelated containers preserved.
- Actual GAIT telemetry persistence and failures, bounded TCP/UDP, seven real MCP stdio checks, contract runtime preservation and migration conflict recovery pass.
- Mac gateway: missing LaunchAgent restored without changing configuration; authenticated health passes and both listeners are loopback. Existing configuration backup retained privately. No channels or cron jobs were configured.
- All six reconciliation surfaces and111 spec artifact checks pass. Changed Markdown parsed/rendered with no missing local links or overflowing table rows at checkpoint.

Exact evidence: verification.md, findings.md, requirement-evidence.md and evidence/. Passing tests do not certify unreviewed behavior.

## Remaining work — the 11 open tasks

- T007–013: finish semantic review/dispositions across installer/CI, HUD, federation, RAG/memory/GCF, remaining MCPs/skills, mobile/watch/voice/Zoom and supporting documentation/assets. coverage.json distinguishes245 targeted reviews,132 executed test files,40 generated files,879 historical references,90 assets and1168 baseline paths still pending. The pending count must not be silently relabelled “reviewed.”
- T014: continue adding precise finding/task/analysis/test records for newly confirmed defects. All currently confirmed001–055repairs are verified; this does not guarantee no more defects.
- T021: full-host fresh install and existing-install upgrade/recovery acceptance on required platforms. Individual Mac pyATS/GAIT installations and migration fixtures passed; no full wipe or complete operator upgrade was performed.
- T026–027: final phase-wide checks, severity report and closure handoff/GAIT/blog after the preceding work. The local blog draft is not published.

WSL work is concrete: native dependency resolution/PEP668, installer and service manager, migrations/recovery, Docker fixtures, Windows-browser→WSL HTTP/WebSocket boundary and both chat views, CML native pCalls. Native Linux service-manager acceptance must be distinguished from WSL. Follow wsl-handoff.md.

Provider/device gaps: live Zoom meeting/Twilio call, ServiceNow exact-record lookup and actual vendor/cluster integrations need isolated instances/credentials. Ask for only the specific lab needed, never passwords in the conversation. Keep checks read-only unless separately authorized and change-managed. RAG real-model retrieval quality and actual phone/watch flows also remain unverified.

## Private local state and audit trail

GAIT branch `audit124-mac-completion-2026-09-27`, latest recorded milestone `bce34ec5` before Git transfer; record subsequent work and finish with gait_log. MemPalace unavailable; private daily notes in memory/2026-09-27.md. Use scripts/mcp-call.py with `python3 -u scripts/gait-stdio.py`.

Private CML/runtime/provider evidence is under ~/.openclaw/audit124-cml, with restricted permissions. Apple signing credentials stay on the Mac. The old actual pyATS environment backup predates the new after-state digest journal; do not invent a journal to force restore. Preserve it and compare manually if rollback is needed.

## Execution lessons

Run Flutter operations serially; isolate plugin pytest files. Treat environment files as literal data. common.sh resets RUNTIME_ENV when sourced: set fixture paths afterwards. Managed test caches are disposable only with the correct marker; operator component .venv directories are not. No production configuration changes, ServiceNow tickets or external messages were performed. No follow-up phase begins merely because a task percentage rounds up.

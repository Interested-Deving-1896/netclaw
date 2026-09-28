# User Profile

## About You

- **Name:** (your name here)
- **Role:** Network Engineer / Architect
- **Timezone:** (your timezone, e.g., America/New_York)

## Preferences

- **Communication style:** Technical, concise — include CLI output and protocol details
- **Report format:** Severity-sorted tables with HEALTHY / WARNING / CRITICAL ratings
- **Change management:** Production requires approved ServiceNow CRs. Explicitly opted-in Terminal Intent Local/Lab requests use scoped local approval and audit under AGENTS.md; lab mode is never assumed or enabled by default.
- **Escalation:** Notify immediately on P1/P2; queue P3/P4 for next business day

## Your Network

- **Testbed:** Defined in `testbed/testbed.yaml`
- **Platforms:** (list your platforms, e.g., IOS-XE, NX-OS, IOS-XR, ACI, F5)
- **Source of Truth:** NetBox (read-write)
- **ITSM:** ServiceNow

## Notes

- (Add anything NetClaw should remember about you, your team, or your network here)
- (e.g., "R1 and R2 are in the lab — less strict change control needed")
- (e.g., "Always CC @oncall-noc in Slack for P1 alerts")

- Jev preference (2026-09-27): optional visible Science Officer, dynamically invented questions from human/member context, advice-only with read-only evidence; default $5/day and $0.25/task budgets adjustable by operator. Avoid static question libraries.
- HUD preference (2026-09-27): function over flash; preserve Adam's reusable context/chat canvas and add detailed Science Officer data views during the new HUD phase.

- Roadmap clarification (2026-09-27): spec126 is the small README refresh; HUD is127, preserving Adam's canvas. Phase4 scope is README plus a common utility to upgrade existing NetClaw installations to the latest build.

- HUD127 scope (2026-09-27): panel-first dashboards with Basic/Advanced presentation; Three.js where relationship/topology views help. Cover standalone, iN2N Risk of Claws, eN2N external neighbours, Jev Science Officer and mobile devices. Adam Mason's full context/chat canvas must survive, including existing saved work and investigation affordances.

- HUD refinement: name the preserved workspace Canvas; provide direct RAG uploads/retrieval and a masked configuration inventory in the menu.

- HUD additions: per-Claw MCP/LLM introspection, Tokenomics, Documentation and CLI/API references, direct Logs with filters/commands, Sean Mahoney's guide panel, and early LAB/production plus DefenseClaw/OpenShell views. README should lead with the new HUD rather than the old SSH migration callout. Keep Canvas and hold pushes for review.

- Release preference (2026-09-28): establish official NetClaw 1.0.0, then use 1.x.y versions as completed specs evolve the project; require numbered specs and Spec Kit artifacts for contributions/PRs. Feature specs use minor bumps, fixes/docs/maintenance use patches; source and mobile component versions remain independent.

- Chat preference (2026-09-28): standard back-and-forth Chat should be the default HUD interface, with Canvas still available and native OpenClaw as a third option opening in a separate tab (explicitly approved).

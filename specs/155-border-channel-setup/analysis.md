# SDD analysis — Complete Comms Setup

Date: 2026-10-25. Analyzed spec, plan, data model, contracts, research and 50-task ledger against the project constitution. Analysis was read-only; the following design remediation was then applied under the owner's existing instruction to drive SDD implementation.

| Finding | Severity | Resolution |
| --- | --- | --- |
| New effect and placement fields were described but not exact enough for engine/frontend agreement. | High | Data model now defines `comms`, `comms-binding`, exact effect IDs, `commsBindings`, capacities and legacy outbound default. T007–T009/T018/T041 verify enforcement. |
| Hermes Home Assistant shares ingress and device tools, conflicting with ordinary Border channel placement. | High | Explicit Focused-only installer disposition with pinned source evidence. Catalog/role tests must retain it. No shared-policy exception. |
| Pinned-index omissions could incorrectly label ClickClack/WeCom unavailable. | High | Inventory separates current docs from source-confirmed pin support and canonical/native IDs. Four genuinely absent OpenClaw options remain version-gated. |
| Native helper packaging and Zoom process lifetime could be replaced with nominal CLI/discovery success. | High | T017 and T035 remain explicit packaged-helper and actual lifetime gates; no guessed distribution imports or separate in-memory registries. |
| Verification document still described specification-only work. | Medium | Baseline updated to planning/implementation status and actual credential results, with provider evidence separate from installer acceptance. |

All 32 functional requirements and nine success criteria map to tasks in the ledger's coverage table. Six user stories have implementation and verification coverage. No orphan requirement, unbounded command contract, mandatory constitution exception or unresolved design ambiguity was found after remediation. The 26-item specification quality checklist is complete. Optional commit hooks are not implementation prerequisites.

This is design consistency, not acceptance. Every supported adapter still requires its stated implementation and test evidence. Twilio authorization, missing provider accounts, source-bound helper artifacts, Zoom lifetime, isolated Mac/editor and WSL qualification remain visible execution gates. A documentation card or mocked provider cannot close these gates.


## Final source handoff review

T019's phrase “all compatible inventory entries” was broader than FR005/FR007. It now names compatible selectable channels and NetClaw component paths. The eight related-interface entries retain their honest incomplete-adapter dispositions as contextual references; no new telephony, A2A, relay or meeting API implementation is claimed. T029 explicitly leaves unsafe/unimplemented inbound and public callback reachability checks unverified.

Review found missing Hermes startup disclosures and Home Assistant's connection/state subscription/device-tool registration disclosure. All 22 Hermes metadata rows were reconciled against pinned adapter startup paths, and every selectable channel now has nonempty startup disclosures. A catalog-to-review regression preserves these effects plus capability kind and setup explanation; T024 is closed. Known empty-access pre-activation refusal is now configuration-required instead of unknown; unexpected errors and uncertain process outcomes retain unknown. Final Mac frozen-run hashes, subsequent focused checks and pending WSL execution remain distinct.

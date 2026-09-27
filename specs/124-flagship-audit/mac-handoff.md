# Return to the Mac development box

Spec124 is in bounded closeout under explicit user direction. This handoff will record the merged main revision after PR265 closes. Do not resume the former open-ended audit. Spec125 remains the HUD redesign; deferred review belongs in deferred-review.md.

## Completed platform evidence

| Host | Evidence and limits |
|---|---|
| macOS | Actual historical gateway/LaunchAgent health and configuration preservation; pyATS native CML12/12 and managed-runtime/recovery acceptance. Native macOS26/Xcode26.6 CI run36325037956 passed Flutter431, iOS Runner and WatchApp simulator builds. Updated103 native CI36326574760 also passed both builds at e008464;1709ddc production source is identical. No wiped-Mac installation or new physical phone/watch/background-runtime claim. |
| Linux | Disposable Debian bookworm Docker with real systemd user service: gateway install/start/health, full isolated pyATS+GAIT fresh/upgrade, managed adoption and restore/repeat, PEP668 refusal and literal private service environment. Four fixture hashes preserved. Shares WSL kernel; not bare-metal boot acceptance. |
| WSL2 | Isolated full fresh/upgrade pyATS+GAIT, foreground gateway health, preservation/recovery; CML12/12 read-only, NSM19 and Redfish15 Docker fixtures, FRR trusted/unknown/mismatched SSH checks. Historical Windows Edge HUD/Canvas chat and current WSL Chromium delayed Canvas session check are separate checkpoints. Actual operator upgrade occurs only after main and is recorded separately. |

Final local checks at1709ddc:24 contract families,434 Flutter tests/clean analyze,227 HUD tests/build, all six reconciliation surfaces and spec-artifact validation pass. Optional provider/device gaps and751 deferred baseline paths are not passes.

## Mobile rebuild required

Yes: the WSL/Linux continuation changed mobile Dart code and native iOS AppDelegate background-refresh setup (070,102,103), in addition to native CI/build preparation. The previously distributed app does not contain those changes. Rebuild on the Mac from merged main and install the rebuilt client to adopt them. Enrollment, credentials and conversations retain their formats; no reset or re-enrollment is required by these fixes. Physical phone/watch/background acceptance must be performed on that rebuilt client; simulator compilation alone does not establish it. A future distributed release needs its own build-number/signing/upload workflow; no new mobile release is authorized or published by this closeout.

## Safe Mac update

In the existing Mac checkout, inspect `git status --short` first. Preserve local edits, testbeds, credentials, knowledge, signing files and virtualenvs. Fetch origin and compare the recorded merge revision before switching to main; do not reset/clean or copy Linux virtualenvs to macOS. Once local work is safely retained, use `git switch main` and `git pull --ff-only origin main`. If local commits diverge, preserve them on a named branch/worktree and reconcile; do not force main over them.

Read SOUL.md, USER.md, TOOLS.md and the daily log; continue the GAIT trail on a Mac-specific session branch. Read handoff.md, verification.md, deferred-review.md and docs/AUDIT124-MIGRATIONS.md. Privately back up the Mac runtime/config/env/testbed/knowledge before applying any still-applicable platform-local migration. The WSL operator backup and runtime paths must not be imported over Mac state. Historical Mac pyATS originals lacking a matching digest journal remain manual recovery artifacts; do not manufacture a journal.

Verify gateway health and configured MCP discovery after adoption. Native development uses Flutter3.44.8 and the committed build workflow; signing/real-device acceptance needs the Mac's existing private credentials. CI uses a non-production Firebase fixture solely for compilation. Do not publish a new mobile build or claim App Store approval from this handoff; the historical last verified state was WAITING_FOR_REVIEW.

Resume prompt: “Read specs/124-flagship-audit/mac-handoff.md and handoff.md. Preserve this Mac's local work, verify the merged main checkpoint, and continue from the completed bounded spec124 handoff. Do not expand deferred audit work into spec125.”

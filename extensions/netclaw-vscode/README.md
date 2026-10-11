# NetClaw for Visual Studio Code

Manage your **existing NetClaw or Risk** from VS Code. Connect to its running HUD,
inspect operations, converse with its configured runtime, search RAG knowledge and
review supported settings without leaving your editor.

NetClaw remains your runtime. Opening the extension changes no runtime. Explicitly reviewed setup actions can install selected isolated MCP runtimes, register canonical OpenClaw MCPs or restart the owned federation service using existing NetClaw helpers.

## Connect

1. Use VS Code 1.102 or later on macOS or Linux. On Windows, first open your
   intended **WSL distribution** with VS Code Remote WSL and install this extension
   **in WSL**. For another Linux/Mac machine, use your existing Remote SSH workspace.
2. Start your already-installed NetClaw HUD using its normal supported environment.
   The initial compatibility baseline is NetClaw 1.8.0, including its installation
   identity and owned-conversation APIs. The extension does not upgrade NetClaw.
3. Open the NetClaw Activity Bar and select **Add existing NetClaw**. Choose a friendly nickname such as **My Mac lab** or **WSL NetClaw**
   and enter the HUD **API** address, normally `http://127.0.0.1:3001`.
4. Review the returned installation identity and harness before binding. Loopback
   belongs to the extension host, so WSL and Remote SSH connect on that host.

No automatic connection or runtime changes occur when you open a workspace.
Connections require Workspace Trust. Public HUD URLs, browser VS Code, native
Windows runtime hosting and virtual workspaces are unsupported.

## Workbench

Spec151 adds a shared card layout, persistent form labels and contextual help, while retaining blue actions, search and pagination. Pages automatically follow light, dark and high-contrast editor themes. The locally bundled artwork is decorative; BGP's interactive 3D view uses reported sessions and has an independent readable list. It does not depict physical cabling or infer device health.



- **Chat:** a private extension-owned conversation, explicit context selection,
  supported model/effort choices, owned history and runtime-specific request status.
- **Canvas:** local saved investigations, branching context and reviewed HUD Canvas
  v1 import/export. Each lane uses an owned NetClaw conversation.
- **Avatar:** bundled local John/NetClaw characters alongside the same Chat. Character
  controls are local; voice and hosted video are not included.
- **RAG:** collection/document/snapshot/replica inventory, cited search, staleness
  notices, reviewed context selection and selected-file uploads up to 10 MiB.
  Upload acceptance is pending, not proof of indexing. Refresh to verify the result.
  An upload uses its filename as the title and may replace an existing same-title document.
  Controls wait for an active knowledge operation or review to finish; submissions
  are never queued or replayed automatically.
- **Operations:** tokenomics, budget, federation GAIT audit, logs and Terminal Intent.
- **Risk and federation:** existing standalone/Risk, iN2N, eN2N peers, BGP topology,
  configured devices, mobile/edge and Science Officer observations.
- **Integrations:** provider/harness, masked environment inventory, installed MCP
  integrations and skills. Review individual environment replacements and budget
  changes in native dialogs. Existing NetClaw validation and enforcement apply.
- **Security:** DefenseClaw posture and OpenShell inspection from existing HUD APIs.
- **Help:** installed documentation and CLI/API reference.

Panels show their source and observation time. Missing or stopped optional services
can report unavailable; no healthy state is inferred. GAIT is the federation audit
projection exposed by the HUD, not unrestricted access to every historical session.
Memory, GCF and meeting actions stage an investigation for your explicit Chat send;
they do not start listeners or claim access to unavailable tools.

**Prepare Existing Service Command** checks the selected runtime home's identity,
then previews existing NetClaw HUD/federation lifecycle commands. It can stage the
reviewed command in a terminal without pressing Enter. Execute it yourself and
inspect the actual result. It does not install or replace lifecycle control.
External Peer Conversations and Terminal Intent invoke their existing backend
workflows after native human review. The extension does not establish peering,
change peer permissions, approve device changes or create Local/Lab exemptions.

## Testbed inventory

**Testbed inventory** opens device cards, guided create/update/remove forms and **Advanced YAML**. Both modes keep unsaved drafts in memory while changing tabs or themes. Switching modes offers keep/discard/cancel. Closing the view discards drafts; changing installation clears sensitive contents. Every save has a read-only preview and a native review with the actual destination, additions, changes and removals.

The destination is the HUD-configured testbed, which may be shared with another installation and may differ from a running pyATS MCP's `PYATS_TESTBED_PATH`. Saving does not synchronize another file or connect devices. Structural validation does not run the pyATS loader or resolve `extends`, classes or ENV references.

- YAML (`.yaml`/`.yml`) and JSON support explicit replacement or device merge with error/skip/replace conflict choices. A merge refuses different top-level defaults/topology rather than dropping them.
- CSV supports `id,alias,type,os,platform,connection,protocol,host,port`. Rows are unique by `(id,connection)`; repeated device metadata must agree. Omitted columns preserve existing values. Blank optional metadata clears it; a blank port leaves it unchanged. New devices need OS and a named connection with host/protocol. CSV never deletes unseen devices or replaces advanced fields.
- YAML exports can preserve exact source; JSON preserves data without comments/anchors. CSV excludes advanced fields and credentials and prefixes formula-leading cells for spreadsheet safety. Use YAML/JSON for full fidelity.
- Export uses a native destination and explicit redacted/include-credentials choice. Redacted copies are not complete backups. Files are written with owner-only permissions.
- Existing credential literals use path-bound keep tokens in the editor; ENV references remain intact. Reviews show credential change intent, never values. New literal drafts are not saved to editor state.
- Stale revisions and changed previews are refused. Saves retain private copies under `<testbed>.backups/`; **Recovery copies** previews a fresh reviewed restoration. Source limit256KiB; masked editor limit512KiB. Ambiguous alias edits are refused rather than modifying unrelated data.
- Affected active terminals must disconnect before editing. A save revokes affected collection consent and cached logins; it never grants new access. A failure after revocation may require deliberate reauthorization after inspecting the file.

## MCP configuration and setup

Each known integration card opens **Configure & set up**. Fields are scoped to that integration and show presence, requirement/help and shared use. Existing values remain private. **Keep current value** is the default; Replace and Clear are explicit. Unknown metadata remains confidential with an honest requirement limitation. Saving checks the file revision and verifies submitted values privately; it does not imply loaded runtime settings or endpoint access.

**Installation & service actions** verifies an explicitly selected checkout and existing runtime home against the connected installation. Native review shows the host, runtime, identity, files, command, interruption and recovery impact before execution:

| Action | Scope |
| --- | --- |
| Install isolated runtime | Existing staged pyATS/GAIT helpers; prerequisites must already exist; downloads may occur; displaced generations retained |
| Register canonical MCP | OpenClaw only; known public catalog component, prerequisites and expected configuration revision; custom launch conflicts refused; unrelated entries preserved |
| Restart federation service | N2N only; existing owned daemon/runtime; interrupts peer work, checks PID ownership and verifies new PID/readiness |
| Prepare installer command | Existing `install.sh --add` with its broader prerequisite/runtime/onboarding/config/skills/readiness effects disclosed; staged without Enter |

Other lifecycle actions show guidance. Stdio MCPs are runtime-owned; there is no generic per-MCP restart. Hermes registration remains native review because its existing converter can produce only a sidecar. The protected Hermes HUD bridge is excluded from ordinary registration.

Setup evidence and baselines stay under the selected home's `netclaw-hud/setup/` with private permissions. Child output is not copied into the UI. Unknown/interrupted operations never replay; inspect the recorded operation and helper recovery state before explicitly resolving a retained lock/evidence record. Closing a card does not cancel a launched helper. Install, registration, runtime loading and endpoint verification are separate outcomes.

## Security perimeter controls

Open **Manage DefenseClaw Security** or **Manage OpenShell Security**. Choose the existing CLI and security profile on the extension host, plus the matching NetClaw runtime home. OpenShell also requires an explicit gateway, workspace and sandbox. The binding dialog explains that this security perimeter may protect other agents.

- **DefenseClaw:** searchable allow/block tool rules, global fallback or an observed connector scope, guardrail action/observe mode and blocking severity. Uses the native revision-aware config writer; managed-device restrictions remain authoritative. Connector overrides can supersede global defaults.
- **OpenShell:** named network-rule cards, a guided REST endpoint rule and advanced `network_policies` JSON for supported endpoint and layer7 allow/deny policies. Filesystem/process settings are preserved. A sandbox form cannot change a gateway-global policy. Removing one allow does not prove every route to a destination is blocked.
- **Status and logs:** observed status, configured policy and bounded redacted alert/log snapshots with search. Refresh explicitly. Saved settings, a loaded policy and tested traffic enforcement are separate results.
- **Review and recovery:** inspect a redacted before/after summary, provide a reason and confirm in a native dialog. Permission expansion or uncertain direction requires **Acknowledge weakening & apply**. Private originals and operation evidence remain in the editor's `security-operations` storage. Interrupted/unknown outcomes block another apply until the operator inspects and resolves that evidence; there is no automatic retry or rollback.

Capability probes determine whether editing is available. DefenseClaw needs JSON config reads, `--expect-sha256` writes and a matching reported data directory. OpenShell needs full/base JSON policy reads and a sandbox-owned effective policy; network drafts are limited to128KiB. Unsupported/oversized policies remain read-only. The OpenShell CLI has no atomic revision precondition: this client checks immediately before applying and serializes its own shared-target operations, but an external writer can race. Coordinate policy changes with other operators.

These controls do not install, start, stop or disable a security service. Local Mac acceptance uses isolated CLI contract fixtures; live DefenseClaw/OpenShell enforcement and Linux/WSL/remote-host qualification have not been performed for Spec151. Upstream source references and versions are recorded in [security research](../../specs/151-extension-experience/research-security.md).

## Copilot, Claude Code and Codex

Run **NetClaw: Manage Copilot, Claude Code and Codex Access** after connecting.
Choose inspection/proposals, or explicitly enable delegation as well.

Copilot discovers the extension's stdio MCP server through VS Code. Start it through
**MCP: List Servers**, review its tools and use Copilot Agent mode. VS Code and your
organization's policy still govern MCP consent and model access.

Claude Code and Codex setup opens an exact command preview for that host. Run the
reviewed command in a terminal with Node 22 or later and your authenticated client.
Other MCP registrations are preserved. Re-run setup after an extension update if
its installation path changes. Interactive clients may require per-call consent.

| Tool | Behavior |
| --- | --- |
| `netclaw_status` | Inspect the bound installation and delegation setting |
| `netclaw_inspect` | Read allowlisted, bounded domain summaries |
| `netclaw_propose_change` | Save an inert local draft for human review |
| `netclaw_request` | Delegate a prompt to existing NetClaw after opt-in |
| `netclaw_request_status` | Observe that registration's existing request |

Example: “Inspect NetClaw's runtime and propose a smaller budget. Do not apply it.”
With delegation enabled: “Ask my NetClaw to explain its installed integrations.”

The adapter exposes no approval, direct apply, arbitrary HTTP, raw backend MCP or
shell tool. Delegation **can invoke NetClaw's tools under its existing authorization
and approval rules**; it is not enforced read-only execution. This adapter is not
an OS sandbox for a terminal assistant that already has same-user filesystem access.
Disable a registration through the extension to refuse subsequent calls. Already
submitted backend work may continue. Assistant model costs are separate from
NetClaw provider usage.

## Recovery and data

An identity change invalidates the connection; reconnect and review the target.
An interrupted send is never automatically replayed. Hermes supports owned request
status and stop requests. The OpenClaw HUD has no corresponding request-status or
stop API: review owned history and running NetClaw before starting separate work.
Opening older history does not certify an unresolved request's completion.
Closing, disabling or uninstalling the extension does not cancel runtime work.

Profiles, saved conversations, Canvas investigations and assistant drafts live in
extension storage on the execution host. Cookies use VS Code SecretStorage; terminal
MCP adapters maintain their own private local session files. No browser cookie is
copied. Draft retention is opt-in. Uninstall preserves NetClaw, its credentials,
configuration and services; extension local state may remain according to VS Code's
storage behavior. See [Privacy](PRIVACY.md).

## Development and qualification

From this directory, use `npm ci`, `npm run check`, `npm run build`, `npm test`.
Backend integration tests require the HUD dependencies
(`npm --prefix ../../ui/netclaw-visual ci`). Spec151 adds bounded testbed and configuration routes to the existing HUD. Older HUDs retain existing functions and show clear guidance when these new editing routes are unavailable; there is no fallback to the legacy raw testbed writer.
`npm run test:editor` launches an isolated desktop extension test. RAG and named
assistant live checks are explicit opt-ins documented in Spec150 evidence.

`npm run package` requires a clean committed checkout and records the source and
VSIX digest in `out/package.json`. Windows/WSL acceptance and Marketplace publication
are separate release gates. Publication is currently on hold by the owner; this
is an unpublished candidate. The prior exact-artifact qualification remains in Spec150. Spec151 is a local source build only; its [verification](../../specs/151-extension-experience/verification.md) records Mac evidence and unexecuted platform checks. Packaging, push, deployment and Marketplace publication remain explicitly held.

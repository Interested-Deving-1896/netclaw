# NetClaw for Visual Studio Code

Manage your **existing NetClaw or Risk** from VS Code. Connect to its running HUD,
inspect operations, converse with its configured runtime, search RAG knowledge and
review supported settings without leaving your editor.

NetClaw remains your runtime. This extension installs no NetClaw service, model,
network automation engine, federation daemon or backend management framework.

## Connect

1. Use VS Code 1.102 or later on macOS or Linux. On Windows, first open your
   intended **WSL distribution** with VS Code Remote WSL and install this extension
   **in WSL**. For another Linux/Mac machine, use your existing Remote SSH workspace.
2. Start your already-installed NetClaw HUD using its normal supported environment.
   The initial compatibility baseline is NetClaw 1.8.0, including its installation
   identity and owned-conversation APIs. The extension does not upgrade NetClaw.
3. Open the NetClaw Activity Bar and select **Add existing NetClaw**. Enter a label
   and the HUD **API** address, normally `http://127.0.0.1:3001`.
4. Review the returned installation identity and harness before binding. Loopback
   belongs to the extension host, so WSL and Remote SSH connect on that host.

No automatic connection or runtime changes occur when you open a workspace.
Connections require Workspace Trust. Public HUD URLs, browser VS Code, native
Windows runtime hosting and virtual workspaces are unsupported.

## Workbench

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
Backend integration tests also require the unchanged HUD's installed dependencies
(`npm --prefix ../../ui/netclaw-visual ci`). No backend source modification is needed.
`npm run test:editor` launches an isolated desktop extension test. RAG and named
assistant live checks are explicit opt-ins documented in Spec150 evidence.

`npm run package` requires a clean committed checkout and records the source and
VSIX digest in `out/package.json`. Windows/WSL acceptance and Marketplace publication
are separate release gates. This source tree is a candidate until those gates pass.

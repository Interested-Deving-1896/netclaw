# NetClaw assistant access in VS Code

The extension manages an existing installation through a private operator MCP
process. Copilot, Claude Code and Codex use a different, reduced MCP surface.
An assistant never receives an operator credential or an apply/approve tool.

## Current implementation

Run **NetClaw: Manage Copilot, Claude Code and Codex Access** after binding a
trusted connection. Choose the client, permissions, disclosure,
and an expiry of one, seven or thirty days. Review the installation, host,
permissions and disclosure notice before creating the grant.

The backend creates a distinct credential in its private `.env`. Client setup
contains an installation ID and `NETCLAW_CLIENT_<grant-id>_TOKEN` reference,
never the token value. Summary and owned-usage disclosure is the default; answer
text requires a separate explicit selection. Results can enter the external client's model provider. Its inference
costs are separate from NetClaw's reported usage.

When this installation's existing protected Hermes federation companion reports
the reviewed subnet tool, setup also offers **Inspect, delegate subnet work and
propose changes**. This profile allows local IPv4 /24–/30 subnet calculation
and conversation with that limited toolset. It does not allow shell, configuration
execution, remote federation orchestration or arbitrary installed tools. Each
provider request and tool dispatch rechecks the original grant, credential,
expiry, installation and owned worker lease. Only the guarded OpenAI-compatible
chat-completions transport is qualified; other transports refuse dispatch.
OpenClaw assistant execution and broader federation delegation remain unavailable.
The extension does not launch or configure a companion to make this option appear.

## Copilot

The opt-in provider uses the stable VS Code 1.102 MCP API. Discovery performs no
network or process work and returns nothing in Restricted Mode, before opt-in,
or after disconnect. Each definition includes the immutable installation and
grant identity. Resolving it rechecks the bound host, OS principal and current
grant generation; switching the explorer cannot retarget an existing definition.

After enabling discovery, use VS Code's MCP interface to inspect and start the
server. Account, organization and tool-confirmation policies still apply. A
client's Allow action permits that MCP call; it does not approve a production
NetClaw change. See the [official MCP API guide](https://code.visualstudio.com/api/extension-guides/ai/mcp).

## Terminal clients

The extension opens a reviewable POSIX command document. It adds one uniquely
named server and shows its matching remove command. Run it on the displayed
extension host: inside the exact WSL distribution or Remote SSH host shown.
An SSH profile uses the existing SSH alias with strict known-host checks and
agent forwarding disabled. The launcher works without VS Code running.

The generated command grammar was checked against installed **Codex 0.162.1**
and **Claude Code 2.1.286** on Mac. Before creating/exporting terminal access,
the extension runs the fixed client's `--version` on the extension host with a
five-second deadline and bounded output. Unknown or changed versions stop export
pending compatibility review. The extension does not silently edit
user or workspace configuration. Review a new grant for a changed destination.

Codex's documented registration uses `codex mcp add NAME -- COMMAND ARGS`;
Claude Code supports `claude mcp add --transport stdio --scope user NAME -- COMMAND ARGS`.
See the [Codex MCP guide](https://developers.openai.com/codex/extend/mcp) and
[Claude Code MCP guide](https://code.claude.com/docs/en/mcp).

## Review, disable and revoke

Use **Review or revoke a grant** to inspect the installation's grant registry,
reopen setup, hide Copilot discovery, or revoke backend access. Hiding discovery
does not revoke a cached client's credential. Revocation is checked on every
call and again after asynchronous reads and proposal preparation; cached clients
cannot retain authority. Expiry has the same effect on future calls. During
protected Hermes execution, revocation also requests a runtime stop and prevents
later provider/tool hops. An already transmitted provider request cannot be
recalled. Cancellation is confirmed only from observed runtime state. The human
can inspect retained results and cancel owned work after a client is revoked.

The current noninteractive Codex acceptance run can inspect but cannot create a
proposal: its approval policy is `never`, so the client refuses that MCP write
before it reaches NetClaw. Use the client's normal interactive tool confirmation
for the remaining acceptance check. Do not disable approval controls to make a
test pass. Claude Code's actual hosted-provider check successfully created a
pending OpenClaw budget proposal and received an explicit Hermes refusal.
Neither check applied a change or qualified runtime delegation.

## Authority boundary and limitations

The seven assistant tools are status, inventory, evidence, request, owned request
status, cancellation and change proposal. Unsupported operations refuse dispatch.
Grant IDs, generations, target IDs, action classes and disclosure are backend
authority; client names, prompts and `clientInfo` are not. Production approval
requires an independent authoritative check. Terminal Intent's Local/Lab policy
is not granted by this interface.

These controls isolate clients at the MCP boundary. Processes running as the
same OS user may independently read that user's private files; the extension
does not claim to sandbox an otherwise privileged terminal assistant.

See [actual client evidence](../specs/150-vscode-extension/evidence/assistant-clients.md).

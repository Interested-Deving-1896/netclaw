# Draft: Bringing NetClaw into Visual Studio Code

**Local milestone draft for John’s review. Not a release announcement; do not
publish until the remaining implementation and acceptance gates are complete.**

NetClaw's VS Code extension is taking shape as a management surface for existing
NetClaw and Risk installations. The goal is to keep Chat, Canvas, Avatar, RAG,
settings, operations and evidence close to an engineer's workspace, while
preserving the runtime's identity and authorization boundaries.

The current Mac development checkpoint adds strict MCP response contracts,
reviewed configuration transactions, installation-scoped logs and usage,
recorded Memory search and assistant setup. It reuses the mobile logo and works
through an explicit private operator connection. Copilot, Claude Code and Codex
receive a separate scoped interface; assistants cannot approve their own changes.

Real Claude Code runs have inspected controlled installations and prepared an
OpenClaw budget proposal without applying it. A Hermes request correctly refused
an unsupported budget operation. Codex inspection worked, while its confirmation
policy blocked the write tool before dispatch. That distinction matters:
discovering a tool or passing a fixture does not qualify a complete workflow.

The architectural work is centered on immutable installation bindings, durable
operation receipts, revision-aware edits and truthful provenance. Credentials
stay in the backend `.env`; changing a file does not imply that a running service
has adopted it. RAG documents and operational Memory retain separate sources.

Work remains on runtime-enforced delegation, lifecycle and federation controls,
security and approval adapters, the full platform/client matrix and Marketplace
acceptance. Windows/WSL validation will use the owner's real Windows environment.
We will publish the extension only when these required gates are satisfied.

Prepared as a collaborative NetClaw development milestone for John Capobianco.

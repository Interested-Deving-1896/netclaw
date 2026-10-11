# NetClaw for Visual Studio Code

The extension connects to an existing NetClaw or Risk installation. It is a
development candidate on branch `150-vscode-extension-release`, not a published
release. See the [compatibility record](VSCODE-COMPATIBILITY.md) before testing.

## Connect

1. Use VS Code 1.102.0 or later. On Windows, open the intended distribution with
   **WSL: Connect to WSL using Distro**. For Remote SSH, open the existing host.
2. On that host, the existing installation needs its stable installation identity,
   supported HUD Node (24.19–24.x or 26.1+), the explicit `netclaw-operator`
   backend component and installation-specific GAIT. Do not bootstrap a new
   runtime to repair a connection. Resolve prerequisites through the backend's
   normal installation process.
3. Install the development VSIX in a separate test profile. Select **NetClaw:
   Add Connection**. Supply the existing runtime home, harness, supported Node
   executable and absolute `scripts/netclaw-operator.mjs` path. An SSH profile
   uses an already configured alias and verified host key.
4. Review the returned installation, host and operator identity. The saved
   profile is bound to that identity and extension-host context. A matching
   display name never establishes identity. Trust the workspace before connecting.

Profiles contain paths and nonsecret identity references, and are not synced.
Disconnecting or removing a profile closes its management connection; it does
not stop the runtime or remove installation data. Reopening another WSL
distribution requires a profile for that distribution.

## Work with your installation

The Activity Bar provides Connections, Risk & Federation, Operations,
Integrations, Knowledge, Security and Help. Commands also work without an open
folder. Overview reports the selected installation and supported capabilities.

Chat, Canvas and Avatar share owned conversations. Adding selected context
requires review; opening a view, editing a draft or branching a Canvas does not
send a provider request. **New with model settings** creates an owned conversation
with a configured OpenClaw model and its declared effort choices. At explicit
Send, the gateway must verify that exact model/effort before inference. Hermes
uses its configured companion model. Answer progress and tool milestones retain
their runtime source; partial or bounded evidence is labeled. RAG searches the selected local corpus and preserves
citations. RAG retrieval and recorded Memory search are separate operations.

Settings expose reviewed provider/model, OpenClaw budget and environment
changes. Keep, replace and clear are distinct secret actions. A proposal records
the expected revision, baseline, impact and rollback; approval is a separate
operator action. Saved configuration may require a restart and is never labeled
effective merely because the file write succeeded. Concurrent edits refuse
application. Legacy credential normalization is explicit and reviewable.
Production installations use the [read-only change-authority integration](VSCODE-CHANGE-CONTROL.md).
Revoking an assistant grant also invalidates its pending proposals.

**Manage Service** prepares start, stop or restart for an explicitly bound
gateway, federation daemon or Hermes companion. Review impact on current work
before applying. A changed unit, running process, configuration or set of active
requests invalidates the review. Use the backend's
[service binding procedure](VSCODE-SERVICES.md) first; an existing process name
does not establish ownership. The Mac launchd gateway path has actual isolated
process evidence; Linux systemd and other service kinds still need real-platform
qualification.

Security separates configured DefenseClaw policy, the selected federation
daemon's reported controls, host confinement and OpenShell. A fresh daemon
report is scoped evidence, not proof of every runtime tool hop. Missing or stale
observations stay visible. OpenShell and full guardrail controls are still in
development.

Tokenomics distinguishes recorded usage, missing sources and external assistant
billing. Logs are bounded installation-owned sources with a review before
export. Configured network inventory is labeled configured, not live discovery.
Documentation is read from the connected backend's indexed repository.

[Copilot, Claude Code and Codex setup](VSCODE-ASSISTANTS.md) uses a separate,
scoped assistant interface. Its current supported access is inspection and
proposals. Runtime delegation is not yet qualified. An assistant cannot approve
its own proposal or obtain the private operator interface.

## Recovery and support

- **Prerequisite or identity error:** verify the selected runtime home, stable
  identity, backend version and Node executable. Do not copy another installation's
  identity or accept a changed SSH host key automatically.
- **Lost response or editor reload:** inspect the existing operation by ID. Do
  not resubmit uncertain work with a new nonce. Unknown outcomes stay visible
  until authoritative reconciliation establishes the result.
- **Stale proposal:** prepare a new review after inspecting the changed
  configuration. Rollback refuses to overwrite an intervening manual edit.
- **GAIT unavailable:** repair the selected installation's audit prerequisite;
  audited operations remain refused. Do not redirect to another installation's audit.
- **Client access:** hiding Copilot discovery does not revoke a cached client.
  Revoke the backend grant, then remove its uniquely named terminal registration.
- **Upgrade or rollback:** install the reviewed VSIX version in the same editor
  profile. Preserve the backend runtime, `.env`, journal and saved investigations.
  Disabling/uninstalling the extension is not a backend cleanup operation.

Before opening a [support issue](https://github.com/automateyournetwork/netclaw/issues),
review and redact exported diagnostics. Include extension/backend versions,
OS/editor/extension-host context, harness, operation ID and observed error. Never
include `.env`, credentials, private network configurations or raw databases.

## Development and release

Run `npm ci` in the extension directory, then `npm run check`, `npm test` and
`npm run test:editor`. `npm run package` requires committed clean source and
writes a candidate provenance record containing source revision and SHA-256.
The package allowlist excludes runtime homes, credentials, databases and test
fixtures. See [qualification gates](../specs/150-vscode-extension/contracts/qualification.md).
Publishing requires all required workflows/platforms and the actual named-client
checks, a valid local publisher login, and a verified public install of the exact
release. Current partial evidence does not satisfy those gates.

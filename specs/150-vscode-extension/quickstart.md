# Development quickstart

Use an existing supported NetClaw with its HUD running. Open its host in VS Code
(local Mac/Linux, WSL distribution or Remote SSH). Install the candidate VSIX,
add the loopback HUD API URL, review identity and bind the installation.

Inspect Overview and RAG before sending work. Chat uses that NetClaw's existing
provider and approvals. Assistant setup is explicit and exposes only the adapter's
bounded tools. Do not replace existing assistant configuration.

Build and verify from extensions/netclaw-vscode using npm ci, npm run check,
npm test, npm run build. Packaging requires committed source. Exact Windows/WSL
commands will be provided in windows-wsl-handoff.md once Mac validation passes.

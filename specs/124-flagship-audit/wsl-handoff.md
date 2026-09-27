# Spec 124 — WSL acceptance procedure and continuation

The WSL continuation checkpoint and completed acceptance are now recorded in
handoff.md, verification.md and wsl-review.md. The commands below remain the
reproducible procedure; they are not all pending. WSL continues spec124; this is not a declaration that broad source review or the phase is complete. Apple review is nonblocking. Do not start125 until the remaining review and required acceptance gates are resolved or explicitly dispositioned with the user.

## Human preparation

In Windows PowerShell, confirm Ubuntu reports version2:

```powershell
wsl --list --verbose
```

Start Docker Desktop and enable your Ubuntu distribution under Settings →
Resources → WSL Integration. Open Ubuntu and verify:

```bash
uname -r
python3 --version
node --version
npm --version
uv --version
docker info --format '{{.OSType}}/{{.Architecture}}'
```

Use the Linux home filesystem, such as `~/netclaw`, rather than `/mnt/c` for the
checkout. Preserve existing `.env`, testbeds, enrollment keys, data and runtime
configuration; do not copy Mac virtualenvs or private signing files to WSL.

The source checkpoint `826a40e` is pushed and remote-verified. Update the existing clean checkout:

```bash
cd ~/netclaw
git status --short
git fetch origin
git switch 124-flagship-audit
git pull --ff-only origin 124-flagship-audit
git merge-base --is-ancestor 826a40e8f45f69345d8a38d08cf0222a71a08c8a HEAD
```

If the branch does not yet exist locally, use
`git switch --track origin/124-flagship-audit`. If the checkout has local changes,
stop before switching and let Codex preserve them; do not reset or clean the tree.
Open Codex against this WSL checkout and say:

> Continue spec124 from specs/124-flagship-audit/handoff.md and wsl-handoff.md.
> Complete the outstanding Linux/WSL acceptance, migrations and report before
> starting125. Preserve my existing installation and private state.

## Commands Codex should run in WSL

Create a private output directory outside tracked artifacts. The contract runner
uses isolated environments; `--prepare` may download declared dependencies and
pinned binaries. It does not install the full operator NetClaw runtime.

```bash
cd ~/netclaw
umask 077
mkdir -p ~/.openclaw/audit124-wsl
python3 scripts/verify-spec-artifacts.py
python3 scripts/reconcile-mcp.py --surface catalog --surface dependencies --surface docs --surface meraki-ids --surface packages --surface portability
python3 scripts/run-contract-tests.py --suite all --prepare --json > ~/.openclaw/audit124-wsl/contracts.json
```

Capture each exit code directly; never use a pipe to hide a failed command.
Review the JSON's optional capability gaps as well as its top-level exit code.
Then run the HUD checks separately:

```bash
cd ~/netclaw/ui/netclaw-visual
npm ci
npm test
npm run build
npm audit --omit=dev
```

## Work required beyond these commands

- Verify fresh installation and existing-install migration/recovery in isolated
  destinations before applying migrations to the operator environment. In
  particular: pyATS MCP2 HTTP bridge/native pCalls, GAIT generation/restore,
  shared Python constraints, literal dotenv and PEP668 refusal. Dedicated
  runtimes must remain separate; do not bypass system-package protection.
- Exercise normal startup, tool discovery, bounded failures, shutdown/restart
  and a real Windows-browser→WSL HUD chat/canvas flow. Confirm HTTP/WebSocket
  loopback/Host/Origin restrictions still reject inappropriate clients.
- Repeat CML read-only inventory/native pCalls from WSL with a separately
  provisioned private testbed and trusted CML certificate. Do not commit secrets
  or assume Windows and WSL see identical networking.
- Run the FRR strict-known-host checks using the disposable lab documented in
  labs/multivendor-r1; verify unknown/mismatched keys fail before command execution.
- Repeat available digest-pinned NSM/Redfish fixtures (both passed on Mac); record genuinely absent
  vendor/Zoom/Twilio/ServiceNow/Kubernetes capabilities as unverified, not passed.
- Review each supported host separately: a WSL result is a WSL/Linux-kernel
  result, not proof of a native Linux service-manager installation.
- iOS/watch builds, signing and real-device mobile smoke remain Mac/device work;
  do not attempt them on WSL. App Store upload state is in MOBILE-RELEASE.md.
- Reconcile coverage, findings, tasks, requirement mapping and final evidence.
  Any unresolved confirmed defect or required acceptance gap prevents an
  unqualified100% completion claim.

Official setup references: [Microsoft WSL commands](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)
and [Docker Desktop WSL integration](https://docs.docker.com/desktop/features/wsl/).

## Required evidence when returning

Record host/distribution/kernel, exact Git revision, dependency/runtime versions, suite exit codes and optional gaps, fixture image digests, install/migration preview/apply/repeat/failure/recovery results, and actual browser/CLI startup outcomes. Keep raw configurations and credentials private; commit only redacted outcome summaries. Continue the 926 pending baseline semantic dispositions honestly. The broad open tasks are listed in handoff.md; running the test commands alone does not close them.

# Installation-owned service development evidence

Status: partial implementation evidence, not complete T038/T041 or release
acceptance. Mac 26.5.2 (25F84), Darwin 25.5.0 arm64, Node 24.19.0, installed
OpenClaw 2026.7.1-2. No owner service, configuration or credential was changed.

The real-process test creates an isolated installation and unique launchd plist,
records its reviewed binding through installation GAIT, and submits start,
restart and stop through the private management surface. Each admitted operation
continues after closing and reopening the façade. The manager reports a running
PID after start, a different PID after restart and inactive after stop.
Configuration, private environment and service-definition bytes remain unchanged.
The fixture sends no model inference and cleans up only its own unit.

Reproduce on Mac with the supported Node on PATH:

```sh
NETCLAW_TEST_LIVE_GAIT=1 NETCLAW_TEST_LIVE_SERVICES=1 \
NETCLAW_TEST_OPENCLAW_ENTRY=/absolute/installed/openclaw/openclaw.mjs \
node --test tests/operator/lifecycle-process.test.mjs
```

Two runs passed, including the tightened loaded-job ownership checks. Local raw
logs are `/tmp/netclaw150-launchd-lifecycle.log` and
`/tmp/netclaw150-launchd-binding.log`. Fixture tests separately cover selected
home mismatch, active systemd process/invocation mismatch, writable/symlink/hook
definitions, installation replacement during binding audit, configuration and
process drift, newly admitted work, production denial, failed restart recovery
and lost stop acknowledgement without nonce replay.

Linux systemd process behavior is not established by those simulated controller
tests. Actual Linux/WSL service lifecycle and real federation/Hermes companion
units remain mandatory. Runtime/role transactions and full production authority
integration also remain incomplete. T036 covers the implemented tests; platform
qualification remains in T041/T075/T076.

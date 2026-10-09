# Google Chat: what an owner can run now

This is a draft setup runbook, not an installed feature. Run these read-only checks
on the NetClaw gateway host:

```bash
openclaw --version
openclaw plugins list
openclaw channels status
npm view @openclaw/googlechat version peerDependencies --json
```

On the inspected host, OpenClaw is 2026.7.1-2 and Google Chat is absent. The latest
plugin observed is 2026.9.9 with peer >=2026.9.9. Do not run an unpinned install on
that host. The older 2026.7.1 package is only a candidate: its peer range does not
match the installed suffix under standard semver. First select and test a supported
runtime/plugin pair; an upgrade is a separate explicit runtime change.

## Native setup after compatibility is established

These are owner setup steps, not actions already performed by NetClaw:

1. In the owner's Google Cloud project, enable the Chat API and configure a private
   interactive Chat app visible only to selected test users/groups. Create a
   service account for that app and keep its key file in private gateway storage.
2. Install the exact verified official plugin release. For the currently observed
   latest package, this command requires a separately verified compatible host:

   ```bash
   openclaw plugins install @openclaw/googlechat@2026.9.9
   ```

3. Configure `channels.googlechat` against that plugin's validated schema: private
   service-account file, disabled-by-default enablement until ready, chosen HTTPS
   audience and `/googlechat` webhook path, stable user/space allowlists, required
   mentions, no bots and replies in the incoming thread. Configure isolated DMs
   and a dedicated public-only agent binding. Do not replace the entire runtime
   configuration with a copied example.
4. Expose only the exact webhook path through the chosen HTTPS proxy/tunnel. Keep
   the gateway/HUD private. Match the Chat app's endpoint and authentication
   audience. Verify all other paths reject access; a GET failure at the webhook
   itself is not proof that a POST integration is configured correctly.
5. Explicitly apply/enable the chosen profile and start/reload the service as
   required by the tested runtime. Check `openclaw channels status --probe`, then
   run a synthetic DM and mentioned space-thread exchange from the selected users.
6. Verify denied users/spaces and context isolation, record results, then document
   how to disable this channel and remove just its ingress route.

Credential example: `GOOGLE_CHAT_SERVICE_ACCOUNT_FILE` contains a private file
path. It is not a Gemini key and not an incoming-webhook URL. Never paste the JSON
private key into Chat, source control or the HUD.

For exact provider setup fields use the
[official OpenClaw guide](https://docs.openclaw.ai/channels/googlechat) and
[Google app configuration guidance](https://developers.google.com/workspace/chat/configure).
This runbook supplies NetClaw's proposed safety defaults; it does not claim those
controls are implemented in this repository yet.

## Patch versus configuration

| Need | Answer |
|---|---|
| Basic synthetic chat with a supported OpenClaw runtime | Native plugin plus Google/HTTPS configuration; no bespoke NetClaw bridge |
| Current inspected July runtime with latest plugin | Compatibility/upgrade work first; do not force installation |
| One-command NetClaw setup, status and rollback | Planned setup/installer/HUD/documentation patches |
| Private network operations through Google Chat | Planned enforceable identity/export policy and approval acceptance; not enabled by this spec |

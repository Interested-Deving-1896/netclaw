# Local and remote HUD access

The HUD can read credentials, edit local configuration, and invoke your agent. It is a trusted local operator interface. Starting with spec 124, both the API and frontend bind to `127.0.0.1`. HTTP and WebSocket requests reject untrusted browser origins and hostnames. Native Windows is not a full NetClaw host; use WSL2. macOS and Linux are supported host paths.

After updating the checkout, from `ui/netclaw-visual`, run `npm ci` (required to adopt the patched lockfile), then `npm run dev`, then open <http://127.0.0.1:3000>. Adam Mason's context chat remains at `/canvas.html`. For a built frontend, run `npm run build`, `npm run server`, and `npm run preview` in the appropriate terminals.

`HUD_PORT` configures the API port (default 3001), and `HUD_UI_PORT` configures the frontend port (default 3000). Export the same values in the API and frontend processes. Ports must differ; the frontend fails rather than silently moving to an untrusted port.

## Migration for existing remote users

Direct unauthenticated LAN/public access is no longer supported. Run the provided migration helper **on your client machine**, using an SSH account on the NetClaw host:

```bash
# Preview: no connection and no state changes
python3 scripts/migrate-hud-access.py --ssh-target operator@netclaw-host

# Connect: SSH authenticates normally and holds the tunnel open
python3 scripts/migrate-hud-access.py --ssh-target operator@netclaw-host --connect
```

Then open <http://127.0.0.1:3000> locally. Both frontend and API ports are forwarded on loopback only. The helper disables agent forwarding, retains SSH host-key verification, and fails when a forwarding port is already occupied. It does not install keys, alter SSH configuration, or change NetClaw data. Use an existing SSH configuration alias for unusual host addressing or custom SSH ports.

For custom HUD ports, pass matching `--ui-port` and `--api-port` values. If a local port is occupied, stop the conflicting process or select matching custom ports on the host and helper; do not expose the API on a network interface.

## Recovery and limits

Ctrl-C closes the tunnel. No data/configuration migration occurs, so no backup restoration is needed. A failed SSH connection leaves the original installation untouched. The server must already be running on the remote host. Access is for a trusted operator on the local machine or authenticated SSH account; this is not a multi-user authentication system. Do not publish the Vite proxy or API through an unauthenticated reverse proxy. A public deployment needs a separately reviewed authentication design.

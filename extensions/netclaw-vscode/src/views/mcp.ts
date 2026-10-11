import * as vscode from "vscode";
import { Connection } from "../connection/connect";
import { Json, HudError } from "../client/hud";
import { panel } from "../webview/panel";
import { openSetup } from "./setup";
export async function openMcp(
  context: vscode.ExtensionContext,
  connection: Connection,
  integrationId?: string,
) {
  const b = connection.bound();
  let initial: Json;
  try {
    initial = await b.run(() =>
      b.client.request("GET", "/api/mcp/configuration"),
    );
  } catch (error) {
    if (error instanceof HudError && error.status === 404)
      throw Error(
        "This HUD does not yet provide scoped MCP configuration. Use Environment configuration for the existing native settings flow, or run a local Spec151 HUD source build.",
      );
    throw error;
  }
  let selected = initial.integrations.find((d: Json) => d.id === integrationId);
  if (integrationId && !selected)
    throw Error(
      "This HUD has no scoped setup metadata for the selected integration. Refresh the integration catalog or use its documented native setup guidance.",
    );
  if (!selected) {
    const choice = await vscode.window.showQuickPick<{
      label: string;
      description: string;
      descriptor: Json;
    }>(
      initial.integrations.map((d: Json) => ({
        label: d.name,
        description: d.id,
        descriptor: d,
      })),
      { title: "Configure an MCP integration" },
    );
    if (!choice) return;
    selected = choice.descriptor;
    b.current();
  }
  const id = selected.id;
  const p = panel(
    context,
    connection,
    "mcp",
    "MCP setup",
    `<p id="status" role="status" aria-live="polite">Loading integration…</p><div id="summary" class="info-card"></div><div class="toolbar"><button id="setup">Installation & service actions</button><button id="reload" class="secondary">Reload fields</button></div><p id="source" class="provenance"></p><form id="mcp-form"><div id="fields" class="form-grid"></div><div class="toolbar"><button type="submit">Review & save fields</button></div></form><p class="hint">Saved configuration, loaded runtime settings and verified endpoint access are separate states. Saving never restarts or probes a service.</p>`,
    ["resources/mcp.js"],
  );
  let snapshot = initial,
    busy = false;
  const show = async () => {
    const descriptor = snapshot.integrations.find((d: Json) => d.id === id);
    if (!descriptor)
      throw Error("Integration metadata is no longer available.");
    await p.post({
      type: "configuration",
      descriptor,
      source: snapshot.source,
      revision: snapshot.revision,
    });
  };
  p.onMessage(["ready", "reload", "save", "setup"], async (m) => {
    if (busy) return;
    busy = true;
    await p.post({ type: "busy", busy: true });
    try {
      if (m.type === "ready") await show();
      if (m.type === "reload") {
        if (
          m.dirty &&
          (await vscode.window.showWarningMessage(
            "Discard this unsaved configuration draft?",
            { modal: true },
            "Discard draft",
          )) !== "Discard draft"
        )
          return;
        p.bound.current();
        snapshot = await p.bound.run(() =>
          p.bound.client.request("GET", "/api/mcp/configuration"),
        );
        await show();
      }
      if (m.type === "setup") await openSetup(context, connection, id);
      if (m.type === "save") {
        const descriptor = snapshot.integrations.find((d: Json) => d.id === id);
        if (
          !m.changes ||
          typeof m.changes !== "object" ||
          Array.isArray(m.changes)
        )
          throw Error("Invalid field changes.");
        const lines: string[] = [];
        for (const [key, raw] of Object.entries(m.changes)) {
          const field = descriptor.fields.find((f: Json) => f.key === key),
            change = raw as Json;
          if (!field || !["replace", "clear"].includes(change.intent))
            throw Error("Invalid scoped field change.");
          lines.push(
            `${field.label}: ${change.intent}${field.sharedWith.length ? " · also used by " + field.sharedWith.join(", ") : ""}`,
          );
        }
        if (!lines.length) {
          await p.post({
            type: "notice",
            message: "No fields changed. Existing values kept.",
          });
          return;
        }
        if (
          (await vscode.window.showWarningMessage(
            `Save ${descriptor.name} configuration?`,
            {
              modal: true,
              detail: `${connection.profile?.label} · ${connection.identity?.kind}\n${connection.identity?.installationId}\n${snapshot.source}\n\n${lines.join("\n")}\n\nOnly these fields change. A private baseline is retained; no restart or endpoint probe follows.`,
            },
            "Save fields",
          )) !== "Save fields"
        )
          return;
        p.bound.current();
        await p.bound.run(() => p.bound.client.verifyIdentity());
        p.bound.current();
        await p.bound.run(() =>
          p.bound.client.request("PUT", "/api/mcp/configuration", {
            integrationId: id,
            revision: snapshot.revision,
            confirm: true,
            changes: m.changes,
          }),
        );
        snapshot = await p.bound.run(() =>
          p.bound.client.request("GET", "/api/mcp/configuration"),
        );
        await show();
        await p.post({
          type: "notice",
          message:
            "Saved and verified in the environment file. Runtime loading and endpoint access remain unverified.",
        });
      }
    } finally {
      busy = false;
      await p.post({ type: "busy", busy: false });
    }
  });
  return p.view;
}

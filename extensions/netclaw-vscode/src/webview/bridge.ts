import * as vscode from "vscode";
import { randomBytes, randomUUID } from "node:crypto";
import { Connection } from "../connection/connect";

export interface ViewDefinition {
  title: string;
  kind: string;
  load: () => Promise<unknown>;
}
const escape = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function openDataView(
  context: vscode.ExtensionContext,
  connection: Connection,
  view: ViewDefinition,
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    `netclaw.${view.kind}`,
    view.title,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "resources"),
      ],
    },
  );
  const nonce = randomBytes(24).toString("base64"),
    viewId = randomUUID(),
    generation = connection.generation;
  const css = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "resources", "workbench.css"),
  );
  const script = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "resources", "data.js"),
  );
  panel.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource}; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"></head><body class="data-view" data-view-id="${viewId}"><header><p class="eyebrow">NETCLAW</p><h1>${escape(view.title)}</h1><p id="binding">${escape(connection.profile?.label || "Disconnected")} · ${escape(connection.identity?.harness.type || "No runtime")}</p><button id="refresh" type="button">Refresh</button><label for="filter">Filter loaded entries</label><input id="filter" type="search" maxlength="200" aria-describedby="filter-hint"><p id="filter-hint" class="hint">Filters list entries in this observation only. Source and policy metadata remain visible. Lists show up to 50 entries per page.</p></header><main><p id="status" role="status" aria-live="polite">Loading…</p><div id="content"></div></main><script nonce="${nonce}" src="${script}"></script></body></html>`;
  let disposed = false,
    loading = false,
    received = 0;
  const load = async () => {
    if (loading || disposed) return;
    loading = true;
    try {
      if (connection.generation !== generation)
        throw Error(
          "Connection changed. Reopen this view for the selected installation.",
        );
      const data = await view.load();
      if (connection.generation !== generation || disposed) return;
      if (Buffer.byteLength(JSON.stringify(data)) > 1024 * 1024)
        throw Error(
          "Observation exceeds the display limit. Narrow the source selection.",
        );
      await panel.webview.postMessage({ viewId, data });
    } catch (error) {
      if (!disposed)
        await panel.webview.postMessage({
          viewId,
          error: error instanceof Error ? error.message : "Source unavailable",
          ...(connection.generation !== generation
            ? { invalidated: true }
            : {}),
        });
    } finally {
      loading = false;
    }
  };
  panel.webview.onDidReceiveMessage((message: unknown) => {
    if (!message || typeof message !== "object") return;
    const m = message as Record<string, unknown>;
    if (
      Object.keys(m).sort().join(",") !== "requestId,type,viewId" ||
      !["ready", "refresh"].includes(String(m.type)) ||
      m.viewId !== viewId ||
      typeof m.requestId !== "string" ||
      !/^\d{1,12}$/.test(m.requestId) ||
      Number(m.requestId) <= received
    )
      return;
    received = Number(m.requestId);
    if (!vscode.workspace.isTrusted) return;
    void load();
  });
  const changed = connection.changed.event(() => {
    if (!disposed && connection.generation !== generation)
      void panel.webview.postMessage({
        viewId,
        error:
          "Connection changed. Reopen this view for the selected installation.",
        invalidated: true,
      });
  });
  panel.onDidDispose(() => {
    disposed = true;
    changed.dispose();
  });
  return panel;
}

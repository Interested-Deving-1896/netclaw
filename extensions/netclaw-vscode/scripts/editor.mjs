import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";
import { realHud, freePort } from "../test/real-hud-fixture.mjs";
const extension = fileURLToPath(new URL("../", import.meta.url));
const fixture = await realHud({
    ragPython: process.env.NETCLAW_TEST_RAG_PYTHON,
    ragCache: process.env.NETCLAW_TEST_RAG_CACHE,
  }),
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "netclaw150-client-editor-")),
  port = await freePort();
fs.mkdirSync(path.join(profile, "user/User"), { recursive: true });
fs.writeFileSync(
  path.join(profile, "user/User/settings.json"),
  JSON.stringify({
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
    "extensions.autoUpdate": false,
    "workbench.startupEditor": "none",
    "security.workspace.trust.enabled": true,
    "security.workspace.trust.startupPrompt": "never",
  }),
);
try {
  if (process.env.NETCLAW_TEST_RAG_PYTHON) {
    const { load } = await import("../test/load.mjs");
    const { HudClient } = await load("src/client/hud.ts");
    const c = new HudClient(fixture.url, fixture.installationId);
    await c.connect();
    await c.upload(
      "extension-proof.md",
      Buffer.from("# Fixture\nThe maintenance window is violet Thursday.\n"),
      "customer",
    );
    const until = Date.now() + 150000;
    let ready = false;
    while (Date.now() < until) {
      const data = await c.request(
        "GET",
        "/api/rag/documents",
        undefined,
        90000,
      );
      if (
        data.documents.some(
          (d) =>
            d.title === "extension-proof.md" && d.ingest_status === "ready",
        )
      ) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    c.close();
    if (!ready) throw Error("RAG fixture indexing unavailable");
  }
  await runTests({
    version: process.env.VSCODE_VERSION || "1.102.0",
    ...(process.env.VSCODE_EXECUTABLE
      ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE }
      : {}),
    extensionDevelopmentPath: extension,
    extensionTestsPath: path.join(extension, "test/editor.cjs"),
    reuseMachineInstall: false,
    extensionTestsEnv: {
      NETCLAW_TEST_RAG_READY: process.env.NETCLAW_TEST_RAG_PYTHON ? "1" : "0",
      NETCLAW_TEST_URL: fixture.url,
      NETCLAW_TEST_ID: fixture.installationId,
      NETCLAW_TEST_REPORT: path.join(profile, "report.json"),
      NETCLAW_TEST_CDP_PORT: String(port),
      NETCLAW_TEST_PLAYWRIGHT: process.env.NETCLAW_TEST_PLAYWRIGHT || "",
    },
    launchArgs: [
      "--user-data-dir",
      path.join(profile, "user"),
      "--extensions-dir",
      path.join(profile, "extensions"),
      "--skip-welcome",
      "--skip-release-notes",
      "--disable-extensions",
      "--disable-telemetry",
      `--remote-debugging-port=${port}`,
    ],
  });
  console.log(
    JSON.stringify(
      {
        profile,
        hudFixture: fixture.root,
        report: JSON.parse(
          fs.readFileSync(path.join(profile, "report.json"), "utf8"),
        ),
        providerCalls: 0,
        syntheticGatewayCalls: fixture.calls.length,
      },
      null,
      2,
    ),
  );
} finally {
  await fixture.close();
}

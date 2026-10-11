const vscode = require("vscode"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
exports.run = async () => {
  const extension = vscode.extensions.getExtension("NetClaw.netclaw");
  assert.ok(extension);
  const api = await extension.activate();
  assert.ok(extension.isActive);
  const profile = await api.profiles.save({
    label: "Isolated unchanged NetClaw",
    url: process.env.NETCLAW_TEST_URL,
    installationId: process.env.NETCLAW_TEST_ID,
    harness: "openclaw",
  });
  await api.connection.connect(profile);
  assert.equal(api.connection.identity.installationId, profile.installationId);
  const runtime = await api.connection.request("GET", "/api/runtime");
  assert.equal(runtime.kind, "openclaw");
  await assert.rejects(
    api.connection.connect({
      ...profile,
      installationId: "33333333-3333-4333-8333-333333333333",
    }),
  );
  await api.connection.connect(profile);
  const checks = [
    "actual extension activation",
    "saved host-local profile",
    "unchanged HUD identity binding",
    "mismatched identity rejected",
  ];

  const registration = api.assistants.file("copilot");
  fs.mkdirSync(api.assistants.directory, { recursive: true, mode: 0o700 });
  const reg = {
    id: profile.id + "-copilot",
    client: "copilot",
    url: profile.url,
    installationId: profile.installationId,
    enabled: true,
    delegate: false,
  };
  fs.writeFileSync(registration, JSON.stringify(reg), { mode: 0o600 });
  const definitions = api.assistants.provideMcpServerDefinitions();
  assert.equal(definitions.length, 1);
  const definition = api.assistants.resolveMcpServerDefinition(definitions[0]);
  assert.ok(definition);
  assert.equal(definition.env.ELECTRON_RUN_AS_NODE, "1");
  const sdkRequire = require("node:module").createRequire(
    path.resolve(__dirname, "../../../ui/netclaw-visual/package.json"),
  );
  const { Client } = sdkRequire("@modelcontextprotocol/client"),
    { StdioClientTransport } = sdkRequire("@modelcontextprotocol/client/stdio");
  const mcp = new Client({ name: "editor-definition-check", version: "1.0.0" });
  try {
    const transport = new StdioClientTransport({
      command: definition.command,
      args: definition.args,
      env: { ...process.env, ...definition.env },
      stderr: "pipe",
    });
    transport.stderr?.on("data", (b) =>
      console.log("MCP test diagnostics: " + b.toString().slice(0, 1000)),
    );
    await mcp.connect(transport, { timeout: 10000 });
    const result = await mcp.callTool({
      name: "netclaw_status",
      arguments: {},
    });
    assert.equal(
      result.structuredContent.installationId,
      profile.installationId,
    );
    fs.writeFileSync(registration, JSON.stringify({ ...reg, enabled: false }));
    assert.equal(
      (await mcp.callTool({ name: "netclaw_status", arguments: {} })).isError,
      true,
    );
  } finally {
    await mcp.close();
  }
  assert.deepEqual(api.assistants.provideMcpServerDefinitions(), []);
  checks.push(
    "actual VS Code MCP definition launches bundled adapter with Electron; cached disable enforced (not Copilot inference)",
  );
  const screenshots = [];
  if (process.env.NETCLAW_TEST_PLAYWRIGHT) {
    const { chromium } = require(process.env.NETCLAW_TEST_PLAYWRIGHT);
    const browser = await chromium.connectOverCDP(
      "http://127.0.0.1:" + process.env.NETCLAW_TEST_CDP_PORT,
    );
    try {
      const page = browser
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().includes("workbench"));
      assert.ok(page);
      const frameFor = async (selector) => {
        const until = Date.now() + 20000;
        while (Date.now() < until) {
          for (const f of page.frames())
            if (
              await f
                .locator(selector)
                .count()
                .catch(() => 0)
            )
              return f;
          await new Promise((r) => setTimeout(r, 100));
        }
        throw Error("Webview missing " + selector);
      };
      const shot = async (name) => {
        const file = path.join(
          path.dirname(process.env.NETCLAW_TEST_REPORT),
          name + ".png",
        );
        await page.screenshot({ path: file });
        screenshots.push(file);
      };
      await vscode.commands.executeCommand("netclaw.openOverview");
      const overview = await frameFor(".data-view");
      await overview
        .locator("#content")
        .getByText(profile.installationId, { exact: true })
        .first()
        .waitFor();
      for (const theme of [
        "Default Dark Modern",
        "Default Light Modern",
        "Default High Contrast",
      ]) {
        await vscode.workspace
          .getConfiguration("workbench")
          .update("colorTheme", theme, vscode.ConfigurationTarget.Global);
        await overview.locator("#refresh").click();
        await shot(theme.replaceAll(" ", "-"));
      }
      checks.push("actual overview rendering in dark/light/high contrast");
      await vscode.workspace
        .getConfiguration("workbench")
        .update(
          "colorTheme",
          "Default Dark Modern",
          vscode.ConfigurationTarget.Global,
        );
      await vscode.commands.executeCommand("netclaw.openChat");
      const chat = await frameFor("#composer");
      await chat.locator("#prompt").fill("Synthetic fixture greeting");
      await chat.locator("#send").click();
      await chat
        .locator("#transcript")
        .getByText("Synthetic gateway reply", { exact: true })
        .waitFor({ timeout: 20000 });
      await shot("chat");
      checks.push(
        "actual composer -> unchanged HUD -> synthetic gateway -> rendered reply",
      );
      await vscode.commands.executeCommand("netclaw.openCanvas");
      const canvas = await frameFor(".canvas-lane");
      await canvas
        .getByRole("button", { name: "Branch this conversation" })
        .first()
        .click();
      await canvas.locator(".canvas-lane").nth(1).waitFor();
      await shot("canvas");
      checks.push("Canvas branch without dispatch");
      await vscode.commands.executeCommand("netclaw.openRag");
      const rag = await frameFor("#rag-search");
      if (process.env.NETCLAW_TEST_RAG_READY === "1") {
        await rag
          .locator("#status")
          .getByText("Collections refreshed.")
          .waitFor({ timeout: 90000 });
        await rag.locator("#query").fill("When is the maintenance window?");
        await rag.getByRole("button", { name: "Search knowledge" }).click();
        await rag.locator("#results pre").first().waitFor({ timeout: 90000 });
        assert.match(
          await rag.locator("#results").textContent(),
          /violet Thursday/,
        );
        checks.push("actual integrated RAG search and rendered citation");
      }
      await shot("rag");
      assert.match(await rag.locator("h1").textContent(), /RAG/);
      checks.push(
        "integrated RAG panel; backend may be unavailable in fixture",
      );
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await vscode.commands.executeCommand("netclaw.openAvatar");
      const avatar = await frameFor("#avatar-character");
      await avatar.locator("#avatar-character").selectOption("lobster");
      await shot("avatar");
      checks.push("bundled local Avatar");
      api.connection.disconnect();
      await avatar
        .locator("#status")
        .getByText(/Connection changed/)
        .waitFor();
      assert.equal(await avatar.locator("#send").isDisabled(), true);
      checks.push("target switch invalidates webview");
    } finally {
      await browser.close();
    }
  }
  await api.profiles.remove(profile.id);
  api.connection.disconnect();
  fs.writeFileSync(
    process.env.NETCLAW_TEST_REPORT,
    JSON.stringify(
      {
        editor: vscode.version,
        checks,
        screenshots,
        scope:
          "Actual desktop extension against unchanged HUD with synthetic local gateway; no real provider/device/WSL claim.",
      },
      null,
      2,
    ),
  );
};

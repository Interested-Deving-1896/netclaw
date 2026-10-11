import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(
    new URL("../../../ui/netclaw-visual/package.json", import.meta.url),
  ),
  { JSDOM } = require("jsdom");
function setup(kind, html) {
  const dom = new JSDOM(`<body data-view-id="v">${html}</body>`, {
      runScripts: "outside-only",
    }),
    w = dom.window,
    messages = [];
  let state;
  w.acquireVsCodeApi = () => ({
    getState: () => state,
    setState: (s) => {
      state = s;
    },
    postMessage: (m) => messages.push(m),
  });
  w.eval(fs.readFileSync("resources/messaging.js", "utf8"));
  w.eval(fs.readFileSync("resources/" + kind + ".js", "utf8"));
  return {
    dom,
    w,
    messages,
    state: () => state,
    receive: (m) =>
      w.dispatchEvent(
        new w.MessageEvent("message", { data: { viewId: "v", ...m } }),
      ),
  };
}
test("testbed drafts survive mode switches, never enter saved state and clear on invalidation", () => {
  const fields = [
    "id",
    "alias",
    "os",
    "type",
    "platform",
    "connection",
    "protocol",
    "host",
    "port",
  ];
  const buttons = [
    "add",
    "import",
    "export",
    "recover",
    "refresh",
    "cards-mode",
    "yaml-mode",
    "previous",
    "next",
    "cancel-form",
    "preview-yaml",
    "save",
    "cancel-review",
  ];
  const h = setup(
    "testbed",
    buttons.map((id) => `<button id="${id}"></button>`).join("") +
      '<p id="status"></p><p id="target"></p><p id="note"></p><section id="cards-pane"><input id="filter"><p id="count"></p><div id="devices"></div></section><form id="device-form"><h2 id="form-title"></h2>' +
      fields.map((id) => `<input id="device-${id}">`).join("") +
      '<select id="connection-choice"></select></form><section id="yaml-pane"><textarea id="yaml"></textarea></section><section id="review"><div id="review-body"></div></section>',
  );
  try {
    const $ = (id) => h.w.document.getElementById(id);
    h.receive({
      type: "snapshot",
      snapshot: {
        source: "/fixture",
        revision: "123",
        content: "devices: {}",
        devices: [],
        note: "Fixture",
      },
    });
    $("yaml").value = "new-secret-draft";
    $("yaml").dispatchEvent(new h.w.Event("input"));
    $("cards-mode").click();
    assert.equal(h.messages.at(-1).type, "switch");
    assert.equal(h.messages.at(-1).dirty, true);
    h.receive({ type: "switch", mode: "cards", discard: false });
    h.receive({ type: "switch", mode: "yaml", discard: false });
    assert.equal($("yaml").value, "new-secret-draft");
    assert.ok(!JSON.stringify(h.state()).includes("secret"));
    h.receive({
      type: "error",
      message: "Connection changed",
      invalidated: true,
    });
    h.receive({ type: "busy", busy: false });
    assert.equal($("yaml").value, "");
    assert.equal($("save").disabled, true);
  } finally {
    h.dom.window.close();
  }
});
test("MCP untouched blanks keep values, explicit replace/clear submit only intended keys and busy/invalidation fence controls", () => {
  const h = setup(
    "mcp",
    '<div id="status"></div><div id="summary"></div><div id="source"></div><button id="setup"></button><button id="environment" hidden></button><button id="reload"></button><form id="mcp-form"><div id="fields"></div><button id="save-fields">Save</button></form>',
  );
  try {
    const $ = (id) => h.w.document.getElementById(id);
    h.receive({
      type: "configuration",
      source: "/fixture",
      revision: "123",
      descriptor: {
        id: "fixture",
        name: "Fixture",
        notes: "Help",
        setupNote: "Review separately",
        fields: ["TOKEN", "URL"].map((key) => ({
          key,
          label: key,
          kind: key === "TOKEN" ? "secret" : "text",
          isSet: true,
          requirement: "unknown",
          sharedWith: [],
          help: "help",
        })),
      },
    });
    $("mcp-form").dispatchEvent(new h.w.Event("submit", { cancelable: true }));
    assert.deepEqual(Object.keys(h.messages.at(-1).changes), []);
    $("intent-TOKEN").value = "replace";
    $("intent-TOKEN").dispatchEvent(new h.w.Event("change"));
    $("value-TOKEN").value = "draft-secret";
    $("intent-URL").value = "clear";
    $("intent-URL").dispatchEvent(new h.w.Event("change"));
    $("mcp-form").dispatchEvent(new h.w.Event("submit", { cancelable: true }));
    assert.equal(h.messages.at(-1).changes.TOKEN.value, "draft-secret");
    assert.equal(h.messages.at(-1).changes.URL.intent, "clear");
    assert.ok(!JSON.stringify(h.state()).includes("draft-secret"));
    h.receive({ type: "busy", busy: true });
    assert.equal($("setup").disabled, true);
    h.receive({
      type: "error",
      message: "Connection changed",
      invalidated: true,
    });
    h.receive({ type: "busy", busy: false });
    assert.equal($("fields").textContent, "");
    assert.equal($("setup").disabled, true);
  } finally {
    h.dom.window.close();
  }
});

test("compatibility testbed displays searchable details, hides writes and enables editing only after a modern reload", () => {
  const buttons = [
    "add",
    "import",
    "export",
    "recover",
    "refresh",
    "cards-mode",
    "yaml-mode",
    "previous",
    "next",
    "cancel-form",
    "preview-yaml",
    "save",
    "cancel-review",
  ];
  const fields = [
    "id",
    "alias",
    "os",
    "type",
    "platform",
    "connection",
    "protocol",
    "host",
    "port",
  ];
  const h = setup(
    "testbed",
    buttons.map((id) => `<button id="${id}"></button>`).join("") +
      '<p id="status"></p><p id="target"></p><p id="note"></p><section id="cards-pane"><input id="filter"><p id="count"></p><div id="devices"></div></section><form id="device-form"><h2 id="form-title"></h2>' +
      fields.map((id) => `<input id="device-${id}">`).join("") +
      '<select id="connection-choice"></select></form><section id="yaml-pane"><textarea id="yaml"></textarea></section><section id="review"><div id="review-body"></div></section>',
  );
  try {
    const $ = (id) => h.w.document.getElementById(id);
    const devices = [
      {
        id: "fixture",
        alias: "<Router>",
        os: "iosxe",
        platform: "iol",
        connections: [
          { name: "ssh", protocol: "ssh", host: "192.0.2.9", port: 2222 },
        ],
      },
    ];
    h.receive({
      type: "snapshot",
      snapshot: {
        readOnly: true,
        source: "HUD inventory",
        observedAt: "fixture-time",
        note: "Restart the updated HUD for editing.",
        devices,
      },
    });
    h.receive({ type: "busy", busy: false });
    assert.match($("devices").textContent, /<Router>/);
    assert.match($("devices").textContent, /192.0.2.9:2222/);
    assert.equal($("devices").querySelectorAll("button").length, 0);
    assert.equal($("devices").querySelectorAll("router").length, 0);
    for (const id of [
      "add",
      "import",
      "export",
      "recover",
      "yaml-mode",
      "save",
    ])
      assert.equal($(id).disabled, true, id);
    assert.equal($("refresh").disabled, false);
    assert.equal($("filter").disabled, false);
    $("filter").value = "absent";
    $("filter").dispatchEvent(new h.w.Event("input"));
    assert.match($("count").textContent, /No devices match/);
    const before = h.messages.length;
    $("device-form").dispatchEvent(
      new h.w.Event("submit", { cancelable: true }),
    );
    assert.equal(h.messages.length, before);
    $("refresh").click();
    assert.equal(h.messages.at(-1).type, "refresh");
    h.receive({ type: "loading" });
    h.receive({ type: "error", message: "Read failed" });
    h.receive({ type: "busy", busy: false });
    assert.equal($("devices").textContent, "");
    assert.equal($("add").disabled, true);
    h.receive({
      type: "snapshot",
      snapshot: {
        source: "/fixture",
        revision: "123",
        content: "devices: {}",
        devices,
        note: "Editable",
      },
    });
    assert.equal($("add").disabled, false);
    assert.equal($("status").className, "");
  } finally {
    h.dom.window.close();
  }
});

test("MCP compatibility view exposes field presence and a separate environment review, never the unsupported form", () => {
  const h = setup(
    "mcp",
    '<p id="status"></p><div id="summary"></div><p id="source"></p><button id="setup"></button><button id="environment" hidden></button><button id="reload"></button><form id="mcp-form"><div id="fields"></div><button id="save-fields">Save</button></form>',
  );
  try {
    const $ = (id) => h.w.document.getElementById(id);
    h.receive({
      type: "configuration",
      readOnly: true,
      source: "fixture.env",
      observedAt: "fixture-time",
      descriptor: {
        id: "netbox",
        name: "NetBox",
        notes: "Help",
        setupNote: "Updated HUD needed for full forms",
        fields: [
          {
            key: "NETBOX_TOKEN",
            label: "Token",
            isSet: true,
            requirement: "unknown",
          },
        ],
      },
    });
    h.receive({ type: "busy", busy: false });
    assert.match($("fields").textContent, /NETBOX_TOKEN · Configured/);
    assert.equal($("fields").querySelectorAll("input,select").length, 0);
    assert.equal($("setup").disabled, true);
    assert.equal($("save-fields").hidden, true);
    assert.equal($("environment").hidden, false);
    const before = h.messages.length;
    $("mcp-form").dispatchEvent(new h.w.Event("submit", { cancelable: true }));
    assert.equal(h.messages.length, before);
    $("environment").click();
    assert.equal(h.messages.at(-1).type, "environment");
    h.receive({ type: "busy", busy: true });
    assert.equal($("environment").disabled, true);
    h.receive({
      type: "error",
      invalidated: true,
      message: "Connection changed",
    });
    h.receive({ type: "busy", busy: false });
    assert.equal($("environment").disabled, true);
    assert.equal($("fields").textContent, "");
  } finally {
    h.dom.window.close();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { serviceFixture, sourceRoot } from "./claw-fixture.mjs";
import { load } from "./load.mjs";
for (const kind of ["openclaw", "hermes"])
  test(`${kind}: real HUD discovery requires owned session and reveals no content or credentials`, async () => {
    const f = await serviceFixture(kind, { realHud: true });
    try {
      assert.equal((await fetch(f.url + "/api/hud/management")).status, 401);
      const { HudClient } = await load(
        new URL("../src/client/hud.ts", import.meta.url).pathname,
      );
      const client = new HudClient(f.url, f.target.installationId);
      await client.connect();
      await client.session();
      const d = await client.request("GET", "/api/hud/management");
      assert.equal(d.home, f.home);
      assert.equal(d.kind, kind);
      assert.equal(d.installationId, f.target.installationId);
      assert.equal(d.root, sourceRoot.replace(/\/$/, ""));
      assert.ok(
        !/token|password|fixture-not|Synthetic/.test(JSON.stringify(d)),
      );
      assert.equal(
        (
          await fetch(f.url + "/api/hud/management", {
            headers: { "x-netclaw-installation": "wrong" },
          })
        ).status,
        409,
      );
      client.close();
    } finally {
      await f.close();
    }
  });

import { build } from "esbuild";
await build({
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["vscode"],
  legalComments: "linked",
});
await build({
  entryPoints: ["src/assistants/server.ts"],
  outfile: "dist/assistant.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "linked",
});
await build({
  entryPoints: ["webview/avatar.jsx"],
  outfile: "dist/avatar.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "linked",
  define: { "process.env.NODE_ENV": '"production"' },
});
await build({
  entryPoints: ["webview/canvas.js"],
  outfile: "dist/canvas.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  legalComments: "linked",
});
await build({
  entryPoints: ["webview/topology.js"],
  outfile: "dist/topology.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "linked",
});

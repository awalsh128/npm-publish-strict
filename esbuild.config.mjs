// Bundles the action's entry point after tsc has emitted dist/, so dist/main.js carries @octokit
// and runs before any install. The other dist/*.js files stay as tsc wrote them (pin.js is run on
// its own by release.config.mjs).
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  allowOverwrite: true,
  // Some bundled CommonJS code calls require().
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});

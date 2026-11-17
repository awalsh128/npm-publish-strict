// Bundles the action's entry points after tsc has emitted dist/: main.js runs before any install,
// and semver.js is loaded on its own by release.config.mjs, so each carries its dependencies.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts", "src/semver.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  allowOverwrite: true,
  // Some bundled CommonJS code calls require().
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});

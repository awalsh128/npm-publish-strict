// The only producer of dist/ (tsc only typechecks): main.js runs before any install,
// and semver.js is loaded on its own by release.config.mjs, so each carries its dependencies.
import { rmSync } from "node:fs";
import { build } from "esbuild";

// Start empty so a removed entry point can't leave a stale bundle behind.
rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/main.ts", "src/semver.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  allowOverwrite: true,
  // Some bundled CommonJS code calls require().
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});

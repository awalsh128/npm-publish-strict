// The only producer of dist/ (tsc only typechecks): main.js runs before any install,
// and semver.js is loaded on its own by release.config.mjs, so each carries its dependencies.
import { rmSync } from "node:fs";
import { build } from "esbuild";

// Start empty so a removed entry point can't leave a stale bundle behind.
rmSync("dist", { recursive: true, force: true });

// @awalsh128/winston-github-actions 3.0.0 is ESM but still calls require("@actions/core") in a code path
// this action never reaches (it always passes the logger a core). @actions/core 3 is ESM-only and has no
// "require" export, so resolve that one call like an import. Drop this when the logger stops calling require.
const coreRequiredAsImport = {
  name: "core-required-as-import",
  setup(build) {
    build.onResolve({ filter: /^@actions\/core$/ }, (args) =>
      args.kind === "require-call"
        ? build.resolve(args.path, { kind: "import-statement", resolveDir: args.resolveDir })
        : undefined
    );
  },
};

await build({
  entryPoints: ["src/main.ts", "src/semver.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  allowOverwrite: true,
  plugins: [coreRequiredAsImport],
  // Some bundled CommonJS code calls require().
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});

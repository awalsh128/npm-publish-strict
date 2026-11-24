# Development

Written in TypeScript (`src/`) and bundled into `dist/` with esbuild.

```bash
npm ci
npm test             # typechecks and builds dist/, then runs the unit tests and end-to-end runs of dist/ on fixture repos
npm run build        # typechecks, then bundles src/ into dist/ with esbuild; commit dist/ with every src/ change
npm run format       # Prettier; a pre-commit hook formats staged files, and CI runs format:check
npm run docs:api     # API docs into docs/api (needs `npm ci --prefix scripts/ops/typedoc` once)
```

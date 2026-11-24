# AGENT PROFILE

You are an expert developer focused on TypeScript, DevOps, Git, and GitHub Actions.

## Always Apply

- Be accurate, not agreeable; push back on unsafe or non-compliant requests.
- Prefer minimal, reversible changes.
- Never claim success unless verified.
- Confirm before force-push, history rewrite, or release publishing.
- Never expose secrets in model-visible channels.
- MUST keep GitHub Actions pinned to full commit SHAs, in this repo and in what the `actions-pinned` check
  enforces.
- Use Conventional Commits. Format with Prettier (`npm run format`); a husky pre-commit hook formats staged
  files and CI runs `npm run format:check`.
- Never edit generated role files (`.claude/agents`, `.codex/agents`, `.github/agents`, `.agents/agents`);
  edit `.rulesync/subagents` and run `npx -y rulesync@43.4.1 generate`.

## Repo Layout

- `action.yml`: Node 24 action; `main` is `dist/main.js`.
- `src/`: TypeScript source. `checks.ts` holds the preconditions; `report.ts` renders fix steps; `release.ts`
  runs semantic-release.
- `dist/`: `main.js` and `semver.js`, bundled by esbuild (tsc only typechecks), committed because the action
  runs from it. MUST run `npm run build` and commit `dist/` with every `src/` change; CI fails when it is
  stale.
- `test/`: vitest. `fixtures.ts` builds throwaway consumer repos; `e2e.test.ts` runs `dist/main.js` on them;
  the `action-e2e` CI job moves each fixture into the workspace and runs the action from
  `./.action-under-test` on it. Add a scenario there for every new precondition. Name tests
  `<method> <conditions> <expected>`; no control flow in test bodies.
- `scripts/`: TypeScript run directly by Node in this repo's workflows (`promote-guard.ts` stops a major
  promotion until it is confirmed). Logic lives in pure modules tested under `test/`; they load `Version` from
  `dist/semver.js` because the workflows don't install.
- `release.config.mjs`: semantic-release config applied to consumer repos and to this repo's own releases
  (stays JavaScript; semantic-release loads it). Release notes are generated at release into the GitHub
  Release only; never commit them.
- `scripts/ops/typedoc/`: typedoc with its own lockfile and TypeScript 6 (typedoc doesn't support TypeScript 7
  yet), so this repo has the `docs:api` script `release.config.mjs` runs.
- Keep runtime `dependencies` at zero in `src/`; Node built-ins plus `@octokit/rest` for GitHub API calls and
  `@awalsh128/winston-github-actions` for logging (`src/logger.ts`), `semver` for version comparison,
  `@actions/artifact` for the `output-json` upload (loaded only when that input is on), and `@actions/core`
  for outputs and the OIDC token. `@actions/core` is a runtime dependency because `release.config.mjs` imports
  it after the action installs with `--omit=dev`; every package `release.config.mjs` imports must be one.
  Octokit, the logger, `@actions/artifact` and `semver` are devDependencies that `esbuild.config.mjs` bundles
  into `dist/main.js` and `dist/semver.js`, so the action runs before any install. semantic-release and its
  plugins are installed from this repo's lockfile at run time.
- Every precondition MUST return a `Failure` with `problem`, `automated` commands, `manual` steps with
  navigation, and `links`. Never fail with a bare message.
- Conventions enforced on consumers: the package at the repository root, tags `v${version}`, placeholder
  `version` `0.0.0-semantically-released`, no `CHANGELOG.md`, no release commits, `main` official / `staging`
  rc, npm trusted publishing (OIDC), typedoc via a `docs:api` script, Conventional Commits (from
  `baseline-commit` when set).
- `data/metadata.json` holds the fixed conventions (branches, tag format, docs script) for both the checks and
  `release.config.mjs`; action inputs read their defaults from `action.yml` only.
- `data/commit-types.json` is the only list of commit prefixes: it feeds the `commit-messages` check,
  semantic-release's `releaseRules` and the release notes sections. Change it there, never in the regex or the
  config.
- ASK FIRST before changing action inputs/outputs; consumers depend on them.

## Owned Dependency Chain

These `awalsh128` repos depend on each other. Check this chain before a breaking change, a major release, or a
Node, `@actions/core` or `winston` upgrade.

| Repo                                                 | Ships                                                                                            | Depends on (owned)                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `winston-host-adapters`                              | npm: `@awalsh128/winston-host`, `@awalsh128/winston-github-actions`, `@awalsh128/winston-vscode` | `winston-host` (same workspace); the `npm-publish-strict` action to publish |
| `npm-publish-strict`                                 | GitHub Action                                                                                    | `@awalsh128/winston-github-actions` (caret range, bundled into `dist/`)     |
| `ts-apt`                                             | npm: `ts-apt`                                                                                    | the `npm-publish-strict` action to publish                                  |
| `cache-apt-pkgs-action` (v2 on `staging-2`/`main-2`) | GitHub Action                                                                                    | `ts-apt` (exact version, or a full commit SHA while unreleased)             |

- Code flows `winston-host` → `winston-github-actions` → `npm-publish-strict`, and `ts-apt` →
  `cache-apt-pkgs-action`.
- Planned: `cache-apt-pkgs-action` switches its logger to `@awalsh128/winston-github-actions` (3.x, exact
  pin).
- MUST release the upstream change first, then bump the downstream pin in the change that uses it.
- MUST open a follow-up PR in each downstream repo for an upstream major release, and list them in the release
  PR.
- MUST keep these aligned across the chain: ESM, `@actions/core` 3.x (`winston-github-actions` declares it as
  a `^3` peer), `winston` 3.x and `winston-transport` 4.x.
- Node: the GitHub Actions side (`npm-publish-strict`, `ts-apt`, `cache-apt-pkgs-action`,
  `winston-github-actions`) targets Node `>=24` (`node24`). `winston-vscode` runs on the Node that VS Code
  bundles, so keep `winston-host` free of Node 24-only APIs.
- `npm-publish-strict` and `winston-host-adapters` form a loop. `winston-host-adapters` is held on
  `npm-publish-strict` `cee67e7` (commented `v1.1.0`, no tag) on purpose: its `publish.yml` releases each
  workspace package with per-package inputs (`working-directory`, `tag-format`, `commit-paths`,
  `pin-dependencies`, `dry-run`, `git-credentials`) that later versions removed. A newer action ignores an
  undeclared input with only a warning, so `dry-run: true` would release for real. Dependabot ignores that
  action there.
- NEVER bump `winston-host-adapters` to a newer `npm-publish-strict` until that action supports workspace
  packages again; a change in `npm-publish-strict` must not assume it can upgrade.
- `ts-apt` pins `npm-publish-strict` to a full commit SHA; make it one a release tag points at, with a
  matching `# vX.Y.Z` comment (`git tag --points-at <sha>`). Its current pin `6b3ccbe` (commented `v1.0.0`)
  has no tag; `v1.0.0` is `b778d3a`.
- This repo: a change to an action input or output is a change for `ts-apt`, which publishes with it
  (`winston-host-adapters` stays on `cee67e7`); bump `@awalsh128/winston-github-actions` here only after it is
  released.

## Branches And Releases

- `main` is the official release branch; `staging` is the release candidate branch.
- MUST keep `main` an ancestor of `staging`: update `main` only by fast-forward through `promote.yml`, never
  by PR merge or a release commit.
- Open PRs into `staging`. Direct pushes to `staging` and `main` are blocked by rulesets
  (`.github/rulesets/`).
- MUST gate every release by CI: candidates release from `ci.yml` after all jobs pass; official releases come
  only from `promote.yml`.
- Releases tag, create a GitHub Release, and attest the bundle; they never commit. They are off unless the
  repository variable `RELEASES_ENABLED` is `true`, which `release.yml` checks, so a merge to `staging` or a
  promote releases nothing until it is turned on. Setup: `docs/release-setup.md`.

## TypeScript Style

Before writing or reviewing TypeScript, load only the skill in `.agents/skills/` that the change touches:

- Type definitions, `any`/`unknown`, assertions, `readonly`, constants: `typescript-types`.
- Mutually exclusive fields or variant shapes: `typescript-discriminated-unions`.
- Function signatures, arguments, return types, purity: `typescript-functions`.
- `const`, enum alternatives, boolean flags, `null` vs `undefined`: `typescript-variables`.
- New exports, identifiers, comments, TSDoc: `typescript-naming`.
- Tests under `test/`: `typescript-tests`.

This file wins over the skills: keep `interface` for object types and name tests
`<method> <conditions> <expected>`, not `should ... when ...`. Don't rewrite existing code to match a skill.

## Subagents

You are the only agent that edits files. Subagents only read and report. Use the `delegate` skill before
starting one, and the `progress-notes` skill for work that spans sessions.

## More context

- `.out-of-scope/` lists ideas that were considered and rejected. Check it before proposing a feature.

## Single Source For All AI Tools

- Instructions: `AGENTS.md` only. `CLAUDE.md`, `.gemini/settings.json` and `.github/copilot-instructions.md`
  point to it; never add rules to them.
- Skills: `.agents/skills/` only. `.claude/skills` and `.github/skills` are symlinks to it.
- Roles: `.rulesync/subagents/` only. Every other role directory is generated output.

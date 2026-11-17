# AGENT PROFILE

You are an expert developer focused on TypeScript, DevOps, Git, and GitHub Actions.

## Always Apply

- Be accurate, not agreeable; push back on unsafe or non-compliant requests.
- Prefer minimal, reversible changes.
- Never claim success unless verified.
- Confirm before force-push, history rewrite, or release publishing.
- Never expose secrets in model-visible channels.
- MUST keep GitHub Actions pinned to full commit SHAs, in this repo and in what the `actions-pinned` check enforces.
- Use Conventional Commits.
- Never edit generated role files (`.claude/agents`, `.codex/agents`, `.github/agents`, `.agents/agents`); edit `.rulesync/subagents` and run `npx -y rulesync@43.4.1 generate`.

## Repo Layout

- `action.yml`: Node 24 action; `main` is `dist/main.js`.
- `src/`: TypeScript source. `checks.ts` holds the preconditions; `report.ts` renders fix steps; `release.ts` runs semantic-release.
- `dist/`: compiled output, committed because the action runs from it. MUST run `npm run build` and commit `dist/` with every `src/` change; CI fails when it is stale.
- `test/`: vitest. `fixtures.ts` builds throwaway consumer repos; `e2e.test.ts` runs `dist/main.js` on them; the `action-e2e` CI job moves each fixture into the workspace and runs the action from `./.action-under-test` on it. Add a scenario there for every new precondition. Name tests `<method> <conditions> <expected>`; no control flow in test bodies.
- `release.config.mjs`: semantic-release config applied to consumer repos (stays JavaScript; semantic-release loads it).
- Keep runtime `dependencies` at zero in `src/`; Node built-ins plus `@octokit/rest` for GitHub API calls and `@awalsh128/winston-github-actions` for logging (`src/logger.ts`), `semver` for version comparison, and `@actions/core` for outputs and the OIDC token. Octokit, the logger and `semver` are devDependencies that `esbuild.config.mjs` bundles into `dist/main.js` and `dist/semver.js`, so the action runs before any install. semantic-release and its plugins are installed from this repo's lockfile at run time.
- Every precondition MUST return a `Failure` with `problem`, `automated` commands, `manual` steps with navigation, and `links`. Never fail with a bare message.
- Conventions enforced on consumers: the package at the repository root, tags `v${version}`, placeholder `version` `0.0.0-semantically-released`, no `CHANGELOG.md`, no release commits, `main` official / `staging` rc, npm trusted publishing (OIDC), typedoc via a `docs:api` script, Conventional Commits (from `baseline-commit` when set).
- `data/metadata.json` holds the fixed conventions (branches, tag format, docs script and directory) for both the checks and `release.config.mjs`; action inputs read their defaults from `action.yml` only.
- `data/commit-types.json` is the only list of commit prefixes: it feeds the `commits` check, semantic-release's `releaseRules` and the release notes sections. Change it there, never in the regex or the config.
- ASK FIRST before changing action inputs/outputs; consumers depend on them.

## Branches And Releases

- `main` is the official release branch; `staging` is the release candidate branch.
- MUST keep `main` an ancestor of `staging`: update `main` only by fast-forward through `promote.yml`, never by PR merge or a release commit.
- Open PRs into `staging`. Direct pushes to `staging` and `main` are blocked by rulesets (`.github/rulesets/`).
- MUST gate every release by CI: candidates release from `ci.yml` after all jobs pass; official releases come only from `promote.yml`.
- Releases tag, create a GitHub Release, and attest the bundle; they never commit. Setup: `docs/release-setup.md`.

## TypeScript Style

Before writing or reviewing TypeScript, load only the skill in `.agents/skills/` that the change touches:

- Type definitions, `any`/`unknown`, assertions, `readonly`, constants: `typescript-types`.
- Mutually exclusive fields or variant shapes: `typescript-discriminated-unions`.
- Function signatures, arguments, return types, purity: `typescript-functions`.
- `const`, enum alternatives, boolean flags, `null` vs `undefined`: `typescript-variables`.
- New exports, identifiers, comments, TSDoc: `typescript-naming`.
- Tests under `test/`: `typescript-tests`.

This file wins over the skills: keep `interface` for object types and name tests `<method> <conditions> <expected>`, not `should ... when ...`. Don't rewrite existing code to match a skill.

## Subagents

You are the only agent that edits files. Subagents only read and report. Use the `delegate` skill
before starting one, and the `progress-notes` skill for work that spans sessions.

## More context

- `.out-of-scope/` lists ideas that were considered and rejected. Check it before proposing a
  feature.

## Single Source For All AI Tools

- Instructions: `AGENTS.md` only. `CLAUDE.md`, `.gemini/settings.json` and `.github/copilot-instructions.md` point to it; never add rules to them.
- Skills: `.agents/skills/` only. `.claude/skills` and `.github/skills` are symlinks to it.
- Roles: `.rulesync/subagents/` only. Every other role directory is generated output.

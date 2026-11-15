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
- `test/`: vitest. Name tests `<method> <conditions> <expected>`; no control flow in test bodies.
- `release.config.mjs`: semantic-release config applied to consumer repos (stays JavaScript; semantic-release loads it).
- Keep runtime dependencies at zero in `src/`; Node built-ins only. semantic-release and its plugins are installed from this repo's lockfile at run time.
- Every precondition MUST return a `Failure` with `problem`, `automated` commands, `manual` steps with navigation, and `links`. Never fail with a bare message.
- Conventions enforced on consumers: placeholder `version` `0.0.0-semantically-released`, no `CHANGELOG.md`, no release commits, `main` official / `staging` rc, npm trusted publishing (OIDC), typedoc via a `docs:api` script, Conventional Commits (from `baseline-commit` when set).
- ASK FIRST before changing action inputs/outputs; consumers depend on them.

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

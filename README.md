# NPM Publish Strict GitHub Action

<p align="center"><img src="assets/logo.svg" alt="npm-publish-strict logo" width="96"></p>

An opinionated NPM publish GitHub Action. It runs [semantic-release](https://semantic-release.gitbook.io)
(Conventional Commits), builds API docs with typedoc, and publishes to npm with trusted publishing
(OIDC, no token). When the repository doesn't meet its preconditions, it stops before releasing and
tells you exactly how to fix each one.

Written in TypeScript (`src/`), compiled to `dist/`.

## Preconditions

Every run checks these, and reports all failures at once, not just the first:

| Check | Why |
| --- | --- |
| Runs on `main` (official release, npm publish) or `staging` (`-rc.N` candidate, tag and GitHub prerelease only) | Predictable release flow |
| `package.json` and `package-lock.json` exist | Reproducible installs |
| `version` is the placeholder `0.0.0-semantically-released` | Releases never commit |
| `repository` matches the GitHub repository running the workflow | npm provenance and trusted publishing |
| The docs script (default `docs:api`) exists; `files` is set; the package isn't `private` | Docs are built before tagging; contents are predictable |
| No `CHANGELOG.md` | Tags and GitHub Releases are the history |
| Every `uses:` under `.github/` is pinned to a full commit SHA | Supply-chain safety |
| Full git history (`fetch-depth: 0`) | semantic-release reads every commit and tag |
| Commits follow Conventional Commits (from `baseline-commit`, when set) | Versions are computed from commit messages |
| On the release branch: the repository is public (npm only issues provenance for public repos), job has `id-token: write`, npm is 11.5.1 or later, and npm accepts this workflow as a **trusted publisher** of the package | Publishing without a token |

The trusted publisher check does what `npm publish` does: it exchanges the job's OIDC token with npm.
So it catches a typo in the workflow filename or repository, which npm never validates when you save
the setting.

### When a check fails

The job log and the job summary give, for each failed check:

- **Automated:** commands to run in a clone of the repository (`npm pkg set ...`, `npm trust github ...`,
  `npx pin-github-action ...`), then commit and push.
- **Manual:** numbered steps with navigation, for example *Click your avatar > Packages > your-package >
  Settings > Trusted Publisher*, with the exact values to enter, and YAML snippets for workflow edits.
- **Read more:** links to the relevant npm and GitHub documentation.

Then **verify the fix** without releasing anything: run the action with `mode: check`. It runs the
same checks, including the live npm trusted publisher exchange, and does nothing else.

```yaml
- uses: awalsh128/npm-publish-strict@<sha>
  with:
    mode: check
```

## Adopting Conventional Commits on an existing repository

Commits are checked against Conventional Commits. If your history predates the convention, set
`baseline-commit` to the last commit that doesn't follow it, or to the current `HEAD`:

```yaml
  with:
    baseline-commit: 1a2b3c4d5e6f
```

Commits up to and including the baseline are ignored by the commit check, the version calculation and
the release notes. Only newer commits count. The baseline must be an ancestor of the commit being
released, and the action checks that too.

## Usage

```yaml
# .github/workflows/release.yml
on:
  push:
    branches: [main, staging]
permissions: {}
jobs:
  release:
    runs-on: ubuntu-24.04
    permissions:
      contents: write      # tags and GitHub Releases
      id-token: write      # npm trusted publishing
      issues: write
      pull-requests: write
    steps:
      - uses: actions/checkout@<sha>
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@<sha>
        with:
          node-version: 24
          cache: npm
      - id: release
        uses: awalsh128/npm-publish-strict@<sha>
```

Configure the package's trusted publisher on npmjs.com for this workflow file (or run
`npm trust github <package> --file release.yml --repo <owner>/<repo>`).

| Input | Default | Purpose |
| --- | --- | --- |
| `mode` | `release` | `check` only verifies preconditions |
| `dry-run` | `false` | Release without tagging or publishing |
| `baseline-commit` | | Enforce and version only commits after this SHA |
| `working-directory` | `.` | Directory of the package, for repositories with several |
| `tag-format` | `v${version}` | semantic-release tag format; give each package its own |
| `commit-paths` | | Paths whose commits version the package; empty counts every commit |
| `pin-dependencies` | | `name=tag-format` lines for internal dependencies to publish at real versions |
| `docs-script` | `docs:api` | npm script running typedoc |
| `docs-dir` | `docs/api` | Docs output directory |
| `release-branch` | `main` | Official release branch |
| `candidate-branch` | `staging` | Release candidate branch |
| `git-credentials` | | `user:token` for pushing tags (e.g. a GitHub App token) |
| `github-token` | `github.token` | Token for the GitHub API |

### Several packages in one repository

Run the action once per package, in dependency order, with its own `working-directory`, `tag-format`
and `commit-paths`. Each package then versions independently from the commits that touch it, and is
tagged and released on its own. The lockfile and workflows stay at the repository root.

```yaml
- name: Release the base package
  id: base
  uses: awalsh128/npm-publish-strict@<sha>
  with:
    working-directory: packages/base
    tag-format: base-v${version}
    commit-paths: packages/base

- name: Release the adapter
  uses: awalsh128/npm-publish-strict@<sha>
  with:
    working-directory: packages/adapter
    tag-format: adapter-v${version}
    commit-paths: packages/adapter
    pin-dependencies: "@scope/base=base-v${version}"
```

- Keep each internal dependency at the placeholder version in the repository. `pin-dependencies`
  replaces it, in the CI workspace only, with `^` and the latest released version found in the
  dependency's tags (stable ones on the release branch, candidates included on the candidate branch).
  The release fails, naming the dependency, when it has no release yet.
- A package that already has `v*` tags keeps them by leaving `tag-format` at its default.
- Install and `npm ci` run from the directory holding `package-lock.json`, found by walking up from
  the package.
- `version` is the package's version for that step; give each step an `id`.

Outputs: `version` (empty when nothing was released), `docs-dir` (for deploying Pages in a follow-up job), and `failed-checks` (comma-separated ids of failed preconditions, empty when all pass).

## Supply chain: attestations

- **Your package:** every npm publish from the release branch runs with provenance on
  (`NPM_CONFIG_PROVENANCE=true`), so npm attaches a signed Sigstore attestation linking the package
  to your repository, commit and workflow. Consumers verify with `npm audit signatures`. Publishing
  from a private repository is refused by a precondition, because npm can't issue provenance for it.
- **This action:** each release uploads `npm-publish-strict-<tag>.tar.gz` (the manifest, compiled
  `dist/`, and release config) with a GitHub build-provenance attestation. Verify the bytes you run:

  ```bash
  gh release download <tag> -R awalsh128/npm-publish-strict -p '*.tar.gz'
  gh attestation verify npm-publish-strict-<tag>.tar.gz -R awalsh128/npm-publish-strict
  ```

  Pin the action by commit SHA, as the examples do; the attestation covers the same tagged commit.

## Development

```bash
npm ci
npm run typecheck && npm test   # unit tests, then end-to-end runs of dist/ on fixture repos
npm run build        # compiles src/ to dist/; commit dist/ with every src/ change
```

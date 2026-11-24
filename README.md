<p align="center">
  <img src="assets/logo.svg" alt="NPM Publish Strict logo" width="128" height="128">
</p>

<h1 align="center">NPM Publish Strict</h1>

<p align="center">
  An opinionated GitHub Action that releases an npm package with semantic-release and trusted publishing.
</p>

<p align="center">
  <a href="https://github.com/awalsh128/npm-publish-strict/releases"><img src="https://img.shields.io/github/v/release/awalsh128/npm-publish-strict?label=release" alt="GitHub release"></a>
  <a href="https://github.com/awalsh128/npm-publish-strict/actions/workflows/release.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/awalsh128/npm-publish-strict/release.yml?label=main&branch=main" alt="main release"></a>
  <a href="https://github.com/awalsh128/npm-publish-strict/actions/workflows/ci.yml?query=branch%3Astaging"><img src="https://img.shields.io/github/actions/workflow/status/awalsh128/npm-publish-strict/ci.yml?label=staging&branch=staging" alt="staging CI"></a>
</p>

An opinionated GitHub Action that releases an npm package. It runs
[semantic-release](https://semantic-release.gitbook.io) (Conventional Commits), builds API docs with typedoc,
and publishes to npm with trusted publishing (OIDC, no token). When the repository doesn't meet its
preconditions, it stops before releasing and tells you exactly how to fix each one.

- 🏷️ Versions, tags and GitHub Releases come from Conventional Commits through semantic-release
- 🔐 Publishes to npm with trusted publishing, so the repository stores no token
- ✅ Checks the preconditions first and reports every failure at once, with the steps to fix each
- 🔎 `mode: check` verifies the setup, including the live npm trusted publisher exchange, without releasing
- 🛡️ Provenance on the package, and a build attestation on each release of this action

<!-- prettier-ignore -->
<p align="center">
  <a href="https://github.com/sponsors/awalsh128"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-db61a2?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor awalsh128"></a>
</p>

<p align="center">
  Free and open source, and kept up by one person.<br />
  If it saves you time, <a href="https://github.com/sponsors/awalsh128">sponsor it monthly</a> or
  <a href="https://github.com/sponsors/awalsh128?frequency=one-time">leave a small one-time tip</a>. Every bit
  helps.
</p>

<!-- prettier-ignore -->
> [!IMPORTANT]
> The release job needs `contents: write` and `id-token: write`, full git history (`fetch-depth: 0`) and a
> public repository (npm only issues provenance for public repos).

## Quick Start

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
      contents: write # tags and GitHub Releases
      id-token: write # npm trusted publishing
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
        uses: awalsh128/npm-publish-strict@c70700da8bf385050717a1749a938d39dbd3987d # v1.1.0
```

Configure the package's trusted publisher on npmjs.com for this workflow file (or run
`npm trust github <package> --file release.yml --repo <owner>/<repo>`).

| Input             | Required | Default        | Purpose                                                                                               |
| ----------------- | -------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `mode`            | no       | `release`      | `check` only verifies preconditions, from any branch                                                  |
| `bump`            | no       | `auto`         | Smallest bump to release (`patch`, `minor`, `major`); commits can raise it                            |
| `dry-run`         | no       | `false`        | `true` releases nothing: the checks run and semantic-release logs the version and notes it would make |
| `baseline-commit` | no       |                | Enforce and version only commits after this SHA                                                       |
| `github-token`    | no       | `github.token` | Token for the GitHub API and for pushing the release tag                                              |

The rest is convention, not configuration: the package is at the repository root, tags are `v${version}`,
`main` releases and `staging` cuts candidates, and `npm run docs:api` writes the docs to `docs/api`. If a tag
ruleset blocks `github-token` from creating tags, set `GIT_CREDENTIALS` (`x-access-token:<token>`, for example
from a GitHub App) in the step's `env`.

## Outputs

A later step or job can use them through the step's `id` (`steps.release.outputs.version`). Release outputs
are empty when nothing was released.

| Output          | Meaning                                                          |
| --------------- | ---------------------------------------------------------------- |
| `failed-checks` | Comma-separated ids of failed preconditions; empty when all pass |
| `released`      | `true` when a release was cut                                    |
| `version`       | Released version                                                 |
| `tag`           | Git tag (`v<version>`)                                           |
| `package-name`  | Name from the package's `package.json`                           |
| `prerelease`    | `true` for a release candidate, `false` for an official release  |
| `release-type`  | `major`, `minor` or `patch`                                      |
| `git-head`      | Commit SHA released                                              |
| `published`     | `true` when published to npm (official releases only)            |
| `npm-url`       | npm page of the published version                                |
| `release-url`   | GitHub Release URL                                               |
| `release-notes` | Markdown release notes                                           |

## Preconditions

Every run checks these, and reports all failures at once, not just the first. The branch check applies only in
`release` mode, and the last row only on the release branch:

| Check                                                                                                                                                                                                                     | Why                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| In `release` mode, runs on `main` (official release, npm publish) or `staging` (`-rc.N` candidate, tag and GitHub prerelease only)                                                                                        | Predictable release flow                                |
| `package.json` and `package-lock.json` exist                                                                                                                                                                              | Reproducible installs                                   |
| `version` is the placeholder `0.0.0-semantically-released`                                                                                                                                                                | Releases never commit                                   |
| `repository` matches the GitHub repository running the workflow                                                                                                                                                           | npm provenance and trusted publishing                   |
| The `docs:api` script exists; `files` is set; the package isn't `private`                                                                                                                                                 | Docs are built before tagging; contents are predictable |
| No `CHANGELOG.md`                                                                                                                                                                                                         | Tags and GitHub Releases are the history                |
| Every `uses:` under `.github/` is pinned to a full commit SHA                                                                                                                                                             | Supply-chain safety                                     |
| Full git history (`fetch-depth: 0`)                                                                                                                                                                                       | semantic-release reads every commit and tag             |
| Commits follow Conventional Commits (from `baseline-commit`, when set)                                                                                                                                                    | Versions are computed from commit messages              |
| On the release branch: the repository is public (npm only issues provenance for public repos), job has `id-token: write`, npm is 11.5.1 or later, and npm accepts this workflow as a **trusted publisher** of the package | Publishing without a token                              |

The trusted publisher check does what `npm publish` does: it exchanges the job's OIDC token with npm. So it
catches a typo in the workflow filename or repository, which npm never validates when you save the setting.

### When a check fails

The job log and the job summary give, for each failed check:

- **Automated:** commands to run in a clone of the repository (`npm pkg set ...`, `npm trust github ...`,
  `npx pin-github-action ...`), then commit and push.
- **Manual:** numbered steps with navigation, for example _Click your avatar > Packages > your-package >
  Settings > Trusted Publisher_, with the exact values to enter, and YAML snippets for workflow edits.
- **Read more:** links to the relevant npm and GitHub documentation.

Then **verify the fix** without releasing anything: run the action with `mode: check`. It runs the same
checks, including the live npm trusted publisher exchange, and does nothing else.

```yaml
- uses: awalsh128/npm-publish-strict@c70700da8bf385050717a1749a938d39dbd3987d # v1.1.0
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

Commits up to and including the baseline are ignored by the commit check, the version calculation and the
release notes. Only newer commits count. The baseline must be an ancestor of the commit being released, and
the action checks that too.

## Supply chain: attestations

- **Your package:** every npm publish from the release branch runs with provenance on
  (`NPM_CONFIG_PROVENANCE=true`), so npm attaches a signed Sigstore attestation linking the package to your
  repository, commit and workflow. Consumers verify with `npm audit signatures`. Publishing from a private
  repository is refused by a precondition, because npm can't issue provenance for it.
- **This action:** each release uploads `npm-publish-strict-<tag>.tar.gz` (the manifest, compiled `dist/`, and
  release config) with a GitHub build-provenance attestation. Verify the bytes you run:

  ```bash
  gh release download <tag> -R awalsh128/npm-publish-strict -p '*.tar.gz'
  gh attestation verify npm-publish-strict-<tag>.tar.gz -R awalsh128/npm-publish-strict
  ```

  Pin the action by commit SHA, as the examples do; the attestation covers the same tagged commit.

## Development

Written in TypeScript (`src/`) and bundled into `dist/` with esbuild.

```bash
npm ci
npm test             # typechecks and builds dist/, then runs the unit tests and end-to-end runs of dist/ on fixture repos
npm run build        # typechecks, then bundles src/ into dist/ with esbuild; commit dist/ with every src/ change
npm run format       # Prettier; a pre-commit hook formats staged files, and CI runs format:check
npm run docs:api     # API docs into docs/api (needs `npm ci --prefix scripts/ops/typedoc` once)
```

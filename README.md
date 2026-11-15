# npm-publish-strict-action

<p align="center"><img src="assets/logo.svg" alt="npm-publish-strict-action logo" width="96"></p>

An opinionated NPM publish GitHub Action. It runs [semantic-release](https://semantic-release.gitbook.io)
(Conventional Commits), builds API docs with typedoc, and publishes to npm with trusted publishing
(OIDC, no token). It fails fast when the repository breaks the conventions from
[ts-apt](https://github.com/awalsh128/ts-apt).

## Conventions enforced

- Runs only on `main` (official release, npm publish) or `staging` (`-rc.N` candidate, tag and GitHub prerelease only).
- `package.json` keeps the placeholder version `0.0.0-semantically-released`, has `repository`, `files` and the docs script, and is not private.
- No `CHANGELOG.md` and no release commits; tags and GitHub Releases are the history.
- Every `uses:` under `.github/` is pinned to a full commit SHA.
- Dependency install scripts never run in the release job.

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
    environment: release
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
      - id: release
        uses: awalsh128/npm-publish-strict-action@<sha>
```

Configure the package's trusted publisher on npmjs.com to this workflow file.

| Input | Default | Purpose |
| --- | --- | --- |
| `dry-run` | `false` | Release without tagging or publishing |
| `node-version` | `24` | Node.js version |
| `docs-script` | `docs:api` | npm script running typedoc |
| `docs-dir` | `docs/api` | Docs output directory |
| `release-branch` | `main` | Official release branch |
| `candidate-branch` | `staging` | Release candidate branch |
| `git-credentials` | | `user:token` for pushing tags (e.g. a GitHub App token) |

Outputs: `version` (empty when nothing was released) and `docs-dir`, for deploying Pages in a follow-up job.

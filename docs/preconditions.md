# Preconditions

Every run checks these, and reports all failures at once, not just the first. The branch check applies only in
`release` mode, and the last item only on the release branch:

- In `release` mode, runs on `main` (official release, npm publish) or `staging` (`-rc.N` candidate, tag and
  GitHub prerelease only). _Why:_ Predictable release flow.
- `package.json` and `package-lock.json` exist. _Why:_ Reproducible installs.
- `version` is the placeholder `0.0.0-semantically-released`. _Why:_ Releases never commit.
- `repository` matches the GitHub repository running the workflow. _Why:_ npm provenance and trusted
  publishing.
- The `docs:api` script exists; `files` is set; the package isn't `private`. _Why:_ Docs are built before
  tagging; contents are predictable.
- No `CHANGELOG.md`. _Why:_ Tags and GitHub Releases are the history.
- Every `uses:` under `.github/` is pinned to a full commit SHA. _Why:_ Supply-chain safety.
- Full git history (`fetch-depth: 0`). _Why:_ semantic-release reads every commit and tag.
- Commits follow Conventional Commits (from `baseline-commit`, when set). _Why:_ Versions are computed from
  commit messages.
- On the release branch: the repository is public (npm only issues provenance for public repos), job has
  `id-token: write`, npm is 11.5.1 or later, and npm accepts this workflow as a **trusted publisher** of the
  package. _Why:_ Publishing without a token.

The trusted publisher check does what `npm publish` does: it exchanges the job's OIDC token with npm. So it
catches a typo in the workflow filename or repository, which npm never validates when you save the setting.

## When a check fails

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

# Release setup

Branches and flow:

```text
feature branch --PR (CI must pass)--> staging --promote.yml (fast-forward)--> main
                                         |                                     |
                                  release candidate                     official release
                                  (v1.2.0-rc.N)                           (v1.2.0)
```

- `staging` takes pull requests only. Every push to it that passes CI cuts a release candidate
  (`ci.yml` calls `release.yml`).
- `main` never gets commits of its own. The **Promote staging to main** workflow fast-forwards it to
  the latest CI-passed `staging` commit and starts the official release.
- Only the Octo STS GitHub App can push `main` and create `v*` tags (rulesets in
  `.github/rulesets/`). Its tokens are minted per job under the trust policies in
  `.github/chainguard/`, so no private key is stored.

## One-time setup

1. [Install the Octo STS app](https://github.com/apps/octo-sts/installations/new) on this
   repository.
2. Add it as a bypass actor (Always) to the `main` and `release tags` rulesets (App ID `801323`).
3. Restrict the `release` environment to `main` and `staging`.

Octo STS reads the trust policies from the default branch (`main`), so a policy change takes effect
when it is promoted. `promote.sts.yaml` matches `promote.yml` on `staging`; `release.sts.yaml`
matches `release.yml` on `main` or `staging`. Both match the owner and repository IDs in the OIDC
subject, so a repository that later takes this name doesn't match.

## Day to day

1. Branch from `staging`, open a PR into `staging`. `build-and-test`, `action-e2e` and `pr-title` must pass.
2. Merging cuts a release candidate. PRs are squash-merged with the PR title and description as the
   commit message, so the title (linted by `pr-title`) decides the release type: `feat!:` or a
   `BREAKING CHANGE:` line in the description makes it major.
3. To release: Actions > **Promote staging to main** > Run workflow (on `staging`). A major release
   stops unless `confirm-major` is set to its version (e.g. `2.0.0`); there is no maintenance branch,
   so after it `v1` gets no more fixes.

## Reapplying the rulesets

```bash
for f in staging main release-tags; do
  gh api repos/OWNER/REPO/rulesets --method POST --input .github/rulesets/$f.json
done
```

Use `PUT repos/OWNER/REPO/rulesets/ID` to update an existing one.

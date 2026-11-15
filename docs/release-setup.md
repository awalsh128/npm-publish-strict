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
- Only the release-bot GitHub App can push `main` and create `v*` tags (rulesets in
  `.github/rulesets/`).

## One-time setup

The rulesets and environments are applied from this repository; the app is the manual part.

### 1. Create the release-bot GitHub App (manual)

1. Go to https://github.com/settings/apps/new (for an organization: Settings > Developer settings >
   GitHub Apps > New GitHub App).
2. Give it a name, any Homepage URL, and untick Webhook > Active.
3. Repository permissions: **Contents: Read and write**.
4. Create it. On its page copy the **Client ID**, then under Private keys choose **Generate a private key**.
5. Sidebar > Install App > install it on this repository only.

### 2. Add its credentials

1. Repository variable (Settings > Secrets and variables > Actions > Variables):
   `RELEASE_BOT_APP_ID` = the Client ID.
2. Environment secret `RELEASE_BOT_PK` = the whole `.pem` file, in **both** environments
   (Settings > Environments > `release` / `promote` > Add environment secret).

The `release` environment can be used from `main` and `staging`; `promote` from `staging` only.

### 3. Let the app through the rulesets

Settings > Rules > Rulesets > `main`, then again for `release tags` > Bypass list > Add bypass >
the app > **Always**. Then remove the *Repository admin* bypass entry if you want only the app to
move `main` and create tags.

Or with the CLI (replace `APP_ID` with the numeric App ID from the app's About section):

```bash
gh api repos/OWNER/REPO/rulesets --jq '.[] | select(.name=="main" or .name=="release tags") | .id'
# for each id:
gh api -X PUT repos/OWNER/REPO/rulesets/ID --input updated.json   # bypass_actors: [{"actor_id": APP_ID, "actor_type": "Integration", "bypass_mode": "always"}]
```

## Day to day

1. Branch from `staging`, open a PR into `staging`. `build-and-test` and `action-e2e` must pass.
2. Merging cuts a release candidate.
3. To release: Actions > **Promote staging to main** > Run workflow (on `staging`).

If a run fails because the app is not configured, its summary lists these steps.
Dependabot PRs target `staging`.

## Reapplying the rulesets

```bash
for f in staging main release-tags; do
  gh api repos/OWNER/REPO/rulesets --method POST --input .github/rulesets/$f.json
done
```

Use `PUT repos/OWNER/REPO/rulesets/ID` to update an existing one.

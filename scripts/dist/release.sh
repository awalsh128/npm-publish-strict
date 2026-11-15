#!/usr/bin/env bash
# Runs semantic-release with the bundled config; docs are built in its prepare step.
set -euo pipefail

bin="$GITHUB_ACTION_PATH/node_modules/.bin/semantic-release"
args=(--extends "$GITHUB_ACTION_PATH/release.config.mjs")
[[ "${DRY_RUN:-false}" == "true" ]] && args+=(--dry-run)

# Only the official release branch publishes to npm.
if [[ "$GITHUB_REF_NAME" == "$RELEASE_BRANCH" && "${DRY_RUN:-false}" != "true" ]]; then
  export NPM_PUBLISH=true
fi
export BRANCH_RELEASE="$RELEASE_BRANCH" BRANCH_CANDIDATE="$CANDIDATE_BRANCH"

"$bin" "${args[@]}"

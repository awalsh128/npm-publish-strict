#!/usr/bin/env bash
# Fails fast when the consumer repository breaks the conventions this action enforces.
set -euo pipefail

fail() { echo "::error::$1"; exit 1; }

branch="${GITHUB_REF_NAME:?}"
[[ "$branch" == "$RELEASE_BRANCH" || "$branch" == "$CANDIDATE_BRANCH" ]] ||
  fail "Releases run only from '$RELEASE_BRANCH' or '$CANDIDATE_BRANCH', not '$branch'."

[[ -f package.json && -f package-lock.json ]] ||
  fail "package.json and package-lock.json are required."

node "$(dirname "${BASH_SOURCE[0]}")/validate-package.mjs" "$DOCS_SCRIPT"

# Every 'uses:' in the consumer's workflows and local actions must be pinned to a full commit SHA.
unpinned=$(grep -rEn '^\s*-?\s*uses:\s*[^./[:space:]][^@[:space:]]*@' .github 2>/dev/null |
  grep -Ev '@[0-9a-f]{40}(\s|$)' || true)
[[ -z "$unpinned" ]] || fail $'GitHub Actions must be pinned to full commit SHAs:\n'"$unpinned"

[[ ! -f CHANGELOG.md ]] ||
  fail "CHANGELOG.md is not allowed: tags and GitHub Releases are the version history."
echo "Repository conventions OK."

#!/usr/bin/env bash
# Fails fast when the consumer repository breaks the conventions this action enforces.
set -euo pipefail

fail() { echo "::error::$1"; exit 1; }

branch="${GITHUB_REF_NAME:?}"
[[ "$branch" == "$RELEASE_BRANCH" || "$branch" == "$CANDIDATE_BRANCH" ]] ||
  fail "Releases run only from '$RELEASE_BRANCH' or '$CANDIDATE_BRANCH', not '$branch'."

[[ -f package.json && -f package-lock.json ]] ||
  fail "package.json and package-lock.json are required."

node --input-type=module - "$DOCS_SCRIPT" <<'JS'
import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const docsScript = process.argv[2];
const errors = [];
if (pkg.version !== "0.0.0-semantically-released")
  errors.push(`"version" must be the placeholder "0.0.0-semantically-released" (releases never commit).`);
if (!pkg.repository) errors.push(`"repository" is required for npm trusted publishing and provenance.`);
if (!pkg.scripts?.[docsScript]) errors.push(`npm script "${docsScript}" (typedoc) is required.`);
if (!pkg.files?.length) errors.push(`"files" must list what is packaged.`);
if (pkg.private) errors.push(`"private" must not be true.`);
if (errors.length) {
  for (const e of errors) console.log(`::error::package.json: ${e}`);
  process.exit(1);
}
JS

# Every 'uses:' in the consumer's workflows and local actions must be pinned to a full commit SHA.
unpinned=$(grep -rEn '^\s*-?\s*uses:\s*[^./[:space:]][^@[:space:]]*@' .github 2>/dev/null |
  grep -Ev '@[0-9a-f]{40}(\s|$)' || true)
[[ -z "$unpinned" ]] || fail $'GitHub Actions must be pinned to full commit SHAs:\n'"$unpinned"

[[ ! -f CHANGELOG.md ]] ||
  fail "CHANGELOG.md is not allowed: tags and GitHub Releases are the version history."
echo "Repository conventions OK."

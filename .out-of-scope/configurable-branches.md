# Configurable release branches

Inputs to rename the official release branch (`main`) and the release candidate branch (`staging`).
Earlier versions shipped these as the `release-branch` and `candidate-branch` inputs.

## Why this is out of scope

The branch names are a convention the action enforces, like the placeholder version and the missing
`CHANGELOG.md`. A repository without `staging` already works: semantic-release ignores configured
branches that don't exist, so it only cuts official releases. A repository on `master` renames it
(GitHub keeps redirects and retargets open pull requests). Check mode skips the branch check, so
fixes can be verified from any branch without these inputs.

Adding an optional input later is a non-breaking minor release, so bring this back only when a
consumer has a concrete need. If it does come back, default the inputs to `main` and `staging` and
pass them to `release.config.mjs` through the environment instead of `data/metadata.json`.

## Prior requests

- None; removed while trimming the inputs for a simpler first release.

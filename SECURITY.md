# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub:
[Report a vulnerability](https://github.com/awalsh128/npm-publish-strict/security/advisories/new). Don't open
a public issue or pull request for one.

This action runs in release workflows that can hold tokens for tagging and npm publishing, so these are in
scope:

- Anything that lets a pull request, a fork, a commit message or a repository file run code with those tokens,
  or expose them.
- A way to make the action pass its preconditions when they aren't met, or to release when it shouldn't.
- Problems with the release bundle or its build-provenance attestation.

## Supported versions

Only the latest release receives fixes. The action is versioned with semantic versioning; pin it by commit SHA
and update through Dependabot, as the README shows.

## Verifying a release

Each release attaches `npm-publish-strict-<tag>.tar.gz` with a build-provenance attestation:

```bash
gh release download <tag> -R awalsh128/npm-publish-strict -p '*.tar.gz'
gh attestation verify npm-publish-strict-<tag>.tar.gz -R awalsh128/npm-publish-strict
```

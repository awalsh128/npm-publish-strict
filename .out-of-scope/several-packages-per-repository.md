# Several packages per repository

Releasing more than one package from a repository: a `working-directory` per package, per-package tag formats,
versioning each package from the commits under its paths, and pinning internal dependencies to their latest
released versions. Earlier versions shipped this as the `working-directory`, `tag-format`, `commit-paths` and
`pin-dependencies` inputs.

## Why this is out of scope

It multiplied the inputs and code paths for a case most consumers don't have. The action assumes the
repository holds one package at its root, tagged `v${version}`. Release each package from its own repository,
or use a monorepo release tool for workspaces.

## Prior requests

- None; removed while trimming the inputs for a simpler first release.

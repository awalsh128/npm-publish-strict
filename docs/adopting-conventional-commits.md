# Adopting Conventional Commits on an existing repository

Commits are checked against [Conventional Commits](https://www.conventionalcommits.org). If your history
predates the convention, set `baseline-commit` to the last commit that doesn't follow it, or to the current
`HEAD`:

```yaml
with:
  baseline-commit: 1a2b3c4d5e6f
```

Commits up to and including the baseline are ignored by the commit check, the version calculation and the
release notes. Only newer commits count. The baseline must be an ancestor of the commit being released, and
the action checks that too.

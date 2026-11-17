## Verify the fixes

Every item above is re-checked by the same code on each run, including the npm trusted publisher (an OIDC token exchange with npm). To confirm your fixes without releasing anything, run the action in check mode:

```yaml
- uses: awalsh128/npm-publish-strict@<sha>
  with:
    mode: check
```

Or re-run this workflow (Actions > {{workflow}} > Re-run failed jobs). Nothing is tagged or published until every check passes.

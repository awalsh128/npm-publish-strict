// Releases create a tag, a GitHub Release, and (official releases only) an npm package. They never
// commit, so the release branch only ever fast-forwards and package.json keeps its placeholder version.
const docsScript = process.env.DOCS_SCRIPT ?? "docs:api";
const docsDir = process.env.DOCS_DIR ?? "docs/api";

export default {
  branches: [
    { name: process.env.BRANCH_CANDIDATE ?? "staging", prerelease: "rc" },
    process.env.BRANCH_RELEASE ?? "main",
  ],
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    // Trusted publishing (OIDC): no npm token. Candidates and dry runs skip the publish.
    ["@semantic-release/npm", { npmPublish: process.env.NPM_PUBLISH === "true" }],
    [
      "@semantic-release/exec",
      {
        // Runs after the npm plugin so the docs carry the released version; a docs failure stops the
        // release before it is tagged.
        prepareCmd: `npm run -s ${docsScript} -- --gitRevision v\${nextRelease.version}`,
        successCmd: `if [ -n "$GITHUB_OUTPUT" ]; then echo "version=\${nextRelease.version}" >> "$GITHUB_OUTPUT"; echo "docs-dir=${docsDir}" >> "$GITHUB_OUTPUT"; fi`,
      },
    ],
    "@semantic-release/github",
  ],
};

// Releases create a tag, a GitHub Release, and (official releases only) an npm package. They never
// commit, so the release branch only ever fast-forwards and package.json keeps its placeholder version.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";

const docsScript = process.env.DOCS_SCRIPT ?? "docs:api";
const docsDir = process.env.DOCS_DIR ?? "docs/api";
const baseline = process.env.BASELINE_COMMIT?.trim();
// A repository with several packages tags each with its own format and versions each from the
// commits that touch its paths (COMMIT_PATHS, one per line; empty means every commit counts).
const tagFormat = process.env.TAG_FORMAT?.trim() || "v${version}";
const commitPaths = (process.env.COMMIT_PATHS ?? "").split("\n").map((p) => p.trim().replace(/\/+$/, "")).filter(Boolean);
const hasPins = Boolean(process.env.PIN_DEPENDENCIES?.trim());
const touchesPaths = (hash) =>
  execFileSync("git", ["show", "--name-only", "--format=", hash], { encoding: "utf8" })
    .split("\n")
    .some((file) => commitPaths.some((path) => file === path || file.startsWith(`${path}/`)));

// With a baseline, commits it already contains are invisible to versioning and release notes, so
// history from before Conventional Commits were adopted can't produce a wrong bump.
const afterBaseline = baseline
  ? new Set(execFileSync("git", ["rev-list", `${baseline}..HEAD`], { encoding: "utf8" }).split("\n").filter(Boolean))
  : null;
const visible = (context) => ({
  ...context,
  commits: context.commits
    .filter((c) => !afterBaseline || afterBaseline.has(c.hash))
    .filter((c) => commitPaths.length === 0 || touchesPaths(c.hash)),
});
const preset = { preset: "conventionalcommits" };

export default {
  tagFormat,
  branches: [
    { name: process.env.BRANCH_CANDIDATE ?? "staging", prerelease: "rc" },
    process.env.BRANCH_RELEASE ?? "main",
  ],
  plugins: [
    { analyzeCommits: (config, context) => analyzeCommits({ ...preset, ...config }, visible(context)) },
    { generateNotes: (config, context) => generateNotes({ ...preset, ...config }, visible(context)) },
    // Internal dependencies are pinned before the npm plugin prepares the package.
    ...(hasPins ? [["@semantic-release/exec", { prepareCmd: `node "${fileURLToPath(new URL("dist/pin.js", import.meta.url))}"` }]] : []),
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

// Releases create a tag, a GitHub Release, and (official releases only) an npm package. They never
// commit, so the release branch only ever fast-forwards and package.json keeps its placeholder version.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setOutput } from "@actions/core";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
import { Version } from "./dist/semver.js";

// The conventions (branches, tag format, docs script and directory) are shared with the action's checks.
const { tagFormat, releaseBranch, candidateBranch, docsScript } = JSON.parse(
  readFileSync(new URL("data/metadata.json", import.meta.url), "utf8")
);
const baseline = process.env.BASELINE_COMMIT?.trim();

// The action's `bump` input: release at least this bump, even when no commit calls for a release.
const BUMP_RANK = { patch: 1, minor: 2, major: 3 };
const forcedBump = Object.hasOwn(BUMP_RANK, process.env.RELEASE_BUMP ?? "") ? process.env.RELEASE_BUMP : null;
const atLeastForced = (type) => {
  if (!forcedBump) return type;
  return (BUMP_RANK[type] ?? 0) >= BUMP_RANK[forcedBump] ? type : forcedBump;
};

// With a baseline, commits it already contains are invisible to versioning and release notes, so
// history from before Conventional Commits were adopted can't produce a wrong bump.
const afterBaseline = baseline
  ? new Set(
      execFileSync("git", ["rev-list", `${baseline}..HEAD`], { encoding: "utf8" })
        .split("\n")
        .filter(Boolean)
    )
  : null;
const visible = (context) => ({
  ...context,
  commits: context.commits.filter((c) => !afterBaseline || afterBaseline.has(c.hash)),
});
// The commit types (and what each releases) come from data/commit-types.json, which the action's own
// commit check reads too, so the two can't disagree about what a valid prefix is.
const commitTypes = JSON.parse(readFileSync(new URL("data/commit-types.json", import.meta.url), "utf8"));
const releaseRules = commitTypes.filter((t) => t.release).map(({ type, release }) => ({ type, release }));
const preset = {
  preset: "conventionalcommits",
  presetConfig: { types: commitTypes.map(({ release, ...type }) => type) },
};

// What a release surfaces to the workflow, as if the package had been released by its own action.
// core.setOutput writes the GITHUB_OUTPUT file protocol, including multi-line values like the notes.
const writeOutputs = (outputs) => {
  for (const [name, value] of Object.entries(outputs)) setOutput(name, String(value ?? ""));
};
const releaseOutputs = ({ cwd, nextRelease, releases = [] }) => {
  const name = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")).name;
  const urlOf = (pattern) =>
    releases.find((r) => pattern.test(`${r.pluginName ?? ""} ${r.name ?? ""}`))?.url ?? "";
  return {
    released: "true",
    version: nextRelease.version,
    tag: nextRelease.gitTag,
    "package-name": name,
    prerelease: Version.parse(nextRelease.version)?.isPrerelease ? "true" : "false",
    "release-type": nextRelease.type,
    "git-head": nextRelease.gitHead,
    published: urlOf(/npm/i) ? "true" : "false",
    "npm-url": urlOf(/npm/i),
    "release-url": urlOf(/github/i),
    "release-notes": nextRelease.notes ?? "",
  };
};

export default {
  tagFormat,
  branches: [{ name: candidateBranch, prerelease: "rc" }, releaseBranch],
  plugins: [
    {
      analyzeCommits: async (config, context) => {
        const type = await analyzeCommits({ ...preset, releaseRules, ...config }, visible(context));
        const released = atLeastForced(type);
        if (released !== type) context.logger.log(`The bump input raises this release to ${released}.`);
        return released;
      },
    },
    { generateNotes: (config, context) => generateNotes({ ...preset, ...config }, visible(context)) },
    // Trusted publishing (OIDC): no npm token. Candidates and dry runs skip the publish.
    ["@semantic-release/npm", { npmPublish: process.env.NPM_PUBLISH === "true" }],
    {
      // Runs after the npm plugin so the docs carry the released version; a docs failure stops the
      // release before it is tagged.
      prepare: (_config, { cwd, nextRelease }) => {
        execFileSync("npm", ["run", "-s", docsScript, "--", "--gitRevision", nextRelease.gitTag], {
          cwd,
          stdio: "inherit",
        });
      },
    },
    "@semantic-release/github",
    {
      success: (_config, context) => {
        if (process.env.GITHUB_OUTPUT) writeOutputs(releaseOutputs(context));
      },
    },
  ],
};

import { readJson } from "./data.js";

interface Metadata {
  npmRegistry: string;
  minNpm: string;
  placeholderVersion: string;
  releaseBranch: string;
  candidateBranch: string;
  docsScript: string;
}

const metadata = readJson<Metadata>("metadata.json");

export const NPM_REGISTRY: string = metadata.npmRegistry;

/** The version package.json keeps; semantic-release writes the real one in CI. */
export const PLACEHOLDER_VERSION: string = metadata.placeholderVersion;

/** Branch that cuts official releases and publishes to npm. */
export const RELEASE_BRANCH: string = metadata.releaseBranch;

/** Branch that cuts release candidates (`-rc.N`): a tag and GitHub prerelease only. */
export const CANDIDATE_BRANCH: string = metadata.candidateBranch;

/** npm script that builds the API docs before a release is tagged. */
export const DOCS_SCRIPT: string = metadata.docsScript;

/** First npm version that supports trusted publishing. */
export const MIN_NPM: string = metadata.minNpm;

/**
 * One commit type, from data/commit-types.json. That file is the only list of types: it drives this
 * action's commit check and, through release.config.mjs, semantic-release's version bumps and
 * release notes sections.
 */
export interface CommitType {
  type: string;
  section: string;
  /** Version bump the type causes; absent when it causes no release. */
  release?: "major" | "minor" | "patch";
  /** Left out of the release notes. */
  hidden?: boolean;
}

export const COMMIT_TYPES: readonly CommitType[] = readJson<CommitType[]>("commit-types.json");

/** Header of a Conventional Commit: `type(scope)!: description`. */
export const CONVENTIONAL_HEADER = new RegExp(
  `^(${COMMIT_TYPES.map((t) => t.type).join("|")})(\\([^)\\r\\n]+\\))?!?: \\S`
);

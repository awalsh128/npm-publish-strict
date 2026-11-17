import { readJson } from "./data.js";
const metadata = readJson("metadata.json");
export const NPM_REGISTRY = metadata.npmRegistry;
/** The version package.json keeps; semantic-release writes the real one in CI. */
export const PLACEHOLDER_VERSION = metadata.placeholderVersion;
/** Branch that cuts official releases and publishes to npm. */
export const RELEASE_BRANCH = metadata.releaseBranch;
/** Branch that cuts release candidates (`-rc.N`): a tag and GitHub prerelease only. */
export const CANDIDATE_BRANCH = metadata.candidateBranch;
/** npm script that builds the API docs before a release is tagged. */
export const DOCS_SCRIPT = metadata.docsScript;
/** First npm version that supports trusted publishing. */
export const MIN_NPM = metadata.minNpm;
export const COMMIT_TYPES = readJson("commit-types.json");
/** Header of a Conventional Commit: `type(scope)!: description`. */
export const CONVENTIONAL_HEADER = new RegExp(`^(${COMMIT_TYPES.map((t) => t.type).join("|")})(\\([^)\\r\\n]+\\))?!?: \\S`);

import { readJson } from "./data.js";
const metadata = readJson("metadata.json");
export const NPM_REGISTRY = metadata.npmRegistry;
/** First npm version that supports trusted publishing. */
export const MIN_NPM = metadata.minNpm;
export const COMMIT_TYPES = readJson("commit-types.json");
/** Header of a Conventional Commit: `type(scope)!: description`. */
export const CONVENTIONAL_HEADER = new RegExp(`^(${COMMIT_TYPES.map((t) => t.type).join("|")})(\\([^)\\r\\n]+\\))?!?: \\S`);

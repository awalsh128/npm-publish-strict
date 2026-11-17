import { readJson } from "./data.js";

interface Metadata {
  npmRegistry: string;
  minNpm: number[];
  conventionalHeader: string;
}

const metadata = readJson<Metadata>("metadata.json");

export const NPM_REGISTRY: string = metadata.npmRegistry;

/** First npm version that supports trusted publishing. */
export const MIN_NPM: readonly number[] = metadata.minNpm;

/** Header of a Conventional Commit: `type(scope)!: description`. */
export const CONVENTIONAL_HEADER = new RegExp(metadata.conventionalHeader);

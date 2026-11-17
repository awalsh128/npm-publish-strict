import { readJson } from "./data.js";
import type { Link } from "./types.js";

type LinkKey =
  | "trustedPublishers"
  | "npmTrust"
  | "oidcPermissions"
  | "pinning"
  | "checkout"
  | "setupNode"
  | "packageJson"
  | "typedoc"
  | "provenance"
  | "conventionalCommits"
  | "commitlint"
  | "semanticRelease";

/** Documentation links attached to the failures of the checks; the data is in data/links.json. */
export const LINKS = readJson<Record<LinkKey, Link>>("links.json");

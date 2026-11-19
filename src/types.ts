/** A command a user can run locally to fix a failed precondition. */
export interface AutomatedStep {
  label: string;
  command: string;
}

/** A documentation link shown with a failure. */
export interface Link {
  text: string;
  url: string;
}

/**
 * How to fix one failed precondition.
 *
 * Manual steps that start with two spaces are rendered as a code block (YAML) under the previous
 * numbered step instead of being numbered themselves.
 */
export interface Failure {
  /** One sentence on what is wrong. */
  problem: string;
  /** Bullet list: offending files, values, server messages. */
  details?: string[];
  /** Commands that fix it, run in a clone of the repository. */
  automated: AutomatedStep[];
  /** Steps a script cannot do, with navigation ("Go to X > Y > Z"). */
  manual: string[];
  links: Link[];
}

/** Result of the npm OIDC token exchange used to verify a trusted publisher. */
export interface ExchangeResult {
  ok: boolean;
  status: number;
  message: string;
}

/** The subset of package.json this action reads. */
export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  files?: string[];
  repository?: string | { url?: string };
  scripts?: Record<string, string>;
}

/** `release` checks preconditions, then releases; `check` only checks them. */
export type Mode = "release" | "check";

/** A commit's full hash and subject line. */
export interface CommitSummary {
  hash: string;
  subject: string;
}

/** Everything a check may look at; the network and process boundaries are injectable for tests. */
export interface Context {
  env: Record<string, string | undefined>;
  /** Root of the repository, which holds the package, its lockfile and the workflows. */
  cwd: string;
  mode: Mode;
  branch: string | undefined;
  repository: string | undefined;
  /** Commit from which Conventional Commits are enforced and releases are analyzed; unset means all history. */
  baseline: string | undefined;
  pkg: PackageJson | null;
  /** Output of `git rev-parse --is-shallow-repository`, or null when not a git checkout. */
  shallow: () => boolean | null;
  npmVersion: () => string | null;
  /** Full SHA of HEAD, or null when it can't be read. */
  head: () => string | null;
  /** True when `ref` names a commit in this repository. */
  commitExists: (ref: string) => boolean;
  /** True when `ref` is an ancestor of (or equal to) HEAD. */
  isAncestor: (ref: string) => boolean;
  /** Non-merge commits reachable from HEAD but not from `baseline` (all history when unset), newest first. */
  commits: (baseline?: string) => CommitSummary[];
  /** Exchanges this job's GitHub OIDC token for an npm token, as `npm publish` does. */
  exchangeNpmToken: (name: string) => Promise<ExchangeResult>;
  /** True when the GitHub repository is public, false when private, null when it can't be determined. */
  repoIsPublic: () => Promise<boolean | null>;
  /** True/false when the registry answers, null when it can't be reached. */
  packageExists: (name: string) => Promise<boolean | null>;
}

export type CheckOutcome = Failure | null;

/**
 * A precondition. `run` returns null when satisfied. Every run of the action, and `mode: check`,
 * re-runs the same checks, so a fix is verified by the code that found the problem.
 */
export interface Check {
  id: string;
  title: string;
  /** Skip the check when this returns false. */
  applies?: (ctx: Context) => boolean;
  run: (ctx: Context) => CheckOutcome | Promise<CheckOutcome>;
}

export interface CheckResult {
  check: Check;
  /** Null when the check passed. */
  failure: Failure | null;
}

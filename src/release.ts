import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RELEASE_BRANCH } from "./constants.js";
import type { Mode } from "./types.js";

type Env = Record<string, string | undefined>;

/** The smallest bump the `bump` input forces; `auto` forces none. */
export type Bump = "auto" | "patch" | "minor" | "major";

const BUMPS: readonly Bump[] = ["auto", "patch", "minor", "major"];

/** Inputs of the action, read from the INPUT_* variables the runner sets from action.yml. */
export interface Inputs {
  mode: Mode;
  baselineCommit: string;
  /** The smallest version bump to release, whatever the commits call for. */
  bump: Bump;
  /** True to run semantic-release with `--dry-run`: nothing is tagged or published. */
  dryRun: boolean;
  /** True to upload every output of the run as one JSON file in a workflow artifact. */
  outputJson: boolean;
  githubToken: string;
}

/**
 * The directory holding action.yml, release.config.mjs and this action's package.json.
 * GITHUB_ACTION_PATH is only set for composite actions, so find it from the compiled file
 * (dist/main.js, which bundles this module) instead.
 */
export function actionRoot(moduleUrl: string = import.meta.url): string {
  return join(dirname(fileURLToPath(moduleUrl)), "..");
}

/** Reads the inputs. Their defaults live in action.yml only: the runner always sets every INPUT_* variable. */
export function readInputs(env: Env): Inputs {
  const input = (name: string): string => (env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
  const mode = input("mode");
  if (mode !== "release" && mode !== "check")
    throw new Error(`Input 'mode' must be 'release' or 'check', not '${mode}'.`);
  const bump = BUMPS.find((b) => b === input("bump"));
  if (!bump) throw new Error(`Input 'bump' must be one of ${BUMPS.join(", ")}, not '${input("bump")}'.`);
  const flag = (name: string): boolean => {
    const value = input(name);
    if (value !== "true" && value !== "false")
      throw new Error(`Input '${name}' must be 'true' or 'false', not '${value}'.`);
    return value === "true";
  };
  return {
    mode,
    baselineCommit: input("baseline-commit"),
    bump,
    dryRun: flag("dry-run"),
    outputJson: flag("output-json"),
    githubToken: input("github-token"),
  };
}

/** Arguments for semantic-release: this action's config, and `--dry-run` when nothing may be released. */
export function semanticReleaseArgs(inputs: Inputs, actionPath: string): string[] {
  return ["--extends", join(actionPath, "release.config.mjs"), ...(inputs.dryRun ? ["--dry-run"] : [])];
}

function run(command: string, args: string[], options: { cwd?: string; env?: Env } = {}): void {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0)
    throw new Error(`'${command} ${args.join(" ")}' failed with exit code ${result.status}.`);
}

/** Environment for semantic-release and the plugins it runs (release.config.mjs reads part of it). */
export function releaseEnv(inputs: Inputs, env: Env): Env {
  // Only the official release branch publishes to npm.
  const publish = env.GITHUB_REF_NAME === RELEASE_BRANCH;
  return {
    ...env,
    BASELINE_COMMIT: inputs.baselineCommit,
    // release.config.mjs releases at least this bump; 'auto' leaves it to the commits.
    RELEASE_BUMP: inputs.bump,
    NPM_PUBLISH: publish ? "true" : "false",
    // Always sign: npm attaches a Sigstore provenance attestation of the source repo and workflow.
    ...(publish ? { NPM_CONFIG_PROVENANCE: "true" } : {}),
    // semantic-release pushes the tag with this token unless the step sets GIT_CREDENTIALS.
    GITHUB_TOKEN: inputs.githubToken,
  };
}

/**
 * Flags of the install that puts this action's runtime dependencies in place. ci.yml checks that
 * release.config.mjs loads from the same install (test/release.test.ts keeps the two in step).
 */
export const RUNTIME_INSTALL_FLAGS = ["--ignore-scripts", "--omit=dev", "--omit=optional"] as const;

/**
 * Installs dependencies and runs semantic-release with the bundled config.
 * Install scripts stay off: this job can mint npm (OIDC) and GitHub credentials, so a dependency's
 * install script must never run with them. semantic-release is not bundled into dist/ because it
 * loads its plugins dynamically, so it is installed from this action's own lockfile instead, without
 * dev or optional packages (cosmiconfig optionally peers on TypeScript, about 30 MB, which it doesn't need).
 */
export function release(inputs: Inputs, env: Env, actionPath: string, cwd: string): void {
  run("npm", ["ci", "--ignore-scripts"], { cwd });
  run("npm", ["ci", ...RUNTIME_INSTALL_FLAGS, "--prefix", actionPath], { cwd });
  run(join(actionPath, "node_modules", ".bin", "semantic-release"), semanticReleaseArgs(inputs, actionPath), {
    cwd,
    env: releaseEnv(inputs, env),
  });
}

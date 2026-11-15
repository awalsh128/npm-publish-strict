import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Env = Record<string, string | undefined>;

/** Inputs of the action, read from the INPUT_* variables the runner sets. */
export interface Inputs {
  mode: "release" | "check";
  dryRun: boolean;
  docsScript: string;
  docsDir: string;
  releaseBranch: string;
  candidateBranch: string;
  baselineCommit: string;
  gitCredentials: string;
  githubToken: string;
}

/**
 * The directory holding action.yml, release.config.mjs and this action's package.json.
 * GITHUB_ACTION_PATH is only set for composite actions, so find it from the compiled file
 * (dist/release.js) instead.
 */
export function actionRoot(moduleUrl: string = import.meta.url): string {
  return join(dirname(fileURLToPath(moduleUrl)), "..");
}

export function readInputs(env: Env): Inputs {
  const input = (name: string, fallback = ""): string => (env[`INPUT_${name.toUpperCase()}`] ?? "").trim() || fallback;
  const mode = input("mode", "release");
  if (mode !== "release" && mode !== "check") throw new Error(`Input 'mode' must be 'release' or 'check', not '${mode}'.`);
  const githubToken = input("github-token");
  return {
    mode,
    dryRun: input("dry-run", "false") === "true",
    docsScript: input("docs-script", "docs:api"),
    docsDir: input("docs-dir", "docs/api"),
    releaseBranch: input("release-branch", "main"),
    candidateBranch: input("candidate-branch", "staging"),
    baselineCommit: input("baseline-commit"),
    githubToken,
    gitCredentials: input("git-credentials") || `x-access-token:${githubToken}`,
  };
}

function run(command: string, args: string[], options: { cwd?: string; env?: Env } = {}): void {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`'${command} ${args.join(" ")}' failed with exit code ${result.status}.`);
}

/**
 * Installs dependencies and runs semantic-release with the bundled config.
 * Install scripts stay off: this job can mint npm (OIDC) and GitHub credentials, so a dependency's
 * install script must never run with them. semantic-release is not bundled into dist/ because it
 * loads its plugins dynamically, so it is installed from this action's own lockfile instead.
 */
export function release(inputs: Inputs, env: Env, actionPath: string, cwd: string): void {
  run("npm", ["ci", "--ignore-scripts"], { cwd });
  run("npm", ["ci", "--ignore-scripts", "--omit=dev", "--prefix", actionPath], { cwd });

  const args = ["--extends", join(actionPath, "release.config.mjs")];
  if (inputs.dryRun) args.push("--dry-run");

  run(join(actionPath, "node_modules", ".bin", "semantic-release"), args, {
    cwd,
    env: {
      ...env,
      DOCS_SCRIPT: inputs.docsScript,
      DOCS_DIR: inputs.docsDir,
      BASELINE_COMMIT: inputs.baselineCommit,
      BRANCH_RELEASE: inputs.releaseBranch,
      BRANCH_CANDIDATE: inputs.candidateBranch,
      // Only the official release branch publishes to npm; dry runs never do.
      NPM_PUBLISH: env.GITHUB_REF_NAME === inputs.releaseBranch && !inputs.dryRun ? "true" : "false",
      GITHUB_TOKEN: inputs.githubToken,
      GIT_CREDENTIALS: inputs.gitCredentials,
    },
  });
}

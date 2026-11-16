import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePins, splitList } from "./workspace.js";
/**
 * The directory holding action.yml, release.config.mjs and this action's package.json.
 * GITHUB_ACTION_PATH is only set for composite actions, so find it from the compiled file
 * (dist/release.js) instead.
 */
export function actionRoot(moduleUrl = import.meta.url) {
    return join(dirname(fileURLToPath(moduleUrl)), "..");
}
export function readInputs(env) {
    // Fail on a malformed pin list before any check or install runs.
    parsePins(env["INPUT_PIN-DEPENDENCIES"] ?? "");
    const input = (name, fallback = "") => (env[`INPUT_${name.toUpperCase()}`] ?? "").trim() || fallback;
    const mode = input("mode", "release");
    if (mode !== "release" && mode !== "check")
        throw new Error(`Input 'mode' must be 'release' or 'check', not '${mode}'.`);
    const githubToken = input("github-token");
    return {
        mode,
        dryRun: input("dry-run", "false") === "true",
        docsScript: input("docs-script", "docs:api"),
        docsDir: input("docs-dir", "docs/api"),
        releaseBranch: input("release-branch", "main"),
        candidateBranch: input("candidate-branch", "staging"),
        baselineCommit: input("baseline-commit"),
        workingDirectory: input("working-directory", "."),
        tagFormat: input("tag-format", "v${version}"),
        commitPaths: splitList(input("commit-paths")),
        pinDependencies: input("pin-dependencies"),
        githubToken,
        gitCredentials: input("git-credentials") || `x-access-token:${githubToken}`,
    };
}
function run(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: "inherit", ...options });
    if (result.status !== 0)
        throw new Error(`'${command} ${args.join(" ")}' failed with exit code ${result.status}.`);
}
/** Environment for semantic-release and the plugins it runs (release.config.mjs reads most of it). */
export function releaseEnv(inputs, env) {
    const publish = env.GITHUB_REF_NAME === inputs.releaseBranch && !inputs.dryRun;
    return {
        ...env,
        DOCS_SCRIPT: inputs.docsScript,
        DOCS_DIR: inputs.docsDir,
        BASELINE_COMMIT: inputs.baselineCommit,
        TAG_FORMAT: inputs.tagFormat,
        COMMIT_PATHS: inputs.commitPaths.join("\n"),
        PIN_DEPENDENCIES: inputs.pinDependencies,
        BRANCH_RELEASE: inputs.releaseBranch,
        BRANCH_CANDIDATE: inputs.candidateBranch,
        // Only the official release branch publishes to npm; dry runs never do.
        NPM_PUBLISH: publish ? "true" : "false",
        // Always sign: npm attaches a Sigstore provenance attestation of the source repo and workflow.
        ...(publish ? { NPM_CONFIG_PROVENANCE: "true" } : {}),
        GITHUB_TOKEN: inputs.githubToken,
        GIT_CREDENTIALS: inputs.gitCredentials,
    };
}
/**
 * Installs dependencies and runs semantic-release with the bundled config.
 * Install scripts stay off: this job can mint npm (OIDC) and GitHub credentials, so a dependency's
 * install script must never run with them. semantic-release is not bundled into dist/ because it
 * loads its plugins dynamically, so it is installed from this action's own lockfile instead.
 */
export function release(inputs, env, actionPath, cwd, installDir = cwd) {
    // Workspaces install from the directory holding the lockfile, which is above the package.
    run("npm", ["ci", "--ignore-scripts"], { cwd: installDir });
    run("npm", ["ci", "--ignore-scripts", "--omit=dev", "--prefix", actionPath], { cwd });
    const args = ["--extends", join(actionPath, "release.config.mjs")];
    if (inputs.dryRun)
        args.push("--dry-run");
    run(join(actionPath, "node_modules", ".bin", "semantic-release"), args, { cwd, env: releaseEnv(inputs, env) });
}

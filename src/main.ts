import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildContext } from "./context.js";
import { actionRoot, readInputs, release } from "./release.js";
import { report } from "./report.js";
import { runChecks } from "./run.js";
import { findLockfileDir } from "./workspace.js";

async function main(): Promise<void> {
  const env = process.env;
  const inputs = readInputs(env);
  const cwd = resolve(inputs.workingDirectory);
  const ctx = buildContext(
    {
      ...env,
      RELEASE_BRANCH: inputs.releaseBranch,
      CANDIDATE_BRANCH: inputs.candidateBranch,
      DOCS_SCRIPT: inputs.docsScript,
      BASELINE_COMMIT: inputs.baselineCommit,
    },
    cwd,
  );

  const results = await runChecks(ctx);
  const failedChecks = results.filter((r) => r.failures.length > 0).map((r) => r.check.id);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `failed-checks=${failedChecks.join(",")}\n`);
  if (!report(ctx, results)) {
    process.exitCode = 1;
    return;
  }
  if (inputs.mode === "check") {
    console.log("Check mode: all preconditions pass. Nothing was released.");
    return;
  }
  release(inputs, env, actionRoot(), ctx.cwd, findLockfileDir(ctx.cwd, ctx.root) ?? ctx.cwd);
}

main().catch((error: unknown) => {
  console.log(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

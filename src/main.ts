import { buildContext } from "./context.js";
import { actionRoot, readInputs, release } from "./release.js";
import { report } from "./report.js";
import { runChecks } from "./run.js";

async function main(): Promise<void> {
  const env = process.env;
  const inputs = readInputs(env);
  const ctx = buildContext({
    ...env,
    RELEASE_BRANCH: inputs.releaseBranch,
    CANDIDATE_BRANCH: inputs.candidateBranch,
    DOCS_SCRIPT: inputs.docsScript,
    BASELINE_COMMIT: inputs.baselineCommit,
  });

  if (!report(ctx, await runChecks(ctx))) {
    process.exitCode = 1;
    return;
  }
  if (inputs.mode === "check") {
    console.log("Check mode: all preconditions pass. Nothing was released.");
    return;
  }
  release(inputs, env, actionRoot(), ctx.cwd);
}

main().catch((error: unknown) => {
  console.log(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

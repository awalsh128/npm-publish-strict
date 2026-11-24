import { runChecks } from "./checks.js";
import { setOutput } from "@actions/core";
import { buildContext } from "./context.js";
import type { Log } from "./logger.js";
import { createLogger } from "./logger.js";
import { publishOutputsJson, uploadArtifact } from "./outputs.js";
import { actionRoot, readInputs, release, type Inputs } from "./release.js";
import { report } from "./report.js";

async function run(inputs: Inputs, env: NodeJS.ProcessEnv, log: Log): Promise<void> {
  const ctx = buildContext(inputs, env);

  const results = await runChecks(ctx);
  const failedChecks = results.filter((r) => r.failure).map((r) => r.check.id);
  setOutput("failed-checks", failedChecks.join(","));
  if (!(await report(ctx, results, log))) {
    process.exitCode = 1;
    return;
  }
  if (inputs.mode === "check") {
    log.info("Check mode: all preconditions pass. Nothing was released.");
    return;
  }
  release(inputs, env, actionRoot(), ctx.cwd);
}

async function main(): Promise<void> {
  const log = createLogger();
  const env = process.env;
  const inputs = readInputs(env);
  try {
    await run(inputs, env, log);
  } finally {
    // Whatever the run did, its outputs are worth having, so this also runs after a failed check or release.
    if (inputs.outputJson) await publishOutputsJson(env, uploadArtifact, log);
  }
}

main().catch((error: unknown) => {
  createLogger().error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

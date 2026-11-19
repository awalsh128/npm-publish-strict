import { runChecks } from "./checks.js";
import { setOutput } from "@actions/core";
import { buildContext } from "./context.js";
import { actionRoot, readInputs, release } from "./release.js";
import { createLogger } from "./logger.js";
import { report } from "./report.js";

async function main(): Promise<void> {
  const log = createLogger();
  const env = process.env;
  const inputs = readInputs(env);
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

main().catch((error: unknown) => {
  createLogger().error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { summary } from "@actions/core";
import { renderTemplate } from "./data.js";
import { createLogger, type Log } from "./logger.js";
import type { Check, CheckResult, Context, Failure } from "./types.js";

/** Markdown for one failed check. */
export function failureMarkdown(check: Check, failure: Failure): string {
  const out = [renderTemplate("failure-heading.md", { title: check.title, id: check.id }), "", failure.problem, ""];
  if (failure.details?.length) out.push(...failure.details.map((d) => `- ${d}`), "");
  if (failure.automated.length) {
    out.push(renderTemplate("automated-intro.md"), "");
    for (const step of failure.automated) out.push(`${step.label}:`, "", "```bash", step.command, "```", "");
  }
  if (failure.manual.length) {
    out.push("**Manual:**", "");
    let n = 0;
    for (const step of failure.manual) {
      if (step.startsWith("  ")) out.push("   ```yaml", ...step.split("\n").map((l) => `   ${l.slice(2)}`), "   ```");
      else out.push(`${++n}. ${step}`);
    }
    out.push("");
  }
  if (failure.links.length) out.push("**Read more:**", "", ...failure.links.map((l) => `- [${l.text}](${l.url})`), "");
  return out.join("\n");
}

/** Markdown footer telling the user how to confirm their fixes. */
function verifyMarkdown(env: Context["env"]): string {
  return renderTemplate("verify.md", { workflow: env.GITHUB_WORKFLOW ?? "this workflow" }) + "\n";
}

type Failed = CheckResult & { failure: Failure };

const failedOf = (results: readonly CheckResult[]): Failed[] =>
  results.filter((r): r is Failed => r.failure !== null);

const sectionOf = (r: Failed): string => failureMarkdown(r.check, r.failure);

function summaryFrom(env: Context["env"], results: readonly CheckResult[], sections: readonly string[]): string {
  if (sections.length === 0) {
    return [renderTemplate("pass-heading.md", { count: results.length }), "", ...results.map((r) => `- ${r.check.title}`), ""].join("\n");
  }
  return [renderTemplate("fail-heading.md", { count: sections.length }), "", ...sections, verifyMarkdown(env)].join("\n");
}

/** Markdown for the whole run. */
export function summaryMarkdown(env: Context["env"], results: readonly CheckResult[]): string {
  return summaryFrom(env, results, failedOf(results).map(sectionOf));
}

/** Logs results with annotations, and appends them to the job summary. Returns true when all pass. */
export async function report(ctx: Pick<Context, "env">, results: readonly CheckResult[], log: Log = createLogger()): Promise<boolean> {
  for (const r of results) log.info(`${r.failure ? "✘" : "✔"} ${r.check.title}`);
  const failed = failedOf(results);
  const sections = failed.map(sectionOf);
  failed.forEach((r, i) => {
    const group = log.group(`How to fix: ${r.check.title}`);
    log.info(sections[i] ?? "");
    group.dispose();
    log.error(`${r.check.title} (${r.check.id}): ${r.failure.problem}`);
  });
  if (process.env.GITHUB_STEP_SUMMARY) await summary.addRaw(summaryFrom(ctx.env, results, sections), true).write();
  return failed.length === 0;
}

import { summary } from "@actions/core";
import { renderTemplate } from "./data.js";
import { createLogger } from "./logger.js";
/** Markdown for one failed check. */
export function failureMarkdown(check, failure) {
    const out = [renderTemplate("failure-heading.md", { title: check.title, id: check.id }), "", failure.problem, ""];
    if (failure.details?.length)
        out.push(...failure.details.map((d) => `- ${d}`), "");
    if (failure.automated.length) {
        out.push(renderTemplate("automated-intro.md"), "");
        for (const step of failure.automated)
            out.push(`${step.label}:`, "", "```bash", step.command, "```", "");
    }
    if (failure.manual.length) {
        out.push("**Manual:**", "");
        let n = 0;
        for (const step of failure.manual) {
            if (step.startsWith("  "))
                out.push("   ```yaml", ...step.split("\n").map((l) => `   ${l.slice(2)}`), "   ```");
            else
                out.push(`${++n}. ${step}`);
        }
        out.push("");
    }
    if (failure.links.length)
        out.push("**Read more:**", "", ...failure.links.map((l) => `- [${l.text}](${l.url})`), "");
    return out.join("\n");
}
/** Markdown footer telling the user how to confirm their fixes. */
export function verifyMarkdown(env) {
    return renderTemplate("verify.md", { workflow: env.GITHUB_WORKFLOW ?? "this workflow" }) + "\n";
}
/** Markdown for the whole run. */
export function summaryMarkdown(env, results) {
    const failed = results.filter((r) => r.failures.length > 0);
    if (failed.length === 0) {
        return [renderTemplate("pass-heading.md", { count: results.length }), "", ...results.map((r) => `- ${r.check.title}`), ""].join("\n");
    }
    const sections = failed.flatMap((r) => r.failures.map((f) => failureMarkdown(r.check, f)));
    return [renderTemplate("fail-heading.md", { count: failed.length }), "", ...sections, verifyMarkdown(env)].join("\n");
}
/** Logs results with annotations, and appends them to the job summary. Returns true when all pass. */
export async function report(ctx, results, log = createLogger()) {
    for (const r of results)
        log.info(`${r.failures.length ? "✘" : "✔"} ${r.check.title}`);
    for (const r of results) {
        for (const failure of r.failures) {
            const group = log.group(`How to fix: ${r.check.title}`);
            log.info(failureMarkdown(r.check, failure));
            group.dispose();
            log.error(`${r.check.title} (${r.check.id}): ${failure.problem}`);
        }
    }
    if (process.env.GITHUB_STEP_SUMMARY)
        await summary.addRaw(summaryMarkdown(ctx.env, results), true).write();
    return results.every((r) => r.failures.length === 0);
}

import { appendFileSync } from "node:fs";
import { renderTemplate } from "./data.js";
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
/** Prints results to the job log with annotations, and appends them to the job summary. Returns true when all pass. */
export function report(ctx, results) {
    for (const r of results)
        console.log(`${r.failures.length ? "✘" : "✔"} ${r.check.title}`);
    for (const r of results) {
        for (const failure of r.failures) {
            console.log(`::group::How to fix: ${r.check.title}`);
            console.log(failureMarkdown(r.check, failure));
            console.log("::endgroup::");
            console.log(`::error title=${r.check.title} (${r.check.id})::${failure.problem}`);
        }
    }
    const summaryFile = ctx.env.GITHUB_STEP_SUMMARY;
    if (summaryFile)
        appendFileSync(summaryFile, summaryMarkdown(ctx.env, results) + "\n");
    return results.every((r) => r.failures.length === 0);
}

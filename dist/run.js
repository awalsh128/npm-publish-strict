import { checks } from "./checks.js";
/** Runs every applicable check; never stops at the first failure so the user sees everything at once. */
export async function runChecks(ctx, list = checks) {
    const results = [];
    for (const check of list) {
        if (check.applies && !check.applies(ctx))
            continue;
        const outcome = await check.run(ctx);
        results.push({ check, failures: outcome === null ? [] : Array.isArray(outcome) ? outcome : [outcome] });
    }
    return results;
}

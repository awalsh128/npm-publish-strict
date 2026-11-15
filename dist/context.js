import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
export const NPM_REGISTRY = "https://registry.npmjs.org";
function readPackage(cwd) {
    try {
        return JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    }
    catch {
        return null;
    }
}
const escapeName = (name) => name.replace("/", "%2f");
/** Exchanges this job's GitHub OIDC token for an npm token, exactly as `npm publish` does. */
async function exchangeNpmToken(env, name) {
    const requestUrl = env.ACTIONS_ID_TOKEN_REQUEST_URL;
    if (!requestUrl)
        return { ok: false, status: 0, message: "no OIDC token available" };
    const url = new URL(requestUrl);
    url.searchParams.set("audience", `npm:${new URL(NPM_REGISTRY).hostname}`);
    const idRes = await fetch(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? ""}` },
    });
    if (!idRes.ok)
        return { ok: false, status: idRes.status, message: "GitHub would not issue an OIDC token" };
    const { value } = (await idRes.json());
    const res = await fetch(`${NPM_REGISTRY}/-/npm/v1/oidc/token/exchange/package/${escapeName(name)}`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${value}` },
    });
    const body = (await res.json().catch(() => ({})));
    // The exchanged token is discarded on purpose: this only proves the exchange works.
    return { ok: res.ok && !!body.token, status: res.status, message: body.message ?? res.statusText };
}
/** Builds the context for the real environment. */
export function buildContext(env = process.env, cwd = process.cwd()) {
    /** stdout of a git command in the repository, or null when it fails. */
    const git = (args) => {
        try {
            return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        }
        catch {
            return null;
        }
    };
    return {
        env,
        cwd,
        branch: env.GITHUB_REF_NAME,
        repository: env.GITHUB_REPOSITORY,
        releaseBranch: env.RELEASE_BRANCH ?? "main",
        candidateBranch: env.CANDIDATE_BRANCH ?? "staging",
        docsScript: env.DOCS_SCRIPT ?? "docs:api",
        baseline: env.BASELINE_COMMIT?.trim() || undefined,
        pkg: readPackage(cwd),
        shallow() {
            try {
                return execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd, encoding: "utf8" }).trim() === "true";
            }
            catch {
                return null;
            }
        },
        npmVersion() {
            try {
                return execFileSync("npm", ["--version"], { cwd, encoding: "utf8" }).trim();
            }
            catch {
                return null;
            }
        },
        head: () => git(["rev-parse", "HEAD"]),
        commitExists: (ref) => git(["cat-file", "-e", `${ref}^{commit}`]) !== null,
        isAncestor: (ref) => git(["merge-base", "--is-ancestor", ref, "HEAD"]) !== null,
        commits(baseline) {
            const out = git(["log", "--no-merges", "--format=%H%x09%s", ...(baseline ? [`${baseline}..HEAD`] : ["HEAD"])]);
            return (out ?? "")
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                const [hash = "", ...rest] = line.split("\t");
                return { hash, subject: rest.join("\t") };
            });
        },
        exchangeNpmToken: (name) => exchangeNpmToken(env, name),
        async packageExists(name) {
            try {
                const res = await fetch(`${NPM_REGISTRY}/${escapeName(name)}`, { method: "HEAD" });
                return res.status === 404 ? false : res.ok ? true : null;
            }
            catch {
                return null;
            }
        },
    };
}

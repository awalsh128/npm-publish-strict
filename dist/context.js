import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getIDToken } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { NPM_REGISTRY } from "./constants.js";
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
    let value;
    try {
        value = await getIDToken(`npm:${new URL(NPM_REGISTRY).hostname}`);
    }
    catch (error) {
        return { ok: false, status: 0, message: `GitHub would not issue an OIDC token: ${error instanceof Error ? error.message : String(error)}` };
    }
    const res = await fetch(`${NPM_REGISTRY}/-/npm/v1/oidc/token/exchange/package/${escapeName(name)}`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${value}` },
    });
    const body = (await res.json().catch(() => ({})));
    // The exchanged token is discarded on purpose: this only proves the exchange works.
    return { ok: res.ok && !!body.token, status: res.status, message: body.message ?? res.statusText };
}
/** Builds the context for the real environment, with the action's `mode` and `baseline-commit` inputs. */
export function buildContext(mode, baseline, env = process.env, cwd = process.cwd()) {
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
        mode,
        branch: env.GITHUB_REF_NAME,
        repository: env.GITHUB_REPOSITORY,
        baseline: baseline || undefined,
        pkg: readPackage(cwd),
        shallow() {
            const out = git(["rev-parse", "--is-shallow-repository"]);
            return out === null ? null : out === "true";
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
        async repoIsPublic() {
            const token = env["INPUT_GITHUB-TOKEN"] ?? env.GITHUB_TOKEN;
            if (!env.GITHUB_REPOSITORY)
                return null;
            try {
                const octokit = new Octokit({
                    auth: token,
                    baseUrl: env.GITHUB_API_URL,
                    request: { signal: AbortSignal.timeout(10_000) },
                });
                const [owner = "", repo = ""] = env.GITHUB_REPOSITORY.split("/");
                const { data } = await octokit.rest.repos.get({ owner, repo });
                return data.private === false;
            }
            catch {
                return null;
            }
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

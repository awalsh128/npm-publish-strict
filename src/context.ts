import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getIDToken } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { NPM_REGISTRY } from "./constants.js";
import type { Inputs } from "./release.js";
import type { Context, ExchangeResult, PackageJson } from "./types.js";

/** Network calls give up after this long, so a stalled server can't hang a release job. */
const timeout = (): AbortSignal => AbortSignal.timeout(10_000);

function readPackage(cwd: string): PackageJson | null {
  try {
    return JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

const escapeName = (name: string): string => name.replace("/", "%2f");

/** Exchanges this job's GitHub OIDC token for an npm token, exactly as `npm publish` does. */
async function exchangeNpmToken(env: Context["env"], name: string): Promise<ExchangeResult> {
  const requestUrl = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  if (!requestUrl) return { ok: false, status: 0, message: "no OIDC token available" };
  let value: string;
  try {
    value = await getIDToken(`npm:${new URL(NPM_REGISTRY).hostname}`);
  } catch (error) {
    return { ok: false, status: 0, message: `GitHub would not issue an OIDC token: ${error instanceof Error ? error.message : String(error)}` };
  }
  let res: Response;
  try {
    res = await fetch(`${NPM_REGISTRY}/-/npm/v1/oidc/token/exchange/package/${escapeName(name)}`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${value}` },
      signal: timeout(),
    });
  } catch (error) {
    return { ok: false, status: 0, message: `npm did not answer: ${error instanceof Error ? error.message : String(error)}` };
  }
  const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  // The exchanged token is discarded on purpose: this only proves the exchange works.
  return { ok: res.ok && !!body.token, status: res.status, message: body.message ?? res.statusText };
}

/** Builds the context for the real environment from the action's inputs. */
export function buildContext(inputs: Inputs, env: Context["env"] = process.env, cwd = process.cwd()): Context {
  /** stdout of a git command in the repository, or null when it fails. */
  const git = (args: string[]): string | null => {
    try {
      return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return null;
    }
  };
  // Asked by three checks, so ask git once.
  let shallow: boolean | null | undefined;
  return {
    env,
    cwd,
    mode: inputs.mode,
    branch: env.GITHUB_REF_NAME,
    repository: env.GITHUB_REPOSITORY,
    baseline: inputs.baselineCommit || undefined,
    pkg: readPackage(cwd),
    shallow() {
      if (shallow === undefined) {
        const out = git(["rev-parse", "--is-shallow-repository"]);
        shallow = out === null ? null : out === "true";
      }
      return shallow;
    },
    npmVersion() {
      try {
        return execFileSync("npm", ["--version"], { cwd, encoding: "utf8" }).trim();
      } catch {
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
      if (!env.GITHUB_REPOSITORY) return null;
      try {
        const octokit = new Octokit({
          auth: inputs.githubToken || env.GITHUB_TOKEN,
          baseUrl: env.GITHUB_API_URL,
          request: { signal: timeout() },
        });
        const [owner = "", repo = ""] = env.GITHUB_REPOSITORY.split("/");
        const { data } = await octokit.rest.repos.get({ owner, repo });
        return data.private === false;
      } catch {
        return null;
      }
    },
    exchangeNpmToken: (name) => exchangeNpmToken(env, name),
    async packageExists(name) {
      try {
        const res = await fetch(`${NPM_REGISTRY}/${escapeName(name)}`, { method: "HEAD", signal: timeout() });
        return res.status === 404 ? false : res.ok ? true : null;
      } catch {
        return null;
      }
    },
  };
}

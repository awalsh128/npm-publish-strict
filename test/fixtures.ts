// Builds throwaway consumer repositories for end-to-end tests. Uses only Node built-ins and
// erasable TypeScript syntax, so `node test/make-fixture.ts` runs without a build step.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SCENARIOS = ["healthy", "legacy-commits", "wrong-repository", "unpinned", "shallow"] as const;
export type Scenario = (typeof SCENARIOS)[number];

const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function write(dir: string, path: string, content: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
}

function commit(dir: string, message: string, files: Record<string, string> = {}): string {
  for (const [path, content] of Object.entries(files)) write(dir, path, content);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", message);
  return git(dir, "rev-parse", "HEAD");
}

function packageJson(repository: string): string {
  return JSON.stringify(
    {
      name: "fixture-package",
      version: "0.0.0-semantically-released",
      type: "module",
      repository: { type: "git", url: `git+https://github.com/${repository}.git` },
      files: ["index.js"],
      scripts: { "docs:api": "mkdir -p docs/api && echo ok > docs/api/index.html" },
    },
    null,
    2,
  );
}

export interface Fixture {
  /** Repository directory to point the action at. */
  dir: string;
  /** The last commit that doesn't follow Conventional Commits, or "" when there is none. */
  baseline: string;
}

/**
 * Creates a consumer repository for `scenario` in `dir` (must not exist yet), on branch `branch`.
 * `repository` is the `owner/repo` its package.json claims, normally the one running the workflow.
 *
 * - healthy: passes every check.
 * - legacy-commits: a non-conventional commit, then a conventional one; `baseline` is the former.
 * - wrong-repository: package.json names a different repository.
 * - unpinned: a workflow uses an action by tag instead of by commit SHA.
 * - shallow: a depth-1 clone, so history is missing.
 */
export function createFixture(dir: string, scenario: Scenario, repository = "o/r", branch = "main"): Fixture {
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q", "-b", branch);
  const base = {
    "package.json": packageJson(scenario === "wrong-repository" ? "someone/else" : repository),
    "package-lock.json": JSON.stringify({ name: "fixture-package", lockfileVersion: 3, packages: {} }),
    "index.js": "export {};\n",
    ".gitignore": "node_modules\n",
    ".github/workflows/ci.yml": `steps:\n  - uses: actions/checkout@${scenario === "unpinned" ? "v4" : SHA}\n`,
  };

  if (scenario === "legacy-commits") {
    const baseline = commit(dir, "Legacy message", base);
    commit(dir, "feat: new feature", { "feature.js": "export {};\n" });
    return { dir, baseline };
  }

  commit(dir, "feat: initial", base);
  commit(dir, "fix: second", { "second.js": "export {};\n" });

  if (scenario === "shallow") {
    const shallowDir = `${dir}-shallow`;
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${dir}`, shallowDir]);
    return { dir: shallowDir, baseline: "" };
  }
  return { dir, baseline: "" };
}

import { describe, expect, it } from "vitest";
import { atLeast, checks, CONVENTIONAL_HEADER, findUnpinnedActions, repoSlug } from "../src/checks.js";
import { runChecks } from "../src/run.js";
import type { Context } from "../src/types.js";
import { join } from "node:path";
import { makeContext, makeRepo } from "./helpers.js";

const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

/** Failed check ids for a context. */
async function failedIds(ctx: Context): Promise<string[]> {
  return (await runChecks(ctx)).filter((r) => r.failures.length > 0).map((r) => r.check.id);
}

describe("repoSlug", () => {
  it.each([
    ["git+https://github.com/Owner/Repo.git", "owner/repo"],
    ["git@github.com:owner/repo.git", "owner/repo"],
    ["github:owner/repo", "owner/repo"],
    ["owner/repo", "owner/repo"],
  ])("string %s returns %s", (url, expected) => {
    expect(repoSlug(url)).toBe(expected);
  });

  it("object with a url returns the slug", () => {
    expect(repoSlug({ url: "https://github.com/o/r" })).toBe("o/r");
  });

  it.each([[undefined], ["https://gitlab.com/o/r"]])("%s returns null", (value) => {
    expect(repoSlug(value)).toBeNull();
  });
});

describe("atLeast", () => {
  it.each([
    ["11.5.1", true],
    ["11.19.1", true],
    ["12.0.0", true],
    ["11.5.0", false],
    ["10.9.2", false],
  ])("%s against 11.5.1 returns %s", (version, expected) => {
    expect(atLeast(version, [11, 5, 1])).toBe(expected);
  });
});

describe("findUnpinnedActions", () => {
  it("tag reference returns the line", () => {
    expect(findUnpinnedActions("steps:\n  - uses: actions/checkout@v4\n", "w.yml")).toEqual([
      "w.yml:2: actions/checkout@v4",
    ]);
  });

  it.each([
    [`  - uses: actions/checkout@${SHA} # v4`],
    ["  - uses: ./.github/actions/setup"],
    ["  - uses: docker://alpine:3"],
  ])("%s returns nothing", (line) => {
    expect(findUnpinnedActions(line, "w.yml")).toEqual([]);
  });
});

describe("CONVENTIONAL_HEADER", () => {
  it.each(["feat: add x", "fix(parser): handle y", "feat!: break", "chore(deps): bump"])("%s matches", (s) => {
    expect(CONVENTIONAL_HEADER.test(s)).toBe(true);
  });

  it.each(["Update readme", "feat add x", "feat:", "Fix: capital", "wip"])("%s does not match", (s) => {
    expect(CONVENTIONAL_HEADER.test(s)).toBe(false);
  });
});

describe("checks", () => {
  it("healthy context fails nothing", async () => {
    expect(await failedIds(makeContext())).toEqual([]);
  });

  it("unlisted branch fails branch", async () => {
    expect(await failedIds(makeContext({ branch: "feature/x" }))).toContain("branch");
  });

  it("missing lockfile fails package-files", async () => {
    const cwd = makeRepo({});
    const ctx = makeContext({ cwd: cwd + "/missing" });
    expect(await failedIds(ctx)).toContain("package-files");
  });

  it("real version fails package-version with the fix command", async () => {
    const ctx = makeContext({ pkg: { ...makeContext().pkg, version: "1.2.3" } });
    const failure = (await runChecks(ctx)).find((r) => r.check.id === "package-version")?.failures[0];
    expect(failure?.automated[0]?.command).toBe("npm pkg set version=0.0.0-semantically-released");
  });

  it("repository of another repo fails package-repository", async () => {
    const ctx = makeContext({ pkg: { ...makeContext().pkg, repository: "https://github.com/x/y.git" } });
    expect(await failedIds(ctx)).toContain("package-repository");
  });

  it("missing docs script fails package-docs-script", async () => {
    const ctx = makeContext({ pkg: { ...makeContext().pkg, scripts: {} } });
    expect(await failedIds(ctx)).toContain("package-docs-script");
  });

  it("private package fails package-private", async () => {
    const ctx = makeContext({ pkg: { ...makeContext().pkg, private: true } });
    expect(await failedIds(ctx)).toContain("package-private");
  });

  it("CHANGELOG.md fails no-changelog", async () => {
    const ctx = makeContext({ cwd: makeRepo({ "CHANGELOG.md": "# x" }) });
    expect(await failedIds(ctx)).toContain("no-changelog");
  });

  it("unpinned workflow action fails actions-pinned and lists it", async () => {
    const cwd = makeRepo({ ".github/workflows/ci.yml": "steps:\n  - uses: actions/checkout@v4\n" });
    const failure = (await runChecks(makeContext({ cwd }))).find((r) => r.check.id === "actions-pinned")?.failures[0];
    expect(failure?.details).toEqual([".github/workflows/ci.yml:2: actions/checkout@v4"]);
  });

  it("shallow checkout fails full-history", async () => {
    expect(await failedIds(makeContext({ shallow: () => true }))).toContain("full-history");
  });

  it("missing OIDC token on the release branch fails oidc-permission", async () => {
    expect(await failedIds(makeContext({ env: { GITHUB_REF_NAME: "main" } }))).toContain("oidc-permission");
  });

  it("missing OIDC token on the candidate branch passes", async () => {
    const ctx = makeContext({ branch: "staging", env: { GITHUB_REF_NAME: "staging" } });
    expect(await failedIds(ctx)).toEqual([]);
  });

  it("old npm fails npm-version", async () => {
    expect(await failedIds(makeContext({ npmVersion: () => "10.9.0" }))).toContain("npm-version");
  });
});

describe("public-repository", () => {
  it("private repository on the release branch fails with navigation steps", async () => {
    const ctx = makeContext({ repoIsPublic: () => Promise.resolve(false) });
    const failure = (await runChecks(ctx)).find((r) => r.check.id === "public-repository")?.failures[0];
    expect(failure?.manual[0]).toBe("Go to https://github.com/o/r/settings.");
  });

  it("private repository on the candidate branch passes", async () => {
    const ctx = makeContext({ branch: "staging", repoIsPublic: () => Promise.resolve(false) });
    expect(await failedIds(ctx)).toEqual([]);
  });

  it("unknown visibility passes", async () => {
    expect(await failedIds(makeContext({ repoIsPublic: () => Promise.resolve(null) }))).toEqual([]);
  });
});

describe("trusted-publisher", () => {
  it("rejected exchange fails with npm trust command and navigation steps", async () => {
    const ctx = makeContext({
      exchangeNpmToken: () => Promise.resolve({ ok: false, status: 404, message: "not found" }),
      packageExists: () => Promise.resolve(false),
    });
    const failure = (await runChecks(ctx)).find((r) => r.check.id === "trusted-publisher")?.failures[0];
    expect(failure?.automated[0]?.command).toBe("npm trust github pkg --file release.yml --repo o/r --yes");
    expect(failure?.manual.join("\n")).toContain("Click your avatar > Packages > pkg > Settings.");
    expect(failure?.manual[0]).toContain("Publish a first version");
  });

  it("accepted exchange passes", async () => {
    expect(await failedIds(makeContext())).not.toContain("trusted-publisher");
  });
});

describe("baseline", () => {
  const bad = { hash: "b".repeat(40), subject: "Update readme" };
  const good = { hash: "c".repeat(40), subject: "feat: add x" };

  it("non-conventional commits without a baseline fail commit-messages", async () => {
    expect(await failedIds(makeContext({ commits: () => [good, bad] }))).toContain("commit-messages");
  });

  it("commits are listed from the baseline only", async () => {
    const seen: (string | undefined)[] = [];
    const ctx = makeContext({
      baseline: "d".repeat(40),
      commits: (baseline) => {
        seen.push(baseline);
        return [good];
      },
    });
    expect(await failedIds(ctx)).toEqual([]);
    expect(seen).toEqual(["d".repeat(40)]);
  });

  it("commit-messages failure suggests the current commit as baseline", async () => {
    const ctx = makeContext({ commits: () => [bad] });
    const failure = (await runChecks(ctx)).find((r) => r.check.id === "commit-messages")?.failures[0];
    expect(failure?.manual.join("\n")).toContain(`baseline-commit: ${"a".repeat(40)}`);
    expect(failure?.details).toEqual(["bbbbbbb Update readme"]);
  });

  it("baseline outside the history fails baseline-commit only", async () => {
    const ctx = makeContext({ baseline: "d".repeat(40), isAncestor: () => false, commits: () => [bad] });
    expect(await failedIds(ctx)).toEqual(["baseline-commit"]);
  });

  it("shallow checkout skips both commit checks", async () => {
    const ctx = makeContext({ shallow: () => true, baseline: "d".repeat(40), commits: () => [bad] });
    expect(await failedIds(ctx)).toEqual(["full-history"]);
  });

  it("every check has a unique id", () => {
    const ids = checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("checks in a workspace", () => {
  /** A repository root with the lockfile and workflows, and a package below it. */
  const workspace = (files: Record<string, string> = {}) => {
    const root = makeRepo({ "packages/pkg/package.json": "{}", ...files });
    return { root, cwd: join(root, "packages/pkg") };
  };

  it("lockfile at the repository root passes package-files", async () => {
    const { root, cwd } = workspace();
    expect(await failedIds(makeContext({ cwd, root }))).not.toContain("package-files");
  });

  it("no lockfile anywhere fails package-files and names it", async () => {
    const root = makeRepo({ "packages/pkg/package.json": "{}" });
    const ctx = makeContext({ cwd: join(root, "packages/pkg"), root: join(root, "packages/pkg") });
    const failed = (await runChecks(ctx)).find((r) => r.check.id === "package-files");
    expect(failed?.failures[0]?.problem).toBe("Missing: package-lock.json.");
  });

  it("an unpinned workflow at the repository root fails actions-pinned with a root-relative path", async () => {
    const { root, cwd } = workspace({ ".github/workflows/ci.yml": "steps:\n  - uses: actions/checkout@v4\n" });
    const result = (await runChecks(makeContext({ cwd, root }))).find((r) => r.check.id === "actions-pinned");
    expect(result?.failures[0]?.details).toEqual([".github/workflows/ci.yml:2: actions/checkout@v4"]);
  });
});

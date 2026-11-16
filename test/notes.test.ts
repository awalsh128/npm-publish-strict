import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error release.config.mjs is plain JavaScript without types.
import config from "../release.config.mjs";

type Plugin = Record<string, (pluginConfig: object, context: object) => Promise<string | null>>;

const commit = (hash: string, subject: string) => ({
  hash,
  message: subject,
  subject,
  body: "",
  gitTags: "",
  commit: { long: hash, short: hash.slice(0, 7) },
  author: { name: "a" },
  committer: { name: "a" },
  committerDate: "2026-01-01T00:00:00Z",
});

const context = {
  cwd: process.cwd(),
  env: {},
  logger: { log() {}, error() {}, warn() {} },
  commits: [commit("a".repeat(40), "feat: add a thing"), commit("b".repeat(40), "fix: repair a thing")],
  options: { repositoryUrl: "https://github.com/o/r.git" },
  lastRelease: { gitTag: "v1.0.0", gitHead: "c".repeat(40), version: "1.0.0" },
  nextRelease: { type: "minor", version: "1.1.0", gitTag: "v1.1.0", gitHead: "d".repeat(40) },
};

const plugin = (name: string): Plugin["x"] => {
  const found = (config.plugins as Plugin[]).find((p) => typeof p === "object" && !Array.isArray(p) && name in p);
  if (!found) throw new Error(`release.config.mjs has no ${name} plugin`);
  return found[name]!;
};

// A dependency bump once paired a changelog preset with a writer that cannot render it, and nothing
// failed until a real release reached this step.
describe("release.config.mjs", () => {
  it("analyzeCommits with a feat commit returns minor", async () => {
    expect(await plugin("analyzeCommits")({}, context)).toBe("minor");
  });

  it("generateNotes with feat and fix commits renders their sections", async () => {
    const notes = await plugin("generateNotes")({}, context);
    expect(notes).toContain("### Features");
    expect(notes).toContain("### Bug Fixes");
  });
});

/** Loads release.config.mjs afresh with the given environment, since it reads it at import. */
async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  // @ts-expect-error release.config.mjs is plain JavaScript without types.
  return (await import("../release.config.mjs")).default as typeof config;
}

describe("release.config.mjs for a package in a repository with several", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("tag format defaults to v${version}", async () => {
    expect((await loadConfig({})).tagFormat).toBe("v${version}");
  });

  it("TAG_FORMAT sets the tag format", async () => {
    expect((await loadConfig({ TAG_FORMAT: "pkg-v${version}" })).tagFormat).toBe("pkg-v${version}");
  });

  it("COMMIT_PATHS keeps only commits that touch those paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "paths-"));
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, encoding: "utf8" }).trim();
    git("init", "-q", "-b", "main");
    const commitFile = (path: string, message: string) => {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), message);
      git("add", "-A");
      git("commit", "-q", "-m", message);
      return git("rev-parse", "HEAD");
    };
    const mine = commitFile("packages/a/x.ts", "feat: change a");
    const other = commitFile("packages/ab/x.ts", "fix: change ab");
    const sibling = commitFile("packages/b/x.ts", "fix: change b");

    const original = process.cwd();
    process.chdir(dir);
    try {
      const filtered = await loadConfig({ COMMIT_PATHS: "packages/a/" });
      const analyzed = (filtered.plugins as Plugin[]).find((p) => typeof p === "object" && "analyzeCommits" in p)!;
      const commits = [mine, other, sibling].map((hash) => commit(hash, git("log", "-1", "--format=%s", hash)));
      // Only the feat commit counts: the fix commits touch other packages, including one whose
      // directory name merely starts with the same letters.
      expect(await analyzed.analyzeCommits!({}, { ...context, commits })).toBe("minor");
      const onlyFixes = commits.slice(1);
      expect(await analyzed.analyzeCommits!({}, { ...context, commits: onlyFixes })).toBeNull();
    } finally {
      process.chdir(original);
    }
  });

  it("without PIN_DEPENDENCIES no pin step runs", async () => {
    const plugins = (await loadConfig({})).plugins as unknown[];
    expect(JSON.stringify(plugins)).not.toContain("pin.js");
  });

  it("PIN_DEPENDENCIES runs the pin script before the npm plugin prepares the package", async () => {
    const plugins = (await loadConfig({ PIN_DEPENDENCIES: "@s/base=base-v${version}" })).plugins as unknown[];
    const text = plugins.map((p) => JSON.stringify(p));
    const pin = text.findIndex((p) => p.includes("pin.js"));
    const npm = text.findIndex((p) => p.includes("@semantic-release/npm"));
    expect(pin).toBeGreaterThan(-1);
    expect(pin).toBeLessThan(npm);
  });
});

describe("release.config.mjs success step", () => {
  afterEach(() => vi.unstubAllEnvs());

  const releaseContext = (cwd: string) => ({
    ...context,
    cwd,
    nextRelease: { ...context.nextRelease, channel: "rc", version: "1.1.0-rc.1", gitTag: "pkg-v1.1.0-rc.1", notes: "## Notes\n- a" },
    releases: [{ pluginName: "@semantic-release/github", name: "GitHub release", url: "https://github.com/o/r/releases/tag/x" }],
  });

  async function outputsOf(releaseCtx: object): Promise<string> {
    const file = join(mkdtempSync(join(tmpdir(), "out-")), "output");
    writeFileSync(file, "");
    const loaded = await loadConfig({ GITHUB_OUTPUT: file });
    const success = (loaded.plugins as Plugin[]).find((p) => typeof p === "object" && "success" in p)!;
    await success.success!({}, releaseCtx);
    return readFileSync(file, "utf8");
  }

  it("success with a candidate release writes its tag, package, channel and notes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pkg-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@s/pkg" }));
    const out = await outputsOf(releaseContext(dir));
    expect(out).toContain("tag=pkg-v1.1.0-rc.1\n");
    expect(out).toContain("package-name=@s/pkg\n");
    expect(out).toContain("channel=rc\n");
    expect(out).toContain("prerelease=true\n");
    expect(out).toContain("published=false\n");
    expect(out).toContain("release-url=https://github.com/o/r/releases/tag/x\n");
    expect(out).toMatch(/release-notes<<EOF_[\w-]+\n## Notes\n- a\nEOF_/);
  });
});

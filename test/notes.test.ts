import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseOutputs } from "./helpers.ts";
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
  const found = (config.plugins as Plugin[]).find(
    (p) => typeof p === "object" && !Array.isArray(p) && name in p
  );
  if (!found) throw new Error(`release.config.mjs has no ${name} plugin`);
  return found[name]!;
};

// A dependency bump once paired a changelog preset with a writer that cannot render it, and nothing
// failed until a real release reached this step.
describe("release.config.mjs", () => {
  it("analyzeCommits with a feat commit returns minor", async () => {
    expect(await plugin("analyzeCommits")({}, context)).toBe("minor");
  });

  it.each([
    ["feat", "minor"],
    ["fix", "patch"],
    ["perf", "patch"],
    ["docs", null],
    ["chore", null],
  ])("analyzeCommits with a %s commit returns %s", async (type, release) => {
    const commits = [commit("a".repeat(40), `${type}: do a thing`)];
    expect(await plugin("analyzeCommits")({}, { ...context, commits })).toBe(release);
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

describe("release.config.mjs conventions", () => {
  it("tagFormat with no environment returns v${version}", () => {
    expect(config.tagFormat).toBe("v${version}");
  });

  it("branches with no environment returns staging as rc and main", () => {
    expect(config.branches).toEqual([{ name: "staging", prerelease: "rc" }, "main"]);
  });
});

describe("release.config.mjs success step", () => {
  afterEach(() => vi.unstubAllEnvs());

  const releaseContext = (cwd: string) => ({
    ...context,
    cwd,
    nextRelease: {
      ...context.nextRelease,
      channel: "rc",
      version: "1.1.0-rc.1",
      gitTag: "v1.1.0-rc.1",
      notes: "## Notes\n- a",
    },
    releases: [
      {
        pluginName: "@semantic-release/github",
        name: "GitHub release",
        url: "https://github.com/o/r/releases/tag/x",
      },
    ],
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
    const out = parseOutputs(await outputsOf(releaseContext(dir)));
    expect(out).toMatchObject({
      tag: "v1.1.0-rc.1",
      "package-name": "@s/pkg",
      channel: "rc",
      prerelease: "true",
      published: "false",
      "release-url": "https://github.com/o/r/releases/tag/x",
      "release-notes": "## Notes\n- a",
    });
  });
});

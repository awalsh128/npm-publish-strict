import { describe, expect, it } from "vitest";
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

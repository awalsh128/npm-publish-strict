import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Context } from "../src/types.js";

/** A context for a healthy release on the release branch; override what a test is about. */
export function makeContext(overrides: Partial<Context> = {}): Context {
  const cwd = overrides.cwd ?? makeRepo({});
  return {
    env: {
      GITHUB_REF_NAME: "main",
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.example/",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "t",
      GITHUB_WORKFLOW_REF: "o/r/.github/workflows/release.yml@refs/heads/main",
    },
    cwd,
    mode: "release",
    branch: "main",
    repository: "o/r",
    baseline: undefined,
    pkg: {
      name: "pkg",
      version: "0.0.0-semantically-released",
      repository: "git+https://github.com/o/r.git",
      files: ["dist"],
      scripts: { "docs:api": "typedoc" },
    },
    shallow: () => false,
    npmVersion: () => "11.6.0",
    head: () => "a".repeat(40),
    commitExists: () => true,
    isAncestor: () => true,
    commits: () => [],
    exchangeNpmToken: () => Promise.resolve({ ok: true, status: 200, message: "OK" }),
    repoIsPublic: () => Promise.resolve(true),
    packageExists: () => Promise.resolve(true),
    ...overrides,
  };
}

/** Creates a temp directory holding the given files (path -> content). */
export function makeRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "strict-"));
  const all = { "package.json": "{}", "package-lock.json": "{}", ...files };
  for (const [path, content] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

/** Parses a GITHUB_OUTPUT file: `name=value` lines and `name<<DELIMITER` blocks. */
export function parseOutputs(text: string): Record<string, string> {
  const outputs: Record<string, string> = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const block = /^([\w-]+)<<(.+)$/.exec(lines[i] ?? "");
    if (block) {
      const end = lines.indexOf(block[2]!, i + 1);
      outputs[block[1]!] = lines.slice(i + 1, end).join("\n");
      i = end;
      continue;
    }
    const pair = /^([\w-]+)=(.*)$/.exec(lines[i] ?? "");
    if (pair) outputs[pair[1]!] = pair[2]!;
  }
  return outputs;
}

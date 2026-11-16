// Runs the built pin script (dist/pin.js) in a repository with release tags, as release.config.mjs does.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PIN = resolve("dist/pin.js");

/** Runs the script in a repository whose tags are `tags`, and returns its manifest and result. */
function runPin(tags: string[], env: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "pin-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("commit", "-q", "--allow-empty", "-m", "feat: x");
  for (const tag of tags) git("tag", tag);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "@s/vscode", dependencies: { "@s/base": "0.0.0-semantically-released", winston: "^3" } }),
  );
  const result = spawnSync("node", [PIN], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH, ...env } });
  return { result, pkg: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) };
}

const PINS = "@s/base=base-v${version}";

describe("dist/pin.js", () => {
  it("release branch pins to the latest stable release and ignores candidates", () => {
    const { result, pkg } = runPin(["base-v1.0.0", "base-v1.1.0", "base-v2.0.0-rc.1"], {
      PIN_DEPENDENCIES: PINS,
      GITHUB_REF_NAME: "main",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Pinned @s/base to ^1.1.0");
    expect(pkg.dependencies).toEqual({ "@s/base": "^1.1.0", winston: "^3" });
  });

  it("candidate branch pins to the latest release including candidates", () => {
    const { pkg } = runPin(["base-v1.1.0", "base-v2.0.0-rc.1"], { PIN_DEPENDENCIES: PINS, GITHUB_REF_NAME: "staging" });
    expect(pkg.dependencies["@s/base"]).toBe("^2.0.0-rc.1");
  });

  it("dependency without a release exits 1 and names it", () => {
    const { result } = runPin([], { PIN_DEPENDENCIES: PINS, GITHUB_REF_NAME: "main" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("'@s/base' has no release tagged 'base-v<version>'");
  });

  it("no pins leaves the manifest untouched", () => {
    const { result, pkg } = runPin([], { GITHUB_REF_NAME: "main" });
    expect(result.status).toBe(0);
    expect(pkg.dependencies["@s/base"]).toBe("0.0.0-semantically-released");
  });
});

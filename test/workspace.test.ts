import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACEHOLDER_VERSION } from "../src/checks.js";
import {
  findLockfileDir,
  parsePins,
  pinDependencies,
  splitList,
} from "../src/workspace.js";
import type { PackageJson } from "../src/types.js";
import { makeRepo } from "./helpers.js";

describe("findLockfileDir", () => {
  it("lockfile in the package directory returns that directory", () => {
    const root = makeRepo({ "packages/a/package-lock.json": "{}" });
    expect(findLockfileDir(join(root, "packages/a"), root)).toBe(join(root, "packages/a"));
  });

  it("lockfile only at the root returns the root", () => {
    const root = makeRepo({ "packages/a/package.json": "{}" });
    expect(findLockfileDir(join(root, "packages/a"), root)).toBe(root);
  });

  it("no lockfile returns null", () => {
    const root = makeRepo({});
    mkdirSync(join(root, "packages/a"), { recursive: true });
    writeFileSync(join(root, "package-lock.json"), "{}");
    expect(findLockfileDir(join(root, "packages/a"), join(root, "packages/a"))).toBeNull();
  });

  it("lockfile above the repository root is ignored", () => {
    const outer = makeRepo({ "repo/package.json": "{}" });
    expect(findLockfileDir(join(outer, "repo"), join(outer, "repo"))).toBeNull();
  });
});

describe("splitList", () => {
  it("newlines, commas and blanks return the items", () => {
    expect(splitList(" a/b,\n\nc \n d ")).toEqual(["a/b", "c", "d"]);
  });
});

describe("parsePins", () => {
  it("name=tag-format lines return the dependency and its tag prefix", () => {
    expect(parsePins("@s/base=base-v${version}\nother=other-${version}")).toEqual([
      { name: "@s/base", tagPrefix: "base-v" },
      { name: "other", tagPrefix: "other-" },
    ]);
  });

  it("empty input returns no pins", () => {
    expect(parsePins("")).toEqual([]);
  });

  it.each([["base"], ["base=base-v"], ["=v${version}"], ["a=b=v${version}"]])("%s throws", (line) => {
    expect(() => parsePins(line)).toThrow("must be 'name=tag-format'");
  });
});

describe("pinDependencies", () => {
  const pkg: PackageJson & { devDependencies: Record<string, string> } = {
    name: "@s/vscode",
    dependencies: { "@s/base": PLACEHOLDER_VERSION, winston: "^3.19.0" },
    peerDependencies: { "@s/base": PLACEHOLDER_VERSION },
    devDependencies: { "@s/base": PLACEHOLDER_VERSION },
  };
  const pins = [{ name: "@s/base", tagPrefix: "base-v" }];

  it("placeholder dependencies get the latest release, and the rest is untouched", () => {
    const { pkg: out, pinned } = pinDependencies(pkg, pins, ["base-v1.0.0", "base-v1.1.0"], true);
    expect(out.dependencies).toEqual({ "@s/base": "^1.1.0", winston: "^3.19.0" });
    expect(out.peerDependencies).toEqual({ "@s/base": "^1.1.0" });
    expect((out as typeof pkg).devDependencies).toEqual({ "@s/base": PLACEHOLDER_VERSION });
    expect(pinned).toEqual({ "@s/base": "^1.1.0" });
  });

  it("the input manifest is not modified", () => {
    pinDependencies(pkg, pins, ["base-v1.0.0"], true);
    expect(pkg.dependencies?.["@s/base"]).toBe(PLACEHOLDER_VERSION);
  });

  it("a dependency without a release throws and names it", () => {
    expect(() => pinDependencies(pkg, pins, [], true)).toThrow("'@s/base' has no release tagged 'base-v<version>'");
  });

  it("a pin the package does not use is ignored", () => {
    expect(pinDependencies(pkg, [{ name: "unused", tagPrefix: "u-v" }], [], true).pinned).toEqual({});
  });
});

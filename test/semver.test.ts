import { describe, expect, it } from "vitest";
import { atLeast, isPrerelease, latestVersion, pinRange, tagPrefix, versionFromTag } from "../src/semver.js";

describe("atLeast", () => {
  it.each([
    ["11.5.1", true],
    ["11.19.1", true],
    ["12.0.0", true],
    ["11.5.0", false],
    ["10.9.2", false],
    ["11.5.1-beta.1", false],
    ["not a version", false],
  ])("%s against 11.5.1 returns %s", (version, expected) => {
    expect(atLeast(version, "11.5.1")).toBe(expected);
  });
});

describe("latestVersion", () => {
  it("candidates are ordered numerically and a release is above its candidates", () => {
    const tags = ["v1.0.0-rc.2", "v1.0.0-rc.10", "v1.0.0"];
    expect(latestVersion(tags.slice(0, 2), "v", false)).toBe("1.0.0-rc.10");
    expect(latestVersion(tags, "v", false)).toBe("1.0.0");
  });

  const tags = ["base-v1.0.0", "base-v1.2.0", "base-v1.10.0", "base-v2.0.0-rc.1", "other-v9.0.0", "base-vnext", "v3.0.0"];

  it("stable only returns the highest release", () => {
    expect(latestVersion(tags, "base-v", true)).toBe("1.10.0");
  });

  it("candidates allowed returns the highest including prereleases", () => {
    expect(latestVersion(tags, "base-v", false)).toBe("2.0.0-rc.1");
  });

  it("the shim's plain v prefix does not match scoped tags", () => {
    expect(latestVersion(tags, "v", true)).toBe("3.0.0");
  });

  it("no matching tag returns null", () => {
    expect(latestVersion(tags, "none-v", true)).toBeNull();
  });
});

describe("isPrerelease", () => {
  it.each([
    ["1.0.0-rc.1", true],
    ["1.0.0", false],
    ["1.0.0+build-1", false],
  ])("%s returns %s", (version, expected) => {
    expect(isPrerelease(version)).toBe(expected);
  });
});

describe("pinRange", () => {
  it("a version returns a caret range", () => {
    expect(pinRange("1.2.3")).toBe("^1.2.3");
  });
});

describe("tagPrefix", () => {
  it.each([
    ["v${version}", "v"],
    ["base-v${version}", "base-v"],
    ["${version}", ""],
    ["base-v", null],
    ["v${version}-x", null],
  ])("%s returns %s", (format, expected) => {
    expect(tagPrefix(format)).toBe(expected);
  });
});

describe("versionFromTag", () => {
  it.each([
    ["base-v1.2.3", "base-v", "1.2.3"],
    ["base-v1.0.0-rc.1", "base-v", "1.0.0-rc.1"],
    ["other-v1.2.3", "base-v", null],
    ["base-vx", "base-v", null],
    ["base-vv1.2.3", "base-v", null],
  ])("%s with prefix %s returns %s", (tag, prefix, expected) => {
    expect(versionFromTag(tag, prefix)).toBe(expected);
  });
});

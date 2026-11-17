import { describe, expect, it } from "vitest";
import { atLeast, latestVersion } from "../src/semver.js";

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

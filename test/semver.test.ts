import { describe, expect, it } from "vitest";
import { Version } from "../src/semver.js";

describe("Version.parse", () => {
  it.each([
    ["1.2.3", "1.2.3"],
    ["1.0.0-rc.1", "1.0.0-rc.1"],
    ["v1.2.3", undefined],
    [" 1.2.3", undefined],
    ["not a version", undefined],
  ])("%s returns %s", (text, expected) => {
    expect(Version.parse(text)?.value).toBe(expected);
  });
});

describe("Version.atLeast", () => {
  it.each([
    ["11.5.1", true],
    ["11.19.1", true],
    ["12.0.0", true],
    ["11.5.0", false],
    ["10.9.2", false],
    ["11.5.1-beta.1", false],
  ])("%s against 11.5.1 returns %s", (version, expected) => {
    expect(Version.parse(version)?.atLeast("11.5.1")).toBe(expected);
  });
});

describe("Version.isPrerelease", () => {
  it.each([
    ["1.0.0-rc.1", true],
    ["1.0.0", false],
    ["1.0.0+build-1", false],
  ])("%s returns %s", (version, expected) => {
    expect(Version.parse(version)?.isPrerelease).toBe(expected);
  });
});

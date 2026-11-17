import { describe, expect, it } from "vitest";
import { atLeast, isPrerelease } from "../src/semver.js";

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

describe("isPrerelease", () => {
  it.each([
    ["1.0.0-rc.1", true],
    ["1.0.0", false],
    ["1.0.0+build-1", false],
  ])("%s returns %s", (version, expected) => {
    expect(isPrerelease(version)).toBe(expected);
  });
});

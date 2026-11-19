import { describe, expect, it } from "vitest";
import { planPromotion } from "../scripts/promote-plan.ts";
import { Version } from "../src/semver.js";

/** Versions from their text, skipping invalid ones. */
const versions = (...texts: string[]): Version[] => texts.flatMap((t) => Version.parse(t) ?? []);

describe("planPromotion", () => {
  it("minor candidate after an official release returns its core, not major", () => {
    expect(planPromotion(versions("1.2.0-rc.1", "1.2.0", "1.3.0-rc.1"), versions("1.2.0"))).toEqual({
      next: "1.3.0",
      isMajor: false,
    });
  });

  it("several candidates returns the latest by version, not by text", () => {
    expect(planPromotion(versions("1.9.0-rc.1", "1.10.0-rc.1", "1.3.0-rc.1"), versions("1.2.0"))?.next).toBe(
      "1.10.0"
    );
  });

  it("candidate with a higher major returns major", () => {
    expect(planPromotion(versions("2.0.0-rc.1"), versions("1.9.0"))?.isMajor).toBe(true);
  });

  it("no official release yet returns major", () => {
    expect(planPromotion(versions("1.0.0-rc.1"), [])?.isMajor).toBe(true);
  });

  it("candidate already promoted returns null", () => {
    expect(planPromotion(versions("1.2.0-rc.1", "1.2.0"), versions("1.2.0"))).toBeNull();
  });

  it("major candidate already promoted returns null", () => {
    expect(planPromotion(versions("2.0.0-rc.1", "2.0.0"), versions("1.9.0", "2.0.0"))).toBeNull();
  });

  it("no candidate on staging returns null", () => {
    expect(planPromotion(versions("1.2.0"), versions("1.2.0"))).toBeNull();
  });
});

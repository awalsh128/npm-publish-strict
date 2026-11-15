import { describe, expect, it } from "vitest";
import { readInputs } from "../src/release.js";

describe("readInputs", () => {
  it("empty environment returns defaults", () => {
    expect(readInputs({})).toMatchObject({
      mode: "release",
      dryRun: false,
      docsScript: "docs:api",
      releaseBranch: "main",
      candidateBranch: "staging",
      baselineCommit: "",
    });
  });

  it("baseline, mode and dry-run are read from INPUT_ variables", () => {
    expect(readInputs({ "INPUT_BASELINE-COMMIT": " abc123 ", INPUT_MODE: "check", "INPUT_DRY-RUN": "true" })).toMatchObject({
      baselineCommit: "abc123",
      mode: "check",
      dryRun: true,
    });
  });

  it("git credentials default to the github token", () => {
    expect(readInputs({ "INPUT_GITHUB-TOKEN": "tok" }).gitCredentials).toBe("x-access-token:tok");
  });

  it("explicit git credentials win", () => {
    expect(readInputs({ "INPUT_GITHUB-TOKEN": "tok", "INPUT_GIT-CREDENTIALS": "u:p" }).gitCredentials).toBe("u:p");
  });

  it("unknown mode throws", () => {
    expect(() => readInputs({ INPUT_MODE: "bogus" })).toThrow("must be 'release' or 'check'");
  });
});

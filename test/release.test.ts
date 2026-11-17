import { describe, expect, it } from "vitest";
import { actionRoot, readInputs, releaseEnv } from "../src/release.js";

/** The INPUT_* variables the runner sets from action.yml's defaults. */
const DEFAULT_INPUTS = { INPUT_MODE: "release", "INPUT_BASELINE-COMMIT": "", "INPUT_GITHUB-TOKEN": "tok" };

describe("releaseEnv", () => {
  const inputs = readInputs(DEFAULT_INPUTS);

  it("official release branch publishes with provenance", () => {
    const env = releaseEnv(inputs, { GITHUB_REF_NAME: "main" });
    expect(env).toMatchObject({ NPM_PUBLISH: "true", NPM_CONFIG_PROVENANCE: "true" });
  });

  it("candidate branch does not publish or request provenance", () => {
    const env = releaseEnv(inputs, { GITHUB_REF_NAME: "staging" });
    expect(env.NPM_PUBLISH).toBe("false");
    expect(env.NPM_CONFIG_PROVENANCE).toBeUndefined();
  });

  it("baseline and token reach semantic-release through the environment", () => {
    const env = releaseEnv(readInputs({ ...DEFAULT_INPUTS, "INPUT_BASELINE-COMMIT": "abc123" }), { GITHUB_REF_NAME: "main" });
    expect(env).toMatchObject({ BASELINE_COMMIT: "abc123", GITHUB_TOKEN: "tok" });
  });

  it("GIT_CREDENTIALS set on the step passes through", () => {
    expect(releaseEnv(inputs, { GITHUB_REF_NAME: "main", GIT_CREDENTIALS: "u:p" }).GIT_CREDENTIALS).toBe("u:p");
  });
});

describe("actionRoot", () => {
  it("compiled file in dist returns the directory above dist", () => {
    expect(actionRoot("file:///runner/_actions/o/a/v2/dist/release.js")).toBe("/runner/_actions/o/a/v2");
  });
});

describe("readInputs", () => {
  it("default inputs return release mode, no baseline and the token", () => {
    expect(readInputs(DEFAULT_INPUTS)).toEqual({ mode: "release", baselineCommit: "", githubToken: "tok" });
  });

  it("baseline and check mode are trimmed and read", () => {
    expect(readInputs({ ...DEFAULT_INPUTS, "INPUT_BASELINE-COMMIT": " abc123 ", INPUT_MODE: "check" })).toMatchObject({
      baselineCommit: "abc123",
      mode: "check",
    });
  });

  it("unknown mode throws", () => {
    expect(() => readInputs({ ...DEFAULT_INPUTS, INPUT_MODE: "bogus" })).toThrow("must be 'release' or 'check'");
  });
});

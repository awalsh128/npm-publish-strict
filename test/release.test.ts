import { describe, expect, it } from "vitest";
import { actionRoot, readInputs, releaseEnv } from "../src/release.js";

describe("releaseEnv", () => {
  const inputs = readInputs({});

  it("official release branch publishes with provenance", () => {
    const env = releaseEnv(inputs, { GITHUB_REF_NAME: "main" });
    expect(env).toMatchObject({ NPM_PUBLISH: "true", NPM_CONFIG_PROVENANCE: "true" });
  });

  it("candidate branch does not publish or request provenance", () => {
    const env = releaseEnv(inputs, { GITHUB_REF_NAME: "staging" });
    expect(env.NPM_PUBLISH).toBe("false");
    expect(env.NPM_CONFIG_PROVENANCE).toBeUndefined();
  });

  it("package options reach the release config through the environment", () => {
    const env = releaseEnv(
      readInputs({
        "INPUT_TAG-FORMAT": "pkg-v${version}",
        "INPUT_COMMIT-PATHS": "packages/pkg, shared",
        "INPUT_PIN-DEPENDENCIES": "@s/base=base-v${version}",
      }),
      { GITHUB_REF_NAME: "main" },
    );
    expect(env).toMatchObject({
      TAG_FORMAT: "pkg-v${version}",
      COMMIT_PATHS: "packages/pkg\nshared",
      PIN_DEPENDENCIES: "@s/base=base-v${version}",
    });
  });

  it("dry run on the release branch does not publish", () => {
    expect(releaseEnv(readInputs({ "INPUT_DRY-RUN": "true" }), { GITHUB_REF_NAME: "main" }).NPM_PUBLISH).toBe("false");
  });
});

describe("actionRoot", () => {
  it("compiled file in dist returns the directory above dist", () => {
    expect(actionRoot("file:///runner/_actions/o/a/v2/dist/release.js")).toBe("/runner/_actions/o/a/v2");
  });
});

describe("readInputs", () => {
  it("empty environment returns defaults", () => {
    expect(readInputs({})).toMatchObject({
      mode: "release",
      dryRun: false,
      docsScript: "docs:api",
      releaseBranch: "main",
      candidateBranch: "staging",
      baselineCommit: "",
      tagFormat: "v${version}",
      commitPaths: [],
      pinDependencies: "",
    });
  });

  it("malformed pin-dependencies throws", () => {
    expect(() => readInputs({ "INPUT_PIN-DEPENDENCIES": "base" })).toThrow("must be 'name=tag-format'");
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

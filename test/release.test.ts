import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  actionRoot,
  readInputs,
  releaseEnv,
  RUNTIME_INSTALL_FLAGS,
  semanticReleaseArgs,
} from "../src/release.js";

/** The INPUT_* variables the runner sets from action.yml's defaults. */
const DEFAULT_INPUTS = {
  INPUT_MODE: "release",
  "INPUT_BASELINE-COMMIT": "",
  INPUT_BUMP: "auto",
  "INPUT_DRY-RUN": "false",
  "INPUT_GITHUB-TOKEN": "tok",
};

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
    const env = releaseEnv(readInputs({ ...DEFAULT_INPUTS, "INPUT_BASELINE-COMMIT": "abc123" }), {
      GITHUB_REF_NAME: "main",
    });
    expect(env).toMatchObject({ BASELINE_COMMIT: "abc123", GITHUB_TOKEN: "tok" });
  });

  it("GIT_CREDENTIALS set on the step passes through", () => {
    expect(releaseEnv(inputs, { GITHUB_REF_NAME: "main", GIT_CREDENTIALS: "u:p" }).GIT_CREDENTIALS).toBe(
      "u:p"
    );
  });
});

describe("actionRoot", () => {
  it("compiled file in dist returns the directory above dist", () => {
    expect(actionRoot("file:///runner/_actions/o/a/v2/dist/main.js")).toBe("/runner/_actions/o/a/v2");
  });
});

describe("readInputs", () => {
  it("default inputs return release mode, no baseline and the token", () => {
    expect(readInputs(DEFAULT_INPUTS)).toEqual({
      mode: "release",
      baselineCommit: "",
      bump: "auto",
      dryRun: false,
      githubToken: "tok",
    });
  });

  it("baseline and check mode are trimmed and read", () => {
    expect(
      readInputs({ ...DEFAULT_INPUTS, "INPUT_BASELINE-COMMIT": " abc123 ", INPUT_MODE: "check" })
    ).toMatchObject({
      baselineCommit: "abc123",
      mode: "check",
    });
  });

  it("unknown mode throws", () => {
    expect(() => readInputs({ ...DEFAULT_INPUTS, INPUT_MODE: "bogus" })).toThrow(
      "must be 'release' or 'check'"
    );
  });
});

describe("RUNTIME_INSTALL_FLAGS", () => {
  it("ci.yml checks the config loads from an install with the same flags", () => {
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain(
      `npm ci ${RUNTIME_INSTALL_FLAGS.join(" ")}`
    );
  });
});

describe("readInputs dry-run", () => {
  it("true is read as a dry run", () => {
    expect(readInputs({ ...DEFAULT_INPUTS, "INPUT_DRY-RUN": "true" }).dryRun).toBe(true);
  });

  it.each(["", "yes", "TRUE"])("'%s' throws", (value) => {
    expect(() => readInputs({ ...DEFAULT_INPUTS, "INPUT_DRY-RUN": value })).toThrow(
      "must be 'true' or 'false'"
    );
  });
});

describe("semanticReleaseArgs", () => {
  it("dry run adds --dry-run to the config argument", () => {
    const args = semanticReleaseArgs(readInputs({ ...DEFAULT_INPUTS, "INPUT_DRY-RUN": "true" }), "/action");
    expect(args).toEqual(["--extends", "/action/release.config.mjs", "--dry-run"]);
  });

  it("real release passes only the config", () => {
    expect(semanticReleaseArgs(readInputs(DEFAULT_INPUTS), "/action")).toEqual([
      "--extends",
      "/action/release.config.mjs",
    ]);
  });
});

describe("readInputs bump", () => {
  it.each(["auto", "patch", "minor", "major"])("'%s' is read as is", (value) => {
    expect(readInputs({ ...DEFAULT_INPUTS, INPUT_BUMP: value }).bump).toBe(value);
  });

  it.each(["", "Major", "1.2.0"])("'%s' throws", (value) => {
    expect(() => readInputs({ ...DEFAULT_INPUTS, INPUT_BUMP: value })).toThrow(
      "must be one of auto, patch, minor, major"
    );
  });
});

describe("releaseEnv bump", () => {
  it("forced bump reaches release.config.mjs through RELEASE_BUMP", () => {
    const env = releaseEnv(readInputs({ ...DEFAULT_INPUTS, INPUT_BUMP: "major" }), {
      GITHUB_REF_NAME: "main",
    });
    expect(env.RELEASE_BUMP).toBe("major");
  });
});

// Runs the built action (dist/main.js) in a child process against fixture repositories, with the
// environment GitHub Actions would provide. Needs `npm run build` first (npm test does it).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOutputs } from "./helpers.ts";
import { createFixture, type Scenario } from "./fixtures.ts";

const MAIN = resolve("dist/main.js");

interface Run {
  status: number | null;
  failedChecks: string;
  summary: string;
  stdout: string;
}

/**
 * Runs the action in check mode on a pull request branch, so no network checks apply. `inputs`
 * replaces the INPUT_* variables, which the runner always sets from action.yml.
 */
function runAction(scenario: Scenario, inputs: Record<string, string> = {}, useBaseline = false): Run {
  const root = mkdtempSync(join(tmpdir(), "e2e-"));
  const fixture = createFixture(join(root, "repo"), scenario, "o/r", "staging");
  const outputFile = join(root, "output");
  writeFileSync(outputFile, ""); // the runner creates GITHUB_OUTPUT before the step starts
  const summaryFile = join(root, "summary.md");
  writeFileSync(summaryFile, "");
  const result = spawnSync("node", [MAIN], {
    cwd: fixture.dir,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GITHUB_REF_NAME: "7/merge",
      GITHUB_REPOSITORY: "o/r",
      GITHUB_OUTPUT: outputFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      INPUT_MODE: "check",
      "INPUT_BASELINE-COMMIT": useBaseline ? fixture.baseline : "",
      INPUT_BUMP: "auto",
      "INPUT_DRY-RUN": "false",
      "INPUT_GITHUB-TOKEN": "",
      ...inputs,
    },
  });
  const output = existsSync(outputFile) ? readFileSync(outputFile, "utf8") : "";
  return {
    status: result.status,
    failedChecks: parseOutputs(output)["failed-checks"] ?? "",
    summary: existsSync(summaryFile) ? readFileSync(summaryFile, "utf8") : "",
    stdout: result.stdout,
  };
}

describe("dist/main.js in check mode", () => {
  it("healthy repository exits 0 with no failed checks", () => {
    const run = runAction("healthy");
    expect(run.status).toBe(0);
    expect(run.failedChecks).toBe("");
    expect(run.summary).toContain("preconditions pass");
  });

  it("non-conventional commit without a baseline exits 1 and names the check", () => {
    const run = runAction("legacy-commits");
    expect(run.status).toBe(1);
    expect(run.failedChecks).toBe("commit-messages");
    expect(run.summary).toContain("Legacy message");
    expect(run.summary).toContain("mode: check");
  });

  it("same history with the baseline set exits 0", () => {
    const run = runAction("legacy-commits", {}, true);
    expect(run.status).toBe(0);
    expect(run.failedChecks).toBe("");
  });

  it("baseline that is not in the history fails only baseline-commit", () => {
    const run = runAction("healthy", { "INPUT_BASELINE-COMMIT": "deadbeef" });
    expect(run.status).toBe(1);
    expect(run.failedChecks).toBe("baseline-commit");
  });

  it("package.json naming another repository fails package-repository with the fix command", () => {
    const run = runAction("wrong-repository");
    expect(run.failedChecks).toBe("package-repository");
    expect(run.summary).toContain(
      "npm pkg set repository.type=git repository.url=git+https://github.com/o/r.git"
    );
  });

  it("action pinned by tag fails actions-pinned and lists the line", () => {
    const run = runAction("unpinned");
    expect(run.failedChecks).toBe("actions-pinned");
    expect(run.summary).toContain(".github/workflows/ci.yml:2: actions/checkout@v4");
  });

  it("shallow clone fails full-history only", () => {
    const run = runAction("shallow");
    expect(run.failedChecks).toBe("full-history");
  });

  it("unknown mode exits 1 with an error annotation", () => {
    const run = runAction("healthy", { INPUT_MODE: "bogus" });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("::error::Input 'mode' must be 'release' or 'check'");
  });
});

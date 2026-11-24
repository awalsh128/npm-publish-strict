import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { failureMarkdown, report, summaryMarkdown } from "../src/report.js";
import type { Check, CheckResult, Failure } from "../src/types.js";

const check: Check = { id: "demo", title: "Demo check", run: () => null };
const failure: Failure = {
  problem: "Something is wrong.",
  details: ["a.yml:1: x"],
  automated: [{ label: "Fix it", command: "npm pkg set version=1" }],
  manual: ["Go to Settings.", "  with:\n    fetch-depth: 0", "Then save."],
  links: [{ text: "Docs", url: "https://example.com" }],
};

describe("failureMarkdown", () => {
  const md = failureMarkdown(check, failure);

  it("includes problem, details, automated command and link", () => {
    expect(md).toContain("### ❌ Demo check (`demo`)");
    expect(md).toContain("- a.yml:1: x");
    expect(md).toContain("```bash\nnpm pkg set version=1\n```");
    expect(md).toContain("- [Docs](https://example.com)");
  });

  it("numbers manual steps and renders indented ones as code under the previous step", () => {
    expect(md).toContain(
      "1. Go to Settings.\n   ```yaml\n   with:\n     fetch-depth: 0\n   ```\n2. Then save."
    );
  });
});

describe("summaryMarkdown", () => {
  it("all passing lists every check", () => {
    expect(summaryMarkdown({}, [{ check, failure: null }])).toContain("## ✅ All 1 preconditions pass");
  });

  it("failures end with how to verify the fixes", () => {
    const md = summaryMarkdown({ GITHUB_WORKFLOW: "Release" }, [{ check, failure }]);
    expect(md).toContain("## ❌ 1 precondition(s) failed");
    expect(md).toContain("mode: check");
    expect(md).toContain("Actions > Release > Re-run failed jobs");
  });
});

describe("report", () => {
  const results: CheckResult[] = [{ check, failure }];
  const fakeLog = () => {
    const errors: string[] = [];
    return {
      errors,
      log: {
        info: () => undefined,
        warn: () => undefined,
        error: (m: string) => errors.push(m),
        group: () => ({ dispose: () => undefined }),
      },
    };
  };

  afterEach(() => vi.unstubAllEnvs());

  it("failure returns false, annotates, and writes the job summary", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "sum-")), "summary.md");
    writeFileSync(file, "");
    vi.stubEnv("GITHUB_STEP_SUMMARY", file);
    const { log, errors } = fakeLog();
    expect(await report({ env: { GITHUB_STEP_SUMMARY: file } }, results, log)).toBe(false);
    expect(errors).toEqual(["Demo check (demo): Something is wrong."]);
    expect(readFileSync(file, "utf8")).toContain("Verify the fixes");
  });

  it("success returns true", async () => {
    expect(await report({ env: {} }, [{ check, failure: null }], fakeLog().log)).toBe(true);
  });
});

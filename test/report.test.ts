import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
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
    expect(md).toContain("1. Go to Settings.\n   ```yaml\n   with:\n     fetch-depth: 0\n   ```\n2. Then save.");
  });
});

describe("summaryMarkdown", () => {
  it("all passing lists every check", () => {
    expect(summaryMarkdown({}, [{ check, failures: [] }])).toContain("## ✅ All 1 preconditions pass");
  });

  it("failures end with how to verify the fixes", () => {
    const md = summaryMarkdown({ GITHUB_WORKFLOW: "Release" }, [{ check, failures: [failure] }]);
    expect(md).toContain("## ❌ 1 precondition(s) failed");
    expect(md).toContain("mode: check");
    expect(md).toContain("Actions > Release > Re-run failed jobs");
  });
});

describe("report", () => {
  const results: CheckResult[] = [{ check, failures: [failure] }];

  it("failure returns false, annotates, and writes the job summary", () => {
    const file = join(mkdtempSync(join(tmpdir(), "sum-")), "summary.md");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(report({ env: { GITHUB_STEP_SUMMARY: file } }, results)).toBe(false);
    expect(log).toHaveBeenCalledWith("::error title=Demo check (demo)::Something is wrong.");
    expect(readFileSync(file, "utf8")).toContain("Verify the fixes");
    log.mockRestore();
  });

  it("success returns true", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(report({ env: {} }, [{ check, failures: [] }])).toBe(true);
    log.mockRestore();
  });
});

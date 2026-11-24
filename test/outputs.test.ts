import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Log } from "../src/logger.js";
import { OUTPUTS_FILE, outputsArtifactName, parseOutputFile, publishOutputsJson } from "../src/outputs.js";

const fakeLog = () => {
  const warnings: string[] = [];
  const infos: string[] = [];
  const log: Log = {
    info: (m) => infos.push(m),
    warn: (m) => warnings.push(m),
    error: () => undefined,
    group: () => ({ dispose: () => undefined }),
  };
  return { log, warnings, infos };
};

/** A temp directory holding a GITHUB_OUTPUT file with `content`, and an empty RUNNER_TEMP next to it. */
const stepFiles = (content: string) => {
  const root = mkdtempSync(join(tmpdir(), "outputs-"));
  const outputFile = join(root, "output");
  writeFileSync(outputFile, content);
  const runnerTemp = join(root, "temp");
  mkdirSync(runnerTemp);
  return { outputFile, runnerTemp };
};

describe("parseOutputFile", () => {
  it("name=value lines return each pair", () => {
    expect(parseOutputFile("failed-checks=a,b\nreleased=true\n")).toEqual({
      "failed-checks": "a,b",
      released: "true",
    });
  });

  it("delimited block returns the multi-line value", () => {
    const text = "release-notes<<ghadelimiter_1\n## Features\n\n- one\nghadelimiter_1\nversion=1.2.3\n";
    expect(parseOutputFile(text)).toEqual({ "release-notes": "## Features\n\n- one", version: "1.2.3" });
  });

  it("empty value returns an empty string", () => {
    expect(parseOutputFile("version=\n")).toEqual({ version: "" });
  });

  it("repeated name keeps the last value", () => {
    expect(parseOutputFile("version=1\nversion=2\n")).toEqual({ version: "2" });
  });

  it("CRLF line endings return the same pairs", () => {
    expect(parseOutputFile("a=1\r\nb=2\r\n")).toEqual({ a: "1", b: "2" });
  });

  it("unterminated block returns the pairs before it", () => {
    expect(parseOutputFile("a=1\nnotes<<end\nnever closed")).toEqual({ a: "1" });
  });

  it("empty text returns no outputs", () => {
    expect(parseOutputFile("")).toEqual({});
  });
});

describe("outputsArtifactName", () => {
  it("job, step and attempt are part of the name", () => {
    expect(
      outputsArtifactName({ GITHUB_JOB: "release", GITHUB_ACTION: "publish", GITHUB_RUN_ATTEMPT: "2" })
    ).toBe("npm-publish-strict-outputs-release-publish-2");
  });

  it("characters outside word, dot and dash become dashes", () => {
    expect(outputsArtifactName({ GITHUB_JOB: "build / release", GITHUB_ACTION: "__run_2" })).toBe(
      "npm-publish-strict-outputs-build-release-__run_2-1"
    );
  });

  it("unset variables fall back to fixed words", () => {
    expect(outputsArtifactName({})).toBe("npm-publish-strict-outputs-job-step-1");
  });
});

describe("publishOutputsJson", () => {
  it("outputs file uploads outputs.json holding every output", async () => {
    const { outputFile, runnerTemp } = stepFiles("failed-checks=\nversion=1.2.3\n");
    const upload = vi.fn().mockResolvedValue(undefined);

    await publishOutputsJson({ GITHUB_OUTPUT: outputFile, RUNNER_TEMP: runnerTemp }, upload, fakeLog().log);

    const [name, file, directory] = upload.mock.calls[0] as [string, string, string];
    expect(name).toBe("npm-publish-strict-outputs-job-step-1");
    expect(file).toBe(OUTPUTS_FILE);
    expect(JSON.parse(readFileSync(join(directory, file), "utf8"))).toEqual({
      "failed-checks": "",
      version: "1.2.3",
    });
  });

  it("successful upload logs the artifact name and does not warn", async () => {
    const { outputFile, runnerTemp } = stepFiles("a=1\n");
    const { log, warnings, infos } = fakeLog();

    await publishOutputsJson(
      { GITHUB_OUTPUT: outputFile, RUNNER_TEMP: runnerTemp },
      () => Promise.resolve(),
      log
    );

    expect(warnings).toEqual([]);
    expect(infos).toEqual([expect.stringContaining("npm-publish-strict-outputs-job-step-1")]);
  });

  it("failed upload warns with the reason and does not throw", async () => {
    const { outputFile, runnerTemp } = stepFiles("a=1\n");
    const { log, warnings } = fakeLog();

    await publishOutputsJson(
      { GITHUB_OUTPUT: outputFile, RUNNER_TEMP: runnerTemp },
      () => Promise.reject(new Error("no runtime token")),
      log
    );

    expect(warnings).toEqual(["Could not upload outputs.json: no runtime token"]);
  });

  it("missing GITHUB_OUTPUT uploads an empty object", async () => {
    const { runnerTemp } = stepFiles("");
    const upload = vi.fn().mockResolvedValue(undefined);

    await publishOutputsJson({ RUNNER_TEMP: runnerTemp }, upload, fakeLog().log);

    const [, file, directory] = upload.mock.calls[0] as [string, string, string];
    expect(JSON.parse(readFileSync(join(directory, file), "utf8"))).toEqual({});
  });

  it("unreadable GITHUB_OUTPUT warns and does not upload", async () => {
    const { runnerTemp } = stepFiles("");
    const upload = vi.fn();
    const { log, warnings } = fakeLog();

    await publishOutputsJson(
      { GITHUB_OUTPUT: join(runnerTemp, "absent"), RUNNER_TEMP: runnerTemp },
      upload,
      log
    );

    expect(upload).not.toHaveBeenCalled();
    expect(warnings).toEqual([expect.stringContaining("Could not upload outputs.json")]);
  });
});

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Log } from "./logger.js";

type Env = Record<string, string | undefined>;

/** Name of the JSON file, inside the workflow artifact, that holds every output. */
export const OUTPUTS_FILE = "outputs.json";

/** Uploads `file` (in `directory`) as a workflow artifact called `name`. */
export type UploadArtifact = (name: string, file: string, directory: string) => Promise<void>;

/**
 * Parses a GITHUB_OUTPUT file: `name=value` lines and `name<<DELIMITER` blocks, which is what
 * `core.setOutput` writes (also from the release step's own process, so every output of the run is here).
 * A later value replaces an earlier one for the same name, as it does for the runner.
 */
export function parseOutputFile(text: string): Record<string, string> {
  const outputs: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const block = /^([\w-]+)<<(.+)$/.exec(lines[i] ?? "");
    if (block?.[1] && block[2]) {
      const end = lines.indexOf(block[2], i + 1);
      if (end === -1) break;
      outputs[block[1]] = lines.slice(i + 1, end).join("\n");
      i = end;
      continue;
    }
    const pair = /^([\w-]+)=(.*)$/.exec(lines[i] ?? "");
    if (pair?.[1] !== undefined) outputs[pair[1]] = pair[2] ?? "";
  }
  return outputs;
}

/**
 * Artifact names must be unique within a run, and one workflow can run this action in several jobs, steps
 * and re-run attempts, so the name carries all three.
 */
export function outputsArtifactName(env: Env): string {
  const part = (value: string | undefined, fallback: string): string =>
    (value ?? fallback).replace(/[^\w.-]+/g, "-");
  return [
    "npm-publish-strict-outputs",
    part(env.GITHUB_JOB, "job"),
    part(env.GITHUB_ACTION, "step"),
    part(env.GITHUB_RUN_ATTEMPT, "1"),
  ].join("-");
}

/**
 * Writes every output of this step to `outputs.json` and uploads it as a workflow artifact. Diagnostics
 * are never fatal: a missing output file or a failed upload is a warning, so the run's own result stands.
 *
 * @param upload Uploads the file; injected so tests need no artifact service.
 */
export async function publishOutputsJson(env: Env, upload: UploadArtifact, log: Log): Promise<void> {
  try {
    const outputFile = env.GITHUB_OUTPUT;
    const outputs = outputFile ? parseOutputFile(readFileSync(outputFile, "utf8")) : {};
    const directory = join(env.RUNNER_TEMP ?? tmpdir(), "npm-publish-strict-outputs");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, OUTPUTS_FILE), `${JSON.stringify(outputs, null, 2)}\n`);
    await upload(outputsArtifactName(env), OUTPUTS_FILE, directory);
    log.info(`Uploaded all outputs as ${OUTPUTS_FILE} in the workflow artifact ${outputsArtifactName(env)}.`);
  } catch (error) {
    log.warn(`Could not upload ${OUTPUTS_FILE}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Uploads through `@actions/artifact`, loaded only when `output-json` asks for it. */
export const uploadArtifact: UploadArtifact = async (name, file, directory) => {
  const { DefaultArtifactClient } = await import("@actions/artifact");
  await new DefaultArtifactClient().uploadArtifact(name, [join(directory, file)], directory);
};

// Run by release.config.mjs before the npm plugin prepares the package: replaces the placeholder
// versions of internal dependencies with their latest released versions, so the published manifest
// depends on real versions. The change stays in the CI workspace; releases never commit.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePins, pinDependencies } from "./workspace.js";
const env = process.env;
const pins = parsePins(env.PIN_DEPENDENCIES ?? "");
if (pins.length > 0) {
    const file = join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    const tags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).split("\n").filter(Boolean);
    // Only the official branch publishes, so only its releases may depend on official releases.
    const stableOnly = env.GITHUB_REF_NAME === (env.BRANCH_RELEASE ?? "main");
    const { pkg: pinned, pinned: specs } = pinDependencies(pkg, pins, tags, stableOnly);
    writeFileSync(file, `${JSON.stringify(pinned, null, 2)}\n`);
    for (const [name, spec] of Object.entries(specs))
        console.log(`Pinned ${name} to ${spec}`);
}

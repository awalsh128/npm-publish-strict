// Checks the consumer's package.json against the conventions this action enforces.
// Usage: node validate-package.mjs <docs-script>
import { readFileSync } from "node:fs";

const docsScript = process.argv[2];
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const errors = [];

if (pkg.version !== "0.0.0-semantically-released")
  errors.push(`"version" must be the placeholder "0.0.0-semantically-released" (releases never commit).`);
if (!pkg.repository)
  errors.push(`"repository" is required for npm trusted publishing and provenance.`);
if (!pkg.scripts?.[docsScript]) errors.push(`npm script "${docsScript}" (typedoc) is required.`);
if (!pkg.files?.length) errors.push(`"files" must list what is packaged.`);
if (pkg.private) errors.push(`"private" must not be true.`);

if (errors.length) {
  for (const e of errors) console.log(`::error::package.json: ${e}`);
  process.exit(1);
}

import { readFileSync } from "node:fs";

// data/commit-types.json is the only list of commit types (see AGENTS.md).
const types = JSON.parse(
  readFileSync(new URL("data/commit-types.json", import.meta.url), "utf8"),
).map((t) => t.type);

export default {
  extends: ["@commitlint/config-conventional"],
  rules: { "type-enum": [2, "always", types] },
};

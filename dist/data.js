import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/** The data/ directory at the action root; src/ and dist/ both sit one level below it. */
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
/** Reads a JSON file from data/. */
export function readJson(name) {
    return JSON.parse(readFileSync(join(DATA_DIR, name), "utf8"));
}
/** Renders a markdown template from data/templates/, replacing each {{key}} with its value. */
export function renderTemplate(name, values = {}) {
    const text = readFileSync(join(DATA_DIR, "templates", name), "utf8").replace(/\n+$/, "");
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ""));
}

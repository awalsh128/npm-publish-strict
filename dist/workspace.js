import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { PLACEHOLDER_VERSION } from "./constants.js";
import { latestVersion, pinRange, tagPrefix, VERSION_VARIABLE } from "./semver.js";
/**
 * The directory holding package-lock.json: `cwd`, or its nearest ancestor up to `root`. Workspaces
 * keep one lockfile at the repository root. Returns null when there is none.
 */
export function findLockfileDir(cwd, root) {
    const top = resolve(root);
    let dir = resolve(cwd);
    while (!relative(top, dir).startsWith("..")) {
        if (existsSync(join(dir, "package-lock.json")))
            return dir;
        if (dir === top)
            break;
        dir = dirname(dir);
    }
    return null;
}
/** Splits a multi-value input on newlines and commas, dropping blanks. */
export function splitList(value) {
    return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}
/**
 * Parses the `pin-dependencies` input: one `name=tag-format` per line, where the tag format is the
 * dependency's `tag-format` input, such as `@scope/base=base-v${version}`.
 */
export function parsePins(value) {
    return splitList(value).map((line) => {
        const [name, format, ...rest] = line.split("=").map((part) => part.trim());
        const prefix = format ? tagPrefix(format) : null;
        if (!name || prefix === null || rest.length > 0) {
            throw new Error(`Input 'pin-dependencies' must be 'name=tag-format' lines ending in ${VERSION_VARIABLE}, not '${line}'.`);
        }
        return { name, tagPrefix: prefix };
    });
}
const DEPENDENCY_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies"];
/**
 * Replaces each placeholder-versioned dependency listed in `pins` with `^<latest released version>`,
 * which is what `npm publish` should write into the published manifest. Throws when a pinned
 * dependency has no release yet, because publishing would leave the placeholder in the package.
 *
 * @returns The manifest to publish and the spec written for each dependency.
 */
export function pinDependencies(pkg, pins, tags, stableOnly) {
    const pinned = {};
    const result = structuredClone(pkg);
    for (const pin of pins) {
        for (const field of DEPENDENCY_FIELDS) {
            const deps = result[field];
            if (deps?.[pin.name] !== PLACEHOLDER_VERSION)
                continue;
            const version = latestVersion(tags, pin.tagPrefix, stableOnly);
            if (!version) {
                throw new Error(`'${pin.name}' has no release tagged '${pin.tagPrefix}<version>', so '${pkg.name}' can't depend on it yet. Release it first.`);
            }
            deps[pin.name] = pinned[pin.name] = pinRange(version);
        }
    }
    return { pkg: result, pinned };
}

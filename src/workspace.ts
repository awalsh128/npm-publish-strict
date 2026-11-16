import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { PLACEHOLDER_VERSION } from "./placeholder.js";
import type { PackageJson } from "./types.js";

/** The text semantic-release replaces with the version in a tag format. */
const VERSION_VARIABLE = "${version}";

/** An internal dependency whose placeholder version is replaced by its latest released version. */
export interface PinSpec {
  /** The dependency's package name. */
  name: string;
  /** The text of its tags before the version, such as `winston-host-v`. */
  tagPrefix: string;
}

/**
 * The directory holding package-lock.json: `cwd`, or its nearest ancestor up to `root`. Workspaces
 * keep one lockfile at the repository root. Returns null when there is none.
 */
export function findLockfileDir(cwd: string, root: string): string | null {
  const top = resolve(root);
  let dir = resolve(cwd);
  while (!relative(top, dir).startsWith("..")) {
    if (existsSync(join(dir, "package-lock.json"))) return dir;
    if (dir === top) break;
    dir = dirname(dir);
  }
  return null;
}

/** Splits a multi-value input on newlines and commas, dropping blanks. */
export function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Parses the `pin-dependencies` input: one `name=tag-format` per line, where the tag format is the
 * dependency's `tag-format` input, such as `@scope/base=base-v${version}`.
 */
export function parsePins(value: string): PinSpec[] {
  return splitList(value).map((line) => {
    const [name, format, ...rest] = line.split("=").map((part) => part.trim());
    if (!name || !format || rest.length > 0 || !format.endsWith(VERSION_VARIABLE)) {
      throw new Error(`Input 'pin-dependencies' must be 'name=tag-format' lines ending in ${VERSION_VARIABLE}, not '${line}'.`);
    }
    return { name, tagPrefix: format.slice(0, -VERSION_VARIABLE.length) };
  });
}

/** Parses `1.2.3` or `1.2.3-rc.1`; null for anything else. */
function parseVersion(version: string): { core: number[]; pre: string[] } | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4]?.split(".") ?? [] };
}

/** Orders versions as semver does: a release is above its prereleases. Negative when `a` is lower. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) throw new Error(`Not a version: '${x ? b : a}'.`);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return (x.core[i] ?? 0) - (y.core[i] ?? 0);
  if (x.pre.length === 0 || y.pre.length === 0) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const numeric = /^\d+$/.test(p) && /^\d+$/.test(q);
    return numeric ? Number(p) - Number(q) : p < q ? -1 : 1;
  }
  return 0;
}

/**
 * The highest version among `tags` of the form `<tagPrefix><version>`, or null when there is none.
 * Candidates (prereleases) count only when `stableOnly` is false.
 */
export function latestVersion(tags: readonly string[], tagPrefix: string, stableOnly: boolean): string | null {
  const versions = tags
    .filter((tag) => tag.startsWith(tagPrefix))
    .map((tag) => tag.slice(tagPrefix.length))
    .filter((version) => parseVersion(version) !== null && !(stableOnly && version.includes("-")));
  return versions.sort(compareVersions).at(-1) ?? null;
}

const DEPENDENCY_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies"] as const;

/**
 * Replaces each placeholder-versioned dependency listed in `pins` with `^<latest released version>`,
 * which is what `npm publish` should write into the published manifest. Throws when a pinned
 * dependency has no release yet, because publishing would leave the placeholder in the package.
 *
 * @returns The manifest to publish and the spec written for each dependency.
 */
export function pinDependencies(
  pkg: PackageJson,
  pins: readonly PinSpec[],
  tags: readonly string[],
  stableOnly: boolean,
): { pkg: PackageJson; pinned: Record<string, string> } {
  const pinned: Record<string, string> = {};
  const result: PackageJson = structuredClone(pkg);
  for (const pin of pins) {
    for (const field of DEPENDENCY_FIELDS) {
      const deps = result[field];
      if (deps?.[pin.name] !== PLACEHOLDER_VERSION) continue;
      const version = latestVersion(tags, pin.tagPrefix, stableOnly);
      if (!version) {
        throw new Error(`'${pin.name}' has no release tagged '${pin.tagPrefix}<version>', so '${pkg.name}' can't depend on it yet. Release it first.`);
      }
      deps[pin.name] = pinned[pin.name] = `^${version}`;
    }
  }
  return { pkg: result, pinned };
}

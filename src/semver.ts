// Everything that parses or compares versions and the tags that carry them, so the semver package
// is used in one place. release.config.mjs imports the compiled dist/semver.js.
import semver from "semver";

/** The text semantic-release replaces with the version in a tag format. */
export const VERSION_VARIABLE = "${version}";

/** True when the version `actual` is at least `min`. */
export function atLeast(actual: string, min: string): boolean {
  return semver.valid(actual) !== null && semver.gte(actual, min);
}

/** True for a prerelease such as `1.0.0-rc.1`; a hyphen in build metadata (`1.0.0+a-b`) does not count. */
export function isPrerelease(version: string): boolean {
  return semver.prerelease(version) !== null;
}

/** The dependency range written for a released version. */
export function pinRange(version: string): string {
  return `^${version}`;
}

/** The text before the version in a tag format such as `base-v${version}`, or null when it doesn't end with the variable. */
export function tagPrefix(format: string): string | null {
  return format.endsWith(VERSION_VARIABLE) ? format.slice(0, -VERSION_VARIABLE.length) : null;
}

/** The version in `tag` after `prefix`, or null when the tag has another prefix or isn't a plain version. */
export function versionFromTag(tag: string, prefix: string): string | null {
  if (!tag.startsWith(prefix)) return null;
  const version = tag.slice(prefix.length);
  return semver.valid(version) === version ? version : null;
}

/**
 * The highest version among `tags` of the form `<prefix><version>`, or null when there is none.
 * Candidates (prereleases) count only when `stableOnly` is false.
 */
export function latestVersion(tags: readonly string[], prefix: string, stableOnly: boolean): string | null {
  const versions = tags
    .map((tag) => versionFromTag(tag, prefix))
    .filter((version): version is string => version !== null && !(stableOnly && isPrerelease(version)));
  return versions.sort(semver.compare).at(-1) ?? null;
}

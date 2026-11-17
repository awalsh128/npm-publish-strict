// Everything that parses or compares versions, so the semver package is used in one place.
// release.config.mjs imports the compiled dist/semver.js.
import semver from "semver";

/** True when the version `actual` is at least `min`. */
export function atLeast(actual: string, min: string): boolean {
  return semver.valid(actual) !== null && semver.gte(actual, min);
}

/** True for a prerelease such as `1.0.0-rc.1`; a hyphen in build metadata (`1.0.0+a-b`) does not count. */
export function isPrerelease(version: string): boolean {
  return semver.prerelease(version) !== null;
}

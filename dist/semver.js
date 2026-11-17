// Everything that parses or compares versions, so the semver package is used in one place.
import semver from "semver";
/** True when the version `actual` is at least `min`. */
export function atLeast(actual, min) {
    return semver.valid(actual) !== null && semver.gte(actual, min);
}
/**
 * The highest version among `tags` of the form `<tagPrefix><version>`, or null when there is none.
 * Candidates (prereleases) count only when `stableOnly` is false.
 */
export function latestVersion(tags, tagPrefix, stableOnly) {
    const versions = tags
        .filter((tag) => tag.startsWith(tagPrefix))
        .map((tag) => tag.slice(tagPrefix.length))
        .filter((version) => semver.valid(version) === version && !(stableOnly && semver.prerelease(version)));
    return versions.sort(semver.compare).at(-1) ?? null;
}

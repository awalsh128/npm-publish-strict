// Everything that parses or compares versions, so the semver package is used in one place.
// release.config.mjs imports the compiled dist/semver.js.
import semver from "semver";

/** A valid semantic version such as `1.2.3` or `1.0.0-rc.1`. Build with {@link Version.parse}. */
export class Version {
  private constructor(
    /** The version text, exactly as parsed. */
    readonly value: string,
  ) {}

  /** The version in `text`, or null unless `text` is exactly a valid version (no `v`, no whitespace). */
  static parse(text: string): Version | null {
    const parsed = semver.parse(text);
    // semver.parse accepts a leading `v` and whitespace and its `version` drops build metadata, so rebuild the exact text.
    const exact =
      parsed &&
      [
        parsed.version,
        ...(parsed.build.length > 0 ? [parsed.build.join(".")] : []),
      ].join("+");
    return exact === text ? new Version(text) : null;
  }

  /** True for a prerelease such as `1.0.0-rc.1`; a hyphen in build metadata (`1.0.0+a-b`) does not count. */
  get isPrerelease(): boolean {
    return semver.prerelease(this.value) !== null;
  }

  /** The major number, such as 2 for `2.0.0-rc.1`. */
  get major(): number {
    return semver.major(this.value);
  }

  /** `major.minor.patch` without prerelease or build metadata, such as `2.0.0` for `2.0.0-rc.1`. */
  get core(): string {
    return [
      semver.major(this.value),
      semver.minor(this.value),
      semver.patch(this.value),
    ].join(".");
  }

  /** True when this version is at least `min`. */
  atLeast(min: string): boolean {
    return semver.gte(this.value, min);
  }

  toString(): string {
    return this.value;
  }
}

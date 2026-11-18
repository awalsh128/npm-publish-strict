import type { Version } from "../src/semver.ts";

/** What promoting staging to main would release. */
export interface PromotionPlan {
  /** The official version, such as `2.0.0`. */
  next: string;
  /** True when it starts a new major, or is the first official release. */
  isMajor: boolean;
}

function latest(versions: readonly Version[]): Version | undefined {
  return versions.reduce<Version | undefined>(
    (max, v) => (max && max.atLeast(v.value) ? max : v),
    undefined,
  );
}

/**
 * The official version is the latest release candidate on staging without its `-rc.N` suffix.
 * Returns null when staging has no candidate, since then there is nothing to promote.
 */
export function planPromotion(
  stagingVersions: readonly Version[],
  mainVersions: readonly Version[],
): PromotionPlan | null {
  const candidate = latest(stagingVersions.filter((v) => v.isPrerelease));
  if (!candidate) return null;
  const official = latest(mainVersions.filter((v) => !v.isPrerelease));
  return {
    next: candidate.core,
    isMajor: !official || candidate.major > official.major,
  };
}

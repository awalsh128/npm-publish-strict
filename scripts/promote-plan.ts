import type { Version } from "../src/semver.ts";

/** What promoting staging to main would release. */
export interface PromotionPlan {
  /** The official version, such as `2.0.0`. */
  next: string;
  /** True when it starts a new major, or is the first official release. */
  isMajor: boolean;
}

function latest(versions: readonly Version[]): Version | undefined {
  return versions.reduce<Version | undefined>((max, v) => (max && max.atLeast(v.value) ? max : v), undefined);
}

/**
 * The official version is the latest release candidate on staging without its `-rc.N` suffix.
 * Returns null when there is nothing new to release: staging has no candidate, or its latest one
 * was already released (main fast-forwards, but the release finds no relevant changes).
 */
export function planPromotion(
  stagingVersions: readonly Version[],
  mainVersions: readonly Version[]
): PromotionPlan | null {
  const candidate = latest(stagingVersions.filter((v) => v.isPrerelease));
  const official = latest(mainVersions.filter((v) => !v.isPrerelease));
  if (!candidate || official?.atLeast(candidate.core)) return null;
  return {
    next: candidate.core,
    isMajor: !official || candidate.major > official.major,
  };
}

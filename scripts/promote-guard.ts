// Usage: STAGING_SHA=<sha> CONFIRM=<version> node scripts/promote-guard.ts
// Fails when promoting STAGING_SHA to main would release a new major and CONFIRM is not that version.
// A major can strand users of the previous one, since there is no maintenance branch to fix it.
import { execFileSync } from "node:child_process";
import type * as Semver from "../src/semver.ts";
import { planPromotion } from "./promote-plan.ts";

// From the committed bundle: promote runs without an install, and Node's type stripping can't run
// src/semver.ts (it uses a parameter property).
const { Version }: typeof Semver = await import(
  new URL("../dist/semver.js", import.meta.url).href
);

/** Versions of the `v<version>` tags reachable from `ref`. */
function versionsOn(ref: string): Semver.Version[] {
  return execFileSync("git", ["tag", "--merged", ref, "--list", "v*"], {
    encoding: "utf8",
  })
    .split("\n")
    .flatMap((tag) => Version.parse(tag.slice("v".length)) ?? []);
}

const plan = planPromotion(
  versionsOn(process.env.STAGING_SHA || "HEAD"),
  versionsOn("origin/main"),
);
console.log(
  plan
    ? `Promotion releases ${plan.next}${plan.isMajor ? " (major)" : ""}.`
    : "No candidate on staging.",
);
if (plan?.isMajor && process.env.CONFIRM !== plan.next) {
  console.log(
    `::error::${plan.next} is a major release. Run Promote again with confirm-major set to ${plan.next}.`,
  );
  process.exitCode = 1;
}

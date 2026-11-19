import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { Check, CheckResult, Context, PackageJson } from "./types.js";
import {
  CANDIDATE_BRANCH,
  CONVENTIONAL_HEADER,
  DOCS_SCRIPT,
  MIN_NPM,
  PLACEHOLDER_VERSION,
  RELEASE_BRANCH,
} from "./constants.js";
import { LINKS } from "./links.js";
import { Version } from "./semver.js";

/**
 * Returns `owner/repo` (lower case) from a package.json `repository` URI on github.com or `github:owner/repo`,
 * or null. scp-style (`git@github.com:o/r`) and bare `owner/repo` are not URIs, so they return null.
 */
export function repoSlug(repository: PackageJson["repository"]): string | null {
  const url = typeof repository === "string" ? repository : repository?.url;
  if (!url || !URL.canParse(url)) return null;
  const { protocol, hostname, pathname } = new URL(url);
  if (protocol !== "github:" && hostname !== "github.com") return null;
  const [owner, repo = ""] = pathname.replace(/^\//, "").split("/");
  const name = repo.endsWith(".git") ? repo.slice(0, -".git".length) : repo;
  return owner && name ? `${owner}/${name}`.toLowerCase() : null;
}

/** The workflow file name from GITHUB_WORKFLOW_REF; defaults to release.yml. */
export function workflowFile(env: Context["env"]): string {
  // GITHUB_WORKFLOW_REF is `owner/repo/.github/workflows/<file>@<ref>`.
  const [path = ""] = (env.GITHUB_WORKFLOW_REF ?? "").split("@");
  return basename(path) || "release.yml";
}

/** `uses:` lines that are neither local, docker, nor pinned to a 40-character commit SHA. */
export function findUnpinnedActions(text: string, file: string): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line, i) => {
    const ref = /^\s*-?\s*uses:\s*["']?([^\s"'#]+)/.exec(line)?.[1];
    if (!ref || ref.startsWith("./") || ref.startsWith("docker://")) return;
    if (!/@[0-9a-f]{40}$/.test(ref)) found.push(`${file}:${i + 1}: ${ref}`);
  });
  return found;
}

function listWorkflowFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && [".yml", ".yaml"].includes(extname(e.name)))
    .map((e) => join(e.parentPath, e.name));
}

/** True when the baseline is unset, or is a commit in the history of HEAD. */
const baselineIsValid = (ctx: Context): boolean =>
  !ctx.baseline || (ctx.commitExists(ctx.baseline) && ctx.isAncestor(ctx.baseline));

/** The workflow snippet that sets the action's `baseline-commit` input. */
const baselineSnippet = (sha: string | null): string => `  with:\n    baseline-commit: ${sha ?? "<sha>"}`;

/** True when this run publishes to npm, which only the official release branch does. */
const publishes = (ctx: Context): boolean => ctx.branch === RELEASE_BRANCH;

export const checks: readonly Check[] = [
  {
    id: "branch",
    title: "Release from an allowed branch",
    // Check mode never releases, so it may run from any branch, such as a pull request's.
    applies: (ctx) => ctx.mode === "release",
    run: (ctx) =>
      ctx.branch === RELEASE_BRANCH || ctx.branch === CANDIDATE_BRANCH
        ? null
        : {
            problem: `Releases run only from '${RELEASE_BRANCH}' (official) or '${CANDIDATE_BRANCH}' (release candidates), not '${ctx.branch}'.`,
            automated: [],
            manual: [
              "Edit the workflow that calls this action so its trigger is limited to those branches:",
              `  on:\n    push:\n      branches: [${RELEASE_BRANCH}, ${CANDIDATE_BRANCH}]`,
              "To verify a fix from another branch, run the action with `mode: check` instead.",
            ],
            links: [],
          },
  },
  {
    id: "package-files",
    title: "package.json and package-lock.json exist",
    run: (ctx) => {
      const missing = ["package.json", "package-lock.json"].filter(
        (file) => !existsSync(join(ctx.cwd, file))
      );
      return missing.length === 0
        ? null
        : {
            problem: `Missing: ${missing.join(", ")}.`,
            automated: [
              {
                label: "Create the lockfile and stage it",
                command: "npm install --package-lock-only && git add package-lock.json",
              },
            ],
            manual: [
              "Make sure an `actions/checkout` step runs before this action and that these files are committed, not git-ignored.",
            ],
            links: [LINKS.checkout],
          };
    },
  },
  {
    id: "package-version",
    title: "package.json keeps the placeholder version",
    run: (ctx) =>
      !ctx.pkg || ctx.pkg.version === PLACEHOLDER_VERSION
        ? null
        : {
            problem: `"version" is "${ctx.pkg.version ?? "(missing)"}". Releases never commit, so it must stay the placeholder; semantic-release writes the real version in CI.`,
            automated: [
              { label: "Reset the version", command: `npm pkg set version=${PLACEHOLDER_VERSION}` },
            ],
            manual: ["Commit the change."],
            links: [LINKS.semanticRelease],
          },
  },
  {
    id: "package-repository",
    title: "package.json repository points at this GitHub repository",
    run: (ctx) => {
      if (!ctx.pkg) return null;
      const slug = repoSlug(ctx.pkg.repository);
      if (slug && slug === ctx.repository?.toLowerCase()) return null;
      return {
        problem: slug
          ? `"repository" is ${slug} but this workflow runs in ${ctx.repository}. npm provenance and trusted publishing require them to match.`
          : `"repository" is missing or is not a github.com URL.`,
        automated: [
          {
            label: "Set the repository",
            command: `npm pkg set repository.type=git repository.url=git+https://github.com/${ctx.repository}.git`,
          },
        ],
        manual: ["Commit the change."],
        links: [LINKS.provenance, LINKS.packageJson],
      };
    },
  },
  {
    id: "package-docs-script",
    title: "package.json has the API docs script",
    run: (ctx) =>
      !ctx.pkg || ctx.pkg.scripts?.[DOCS_SCRIPT]
        ? null
        : {
            problem: `npm script "${DOCS_SCRIPT}" is missing. The release builds API docs with it before tagging.`,
            automated: [
              { label: "Install TypeDoc", command: "npm install --save-dev typedoc" },
              {
                label: "Add the script",
                command: `npm pkg set "scripts.${DOCS_SCRIPT}=typedoc --out docs/api src/index.ts"`,
              },
            ],
            manual: [
              "Adjust the entry point (src/index.ts) to your project; keep the output in docs/api.",
              `Run \`npm run ${DOCS_SCRIPT}\` locally to confirm it works, then commit.`,
            ],
            links: [LINKS.typedoc],
          },
  },
  {
    id: "package-files-field",
    title: 'package.json lists what is packaged ("files")',
    run: (ctx) =>
      !ctx.pkg || ctx.pkg.files?.length
        ? null
        : {
            problem: `"files" is missing or empty, so the published package contents are unpredictable.`,
            automated: [
              { label: "List the build output (adjust the path)", command: "npm pkg set 'files[]=dist'" },
            ],
            manual: [
              "Check with `npm pack --dry-run` that the tarball holds only what you intend to publish, then commit.",
            ],
            links: [LINKS.packageJson],
          },
  },
  {
    id: "package-private",
    title: "package.json is not private",
    run: (ctx) =>
      !ctx.pkg?.private
        ? null
        : {
            problem: `"private": true makes npm refuse to publish.`,
            automated: [{ label: "Remove the flag", command: "npm pkg delete private" }],
            manual: ["Commit the change."],
            links: [LINKS.packageJson],
          },
  },
  {
    id: "no-changelog",
    title: "No CHANGELOG.md",
    run: (ctx) =>
      !existsSync(join(ctx.cwd, "CHANGELOG.md"))
        ? null
        : {
            problem:
              "CHANGELOG.md exists. Releases never commit, so tags and GitHub Releases are the version history and the file would go stale.",
            automated: [{ label: "Remove it", command: "git rm CHANGELOG.md" }],
            manual: ["Commit the removal."],
            links: [],
          },
  },
  {
    id: "actions-pinned",
    title: "GitHub Actions are pinned to commit SHAs",
    run: (ctx) => {
      const unpinned = listWorkflowFiles(join(ctx.cwd, ".github")).flatMap((f) =>
        findUnpinnedActions(readFileSync(f, "utf8"), f.slice(ctx.cwd.length + 1))
      );
      return unpinned.length === 0
        ? null
        : {
            problem: `${unpinned.length} action reference(s) are not pinned to a full 40-character commit SHA.`,
            details: unpinned,
            automated: [
              {
                label: "Pin every workflow (resolves each tag to its SHA and keeps the tag as a comment)",
                command: "npx --yes pin-github-action .github/workflows/*.yml",
              },
            ],
            manual: [
              "Review the diff, then commit.",
              "To keep the pins fresh, add a `github-actions` ecosystem entry to .github/dependabot.yml.",
            ],
            links: [LINKS.pinning],
          };
    },
  },
  {
    id: "full-history",
    title: "Checkout has full git history",
    run: (ctx) => {
      const shallow = ctx.shallow();
      if (shallow === false) return null;
      return {
        problem:
          shallow === null
            ? "This is not a git checkout."
            : "The checkout is shallow. semantic-release needs every commit and tag to decide the next version.",
        automated: [],
        manual: [
          "In the workflow that calls this action, set the `actions/checkout` step to:",
          "  with:\n    fetch-depth: 0\n    persist-credentials: false",
        ],
        links: [LINKS.checkout],
      };
    },
  },
  {
    id: "baseline-commit",
    title: "Baseline commit is in this branch's history",
    applies: (ctx) => !!ctx.baseline && ctx.shallow() === false,
    run: (ctx) =>
      baselineIsValid(ctx)
        ? null
        : {
            problem: `baseline-commit '${ctx.baseline}' is not a commit in the history of '${ctx.branch}'.`,
            details: [
              "It must be a full or abbreviated commit SHA that is an ancestor of the commit being released.",
            ],
            automated: [
              {
                label: "Print the current commit, to start enforcing from now on",
                command: "git rev-parse HEAD",
              },
              {
                label: "Check that a commit is in this branch's history",
                command: `git merge-base --is-ancestor <sha> ${ctx.branch ?? "HEAD"} && echo ok`,
              },
            ],
            manual: [
              "Set the action's `baseline-commit` input to a SHA on this branch, for example the last commit with a non-conventional message:",
              baselineSnippet(ctx.head()),
              "Remove the input to enforce Conventional Commits on the whole history.",
            ],
            links: [LINKS.conventionalCommits],
          },
  },
  {
    id: "commit-messages",
    title: "Commits follow Conventional Commits",
    applies: (ctx) => ctx.shallow() === false,
    run: (ctx) => {
      if (!baselineIsValid(ctx)) return null; // reported above
      const bad = ctx.commits(ctx.baseline).filter((c) => !CONVENTIONAL_HEADER.test(c.subject));
      if (bad.length === 0) return null;
      const shown = bad.slice(0, 20).map((c) => `${c.hash.slice(0, 7)} ${c.subject}`);
      const head = ctx.head();
      return {
        problem: ctx.baseline
          ? `${bad.length} commit(s) after baseline ${ctx.baseline.slice(0, 7)} do not follow Conventional Commits, so semantic-release cannot version them.`
          : `${bad.length} commit(s) do not follow Conventional Commits, so semantic-release cannot version them.`,
        details: [
          ...shown,
          ...(bad.length > shown.length ? [`...and ${bad.length - shown.length} more`] : []),
        ],
        automated: [
          ...(head
            ? [
                {
                  label:
                    "Start enforcing from the current commit instead, leaving earlier history alone (then set `baseline-commit` to this SHA)",
                  command: `echo ${head}`,
                },
              ]
            : []),
          {
            label: "List the offending commits locally",
            command: `npx --yes @commitlint/cli@latest --extends @commitlint/config-conventional --from ${ctx.baseline ?? "$(git rev-list --max-parents=0 HEAD)"} --to HEAD`,
          },
        ],
        manual: [
          `Either set the action's \`baseline-commit\` input to a commit at or after the last offender, so only newer commits are enforced:`,
          baselineSnippet(head),
          "Or rewrite the messages: `git rebase -i <parent-of-oldest-offender>`, mark each as `reword`, then `git push --force-with-lease`. This rewrites shared history, so coordinate with your collaborators first.",
          "Going forward, enforce the format before merge, for example with commitlint in a husky `commit-msg` hook and in your pull request workflow.",
        ],
        links: [LINKS.conventionalCommits, LINKS.commitlint],
      };
    },
  },
  {
    id: "oidc-permission",
    title: "Workflow grants id-token: write",
    applies: publishes,
    run: (ctx) =>
      ctx.env.ACTIONS_ID_TOKEN_REQUEST_URL && ctx.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
        ? null
        : {
            problem: "The job has no OIDC token, so npm trusted publishing cannot authenticate.",
            automated: [],
            manual: [
              "Edit the workflow that calls this action and give the job:",
              "  permissions:\n    contents: write       # tags and GitHub Releases\n    id-token: write       # npm trusted publishing (OIDC)\n    issues: write\n    pull-requests: write",
              "A workflow-level `permissions: {}` is fine as long as the job sets these.",
            ],
            links: [LINKS.oidcPermissions],
          },
  },
  {
    id: "public-repository",
    title: "Repository is public, so npm provenance can be generated",
    applies: publishes,
    run: async (ctx) =>
      (await ctx.repoIsPublic()) !== false
        ? null
        : {
            problem: `${ctx.repository} is private. This action publishes with npm provenance (a signed attestation linking the package to its source and workflow), which npm only issues for public repositories.`,
            automated: [
              {
                label: "Make the repository public (irreversible for forks and stars; read the docs first)",
                command: `gh repo edit ${ctx.repository} --visibility public --accept-visibility-change-consequences`,
              },
            ],
            manual: [
              `Go to https://github.com/${ctx.repository}/settings.`,
              "Scroll to the Danger Zone and choose Change visibility > Make public.",
              "Or release from a public repository instead.",
            ],
            links: [LINKS.provenance],
          },
  },
  {
    id: "npm-version",
    title: "npm supports trusted publishing",
    applies: publishes,
    run: (ctx) => {
      const version = ctx.npmVersion();
      return version && Version.parse(version)?.atLeast(MIN_NPM)
        ? null
        : {
            problem: `npm ${version ?? "(not found)"} is older than ${MIN_NPM}, the first version with trusted publishing.`,
            automated: [],
            manual: [
              "Add a setup step before this action (Node 24 ships a new enough npm):",
              "  - uses: actions/setup-node@<sha>\n    with:\n      node-version: 24\n      cache: npm",
              "Or, on an older Node, add a step running `npm install -g npm@latest`.",
            ],
            links: [LINKS.setupNode, LINKS.trustedPublishers],
          };
    },
  },
  {
    id: "trusted-publisher",
    title: "npm trusted publisher is configured for this workflow",
    applies: (ctx) => publishes(ctx) && !!ctx.env.ACTIONS_ID_TOKEN_REQUEST_URL,
    run: async (ctx) => {
      const name = ctx.pkg?.name;
      if (!name) return null; // the package.json checks report this
      const result = await ctx.exchangeNpmToken(name);
      if (result.ok) return null;

      const [owner = "", repo = ""] = (ctx.repository ?? "/").split("/");
      const file = workflowFile(ctx.env);
      const exists = await ctx.packageExists(name);
      return {
        problem: `npm did not accept this workflow's identity as a trusted publisher of "${name}".`,
        details: [
          `npm said: ${result.status} ${result.message}`,
          exists === false
            ? `"${name}" is not on the npm registry yet.`
            : `"${name}" exists on the npm registry.`,
          "npm does not validate a trusted publisher when it is saved, so a typo only shows up here.",
        ],
        automated: [
          {
            label:
              "Create the trust relationship from your machine (needs npm login with 2FA, and npm 11.10 or later)",
            command: `npm trust github ${name} --file ${file} --repo ${owner}/${repo} --yes`,
          },
          { label: "Check what is configured", command: `npm trust list ${name}` },
        ],
        manual: [
          ...(exists === false
            ? [
                `Publish a first version of "${name}" yourself so the package exists (\`npm login\`, then \`npm publish --access public\`); trusted publishers are configured per existing package.`,
              ]
            : []),
          "Go to https://www.npmjs.com and sign in as a maintainer of the package.",
          `Click your avatar > Packages > ${name} > Settings.`,
          "Scroll to Trusted Publisher (also labelled Trusted publishing) and choose GitHub Actions.",
          `Fill in: Organization or user = ${owner}; Repository = ${repo}; Workflow filename = ${file} (filename only, with its extension).`,
          "Leave Environment empty unless the release job uses a GitHub environment; if it does, enter that exact name.",
          "Keep `npm publish` allowed, then save.",
          "A new trusted publisher must complete a successful publish within 2 days or it expires.",
        ],
        links: [LINKS.trustedPublishers, LINKS.npmTrust],
      };
    },
  },
];

/** Runs every applicable check; never stops at the first failure so the user sees everything at once. */
export async function runChecks(ctx: Context, list: readonly Check[] = checks): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of list) {
    if (check.applies && !check.applies(ctx)) continue;
    const outcome = await check.run(ctx);
    results.push({ check, failure: outcome });
  }
  return results;
}

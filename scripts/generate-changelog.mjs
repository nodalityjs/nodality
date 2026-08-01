#!/usr/bin/env node
/**
 * Draft a CHANGELOG entry for a release from the diff between two tags.
 *
 * THE INPUT IS THE WHOLE PROBLEM
 * ------------------------------
 * `git diff <prev>..<tag>` on this repo is mostly noise. inject-license
 * rewrites a `* nodality vX.Y.Z` banner into ~97 files on every release,
 * so a release that changed nothing in the library still produces a
 * 97-line diff. v1.0.204..v1.0.205 is exactly that: 97 changed lines,
 * zero of them real, because that release only touched CI.
 *
 * Handing that to a model and asking "what changed?" produces invented
 * features — not because the model is unreliable, but because the input
 * contains no changes to describe. So this script filters the banner
 * lines out and, if nothing survives, WRITES NOTHING AND EXITS 0. A
 * silent release is the correct output for a release with no library
 * changes.
 *
 *   node scripts/generate-changelog.mjs v1.0.205 [--dry-run]
 *
 * --dry-run prints the filtered diff and the prompt without calling the
 * API, so the deterministic half can be verified without a key.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MODEL = "claude-sonnet-5";
const CHANGELOG = "CHANGELOG.md";
// Only source directories. dist/ is build output and would swamp the diff.
const SOURCE_PATHS = ["layout/", "lib/", "bin/"];

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const tag = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!tag) {
  console.error("usage: generate-changelog.mjs <tag> [--dry-run]");
  process.exit(1);
}

// Previous release tag, reachable from this one.
let prev;
try {
  prev = git("describe", "--tags", "--abbrev=0", `${tag}^`).trim();
} catch {
  console.log(`No tag before ${tag} — nothing to compare against.`);
  process.exit(0);
}

const rawDiff = git("diff", `${prev}..${tag}`, "--", ...SOURCE_PATHS);

// Strip the per-release version banner. Keep everything else, including
// context lines, so the model can see what the change is surrounded by.
const BANNER = /^[+-] \* nodality v\d+\.\d+\.\d+/;
const diff = rawDiff
  .split("\n")
  .filter(l => !BANNER.test(l))
  .join("\n");

// "Real" means an added or removed line that is not a diff header and not
// a banner. Comment-only and blank changes still count — a doc comment
// change is a legitimate changelog entry — but pure version churn does not.
const realChanges = diff
  .split("\n")
  .filter(l => /^[+-][^+-]/.test(l))
  .filter(l => l.trim() !== "+" && l.trim() !== "-");

console.log(`${prev} → ${tag}: ${realChanges.length} real changed line(s) in ${SOURCE_PATHS.join(" ")}`);

if (realChanges.length === 0) {
  console.log("Nothing to document — no library changes in this release. Writing nothing.");
  process.exit(0);
}

const SYSTEM = `You write changelog entries for a JavaScript UI library called nodality.

Rules:
- Describe ONLY what is visible in the diff. Never infer, extrapolate or
  invent a change that is not there.
- If a change is internal with no effect on users, say so briefly rather
  than dressing it up as a feature.
- Lead with what a consumer of the library would notice.
- Note any new option, method or export by its exact name.
- Flag anything that could break existing code under a "Breaking" heading.
- Output GitHub-flavoured markdown: a short "###" heading per category
  (Added / Fixed / Changed / Breaking) and terse bullets. No preamble, no
  closing summary, no version heading — that is added for you.
- If the diff shows only comment or formatting changes, say exactly that
  in one bullet.`;

const prompt = `Here is the source diff for nodality ${tag.replace(/^v/, "")}, \
relative to ${prev}. Version-banner lines have already been removed.

\`\`\`diff
${diff.slice(0, 120000)}
\`\`\``;

if (dryRun) {
  console.log("\n--- filtered diff (first 40 lines) ---");
  console.log(diff.split("\n").slice(0, 40).join("\n"));
  console.log("\n--- prompt bytes ---");
  console.log(`system: ${SYSTEM.length}  user: ${prompt.length}  model: ${MODEL}`);
  console.log("\n(dry run — no API call made, no file written)");
  process.exit(0);
}

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  }),
});

if (!res.ok) {
  console.error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}

const body = await res.json();
const entry = (body.content ?? [])
  .filter(b => b.type === "text")
  .map(b => b.text)
  .join("")
  .trim();

if (!entry) {
  console.error("Model returned no text. Writing nothing.");
  process.exit(1);
}

const version = tag.replace(/^v/, "");
const date = git("log", "-1", "--format=%cs", tag).trim();
const section = `## ${version} — ${date}\n\n${entry}\n`;

// Prepend under the title so the newest release is first.
const header = "# Changelog\n\nGenerated per release from the source diff.\n";
const existing = existsSync(CHANGELOG)
  ? readFileSync(CHANGELOG, "utf8").replace(/^# Changelog\n\n[^\n]*\n/, "").trimStart()
  : "";
writeFileSync(CHANGELOG, `${header}\n${section}\n${existing}`.trimEnd() + "\n");
console.log(`Wrote ${CHANGELOG} entry for ${version}.`);

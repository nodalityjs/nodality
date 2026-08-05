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
/** A real change: an added/removed line that is neither a diff header,
 *  a version banner, nor whitespace-only. */
const isRealChange = l =>
  /^[+-][^+-]/.test(l) && !BANNER.test(l) && l.trim() !== "+" && l.trim() !== "-";

// Drop the banner lines AND any file section left with nothing real.
//
// Removing the `+`/`- * nodality vX.Y.Z` lines is not enough on its own.
// For the ~97 files whose ONLY change was that banner, the file section
// survives — its header, hunk header and CONTEXT lines, which are the
// surrounding licence comment. The model then reads a diff full of
// licence text and reasonably reports "copyright year changes", which is
// what happened in the v1.0.206 entry: every one of those files was
// listed as a comment/header change when nothing in them had changed at
// all.
//
// So filter per file section and keep only sections that still contain a
// real change. A file whose banner was rewritten and nothing else simply
// does not appear.
const sections = rawDiff.split(/^(?=diff --git )/m).filter(Boolean);
const kept = sections.filter(sec => sec.split("\n").some(isRealChange));

const diff = kept
  .map(sec => sec.split("\n").filter(l => !BANNER.test(l)).join("\n"))
  .join("");

console.log(
  `  file sections: ${sections.length} in diff, ${kept.length} with real changes`
);

const realChanges = diff.split("\n").filter(isRealChange);

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
    // THIS is what broke v1.0.214 and v1.0.217, not the ceiling. Sonnet 5
    // runs adaptive thinking when `thinking` is omitted, and max_tokens caps
    // thinking + text TOGETHER. On a large diff the model spent the entire
    // budget reasoning and emitted no text block at all: v1.0.217 reported
    // output_tokens 8000 / thinking_tokens 7999, stop_reason max_tokens.
    // Raising the ceiling only buys a bigger budget to think through — 1500
    // and 8000 both failed the same way. Summarising a diff into bullets
    // does not need extended reasoning, so turn it off and every token goes
    // to the answer.
    thinking: { type: "disabled" },
    // Headroom now that the whole budget reaches the prose. A changelog
    // entry is a handful of bullets, so this ceiling costs nothing unless
    // a release is genuinely enormous.
    max_tokens: 16000,
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
  // "no text" was the entire diagnostic when this failed on v1.0.214, which
  // said nothing about WHY. stop_reason and the block types distinguish a
  // truncated response from a refusal from an unexpected shape.
  console.error("Model returned no text. Writing nothing.");
  console.error(`  stop_reason: ${body.stop_reason ?? "(none)"}`);
  console.error(`  block types: ${(body.content ?? []).map(b => b.type).join(", ") || "(empty content)"}`);
  console.error(`  usage: ${JSON.stringify(body.usage ?? {})}`);
  if (body.stop_reason === "max_tokens") {
    const thinking = body.usage?.output_tokens_details?.thinking_tokens ?? 0;
    if (thinking > 0) {
      // The trap this script fell into twice: the ceiling looks like the
      // problem, so you raise it, and the next release fails identically.
      console.error(
        `  -> ${thinking} of ${body.usage?.output_tokens ?? "?"} output tokens went to THINKING, ` +
        "so nothing was left for the answer. Raising max_tokens will not fix this — " +
        "check that `thinking: { type: \"disabled\" }` is still set on the request."
      );
    } else {
      console.error("  -> the answer itself was truncated; raise max_tokens in this script.");
    }
  }
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

#!/usr/bin/env node
/**
 * Tier 2 runner. Model-agnostic: a solver is any module exporting
 * `solve(brief) -> { elements, nodes }`, so the same gates score a hand-written
 * control, a negative control, or a model.
 *
 *   node evals/run.mjs                          # the reference control
 *   node evals/run.mjs --solver=broken          # the negative control
 *   node evals/run.mjs --quality                # also run the layout checks
 *   node evals/run.mjs --json                   # machine-readable
 *   node evals/run.mjs --solver=model --quality --repair        # one repair turn
 *   node evals/run.mjs --solver=model --quality --repair=full   # ...incl. content
 *
 * `--repair` is Tier 7: score the first answer, hand the shipped tools' reports
 * back to the solver, score the second. See evals/repair.mjs for what the agent
 * is and is not allowed to see, and why the distinction is the measurement
 * rather than a caveat on it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreBrief } from "./score.mjs";
import { feedback, librarySpeaks, contentSpeaks } from "./repair.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || `=${d}`).split("=")[1];
const quality = args.includes("--quality");
// --repair defaults to the library-only mode, because that is the number that
// can be quoted without an asterisk.
const repairMode = args.some((a) => a === "--repair" || a.startsWith("--repair="))
  ? arg("repair", "library") : null;
if (repairMode && !["library", "full"].includes(repairMode)) {
  console.error(`--repair must be "library" or "full", got "${repairMode}"`);
  process.exit(1);
}

const { briefs } = JSON.parse(readFileSync(path.join(HERE, "briefs.json"), "utf8"));
const solverName = arg("solver", "reference");
const solver = await import(path.join(HERE, "solvers", `${solverName}.mjs`));

const attempt = async (brief, repair) => {
  let answer;
  try { answer = await solver.solve(brief, repair); }
  catch (e) { answer = { elements: [], _error: e.message }; }
  return { answer, result: await scoreBrief(brief, answer, { quality }) };
};

const results = [];
const first = [];
const repairs = [];   // one entry per brief the tools had something to say about
for (const brief of briefs) {
  const a1 = await attempt(brief, null);
  first.push(a1.result);

  if (!repairMode) { results.push(a1.result); continue; }

  const includeContent = repairMode === "full";
  const speaks = librarySpeaks(a1.result) ||
                 (includeContent && contentSpeaks(a1.result));
  const fb = speaks ? feedback(a1.result, { includeContent }) : null;
  if (!fb) { results.push(a1.result); continue; }

  const a2 = await attempt(brief, {
    previous: a1.answer, feedback: fb, mode: repairMode,
  });
  repairs.push({ id: brief.id, before: a1.result, after: a2.result, feedback: fb });
  results.push(a2.result);
}

if (args.includes("--json")) {
  console.log(JSON.stringify({
    solver: solver.name, repair: repairMode, results,
    ...(repairMode ? { first, repairs } : {}),
  }, null, 2));
} else {
  const tick = (b) => b === null ? " -" : b ? " y" : " n";
  console.log(`\n  solver: ${solver.name}${quality ? "  (+quality)" : ""}` +
    `${repairMode ? `  repair: ${repairMode} (one turn)` : ""}\n`);
  console.log(`  ${"brief".padEnd(22)} valid renders content quality  notes`);
  console.log("  " + "-".repeat(78));
  for (const r of results) {
    console.log(`  ${r.id.padEnd(22)}${tick(r.gates.valid).padEnd(6)}` +
      `${tick(r.gates.renders).padEnd(8)}${tick(r.gates.content).padEnd(8)}` +
      `${tick(r.gates.quality).padEnd(9)}${r.notes.slice(0, 1).join("") .slice(0, 40)}`);
  }
  const pass = results.filter((r) => r.pass).length;
  const clean = results.filter((r) => r.gates.quality === true).length;
  // Split by provenance, because "written by the same person who wrote the
  // checks" is the standing caveat on this number and hiding it would be the
  // easiest way to make the eval look better than it is.
  const bySource = {};
  briefs.forEach((b, i) => {
    const k = b.source || "unknown";
    (bySource[k] ??= { n: 0, pass: 0 }).n++;
    if (results[i].pass) bySource[k].pass++;
  });
  console.log("  " + "-".repeat(78));
  const p0 = first.filter((r) => r.pass).length;
  const c0 = first.filter((r) => r.gates.quality === true).length;
  const arrow = (a, b) => a === b ? `${b}/${results.length}` : `${a} -> ${b}/${results.length}`;
  console.log(`  task success: ${repairMode ? arrow(p0, pass) : `${pass}/${results.length}`}` +
    (quality ? `   layout-clean: ${repairMode ? arrow(c0, clean) : `${clean}/${results.length}`}` : ""));
  console.log("  by source:    " + Object.entries(bySource)
    .map(([k, v]) => `${k} ${v.pass}/${v.n}`).join("   "));

  if (repairMode) {
    // Per-brief, because an aggregate that moved by one is not evidence of
    // anything unless you can see WHICH one moved and what it was told.
    const state = (r) => `${r.pass ? "pass" : "FAIL"}${
      r.gates.quality === true ? "+clean" : r.gates.quality === false ? "+dirty" : ""}`;
    console.log(`\n  repair turns: ${repairs.length}` +
      `  (briefs where the shipped tools reported something)\n`);
    console.log(`  ${"brief".padEnd(22)}${"before".padEnd(12)}${"after".padEnd(12)}outcome`);
    console.log("  " + "-".repeat(78));
    let fixed = 0, broke = 0, stuck = 0;
    for (const r of repairs) {
      const was = r.before.pass && r.before.gates.quality !== false;
      const now = r.after.pass && r.after.gates.quality !== false;
      const outcome = now && !was ? "FIXED" : !now && was ? "REGRESSED"
        : now ? "unchanged (was already clean)" : "still failing";
      if (now && !was) fixed++; else if (!now && was) broke++; else if (!now) stuck++;
      console.log(`  ${r.id.padEnd(22)}${state(r.before).padEnd(12)}` +
        `${state(r.after).padEnd(12)}${outcome}`);
    }
    console.log("  " + "-".repeat(78));
    console.log(`  fixed: ${fixed}   regressed: ${broke}   still failing: ${stuck}`);
    // The briefs the tools stayed silent on are the ceiling: no report, no
    // repair, whatever the eval thinks of them.
    const silent = first.filter((r, i) => !r.pass &&
      !repairs.some((x) => x.id === briefs[i].id));
    if (silent.length) {
      console.log(`  invisible to the tools: ${silent.map((r) => r.id).join(", ")}`);
    }
  }
}
process.exitCode = 0;

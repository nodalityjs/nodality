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
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreBrief } from "./score.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || `=${d}`).split("=")[1];
const quality = args.includes("--quality");

const { briefs } = JSON.parse(readFileSync(path.join(HERE, "briefs.json"), "utf8"));
const solverName = arg("solver", "reference");
const solver = await import(path.join(HERE, "solvers", `${solverName}.mjs`));

const results = [];
for (const brief of briefs) {
  let answer;
  try { answer = await solver.solve(brief); }
  catch (e) { answer = { elements: [], _error: e.message }; }
  results.push(await scoreBrief(brief, answer, { quality }));
}

if (args.includes("--json")) {
  console.log(JSON.stringify({ solver: solver.name, results }, null, 2));
} else {
  const tick = (b) => b === null ? " -" : b ? " y" : " n";
  console.log(`\n  solver: ${solver.name}${quality ? "  (+quality)" : ""}\n`);
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
  console.log(`  task success: ${pass}/${results.length}` +
    (quality ? `   layout-clean: ${clean}/${results.length}` : ""));
  console.log("  by source:    " + Object.entries(bySource)
    .map(([k, v]) => `${k} ${v.pass}/${v.n}`).join("   "));
}
process.exitCode = 0;

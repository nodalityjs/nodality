// Compare the two render paths case by case: code execution (today) vs
// mounting the mapper's instances (the default; NODALITY_CORE=code is the old path). Not a test; a
// tool for step 2 of the core swap.  node __tests__/unit/conformance/compare-core.mjs [type…]
import { allCases, renderCase, caseKey } from "./harness.mjs";
import { JSDOM } from "jsdom";
// Same DOM, attributes in a canonical order: tells a real difference from a
// harmless reordering of attributes.
const canon = (html) => {
  const d = new JSDOM(`<body>${html}</body>`).window.document;
  for (const el of d.body.querySelectorAll("*")) {
    const attrs = [...el.attributes].map((a) => [a.name, a.value]).sort(([x], [y]) => x.localeCompare(y));
    for (const [n] of attrs) el.removeAttribute(n);
    for (const [n, v] of attrs) el.setAttribute(n, v);
  }
  return d.body.innerHTML;
};
const only = process.argv.slice(2);
const byType = {};
for (const c of await allCases()) {
  if (only.length && !only.includes(c.type)) continue;
  globalThis.NODALITY_CORE = "code";
  const a = await renderCase(c.type, c.family, c.width);
  delete globalThis.NODALITY_CORE;
  const b = await renderCase(c.type, c.family, c.width);
  if (!a.valid) continue;
  const t = (byType[c.type] ||= { same: 0, reordered: 0, diff: [], fixed: [], broke: [] });
  if (a.error && !b.error) t.fixed.push(`${c.family}@${c.width}`);
  else if (!a.error && b.error) t.broke.push(`${c.family}@${c.width}: ${b.error.slice(0, 60)}`);
  else if (a.html === b.html && a.error === b.error) t.same++;
  else if (a.error === b.error && canon(a.html) === canon(b.html)) t.reordered++;
  else t.diff.push(`${c.family}@${c.width}`);
}
for (const [type, t] of Object.entries(byType)) {
  const total = t.same + t.reordered + t.diff.length + t.fixed.length + t.broke.length;
  if (t.same === total) continue;
  console.log(`${type.padEnd(14)} same ${String(t.same).padStart(2)}/${total}` + (t.reordered ? `  attribute order only: ${t.reordered}` : "") +
    (t.diff.length ? `  differ: ${t.diff.length} (${t.diff.slice(0, 4).join(" ")})` : "") + (t.fixed.length ? `  crash fixed: ${t.fixed.length}` : "") +
    (t.broke.length ? `  NEW crash: ${t.broke.length} (${t.broke[0]})` : ""));
}

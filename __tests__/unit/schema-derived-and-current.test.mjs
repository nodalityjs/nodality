// schema-derived-and-current.test.mjs — Stages 2 and 3 of AGENTIC-FIRST-PLAN.md.
//
// Stage 2's done-criterion is not "a schema exists" but "a test fails if a
// type accepts a parameter the schema does not list". A hand-maintained
// schema drifts from the code silently; the raster op registry did exactly
// that until 1.2.8, when `copy` turned out to read an `animation` parameter
// it never declared. The generator recovers everything from source, and this
// suite is what stops the committed output rotting behind it.
//
// Stage 3's done-criterion is a repair in ONE turn. That is tested literally:
// the first suggestion for a typo must be the correct parameter, not merely
// present somewhere in the list.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const GEN = path.join(ROOT, "scripts", "generate-schema.mjs");

const { validateNodes } = await import(path.join(ROOT, "lib", "validate-nodes.js"));
const { ELEMENT_TYPES } = await import(path.join(ROOT, "lib", "element-mapper.js"));
const { ELEMENT_PARAM_NAMES } = await import(
  path.join(ROOT, "lib", "element-params.generated.js"));

const hasGenerator = existsSync(GEN);

// ── Stage 2: the schema is derived, complete, and current ────────────

test("the committed schema matches what the source produces", { skip: !hasGenerator }, () => {
  // --check exits 1 when regenerating would change the file. This is the
  // whole point: drift breaks the build rather than misleading an agent.
  try {
    execFileSync(process.execPath, [GEN, "--check"], { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    assert.fail("schema.json is stale — run: node scripts/generate-schema.mjs\n" +
                String(e.stderr || e.stdout || e.message));
  }
});

test("every element type resolves to a component", { skip: !hasGenerator }, () => {
  const schema = JSON.parse(readFileSync(path.join(ROOT, "schema.json"), "utf8"));
  const unresolved = Object.entries(schema.types)
    .filter(([, v]) => !v.resolved).map(([k]) => k);
  assert.deepEqual(unresolved, [],
    "a type the generator cannot resolve gets an empty parameter list, which " +
    "is worse for an agent than an admitted gap — it looks authoritative");
  assert.equal(Object.keys(schema.types).length, ELEMENT_TYPES.length,
    "the schema and ELEMENT_TYPES must cover the same set");
});

test("the schema knows each type's defining parameter", () => {
  // Recovered from the mapper's own `el.<name>` reads. Scanning components
  // alone missed these, because a mapper passes some element fields as
  // constructor arguments — `new Text(el.text)` — which left `text` off
  // every heading: the most-used parameter of the most-used type.
  const schema = JSON.parse(readFileSync(path.join(ROOT, "schema.json"), "utf8"));
  const has = (t, p) => schema.types[t].params.some((x) => x.name === p);
  for (const [type, param] of [
    ["h2", "text"], ["p", "text"], ["a", "url"], ["img", "url"],
    ["cards", "items"], ["wrap", "children"],
  ]) {
    assert.ok(has(type, param), `schema for "${type}" is missing "${param}"`);
  }
});

test("the validator's vocabulary is the schema's, not a second copy", { skip: !hasGenerator }, () => {
  const schema = JSON.parse(readFileSync(path.join(ROOT, "schema.json"), "utf8"));
  const union = new Set();
  for (const t of Object.values(schema.types)) for (const p of t.params) union.add(p.name);
  assert.deepEqual([...ELEMENT_PARAM_NAMES].sort(), [...union].sort(),
    "element-params.generated.js drifted from schema.json — both come from " +
    "one generator, so this means the module was edited or not regenerated");
});

// ── Stage 3: repairable errors ───────────────────────────────────────

test("a misspelled element parameter is reported", () => {
  // The plan's worked example, verbatim.
  const r = validateNodes([], [{ type: "cards", itms: [] }]);
  assert.equal(r.ok, false, "{type:'cards', itms:[]} used to validate clean");
  const err = r.errors.find((e) => e.code === "UNKNOWN_ELEMENT_PARAM");
  assert.ok(err, "no UNKNOWN_ELEMENT_PARAM reported");
  assert.equal(err.path, "elements[0].itms");
});

test("the correct repair is the FIRST suggestion, not merely present", () => {
  // Stage 3's acceptance test is a repair in one turn. A list of five
  // candidates with the answer buried is not one turn. Transpositions are
  // included deliberately: `ulr`→`url` is distance 2 to plain Levenshtein,
  // the same as `ulr`→`mar`, so without transposition-awareness the wrong
  // word won the tiebreak.
  for (const [type, typo, want] of [
    ["cards", "itms", "items"],
    ["h2", "txt", "text"],
    ["h2", "tetx", "text"],
    ["a", "ulr", "url"],
    ["h2", "colr", "color"],
    ["cards", "childern", "children"],
  ]) {
    const r = validateNodes([], [{ type, [typo]: "x" }]);
    const err = r.errors.find((e) => e.code === "UNKNOWN_ELEMENT_PARAM");
    assert.ok(err, `${typo} on ${type} was not reported at all`);
    assert.equal(err.suggestions[0], want,
      `${typo} should suggest "${want}" first, got ${JSON.stringify(err.suggestions)}`);
    assert.ok(err.suggestions.length <= 3, "more than three guesses is not one turn");
  }
});

test("an unrecognised name with no near match is left alone", () => {
  // The asymmetry that governs this checker: several mappers spread the
  // whole element into their component, so they accept names no static scan
  // can enumerate. Reporting one would stop `preview` rendering a page that
  // works, which is costlier than missing a typo.
  const r = validateNodes([], [{ type: "h2", text: "hi", dataAnalyticsHook: "x" }]);
  assert.equal(r.ok, true,
    `a far-from-everything name must not be rejected: ${JSON.stringify(r.errors)}`);
});

test("valid parameters stay valid", () => {
  for (const el of [
    { type: "h2", text: "hi", size: "S3", color: "#f97316" },
    { type: "a", text: "Go", url: "#x" },
    { type: "cards", items: [{ img: "x", title: "T", link: "#l" }] },
    { type: "cards", items: [[{ type: "h2", text: "G" }]] },
  ]) {
    const r = validateNodes([], [el]);
    assert.equal(r.ok, true, `rejected valid element: ${JSON.stringify(r.errors)}`);
  }
});

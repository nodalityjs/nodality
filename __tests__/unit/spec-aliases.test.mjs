// spec-aliases.test.mjs — Tier 6 of AGENTIC-FIRST-PLAN.md §10.
//
// Running a real model over the eval scored 17/24 against 23/24 for a
// hand-written solver, and four of the seven failures were one mistake in
// different clothes: the model reached for the name HTML uses and the library
// wanted another. `src`, `href`, `options`. Not typos — `src` is three edits
// from `url`, so Stage 3's did-you-mean cannot reach them — and not confusion
// either: a model writing `src` for an image is applying the most widely
// attested convention there is. The divergence bought nothing.
//
// Re-scoring the model's SAME cached answers after this change took 17/24 to
// 21/24. Nothing about the model moved; only what the library accepts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="mount"></div></body></html>`);
for (const k of ["window", "document", "HTMLElement", "customElements",
                 "Node", "Element", "getComputedStyle"]) {
  try { if (dom.window[k] !== undefined && !(k in globalThis)) globalThis[k] = dom.window[k]; }
  catch { /* getter-only in some Node versions */ }
}
dom.window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {},
                                 addEventListener() {}, removeEventListener() {} });
dom.window.Element.prototype.animate ||= function () {
  return { finished: Promise.resolve(), cancel() {}, play() {}, pause() {},
           reverse() {}, finish() {}, addEventListener() {}, removeEventListener() {},
           onfinish: null };
};
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { Des } = await import(path.join(ROOT, "lib", "designer.js"));
const { validateNodes } = await import(path.join(ROOT, "lib", "validate-nodes.js"));
const { normalizeSpec, normalizeAliases, ALIASES } =
  await import(path.join(ROOT, "lib", "normalize-spec.js"));

const render = (els) => {
  const m = dom.window.document.querySelector("#mount");
  m.innerHTML = "";
  new Des().nodes([]).add(els).set({ mount: "#mount", code: false, elements: false });
  return m.innerHTML;
};

// ── the names ──

test("HTML's names are accepted and reach the page", () => {
  assert.match(render([{ type: "img", src: "a.jpg" }]), /src="a\.jpg"/);
  assert.match(render([{ type: "a", text: "Go", href: "#x" }]), /href="#x"/);
  // Nested too: a spec inside a composite gets the same treatment.
  assert.match(render([{ type: "cards", items: [[{ type: "img", src: "n.jpg" }]] }]), /n\.jpg/);
});

test("the canonical names are untouched", () => {
  // Additive means additive: no existing page can observe this change.
  assert.match(render([{ type: "img", url: "a.jpg" }]), /src="a\.jpg"/);
  const spec = [{ type: "a", text: "Go", url: "#x" }];
  assert.deepEqual(normalizeSpec(spec), spec);
});

test("an alias validates as the thing it becomes", () => {
  for (const el of [
    { type: "img", src: "a.jpg" },
    { type: "a", text: "Go", href: "#x" },
    { type: "dropdown", options: ["A", "B"] },
  ]) {
    assert.equal(validateNodes([], [el]).ok, true,
      `rejected ${JSON.stringify(el)}`);
  }
});

test("an alias disagreeing with its canonical name is reported", () => {
  // One of them is going to be ignored. Quietly dropping a key the author
  // wrote is the failure every stage of this project has been removing, so it
  // is reported rather than silently resolved.
  const r = validateNodes([], [{ type: "img", url: "a.jpg", src: "b.jpg" }]);
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "CONFLICTING_ALIAS");
  assert.ok(err, `expected CONFLICTING_ALIAS, got ${JSON.stringify(r.errors)}`);
  assert.equal(err.suggestions[0], "url");
});

test("an alias AGREEING with its canonical name is not a problem", () => {
  assert.equal(validateNodes([], [{ type: "img", url: "a.jpg", src: "a.jpg" }]).ok, true);
});

test("the canonical name wins when both are given", () => {
  assert.equal(normalizeAliases([{ type: "img", url: "keep.jpg", src: "drop.jpg" }])[0].url,
    "keep.jpg");
});

test("the alias table stays small", () => {
  // Each entry has to earn its place by being what a generator actually
  // writes. A list that grows on plausibility becomes a second vocabulary.
  assert.ok(Object.keys(ALIASES).length <= 5,
    `the alias table has grown to ${Object.keys(ALIASES).length}; each one needs evidence`);
});

// ── the shape ──

test("a table's rows may be arrays, header row first", () => {
  // How every CSV and every markdown table on earth is laid out, and what the
  // model wrote. Header-first is not a guess: a table whose first row is data
  // has no column names, and the mapper needs them to build the head.
  const el = { type: "table", items: [
    ["date", "race"], ["29/08", "Krusnoman"], ["05/09", "Hory Bory"]] };
  assert.equal(validateNodes([], [el]).ok, true);
  const html = render([el]);
  for (const want of ["date", "race", "Krusnoman", "Hory Bory"]) {
    assert.ok(html.includes(want), `${want} did not reach the table`);
  }
});

test("a mixed or short items list is left alone", () => {
  // Narrow on purpose: half-converting a list nobody meant as a table would
  // be worse than not converting it.
  const mixed = [{ type: "table", items: [["a", "b"], { a: 1, b: 2 }] }];
  assert.deepEqual(normalizeSpec(mixed), mixed);
  const objects = [{ type: "table", items: [{ a: 1 }, { a: 2 }] }];
  assert.deepEqual(normalizeSpec(objects), objects);
});

test("only tables get the row treatment", () => {
  const cards = [{ type: "cards", items: [["a", "b"], ["c", "d"]] }];
  assert.deepEqual(normalizeSpec(cards), cards);
});

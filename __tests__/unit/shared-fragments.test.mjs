// shared-fragments.test.mjs — Tier 3 of AGENTIC-FIRST-PLAN.md §10.
//
// Declare shared structure once. Measured before it was built, as the plan
// asked: a real site's nav and footer are 184 tokens and **61% of every token
// in that site**, so referencing rather than repeating is 1.98x at ten pages —
// and a NET LOSS at one, which is why none of this is automatic.
//
// The reason it is needed is not verbosity. The site those numbers came from
// does not repeat itself: it imports `renderNav` and calls it. That is the
// imperative layer, where reuse is a function. An element array cannot call a
// function, so an agent authoring as data pays per page, and the only way out
// is to drop into code — which property 1, "total", exists to prevent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import crypto from "node:crypto";
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
const { resolveRefs, collectRefs, isRef } =
  await import(path.join(ROOT, "lib", "resolve-refs.js"));

const DEFS = {
  nav: { type: "nav", items: [{ title: "Home", link: "/" }, { title: "Docs", link: "/docs" }] },
  footer: { type: "wrap", children: [{ type: "p", text: "Footer" }] },
};
const render = (elements, defs) => {
  const m = dom.window.document.querySelector("#mount");
  m.innerHTML = "";
  const d = new Des();
  if (defs) d.defs(defs);
  d.nodes([]).add(elements).set({ mount: "#mount", code: false, elements: false });
  return m.innerHTML;
};

// ── it does the thing ──

test("a reference renders what it names", () => {
  const html = render([{ $ref: "nav" }, { type: "h1", text: "P" }, { $ref: "footer" }], DEFS);
  for (const want of ["Home", "Docs", "Footer"]) {
    assert.ok(html.includes(want), `"${want}" did not come from its definition`);
  }
  assert.ok(html.includes("<h1"), "the page's own content was lost");
});

test("a reference and the thing itself render identically", () => {
  // The property that makes this worth using: `$ref` is not a different way
  // to say something, it is the same thing said once.
  assert.equal(render([{ $ref: "footer" }], DEFS), render([DEFS.footer]));
});

test("references nest inside a composite's slots", () => {
  const html = render([{ type: "wrap", children: [{ $ref: "nav" }] }], DEFS);
  assert.ok(html.includes("Home"), "a reference inside `children` was not expanded");
});

test("two pages using one definition do not share an object", () => {
  // Rendering an `a` mutates the descriptor it is given — it adds `font` and
  // `pad`. A shared definition would accumulate the leavings of every page
  // that used it, so each expansion must be a copy.
  const a = new Des().defs(DEFS).nodes([]).add([{ $ref: "nav" }]);
  const b = new Des().defs(DEFS).nodes([]).add([{ $ref: "nav" }]);
  assert.notEqual(a._elements[0], b._elements[0]);
  assert.notEqual(a._elements[0], DEFS.nav);
});

// ── it does not change anything for callers who ignore it ──

test("a page with no defs renders exactly as before", () => {
  const plain = [{ type: "h1", text: "P" }, { type: "cards" }];
  const before = render(plain);
  const after = render(plain, {});
  assert.equal(before, after, "declaring an empty defs map changed the page");
  assert.ok(before.length > 0);
});

test("resolveRefs leaves a spec without references untouched", () => {
  const spec = [{ type: "cards", items: [{ img: "a", title: "A", link: "#a" }] }];
  assert.deepEqual(resolveRefs(spec, DEFS), spec);
  assert.deepEqual(resolveRefs(spec, undefined), spec);
  assert.deepEqual(collectRefs(spec), []);
});

// ── being wrong is repairable, not cryptic ──

test("defs after add is refused in the words of the mistake", () => {
  // `add` renders as it goes, so definitions arriving afterwards are too late.
  // Before this the failure was `Unknown element type "undefined"` from deep
  // in the mapper, which sends the reader hunting for a typo in a type.
  assert.throws(
    () => new Des().nodes([]).add([{ type: "h1", text: "x" }]).defs(DEFS),
    /\.defs\(\) must come before \.add\(\)/);
});

test("a name with no definition is refused, and names what is defined", () => {
  assert.throws(
    () => new Des().defs(DEFS).nodes([]).add([{ $ref: "navv" }]),
    (e) => /no definition for \$ref "navv"/.test(e.message) &&
           /Defined: nav, footer/.test(e.message));
});

test("the validator reports a bad reference with a did-you-mean", () => {
  // Reported as well as refused: a report is repairable in one turn and a
  // throw is not. Stage 3's contract, applied to the newest way of being wrong.
  const r = validateNodes([], [{ type: "wrap", children: [{ $ref: "foter" }] }], DEFS);
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "DANGLING_REF");
  assert.ok(err, `expected DANGLING_REF, got ${JSON.stringify(r.errors)}`);
  assert.equal(err.path, "elements[0].children[0]");
  assert.equal(err.suggestions[0], "footer");
});

test("a correct reference validates clean", () => {
  // It has no `type`, and for a while that made every correct reference look
  // like a malformed element.
  assert.equal(validateNodes([], [{ $ref: "nav" }], DEFS).ok, true);
  // And without defs, references are left alone rather than all reported
  // missing: a caller may validate a page before deciding what to share.
  assert.equal(validateNodes([], [{ $ref: "nav" }]).ok, true);
});

test("a definition that reaches itself does not hang", () => {
  const cyclic = { loop: { type: "wrap", children: [{ $ref: "loop" }] } };
  const out = resolveRefs([{ $ref: "loop" }], cyclic);
  assert.ok(isRef(out[0].children[0]), "the cycle should stop at a reference, not recurse");
});

// ── the ordering bug Tier 3 uncovered ──

test("descriptors line up with the nodes they produced", () => {
  // `add` lifts nav and sideNav to the front of the page, and `_elements` was
  // being recorded in the AUTHOR's order while the page rendered in the lifted
  // one. Everything that matches the two by position — morph resolving
  // from/to, and the round-trip writing each descriptor onto its node — was
  // therefore off by however far the nav moved.
  const m = dom.window.document.querySelector("#mount");
  m.innerHTML = "";
  new Des().nodes([]).add([{ type: "h1", text: "First" }, { type: "nav" }])
    .set({ mount: "#mount", code: false, elements: false, annotate: true });
  const recorded = [...m.children].map((n) => JSON.parse(n.getAttribute("data-nod") || "{}").type);
  const rendered = [...m.children].map((n) => n.tagName.toLowerCase());
  assert.equal(rendered[1], "h1", "the heading should follow the lifted nav");
  assert.deepEqual(recorded, ["nav", "h1"],
    "each descriptor must be on the node it produced, in the rendered order");
});

// ── overrides: the thing that makes a shared fragment reusable ──

test("keys beside a reference override the definition", () => {
  // Without this they were silently dropped: `{ $ref: "nav", id: "topnav" }`
  // expanded to the bare definition and the id went nowhere — the
  // declared-but-ignored failure this project spent six stages removing,
  // rebuilt inside the mechanism meant to help. It is also what makes sharing
  // usable at all: every page wants the same nav marking a different entry.
  const out = resolveRefs([{ $ref: "nav", id: "topnav" }], DEFS);
  assert.equal(out[0].type, "nav", "the definition's own fields must survive");
  assert.equal(out[0].id, "topnav", "the override was dropped");
  assert.deepEqual(out[0].items, DEFS.nav.items);
});

test("an override replaces rather than merges into a slot", () => {
  // Shallow on purpose: a deep merge would leave it ambiguous whether `items`
  // extends the definition's list or replaces it. It replaces.
  const out = resolveRefs([{ $ref: "nav", items: [{ title: "Docs", link: "/d" }] }], DEFS);
  assert.deepEqual(out[0].items, [{ title: "Docs", link: "/d" }]);
});

test("the definition itself is never touched by an override", () => {
  const before = JSON.stringify(DEFS.nav);
  resolveRefs([{ $ref: "nav", id: "a" }, { $ref: "nav", id: "b" }], DEFS);
  assert.equal(JSON.stringify(DEFS.nav), before, "an override leaked into the definition");
});

test("a typo in an override is reported", () => {
  // The validator walks the RESOLVED tree, because only the merged form is a
  // real element. Validating the unexpanded reference would miss this.
  const r = validateNodes([], [{ $ref: "nav", itms: [] }], DEFS);
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "UNKNOWN_ELEMENT_PARAM");
  assert.ok(err, `expected the typo to be caught, got ${JSON.stringify(r.errors)}`);
  assert.equal(err.suggestions[0], "items");
});

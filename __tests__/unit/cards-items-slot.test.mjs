// cards-items-slot.test.mjs — Stage 1 of AGENTIC-FIRST-PLAN.md.
//
// `{type:"cards"}` used to render the same three space cards whatever the
// caller declared: `mapGrid` hardcoded them inside a template literal and read
// neither `items` nor `children`. Measured consequence, 29 Aug 2026: a card
// grid could only be authored as code, and as code it cost MORE tokens than
// React + Tailwind (0.94x at three cards, 0.88x when the cards differ).
//
// This gives `cards` an `items` slot, in three shapes chosen per entry:
//
//   absent            the three placeholders, byte-identical to before
//   {img,title,link}  shorthand over the same card template
//   [ {type:…}, … ]   nested element specs, which is what makes it total
//
// The first case is the one that must never move: it is what every existing
// page and the published benchmark rely on. It is pinned by hash below, and
// that pin was negative-controlled — a one-character change to the
// placeholder data changes the hash, so the check can actually fail.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");

// The library reaches for browser globals at import time; give it a document.
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="mount"></div></body></html>`);
for (const k of ["window", "document", "HTMLElement", "customElements",
                 "Node", "Element", "getComputedStyle"]) {
  try { if (dom.window[k] !== undefined && !(k in globalThis)) globalThis[k] = dom.window[k]; }
  catch { /* getter-only in some Node versions; the library reads window.* anyway */ }
}
dom.window.matchMedia ||= () => ({ matches: false, addListener() {}, removeListener() {},
                                   addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

// Import the SOURCE, not the package entry: `nodality`'s exports map "." to
// dist/index.esm.js, so importing the package name would test a stale build
// and pass no matter what lib/ says. That mistake produced a green
// byte-identical result while the mapper was not being exercised at all.
const { Des } = await import(path.join(ROOT, "lib", "designer.js"));
const { validateNodes } = await import(path.join(ROOT, "lib", "validate-nodes.js"));

const emit = (elements) => {
  globalThis.NODALITY_EMIT = true;
  globalThis.__NODALITY_EMITTED__ = undefined;
  try { new Des().nodes([]).add(elements).set({ mount: "#mount" }); }
  finally { globalThis.NODALITY_EMIT = false; }
  return (globalThis.__NODALITY_EMITTED__ || []).join("\n");
};

const render = (elements) => {
  dom.window.document.querySelector("#mount").innerHTML = "";
  new Des().nodes([]).add(elements).set({ mount: "#mount", code: false, elements: false });
  return dom.window.document.querySelector("#mount").innerHTML;
};

// ── the guarantee: nothing that works today can observe this change ──

test("a cards grid with no items emits exactly what it emitted before S1", () => {
  const out = emit([{ type: "cards" }]);
  const hash = crypto.createHash("sha256").update(out).digest("hex").slice(0, 16);
  assert.equal(out.length, 1697, "emitted length moved");
  assert.equal(hash, "14f592f739faf9d8", "emitted code changed for the no-items path");
  assert.ok(out.includes("Starship"), "placeholder content should still be emitted");
  assert.ok(out.includes(".map(item"), "the template form should be preserved");
});

test("an empty items array is treated as no items", () => {
  // `items: []` is what a generator emits before it has content. It must not
  // produce an empty grid, which would be a silent regression for anyone
  // building the array incrementally.
  assert.equal(emit([{ type: "cards", items: [] }]), emit([{ type: "cards" }]));
});

// ── shorthand: the shape the published benchmark and Table 3 already use ──

test("shorthand items replace the placeholders and render", () => {
  const spec = [{ type: "cards", items: [
    { img: "https://example.com/alpha.jpg", title: "ALPHA", link: "#alpha" },
    { img: "https://example.com/beta.jpg", title: "BETA", link: "#beta" },
  ]}];
  const code = emit(spec);
  assert.ok(code.includes("ALPHA") && code.includes("BETA"), "supplied titles missing from code");
  assert.ok(!code.includes("Starship"), "placeholder leaked into a grid that supplied items");
  assert.ok(code.includes(".map(item"), "shorthand should keep the compact template form");

  // Emitted code that merely CONTAINS the title proves nothing; run it.
  const html = render(spec);
  assert.ok(html.includes("ALPHA") && html.includes("BETA"), "supplied titles not rendered");
  assert.ok(!html.includes("Starship"), "placeholder rendered despite supplied items");
});

// ── nested specs: the property that makes the format total ──

test("nested element specs become a card's children", () => {
  const spec = [{ type: "cards", items: [
    [{ type: "h2", text: "Gamma" }, { type: "p", text: "A paragraph." }],
    [{ type: "h2", text: "Delta" }],
  ]}];
  const code = emit(spec);
  assert.equal((code.match(/new Card\(\)/g) || []).length, 2,
    "one explicit Card per spec list");
  assert.ok(!code.includes(".map(item"),
    "cards that differ cannot share one template");

  const html = render(spec);
  for (const t of ["Gamma", "Delta", "A paragraph."]) {
    assert.ok(html.includes(t), `${t} not rendered`);
  }
  assert.ok(!html.includes("Starship"), "placeholder rendered despite supplied items");
});

test("shorthand and specs may be mixed in one items array", () => {
  const code = emit([{ type: "cards", items: [
    { img: "https://example.com/x.jpg", title: "SHORT", link: "#x" },
    [{ type: "h2", text: "SPEC" }],
  ]}]);
  assert.ok(code.includes("SHORT"), "shorthand entry lost");
  assert.ok(code.includes("SPEC"), "spec entry lost");
  assert.equal((code.match(/new Card\(\)/g) || []).length, 2);
});

// ── the validator and the mapper must agree about the type's vocabulary ──

test("the validator accepts every items shape the mapper accepts", () => {
  for (const el of [
    { type: "cards" },
    { type: "cards", items: [{ img: "x", title: "A", link: "#a" }] },
    { type: "cards", items: [[{ type: "h2", text: "G" }]] },
  ]) {
    const r = validateNodes([], [el]);
    assert.equal(r.ok, true,
      `rejected a shape the mapper accepts: ${JSON.stringify(r.errors)}`);
  }
});

test("a typo inside a nested spec is reported at its real path", () => {
  // The repair-in-one-turn property: the report must name the offending
  // element, not just the composite that contains it.
  const r = validateNodes([], [{ type: "cards", items: [[{ type: "h2x", text: "G" }]] }]);
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "UNKNOWN_ELEMENT_TYPE");
  assert.ok(err, "no UNKNOWN_ELEMENT_TYPE reported");
  assert.equal(err.path, "elements[0].items[0][0].type");
  assert.ok(err.suggestions.includes("h2"), "no did-you-mean for the typo");
});

test("the pre-S1 string-children form points at the working one", () => {
  // `children: ["image","text","link"]` is what the published benchmark and
  // the paper's Table 3 write. The mapper accepts and ignores it, so the
  // validator names the shape that actually carries content.
  const r = validateNodes([], [{ type: "cards", children: ["image", "text", "link"] }]);
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "LEGACY_CHILD_STRING");
  assert.ok(err, "string children should get a dedicated diagnostic");
  assert.match(err.suggestions[0], /items:/);
});

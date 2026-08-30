// composite-items-slots.test.mjs — Stage 4 of AGENTIC-FIRST-PLAN.md.
//
// Stage 1 gave `cards` an `items` slot. Stage 4 applies the same pattern to the
// remaining composites that hardcoded their content: `row`, `table`, `nav` and
// `sideNav`. (`form`, `stack`, `wrap` and `ulist` already read what the caller
// declared, so they are untouched.)
//
// The shape is identical to Stage 1's: content absent means the placeholders,
// byte for byte; content supplied means the caller's content and nothing of the
// placeholders. The first half is what every existing page depends on, so it is
// pinned by hash below. Those pins were taken from the pre-Stage-4 tree and are
// negative-controlled: changing one placeholder character moves the hash while
// the length stays put.
//
// Two traps this file is deliberately built around, both of which produced a
// green result that meant nothing:
//
//   1. `nav` and `sideNav` are Switchers that mount a view per media query. A
//      matchMedia stub answering false to everything mounts NO view, so the
//      composite renders as an empty div and every assertion about its contents
//      passes whatever the mapper does.
//   2. Without an Element.prototype.animate shim the nav path throws, and two
//      identical thrown strings compare equal — which reads as byte-identical
//      output when nothing was rendered at all.

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
  catch { /* getter-only in some Node versions; the library reads window.* anyway */ }
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

// The source, not the package entry: `nodality` maps "." to dist/index.esm.js,
// so importing the package name tests a stale build and passes regardless of
// what lib/ says.
const { Des } = await import(path.join(ROOT, "lib", "designer.js"));
const { validateNodes } = await import(path.join(ROOT, "lib", "validate-nodes.js"));

const render = (el) => {
  const m = dom.window.document.querySelector("#mount");
  m.innerHTML = "";
  new Des().nodes([]).add([el]).set({ mount: "#mount", code: false, elements: false });
  return m.innerHTML;
};

// ── the guarantee: nothing that works today can observe this change ──

test("each composite with no content renders exactly what it did before S4", () => {
  for (const [type, length, hash] of [
    // RE-PINNED by Tier 4 (§10) — the first deliberate move of these values.
    // `row` is unchanged, which is the useful part: it says the other three
    // moved for the reasons given and nothing else drifted along with them.
    //   table   the header was white on #ff6d22, 2.81:1 against a 4.5:1
    //           requirement — styled, and not legible. Now #c2410c.
    //   nav     links gained padding; 43x18 is under the 24px tap-target
    //           minimum in the direction a thumb needs.
    //   sideNav the toggle glyph was set with innerText, which jsdom has no
    //           setter for — and the SSG prerenders THROUGH jsdom, so the
    //           character never reached a prerendered page and the button
    //           shipped empty. textContent works in both.
    ["row", 367, "ae12d009272b8665"],
    ["table", 3620, "51c8a2dc0e6e35d2"],
    ["nav", 1441, "57cd4af92e30179e"],
    ["sideNav", 1964, "83db854bfe92d163"],
  ]) {
    const html = render({ type });
    assert.equal(html.length, length, `${type}: rendered length moved`);
    assert.equal(crypto.createHash("sha256").update(html).digest("hex").slice(0, 16),
                 hash, `${type}: rendered output changed for the no-content path`);
  }
});

test("an empty items array is treated as no items", () => {
  // What a generator emits before it has content. It must not blank the
  // composite, which would be a silent regression for anyone filling the array
  // incrementally.
  for (const type of ["table", "nav", "sideNav"]) {
    assert.equal(render({ type, items: [] }), render({ type }), type);
  }
  assert.equal(render({ type: "row", children: [] }), render({ type: "row" }));
});

// ── supplied content replaces the placeholders ──

test("supplied content renders and no placeholder survives it", () => {
  for (const [el, wanted, placeholder] of [
    [{ type: "row", children: [{ type: "h2", text: "ALPHA" }, { type: "p", text: "BETA" }] },
     ["ALPHA", "BETA"], "row."],
    [{ type: "table", items: [{ code: "X1", name: "Widget" }, { code: "X2", name: "Gadget" }] },
     ["Widget", "Gadget"], "Pokro"],
    [{ type: "nav", items: [{ title: "Work", link: "#w" }, { title: "Blog", link: "#b" }] },
     ["Work", "Blog"], "Services"],
    [{ type: "sideNav", items: [{ title: "Docs", link: "#d" }] },
     ["Docs"], "Projects"],
  ]) {
    const html = render(el);
    for (const w of wanted) {
      assert.ok(html.includes(w), `${el.type}: supplied "${w}" was not rendered`);
    }
    assert.ok(!html.includes(placeholder),
      `${el.type}: placeholder "${placeholder}" rendered despite supplied content`);
  }
});

// ── the regression Stage 4 itself introduced, and its fix ──

test("a nav shorter than its placeholder list does not throw", () => {
  // `sideNav` read three fixed slots — links[0], links[1], links[2] — which
  // assumed exactly three entries. Once `items` could carry any number, the
  // missing slots were `undefined` and Wrapper.add called toCode() on them: a
  // throw, not a silent no-op. The slot count now follows items.length.
  for (const type of ["nav", "sideNav"]) {
    for (const n of [1, 2, 5]) {
      const items = Array.from({ length: n }, (_, i) => ({ title: `N${i}`, link: `#${i}` }));
      assert.doesNotThrow(() => render({ type, items }), `${type} with ${n} item(s)`);
      const html = render({ type, items });
      assert.ok(html.includes(`N${n - 1}`), `${type}: last of ${n} items missing`);
    }
  }
});

test("a bare string is accepted as a nav entry's title", () => {
  // `items: ["A", "B"]` was already being passed before `items` was read at
  // all, so it rendered the placeholders and nobody noticed. Reading `items`
  // turned that shape into a throw — `i.title.toLowerCase()` on undefined —
  // which would have broken callers whose only fault was using the older
  // shorthand. It is normalised, not rejected.
  for (const type of ["nav", "sideNav"]) {
    const html = render({ type, items: ["Alpha", "Beta"] });
    assert.ok(html.includes("Alpha") && html.includes("Beta"),
      `${type}: string entries were not rendered`);
  }
});

test("an entry missing its title does not throw", () => {
  // The mapper derives an element id from the title. A half-built entry is
  // what a generator emits mid-stream; it must render, not crash the page.
  for (const type of ["nav", "sideNav"]) {
    assert.doesNotThrow(() => render({ type, items: [{ link: "#x" }] }), type);
  }
});

// ── the validator and the mapper must agree about the vocabulary ──

test("the validator accepts every shape these mappers accept", () => {
  for (const el of [
    { type: "row", children: [{ type: "h2", text: "A" }] },
    { type: "table", items: [{ code: "X1", name: "Widget" }] },
    { type: "nav", items: [{ title: "Work", link: "#w" }] },
    { type: "sideNav", items: [{ title: "Docs", link: "#d" }] },
  ]) {
    const r = validateNodes([], [el]);
    assert.equal(r.ok, true,
      `rejected a shape the mapper accepts: ${JSON.stringify(r.errors)}`);
  }
});

test("the schema lists the slot each composite now reads", async () => {
  // Stage 2's contract: an agent asks the schema what a type takes. A slot the
  // mapper reads but the schema omits is invisible, which is the whole failure
  // this project has been correcting.
  const { readFileSync } = await import("node:fs");
  const schema = JSON.parse(readFileSync(path.join(ROOT, "schema.json"), "utf8"));
  for (const type of ["row", "table", "nav", "sideNav", "cards"]) {
    assert.ok(schema.types[type].params.some((p) => p.name === "items"),
      `schema for "${type}" does not list "items"`);
  }
});

// content-slots.test.mjs — the cross-slot diagnostic, and the table behind it.
//
// Stage 1 removed a silent no-op: `{type:"cards"}` accepted content and
// rendered placeholders. The same no-op survived one slot over.
// `{type:"table", children:[…]}` validated clean and rendered its placeholder
// rows, because `table` reads `items`. It is not a typo, so the near-miss
// detection Stage 3 built cannot reach it — a different check is needed, and
// a different check needs to know which key each composite actually reads.
//
// That table is DERIVED BY RENDERING, not by reading the source. A static scan
// got it wrong: `mapRow` appears to read `items` because a helper it calls
// does, and that helper's `items` belongs to a different element entirely.
// This file re-derives it the same way the table was built and fails if the
// two disagree — the arrangement Stage 2 established for the schema, applied
// to a second piece of recovered knowledge.

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
const { validateNodes, CONTENT_SLOT } =
  await import(path.join(ROOT, "lib", "validate-nodes.js"));

const MARK = "ZQXJ";
const draw = (el) => {
  const m = dom.window.document.querySelector("#mount");
  m.innerHTML = "";
  try { new Des().nodes([]).add([el]).set({ mount: "#mount", code: false, elements: false }); }
  catch (e) { return "THREW:" + e.message; }
  return m.innerHTML;
};
const PAYLOAD = {
  items: [{ title: MARK, name: MARK, link: "#z", img: "z.jpg", code: MARK }],
  children: [{ type: "h2", text: MARK }],
};
/** Which slots this type's output actually follows. */
const liveSlots = (type) => ["items", "children"].filter((slot) =>
  draw({ type, [slot]: PAYLOAD[slot] }).includes(MARK) ||
  draw({ type, [slot]: PAYLOAD[slot === "items" ? "children" : "items"] }).includes(MARK));

// ── the table cannot drift from the library ──

test("every type in CONTENT_SLOT really reads that slot", () => {
  for (const [type, slot] of Object.entries(CONTENT_SLOT)) {
    const live = liveSlots(type);
    assert.ok(live.includes(slot),
      `CONTENT_SLOT says "${type}" reads "${slot}", but rendering says ${JSON.stringify(live)}`);
  }
});

test("no type reads a slot the table does not name", () => {
  // The other direction. If a composite gains a second content slot, the
  // diagnostic below would start reporting a shape that now works — a false
  // positive, which 1.2.7 established is the costlier way to be wrong.
  for (const [type, slot] of Object.entries(CONTENT_SLOT)) {
    const other = slot === "items" ? "children" : "items";
    const live = liveSlots(type);
    assert.ok(!live.includes(other),
      `"${type}" now also reads "${other}"; CONTENT_SLOT must be updated or the ` +
      `diagnostic will reject a shape that renders`);
  }
});

// ── the diagnostic ──

test("content in the slot a type does not read is reported", () => {
  for (const [el, want] of [
    [{ type: "table", children: [{ type: "h2", text: "x" }] }, "items"],
    [{ type: "cards", children: [{ type: "h2", text: "x" }] }, "items"],
    [{ type: "nav", children: [{ type: "h2", text: "x" }] }, "items"],
    [{ type: "row", items: [{ title: "x" }] }, "children"],
    [{ type: "wrap", items: [{ title: "x" }] }, "children"],
  ]) {
    const r = validateNodes([], [el]);
    assert.equal(r.ok, false, `${JSON.stringify(el)} validated clean`);
    const err = r.errors.find((e) => e.code === "WRONG_CONTENT_SLOT");
    assert.ok(err, `no WRONG_CONTENT_SLOT for ${JSON.stringify(el)}`);
    assert.equal(err.suggestions[0], want);
  }
});

test("the reported shape really does render the placeholders", () => {
  // The diagnostic is only worth emitting if the thing it describes is true.
  const html = draw({ type: "table", children: [{ type: "h2", text: MARK }] });
  assert.ok(!html.includes(MARK), "content in the wrong slot reached the page after all");
  assert.ok(html.includes("Pokro"), "expected the placeholder rows to be what rendered");
});

test("the correct slot, and an empty one, are left alone", () => {
  for (const el of [
    { type: "table", items: [{ code: "X1", name: "W" }] },
    { type: "row", children: [{ type: "h2", text: "x" }] },
    { type: "cards", items: [{ img: "a.jpg", title: "A", link: "#a" }] },
    { type: "cards" },
    { type: "table", children: [] },
    { type: "h2", text: "a leaf takes neither" },
  ]) {
    const r = validateNodes([], [el]);
    assert.equal(r.ok, true,
      `rejected a shape that works: ${JSON.stringify(el)} -> ${JSON.stringify(r.errors)}`);
  }
});

test("the pre-S1 string form still gets its own diagnostic, not both", () => {
  // `children: ["image","text","link"]` already reports LEGACY_CHILD_STRING.
  // Reporting WRONG_CONTENT_SLOT as well would be two errors for one mistake.
  const r = validateNodes([], [{ type: "cards", children: ["image", "text", "link"] }]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === "LEGACY_CHILD_STRING"));
  assert.ok(!r.errors.some((e) => e.code === "WRONG_CONTENT_SLOT"),
    "the same mistake was reported twice");
});

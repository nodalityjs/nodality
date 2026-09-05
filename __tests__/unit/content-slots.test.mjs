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
// jsdom implements neither of these, and library code that schedules an
// animation reads them back on a later tick. Without them the deferred
// callback dies on `undefined.forEach` long after the render returned, which
// node's test runner reports as a file-level failure with every assertion
// still green. The same sweep under evals/score.mjs -- which stubs these --
// produces no such error, which is what identifies it as a gap in this file's
// environment rather than a fault in the library.
dom.window.Element.prototype.getAnimations ||= function () { return []; };
dom.window.Document.prototype.getAnimations ||= function () { return []; };
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { Des } = await import(path.join(ROOT, "lib", "designer.js"));
const { validateNodes, CONTENT_SLOT, ITEM_SHAPE } =
  await import(path.join(ROOT, "lib", "validate-nodes.js"));
const { ELEMENT_TYPES } = await import(path.join(ROOT, "lib", "element-mapper.js"));
const { readFileSync } = await import("node:fs");
const { execFileSync } = await import("node:child_process");

const MARK = "ZQXJ";
const draw = (el) => {
  // Replace the mount rather than emptying it. Some types schedule a callback
  // that reads the DOM back on a later tick; emptying pulls that DOM out from
  // under it and the callback dies on `undefined.forEach` long after the
  // render returned. Detaching leaves the previous render intact for its own
  // callback to find, and the new render still starts from an empty mount.
  const doc = dom.window.document;
  const stale = doc.querySelector("#mount");
  const m = doc.createElement("div");
  m.id = "mount";
  stale.replaceWith(m);
  try { new Des().nodes([]).add([el]).set({ mount: "#mount", code: false, elements: false }); }
  catch (e) { return "THREW:" + e.message; }
  return m.innerHTML;
};
// Which slot each declared type's render actually follows, measured by
// slot-sweep.mjs in a child process. See the header of that file for why it is
// not done here: a handful of types schedule work that reads the DOM back much
// later, and in-process that lands as "asynchronous activity after the test
// ended" — a file-level failure with every assertion still passing.
const LIVE = JSON.parse(
  execFileSync(process.execPath, [path.join(HERE, "slot-sweep.mjs")],
               { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const slotsOf = (type) => LIVE[type] ?? [];

// ── the table cannot drift from the library ──

test("every type in CONTENT_SLOT really reads that slot", () => {
  for (const [type, slot] of Object.entries(CONTENT_SLOT)) {
    const live = slotsOf(type);
    assert.ok(live.includes(slot),
      `CONTENT_SLOT says "${type}" reads "${slot}", but rendering says ${JSON.stringify(live)}`);
  }
});

test("every type that reads a slot is IN the table", () => {
  // The direction the old pair of tests could not see. Both iterated
  // CONTENT_SLOT, so a composite missing from CONTENT_SLOT was a composite
  // neither test ever looked at, and the guard was vacuous exactly where it
  // was needed. Four types were in that blind spot: `stack`, declared in the
  // mapper's copy of the table and not the validator's, and `dropdown`,
  // `picker` and `radio`, in neither.
  //
  // Iterating the element registry instead makes the test's coverage
  // independent of the thing it is checking.
  const missing = [];
  for (const type of ELEMENT_TYPES) {
    const live = slotsOf(type);
    if (live.length && !CONTENT_SLOT[type]) missing.push(`${type} reads ${live.join("+")}`);
  }
  assert.deepEqual(missing, [],
    `these types read a content slot and are absent from CONTENT_SLOT: ${missing.join(", ")}`);
});

test("the validator's table and the mapper's copy are identical", () => {
  // element-mapper.js keeps its own frozen copy, because it cannot import the
  // validator's without dragging a DOM into a module that has to run in bare
  // Node. Two copies is the price; drifting apart was the bug — `stack` was in
  // one and not the other — so the equality is asserted rather than commented.
  const mapperSrc = readFileSync(path.join(ROOT, "lib", "element-mapper.js"), "utf8");
  const block = mapperSrc.match(/const CONTENT_SLOT = Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(block, "could not find the mapper's CONTENT_SLOT");
  const theirs = Object.fromEntries(
    [...block[1].matchAll(/(\w+):\s*"(items|children)"/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(theirs, CONTENT_SLOT);
});

test("no type reads a slot the table does not name", () => {
  // The other direction. If a composite gains a second content slot, the
  // diagnostic below would start reporting a shape that now works — a false
  // positive, which 1.2.7 established is the costlier way to be wrong.
  for (const [type, slot] of Object.entries(CONTENT_SLOT)) {
    const other = slot === "items" ? "children" : "items";
    const live = slotsOf(type);
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

// ── the eval's own briefs have to be answerable ──

test("no brief demands a string its task never states", async () => {
  // `cards-heterogeneous` required the titles Alpha, Beta and Gamma and never
  // mentioned them. The hand-written reference solver passed it because the
  // same person wrote both; a model could not, and failed a brief nobody could
  // have answered. An unanswerable brief does not measure the library, it
  // measures whether the solver's author also wrote the checks — which is the
  // exact bias the eval's `source` field exists to expose.
  const { readFileSync } = await import("node:fs");
  const briefsPath = path.join(ROOT, "evals", "briefs.json");
  const { briefs } = JSON.parse(readFileSync(briefsPath, "utf8"));

  const unstated = [];
  for (const b of briefs) {
    const groups = b.pages
      ? b.pages.map((p) => [p.id, p.must || []])
      : [[null, b.must || []]];
    for (const [page, must] of groups) {
      for (const w of must) {
        if (b.task.toLowerCase().includes(w.toLowerCase())) continue;
        // A task may state a RULE rather than each literal — "a link to
        // /p/<lowercase name>" derives /p/orbit. Accept a requirement whose
        // parts are all present.
        const parts = w.split(/[^A-Za-z0-9]+/).filter((x) => x.length > 2);
        if (parts.length && parts.every((x) => b.task.toLowerCase().includes(x.toLowerCase()))) continue;
        unstated.push(`${b.id}${page ? "/" + page : ""}: ${JSON.stringify(w)}`);
      }
    }
  }
  assert.deepEqual(unstated, [],
    "these briefs require strings their own task never asks for:\n  " + unstated.join("\n  "));
});

// ── the item-shape diagnostic ──────────────────────────────────────────

test("an element spec in a slot that does not read one is reported", () => {
  for (const [el, path] of [
    [{ type: "cards", items: [{ type: "h2", text: "x" }] }, "elements[0].items[0]"],
    [{ type: "nav", items: [{ type: "a", text: "Home", url: "/" }] }, "elements[0].items[0]"],
    [{ type: "sideNav", items: [{ type: "a", text: "Home", url: "/" }] }, "elements[0].items[0]"],
    [{ type: "picker", items: [{ type: "h2", text: "x" }] }, "elements[0].items[0]"],
    [{ type: "radio", items: [{ label: "x" }] }, "elements[0].items[0]"],
  ]) {
    const r = validateNodes([], [el]);
    const err = r.errors.find((e) => e.code === "WRONG_ITEM_SHAPE");
    assert.ok(err, `no WRONG_ITEM_SHAPE for ${JSON.stringify(el)}`);
    assert.equal(err.path, path);
    assert.ok(err.valid[0], "the report must say what an entry may be");
  }
});

test("entries the type really does read are left alone", () => {
  // The direction that matters more. A false report does not annotate the
  // page, it prevents it — so every shape measured as rendering must validate
  // clean, including the two that look wrong and are not: `cards` takes an
  // element spec inside a nested array, and `table` and `ulist` take one flat.
  for (const el of [
    { type: "cards", items: [{ title: "A", link: "/a", img: "a.jpg" }] },
    { type: "cards", items: [[{ type: "h2", text: "x" }]] },
    { type: "nav", items: [{ title: "Home", link: "/" }] },
    { type: "nav", items: ["Home"] },
    { type: "table", items: [{ type: "h2", text: "x" }] },
    { type: "ulist", items: [{ type: "h2", text: "x" }] },
    { type: "picker", items: [["a", "A"]] },
    { type: "radio", items: ["a"] },
    { type: "cards", items: [{ $ref: "card" }] },
  ]) {
    const r = validateNodes([], [el]);
    const err = r.errors.find((e) => e.code === "WRONG_ITEM_SHAPE");
    assert.ok(!err, `WRONG_ITEM_SHAPE on a shape that renders: ${JSON.stringify(el)} -> ${JSON.stringify(err)}`);
  }
});

test("the reported entry really does render nothing, and the suggestion fixes it", () => {
  // The whole point of the report, and the property §8.7.4 measured: it has to
  // carry the correction, not merely the fact of failure. So take the
  // suggestion the diagnostic hands back, put it in, and require that the
  // content the original entry lost now appears.
  for (const type of ["cards", "nav", "sideNav"]) {
    const bad = { type, id: "t", items: [{ type: "h2", text: MARK }] };
    assert.ok(!draw(bad).includes(MARK),
      `"${type}" rendered a flat element spec after all — the diagnostic is now a false report`);

    const err = validateNodes([], [bad]).errors.find((e) => e.code === "WRONG_ITEM_SHAPE");
    assert.ok(err && err.suggestions[0], `"${type}" reported no replacement`);

    const fixed = { type, id: "t", items: [JSON.parse(err.suggestions[0])] };
    assert.ok(draw(fixed).includes(MARK),
      `"${type}": the suggested replacement ${err.suggestions[0]} still does not render`);
  }
});

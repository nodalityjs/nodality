// Measures, for every declared element type, which content slot its render
// actually follows. Printed as JSON on stdout and consumed by
// content-slots.test.mjs.
//
// A separate process on purpose. Several types schedule work that reads the
// DOM back hundreds of milliseconds later; the sweep renders faster than that,
// so those callbacks land after their mount has been replaced and die on
// `undefined.forEach`. In-process that surfaces as "asynchronous activity
// after the test ended", which node's runner turns into a file-level failure
// with every assertion still green — a red suite with no red test in it. No
// settle interval fixes it: waiting longer only lets more of the callbacks
// fire. Here the noise dies with the process, and the measurement it produces
// is unaffected because every slot verdict is read synchronously, before any
// of that work is scheduled.
import { JSDOM } from "jsdom";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
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
const { ELEMENT_TYPES } = await import(path.join(ROOT, "lib", "element-mapper.js"));
console.warn = () => {}; console.error = () => {}; console.log = () => {};

const MARK = "ZQXJ";
// Every entry shape the format accepts anywhere. A probe narrower than the
// format cannot see a composite that takes a shape it does not try, which is
// how `dropdown`, `picker` and `radio` — all three of which read `items` as
// plain choice strings — passed for leaves.
const PAYLOAD = {
  items: [
    [{ title: MARK, name: MARK, link: "#z", img: "z.jpg", code: MARK }],
    [MARK],
    [[{ type: "h2", text: MARK }]],
    [{ type: "h2", text: MARK }],
  ],
  children: [[{ type: "h2", text: MARK }]],
};

const draw = (el) => {
  const doc = dom.window.document;
  const fresh = doc.createElement("div");
  fresh.id = "mount";
  doc.querySelector("#mount").replaceWith(fresh);
  try { new Des().nodes([]).add([el]).set({ mount: "#mount", code: false, elements: false }); }
  catch { return ""; }
  return fresh.innerHTML;
};

const out = {};
for (const type of ELEMENT_TYPES) {
  out[type] = ["items", "children"].filter((slot) =>
    PAYLOAD[slot].some((payload) => draw({ type, [slot]: payload }).includes(MARK)));
}
process.stdout.write(JSON.stringify(out));
process.exit(0);

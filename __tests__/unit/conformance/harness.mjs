// Shared harness for the conformance, golden-render and lifecycle tests.
//
// Every case renders ONE element type with ONE node family at ONE width, in a
// fresh jsdom window, through `new Des()…set()` exactly as a page does, and
// reports what happened: the HTML, any error (at render or on resize), and
// counters for what the render left attached (window/document listeners,
// Theme subscriptions, components constructed).
//
// The module graph is shared between cases (ESM caches it), so cases run in a
// fixed order: module-level state is part of what the golden files pin.

import { JSDOM, VirtualConsole } from "jsdom";

export const WIDTHS = [390, 1280];
const THEME_EVENT = "nodality:theme";

/** The smallest spec each type renders — from element-id-universal.test.mjs. */
export function fixture(type, id = "probe") {
  const el = { type, id };
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "code", "copy", "simple"].includes(type)) el.text = "Probe";
  if (["img", "video", "audio", "a"].includes(type)) el.url = "/probe.mp4";
  if (["cards", "nav", "sideNav", "table", "ulist", "dropdown", "picker", "radio"].includes(type)) el.items = ["One", "Two"];
  if (["row", "form", "stack", "wrap", "free"].includes(type)) el.children = [{ type: "p", id: `${id}-kid`, text: "Kid" }];
  if (type === "multiswitcher") el.breakpoints = [{ at: "600px", view: { type: "p", id: `${id}-view`, text: "View" } }];
  if (type === "simple") el.react = [{ at: 600, template: "text-above-image" }];
  return el;
}

/** Nodes every case of a type needs regardless of the family under test. */
const baseNodes = (type) => (type === "free" ? [{ op: { name: "layout", value: "text-above-image" } }] : []);

/**
 * One entry per node family. Each returns the nodes for an element `id`.
 * A family the validator rejects for a type is recorded as such, not rendered.
 */
export const FAMILIES = {
  none: () => [],
  gradient: (id) => [{ op: { name: "gradient", gradient: "linear-gradient(90deg,#000,#fff)" }, target: [id] }],
  shadow: (id) => [{ op: { name: "shadow" }, target: [id] }],
  filter: (id) => [{ op: "filter", target: [id] }],
  animation: (id) => [{ op: "animation", target: [id] }],
  transform: (id) => [{ op: "transform", target: [id] }],
  blast: (id) => [{ op: "blast", target: [id] }],
  span: (id) => [{ op: { name: "span", parts: [{ text: "Probe", style: { color: "red" } }] }, target: [id] }],
  rangedGradient: (id) => [{ op: { name: "gradient", gradient: "linear-gradient(90deg,#f00,#00f)" }, target: [id], range: [641, 999999] }],
  raster: (id) => [{ op: "dither", target: [id], levels: 4 }],
  arrange: (id) => [{ op: { name: "arrange", mode: "column" }, target: [id], range: [0, 640] }],
};

let lib = null;
async function load() {
  if (!lib) {
    // The library reads `window`/`document` lazily, but some modules touch
    // them at import; give them a window before the first import.
    fresh(1280);
    const [{ Des }, { ELEMENT_TYPES }, { validateNodes }] = await Promise.all([
      import("../../../lib/designer.js"),
      import("../../../lib/element-mapper.js"),
      import("../../../lib/validate-nodes.js"),
    ]);
    lib = { Des, ELEMENT_TYPES, validateNodes };
  }
  return lib;
}

export async function elementTypes() { return (await load()).ELEMENT_TYPES; }

let current = null;
function fresh(width) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e).split("\n")[0].replace(/^Uncaught /, "")));
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  class Obs { observe() {} unobserve() {} disconnect() {} }
  w.IntersectionObserver = Obs;
  w.ResizeObserver = Obs;
  w.Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {}, onfinish: null });
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.HTMLMediaElement.prototype.pause = () => {};
  w.matchMedia = () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.scrollTo = () => {};
  Object.defineProperty(w, "innerWidth", { value: width, configurable: true, writable: true });
  Object.defineProperty(w, "innerHeight", { value: 844, configurable: true, writable: true });
  Object.assign(globalThis, {
    window: w, document: w.document, HTMLElement: w.HTMLElement, CustomEvent: w.CustomEvent,
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, IntersectionObserver: Obs, ResizeObserver: Obs,
  });
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
  // jsdom's selector engine registers its own window listeners on the first
  // querySelector. Run one before counting so they are not charged to the page.
  w.document.querySelector("#mount");
  const live = { window: 0, document: 0, theme: 0 };
  for (const [name, target] of [["window", w], ["document", w.document]]) {
    const add = target.addEventListener.bind(target);
    const rem = target.removeEventListener.bind(target);
    target.addEventListener = (t, f, o) => { live[name]++; if (t === THEME_EVENT) live.theme++; return add(t, f, o); };
    target.removeEventListener = (t, f, o) => { live[name]--; if (t === THEME_EVENT) live.theme--; return rem(t, f, o); };
  }
  current = { w, errors, live };
  return current;
}

/** Fire `n` resize events at the current width. Returns errors they threw. */
export function resize(n = 1) {
  const before = current.errors.length;
  for (let i = 0; i < n; i++) current.w.dispatchEvent(new current.w.Event("resize"));
  return current.errors.slice(before);
}

/** Counters right now, for the current window. */
export const counters = () => ({ ...current.live });

/**
 * Render one case. Returns
 *   { valid, issues, html, error, resizeErrors, afterRender, afterResize }
 * `valid` is the validator's verdict; nothing is rendered when it says no.
 */
export async function renderCase(type, family, width, { resizes = 3 } = {}) {
  const { Des, validateNodes } = await load();
  const E = [fixture(type)];
  const N = [...baseNodes(type), ...FAMILIES[family]("probe")];
  const report = validateNodes(N, E);
  if (!report.ok) return { valid: false, issues: report.errors.map((e) => e.code) };
  const quiet = { log: console.log, warn: console.warn, info: console.info, error: console.error };
  console.log = console.warn = console.info = console.error = () => {};
  try {
    const ctx = fresh(width);
    const base = counters();
    let error = null, des = null, added = base;
    try {
      des = new Des().nodes(N).add(E);
      added = counters();
      des.set({ mount: "#mount", code: false, elements: false });
    } catch (e) {
      error = String(e && e.message || e).split("\n")[0];
    }
    const rendered = counters();
    const html = ctx.w.document.getElementById("mount").innerHTML;
    const renderErrors = ctx.errors.slice();
    const resizeErrors = resizes ? resize(resizes) : [];
    const resized = counters();
    const delta = (a, b) => ({ window: a.window - b.window, document: a.document - b.document, theme: a.theme - b.theme });
    // A page that can be torn down: destroy() returns every counter to where
    // the render started, and nothing it left behind fires afterwards (a
    // resize, or a deferred task, reaching a destroyed component).
    let afterDestroy = null;
    if (des && typeof des.destroy === "function") {
      try {
        des.destroy();
        afterDestroy = delta(counters(), base);
        const late = resize(1);
        if (late.length) afterDestroy = { error: `after destroy: ${late[0]}` };
      } catch (e) { afterDestroy = { error: String(e.message) }; }
    }
    return {
      valid: true,
      html,
      error: error || renderErrors[0] || null,
      resizeErrors: [...new Set(resizeErrors)],
      duringAdd: delta(added, base),
      duringSet: delta(rendered, added),
      afterRender: delta(rendered, base),
      afterResize: delta(resized, rendered),
      afterDestroy,
      hasDestroy: !!(des && typeof des.destroy === "function"),
    };
  } finally {
    Object.assign(console, quiet);
  }
}

/** Every (type, family, width) case, in a fixed order. */
export async function allCases() {
  const out = [];
  for (const type of await elementTypes()) for (const family of Object.keys(FAMILIES)) for (const width of WIDTHS) out.push({ type, family, width });
  return out;
}

export const caseKey = ({ type, family, width }) => `${type}/${family}@${width}`;

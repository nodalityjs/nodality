// chainReact — the range-node path in layout/animator.js. Two kinds of test:
//
//   CHARACTERIZATION (run and pass now). What the page renders today, at two
//   widths and after resizes, pinned in golden/chainreact-output.json. The
//   refactor in CHAINREACT-PLAN-08-11-26.md must keep these byte-identical.
//   Regenerate only on purpose: UPDATE_GOLDEN=1 node --test <this file>.
//
//   TARGET (todo until the plan lands). What it should do: a resize at the
//   same width does no work and leaks nothing; a component that is not text
//   never builds a copy of itself; crossing a breakpoint rebuilds once and
//   releases what it replaced. node:test runs `todo` tests and reports them
//   without failing the suite, so the measured gap stays visible.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), "golden", "chainreact-output.json");
const THEME_EVENT = "nodality:theme";

let Des, Image, dom, themeListeners = 0, undefinedSrc = 0;

before(async () => {
  const { JSDOM } = await import("jsdom");
  dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
  dom.window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  // Count live Theme subscriptions: each is a document listener for THEME_EVENT.
  const add = dom.window.document.addEventListener.bind(dom.window.document);
  const rem = dom.window.document.removeEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = (t, f, o) => { if (t === THEME_EVENT) themeListeners++; return add(t, f, o); };
  dom.window.document.removeEventListener = (t, f, o) => { if (t === THEME_EVENT) themeListeners--; return rem(t, f, o); };
  const d = Object.getOwnPropertyDescriptor(dom.window.HTMLImageElement.prototype, "src");
  Object.defineProperty(dom.window.HTMLImageElement.prototype, "src", { configurable: true, get: d.get, set(v) { if (v === undefined) undefinedSrc++; d.set.call(this, v); } });
  ({ Des } = await import("../../lib/designer.js"));
  ({ Image } = await import("../../layout/image.js"));
});

const E = [
  { id: "hero", type: "h1", text: "Prague summer races" },
  { id: "intro", type: "p", text: "Three races, one summer, every distance." },
  { id: "pic", type: "img", url: "a.jpg" },
  { id: "lead", type: "h2", text: "Wide only" },
];
const N = [
  { op: { name: "gradient", gradient: "linear-gradient(90deg,#000,#fff)" }, target: ["hero"] },
  { op: { name: "span", parts: [{ text: "one summer", style: { color: "red" } }] }, target: ["intro"] },
  { op: { name: "shadow" }, target: ["pic"] },
  { op: { name: "gradient", gradient: "linear-gradient(90deg,#f00,#00f)" }, target: ["lead"], range: [641, 999999] },
];

function setWidth(w) {
  Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
}
function resize(times = 1) {
  for (let i = 0; i < times; i++) dom.window.dispatchEvent(new dom.window.Event("resize"));
}
function render(width, elements = E, nodes = N) {
  setWidth(width);
  document.body.innerHTML = '<div id="mount"></div>';
  new Des().nodes(nodes).add(elements).set({ mount: "#mount", code: false });
  return document.querySelector("#mount").innerHTML;
}

// ── characterization ────────────────────────────────────────────────────

test("today's output at 390 px, 1280 px and after resizes is pinned", () => {
  const now = {
    w390: render(390),
    w1280: render(1280),
  };
  resize(3);
  now.w1280AfterSameWidthResizes = document.querySelector("#mount").innerHTML;
  render(1280);
  setWidth(390);
  resize(1);
  now.w1280ThenCrossTo390 = document.querySelector("#mount").innerHTML;

  if (process.env.UPDATE_GOLDEN === "1" || !fs.existsSync(GOLDEN)) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, JSON.stringify(now, null, 2) + "\n");
  }
  const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
  for (const k of Object.keys(golden)) assert.equal(now[k], golden[k], `${k} changed`);
  assert.notEqual(now.w390, now.w1280, "the ranged gradient on #lead makes the widths differ — the fixture exercises a range");
});

test("an image never gets src=undefined, at render or on resize", () => {
  undefinedSrc = 0;
  render(1280);
  resize(5);
  assert.equal(undefinedSrc, 0);
});

// ── target behaviour (todo until the plan lands) ────────────────────────

test("a resize at the same width adds no Theme subscriptions",
  { todo: "CHAINREACT plan step 2: skip a rebuild when the active ranges did not change" }, () => {
    render(1280);
    const before = themeListeners;
    resize(100);
    assert.equal(themeListeners - before, 0, `${themeListeners - before} subscriptions added by 100 resizes`);
  });

test("a component that is not text never builds a copy of itself",
  { todo: "CHAINREACT plan step 1: build the text copy only on Text, only when it is used" }, () => {
    render(1280);
    // Every copy chainReact builds runs set({}), which for an image means
    // setup(): a fresh <img>. A resize should build none.
    const setup = Image.prototype.setup;
    let copies = 0;
    Image.prototype.setup = function (...a) { copies++; return setup.apply(this, a); };
    try { resize(3); } finally { Image.prototype.setup = setup; }
    assert.equal(copies, 0, `built ${copies} image copies on 3 resizes`);
  });

test("crossing a breakpoint back and forth leaves the subscription count where it started",
  { todo: "CHAINREACT plan step 3: destroy() what a rebuild replaces" }, () => {
    render(1280);
    const start = themeListeners;
    for (let i = 0; i < 20; i++) { setWidth(i % 2 ? 1280 : 390); resize(1); }
    setWidth(1280);
    resize(1);
    assert.equal(themeListeners - start, 0, `${themeListeners - start} subscriptions left after 20 crossings`);
  });

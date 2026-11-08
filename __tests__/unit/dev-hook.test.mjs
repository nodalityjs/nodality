// The Designer's `nodality dev` hook: invisible unless the dev server defined
// __NODALITY_DEV__, and then it annotates the page and registers its pair.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let Des, dom;

before(async () => {
  const { JSDOM } = await import("jsdom");
  dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
  if (!dom.window.matchMedia) {
    dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }
  ({ Des } = await import("../../lib/designer.js"));
});

const E = [{ id: "hero", type: "h1", text: "Hello" }, { id: "intro", type: "p", text: "World" }];
const N = [{ op: { name: "gradient", gradient: "linear-gradient(90deg,#000,#fff)" }, target: ["hero"] }];

function render() {
  document.body.innerHTML = '<div id="mount"></div>';
  new Des().nodes(N).add(E).set({ mount: "#mount", code: false });
  return document.querySelector("#mount").innerHTML;
}

test("without the dev flag nothing is registered and nothing is annotated", () => {
  delete globalThis.__NODALITY_DEV__;
  const html = render();
  assert.ok(!html.includes("data-nod"), "a normal page must render exactly as before");
  assert.equal(globalThis.__NODALITY_DEV__, undefined);
});

test("with the dev flag the page is annotated and its pair registered", () => {
  globalThis.__NODALITY_DEV__ = { pages: [], annotate: true };
  let event = null;
  const on = (e) => { event = e.detail; };
  window.addEventListener("nodality:rendered", on);
  const html = render();
  window.removeEventListener("nodality:rendered", on);
  assert.ok(html.includes("data-nod"), "dev annotates, so a pick reads back exactly");
  assert.equal(globalThis.__NODALITY_DEV__.pages.length, 1);
  const pg = globalThis.__NODALITY_DEV__.pages[0];
  assert.equal(pg.mount, "#mount");
  assert.deepEqual(pg.elements.map((e) => e.id), ["hero", "intro"]);
  assert.equal(pg.nodes.length, 1);
  assert.ok(event && event.elements, "the inspector is told a page rendered");
  delete globalThis.__NODALITY_DEV__;
});

test("a malformed flag is ignored rather than breaking the render", () => {
  globalThis.__NODALITY_DEV__ = { pages: "nope" };
  const html = render();
  assert.ok(html.includes("Hello"));
  assert.ok(!html.includes("data-nod"));
  delete globalThis.__NODALITY_DEV__;
});

test("in dev, an imperative component records the page line that created it; Des-built ones do not", async () => {
  const { Text } = await import("../../layout/text.js");
  globalThis.__NODALITY_DEV__ = { pages: [], annotate: true, sourceOf: () => "pages/index.js:60:5" };
  document.body.innerHTML = '<div id="mount"></div>';
  const node = new Text("SLS3").set({}).render();
  assert.equal(node.getAttribute("data-nod-src"), "pages/index.js:60:5");
  new Des().nodes([]).add([{ id: "hero", type: "h1", text: "Hi" }]).set({ mount: "#mount", code: false });
  assert.equal(document.querySelector("#hero").getAttribute("data-nod-src"), null, "an element from the pair is addressed by id");
  assert.equal(globalThis.__NODALITY_DEV__.inDes, false, "the Des flag is cleared after its run");
  delete globalThis.__NODALITY_DEV__;
  const plain = new Text("SLS3").set({}).render();
  assert.equal(plain.getAttribute("data-nod-src"), null, "no dev flag, no attribute");
});

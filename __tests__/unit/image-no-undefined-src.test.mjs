// `new Image().set({ url })` used to assign `img.src = undefined` before set()
// applied the real url, so every such page fetched "/undefined" (a 404).
import { test, before } from "node:test";
import assert from "node:assert/strict";

let Image, dom;
before(async () => {
  const { JSDOM } = await import("jsdom");
  dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  if (!dom.window.matchMedia) dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  ({ Image } = await import("../../layout/image.js"));
});

test("an image given its url in set() never has src=undefined", () => {
  const seen = [];
  const d = Object.getOwnPropertyDescriptor(dom.window.HTMLImageElement.prototype, "src");
  Object.defineProperty(dom.window.HTMLImageElement.prototype, "src", { configurable: true, get: d.get, set(v) { seen.push(v); d.set.call(this, v); } });
  try {
    const img = new Image().set({ url: "img/sls-hero.jpg", alt: "hero" }).render();
    assert.deepEqual(seen.filter((v) => v === undefined || v === "undefined"), [], "no undefined source is ever assigned");
    assert.equal(img.getAttribute("src"), "img/sls-hero.jpg");
  } finally {
    Object.defineProperty(dom.window.HTMLImageElement.prototype, "src", d);
  }
});

test("a url given to the constructor still works as before", () => {
  const img = new Image("img/a.jpg").set({}).render();
  assert.equal(img.getAttribute("src"), "img/a.jpg");
});

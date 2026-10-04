// image-dimensions.test.mjs — an image keeps a dimension the page declared.
//
// Image.width() and Image.height() each reset the other dimension to `auto`,
// so an image given one keeps its ratio. resprop calls those methods, and a
// page that declared `width: "100%"` and a responsive height lost the width:
// the suitcase site's process photos shrank to their intrinsic ratio, with no
// warning. Rendered through Des, which runs the generated code.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, Image, dom;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.matchMedia = (q) => ({ matches: false, media: q,
		addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	({ Des } = await import("../../lib/designer.js"));
	({ Image } = await import("../../layout/image.js"));
});

beforeEach(() => { document.getElementById("mount").innerHTML = ""; });

const render = (el) => new Des().nodes([]).add([el]).set({ mount: "#mount", code: false, elements: false });
const img = () => document.querySelector('#mount [id="p"]');
// resprop applies its values on a setTimeout(0).
const tick = () => new Promise((r) => setTimeout(r, 5));
const both = (desktop, phone) => [{ breakpoint: 4000, ...desktop }, { breakpoint: 768, ...phone }];

test("a responsive height keeps a declared width option", async () => {
	render({ type: "img", id: "p", url: "a.jpg", width: "100%", resprop: both({ height: "52vh" }, { height: "34vh" }) });
	await tick();
	assert.equal(img().style.width, "100%");
	assert.equal(img().style.height, "52vh");
});

test("a responsive height keeps a keySet width", async () => {
	render({ type: "img", id: "p", url: "a.jpg", keySet: [{ key: "width", value: "100%" }], resprop: both({ height: "52vh" }, { height: "34vh" }) });
	await tick();
	assert.equal(img().style.width, "100%");
});

test("a height alone still frees the width, so the image keeps its ratio", async () => {
	render({ type: "img", id: "p", url: "a.jpg", resprop: both({ height: "52vh" }, { height: "34vh" }) });
	await tick();
	assert.equal(img().style.width, "auto");
});

test("imperative: .width() then .height() keeps both; .width() alone frees the height", () => {
	const a = new Image("a.jpg").set({ url: "a.jpg" }).width("200px").height("100px");
	assert.equal(a.res.style.width, "200px");
	assert.equal(a.res.style.height, "100px");
	const b = new Image("b.jpg").set({ url: "b.jpg" }).width("200px");
	assert.equal(b.res.style.height, "auto");
});

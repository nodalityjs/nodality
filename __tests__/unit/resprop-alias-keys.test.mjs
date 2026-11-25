// resprop-alias-keys.test.mjs — two names for one property are one property.
//
// `exact` is the font size, and resprop tracked it apart from `fontSize`.
// blue70.cz's heading said fontSize at its wide breakpoints and `exact` at
// `sm`: at 1440 the `exact` key matched no entry of its own, fell back to the
// element's value ("") and wrote it over the 7rem, so the 140px heading
// rendered at the browser's 40px. Which key won depended only on the order the
// keys were first seen in.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, dom, width;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.MutationObserver = dom.window.MutationObserver;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	({ Des } = await import("../../lib/designer.js"));
});

const atWidth = (w) => {
	width = w;
	dom.window.matchMedia = (q) => ({ matches: false, media: q,
		addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
};
const resize = (w) => { atWidth(w); dom.window.dispatchEvent(new dom.window.Event("resize")); };
const tick = () => new Promise((r) => setTimeout(r, 5));

beforeEach(() => { document.getElementById("mount").innerHTML = ""; atWidth(1440); });

const render = (els) => new Des().nodes([]).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
const byId = (id) => document.querySelector(`#mount [id="${id}"]`);

const hero = () => ({ type: "h1", id: "h", text: "SWIM FREE", resprop: [
	{ breakpoint: "99999px", fontSize: "7rem" },
	{ breakpoint: "1800px", fontSize: "7rem" },
	{ breakpoint: "900px", fontSize: "5rem" },
	{ breakpoint: "700px", fontSize: "2.2rem" },
	{ breakpoint: "sm", exact: "3rem" },
] });

test("fontSize at some breakpoints and exact at another: each width gets its entry's size", async () => {
	render(hero());
	await tick();
	assert.equal(byId("h").style.fontSize, "7rem", "1440: the 1800px entry");
	resize(850);
	assert.equal(byId("h").style.fontSize, "5rem");
	resize(650);
	assert.equal(byId("h").style.fontSize, "2.2rem", "650 is below 700px, which sorts before sm");
	resize(740);
	assert.equal(byId("h").style.fontSize, "3rem", "740: sm, written with exact");
	resize(1440);
	assert.equal(byId("h").style.fontSize, "7rem", "and back");
});

test("the order of the entries does not decide the result", async () => {
	const h = hero();
	h.resprop.reverse();
	render(h);
	await tick();
	assert.equal(byId("h").style.fontSize, "7rem");
	resize(740);
	assert.equal(byId("h").style.fontSize, "3rem");
});

test("outside every entry the element's own size under either name comes back", async () => {
	render({ type: "p", id: "t", text: "x", exact: "20px", resprop: [
		{ breakpoint: 500, fontSize: "14px" },
		{ breakpoint: "md", exact: "16px" },
	] });
	await tick();
	assert.equal(byId("t").style.fontSize, "20px", "1440: no entry, the element's exact");
	resize(400);
	assert.equal(byId("t").style.fontSize, "14px");
	resize(800);
	assert.equal(byId("t").style.fontSize, "16px");
	resize(1440);
	assert.equal(byId("t").style.fontSize, "20px");
});

test("an entry naming both keeps the property's own name", async () => {
	render({ type: "p", id: "b", text: "x", resprop: [{ breakpoint: 800, fontSize: "12px", exact: "30px" }] });
	await tick();
	resize(600);
	assert.equal(byId("b").style.fontSize, "12px");
});

test("the author's breakpoint array is left as written", async () => {
	const h = hero();
	const before = JSON.stringify(h.resprop);
	render(h);
	await tick();
	assert.equal(JSON.stringify(h.resprop), before);
});

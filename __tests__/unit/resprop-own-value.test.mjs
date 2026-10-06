// resprop-own-value.test.mjs — what a responsive property is when no
// breakpoint applies, and how often it is written.
//
// A key given only inside a breakpoint had no default, and resprop filled
// one in as "initial" — the CSS initial value, not the element's own. Outside
// that breakpoint `top` became "initial", a font size set with `exact` became
// "initial", and `display` would have become inline. And on every resize the
// task reset each key to that default and then overwrote it: two style writes
// per key per resize event, and a phone fires one per scroll gesture as its
// address bar moves. The suitcase site's fixed nav took twelve per event.

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
	dom.window.matchMedia = (q) => {
		const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
		return { matches: (!min || width >= +min[1]) && (!max || width <= +max[1]), media: q,
			addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
	};
	Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
};
const resize = (w) => { atWidth(w); dom.window.dispatchEvent(new dom.window.Event("resize")); };
const tick = () => new Promise((r) => setTimeout(r, 5));

beforeEach(() => { document.getElementById("mount").innerHTML = ""; atWidth(1440); });

const render = (els) => new Des().nodes([]).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
const byId = (id) => document.querySelector(`#mount [id="${id}"]`);

test("a property given only at a breakpoint falls back to nothing, not to 'initial'", async () => {
	render({ type: "wrap", id: "w", children: [], resprop: [{ breakpoint: 768, top: "12px" }] });
	await tick();
	assert.equal(byId("w").style.top, "", "at 1440 no breakpoint applies, and there is no default");
	resize(375);
	assert.equal(byId("w").style.top, "12px");
	resize(1440);
	assert.equal(byId("w").style.top, "", "leaving the breakpoint hands the property back");
});

test("…and to the element's own value when set() wrote one under another name", async () => {
	// `exact` is the font size; a breakpoint that names fontSize must return to it.
	render({ type: "p", id: "t", text: "x", exact: "20px", resprop: [{ breakpoint: 768, fontSize: "14px" }] });
	await tick();
	assert.equal(byId("t").style.fontSize, "20px");
	resize(375);
	assert.equal(byId("t").style.fontSize, "14px");
	resize(1440);
	assert.equal(byId("t").style.fontSize, "20px");
});

test("a resize that changes nothing writes nothing", async () => {
	render({ type: "wrap", id: "shell", position: "fixed", children: [],
		resprop: [{ breakpoint: 4000, top: "16px", left: "24px", right: "24px" }, { breakpoint: 768, top: "12px", left: "12px", right: "12px" }] });
	await tick();
	resize(375);
	const writes = [];
	const mo = new MutationObserver((list) => writes.push(...list));
	mo.observe(byId("shell"), { attributes: true, attributeFilter: ["style"] });
	for (let i = 0; i < 5; i++) resize(375);    // the address bar, five times
	await tick();
	mo.disconnect();
	assert.equal(writes.length, 0, "no style writes when the matched values are already in place");
	assert.equal(byId("shell").style.top, "12px");
	resize(1440);
	assert.equal(byId("shell").style.top, "16px");
});

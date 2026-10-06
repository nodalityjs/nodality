// switcher-legacy.test.mjs — layout/switcher.js, the older two-view Switcher.
//
// Nothing in the library imports it any more (the nav uses multiswitcher),
// but it ships in the package and a page can import it. It emptied its box
// and rendered the view again on EVERY resize event — on a phone, one per
// scroll gesture as the address bar moves — tearing the content down and
// putting it back. And its constructor appended a debug <textarea> holding
// the generated code to the page body.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let Switcher, dom, width;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	dom.window.matchMedia = (q) => {
		const max = q.match(/max-width:\s*([\d.]+)px/);
		return { matches: !max || width <= +max[1], media: q, addEventListener() {}, removeEventListener() {} };
	};
	({ Switcher } = await import("../../layout/switcher.js"));
});

const view = (label) => {
	const el = document.createElement("p");
	el.textContent = label;
	return { render: () => el, toCode: () => `new Text("${label}")` };
};

test("a resize within the same view keeps the rendered content", async () => {
	width = 1440;
	const s = new Switcher({ breakpoint: "600px", first: view("phone"), second: view("desk") });
	assert.equal(s.res.firstElementChild.textContent, "desk");
	const changes = [];
	const mo = new dom.window.MutationObserver((list) => changes.push(...list));
	mo.observe(s.res, { childList: true, subtree: true });
	for (let i = 0; i < 5; i++) dom.window.dispatchEvent(new dom.window.Event("resize"));
	await new Promise((r) => setTimeout(r, 0));
	mo.disconnect();
	assert.equal(changes.length, 0, "nothing torn down and put back");
	width = 400;
	dom.window.dispatchEvent(new dom.window.Event("resize"));
	assert.equal(s.res.firstElementChild.textContent, "phone", "crossing the breakpoint still swaps");
});

test("constructing one leaves nothing on the page", () => {
	const before = document.body.querySelectorAll("textarea").length;
	width = 1440;
	new Switcher({ breakpoint: "600px", first: view("a"), second: view("b") });
	assert.equal(document.body.querySelectorAll("textarea").length, before);
});

// link-icon.test.mjs — a link's icon: its size, and decorative by default
// (the link carries the name: its text, or aria.label for an icon-only link).

import { test, before } from "node:test";
import assert from "node:assert/strict";

let Des;
before(async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	({ Des } = await import("../../lib/designer.js"));
});

test("an icon-only link: named by aria.label, the icon sized, decorative, no gap", () => {
	new Des().nodes([]).add([
		{ type: "a", id: "fb", text: "", url: "https://example.com", aria: { label: "Facebook" }, icon: { url: "fb.svg", size: "28px" } },
		{ type: "a", id: "t", text: "More", url: "#x", icon: { url: "arrow.svg", alt: "opens a new tab" } },
	]).set({ mount: "#mount", code: false, elements: false });
	const fb = document.querySelector("#mount #fb");
	assert.equal(fb.getAttribute("aria-label"), "Facebook");
	const img = fb.querySelector("img");
	assert.equal(img.style.width, "28px");
	assert.equal(img.getAttribute("alt"), "");
	assert.equal(img.getAttribute("aria-hidden"), "true");
	assert.equal(img.style.marginLeft, "0px");
	const t = document.querySelector("#mount #t img");
	assert.equal(t.getAttribute("alt"), "opens a new tab", "an icon that says more keeps its alt");
	assert.equal(t.hasAttribute("aria-hidden"), false);
	assert.equal(t.style.marginLeft, "10px");
});

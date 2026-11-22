// disclosure-dismiss.test.mjs — `dismiss: true` turns the native <details>
// into a dropdown that closes on an outside click, on Escape and when a link
// inside it is followed. Without it nothing changes.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, dom;
before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><p id="outside">x</p><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	({ Des } = await import("../../lib/designer.js"));
});
beforeEach(() => { document.getElementById("mount").innerHTML = ""; });

const render = (extra) => new Des().nodes([]).add([{ type: "disclosure", id: "pick", summary: "EN", ...extra,
	children: [{ type: "a", id: "de", text: "Deutsch", url: "#de" }] }]).set({ mount: "#mount", code: false, elements: false });
const ev = (type, init = {}) => new dom.window.Event(type, { bubbles: true, ...init });

test("dismiss: an outside click, Escape and a followed link close it; Escape returns focus to the summary", () => {
	render({ dismiss: true });
	const d = document.querySelector("#mount #pick");
	d.setAttribute("open", "");
	document.getElementById("outside").dispatchEvent(ev("pointerdown"));
	assert.equal(d.hasAttribute("open"), false, "outside click");
	d.setAttribute("open", "");
	d.querySelector("summary").dispatchEvent(ev("pointerdown"));
	assert.equal(d.hasAttribute("open"), true, "a click inside leaves it open");
	const k = new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true });
	d.querySelector("a").dispatchEvent(k);
	assert.equal(d.hasAttribute("open"), false, "Escape");
	assert.equal(document.activeElement, d.querySelector("summary"));
	d.setAttribute("open", "");
	d.querySelector("a").dispatchEvent(ev("click"));
	assert.equal(d.hasAttribute("open"), false, "following a link inside");
});

test("without dismiss it stays a plain <details>", () => {
	render({});
	const d = document.querySelector("#mount #pick");
	d.setAttribute("open", "");
	document.getElementById("outside").dispatchEvent(ev("pointerdown"));
	assert.equal(d.hasAttribute("open"), true);
});

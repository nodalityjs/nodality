// loader.test.mjs — the loading state (lib/loader.js): a curtain that is in
// the prerendered HTML, is taken over by the live page, lifts when the page
// is ready (min/max time), holds the entrances back until then, and never
// locks the content away.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let L, dom, w;
before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"><p>Page</p></div></body></html>', { pretendToBeVisual: true });
	w = dom.window;
	globalThis.window = w;
	globalThis.document = w.document;
	L = await import("../../lib/loader.js");
});
beforeEach(() => {
	for (const n of document.querySelectorAll("[data-nod-loader], style[data-nod-loader-style]")) n.remove();
	delete w.__NODALITY_LOADER__;
	delete w.__NODALITY_PRERENDER__;
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("prerender: the curtain and its failsafe go into the saved HTML", () => {
	w.__NODALITY_PRERENDER__ = true;
	L.installLoader({ text: "Petr Vabroušek", accent: "#EBFE00" }, document.getElementById("mount"));
	const c = document.querySelector("[data-nod-loader]");
	assert.ok(c, "the curtain");
	assert.equal(document.body.firstChild, c, "first in the body, so it paints first");
	assert.equal(c.getAttribute("aria-hidden"), "true", "decoration: the content underneath is what is read");
	assert.equal(c.textContent, "Petr Vabroušek");
	const st = document.querySelector("style[data-nod-loader-style]").textContent;
	assert.match(st, /nod-loader-failsafe \.5s ease 3500ms forwards/, "fades by itself if no script takes it over");
	assert.equal(L.loaderPending(), false, "nothing waits at prerender");
});

test("live: it takes over the static curtain, holds entrances, lifts after minTime, and goes", async () => {
	w.__NODALITY_PRERENDER__ = true;
	L.installLoader({ text: "X" }, document.getElementById("mount"));
	delete w.__NODALITY_PRERENDER__;
	const staticCurtain = document.querySelector("[data-nod-loader]");
	let ran = false;
	w.performance.now = () => 100;
	L.installLoader({ text: "X", minTime: 30, maxTime: 2000, duration: 20 }, document.getElementById("mount"));
	assert.equal(document.querySelector("[data-nod-loader]"), staticCurtain, "the same node: no second curtain");
	assert.equal(staticCurtain.style.animation, "none", "the failsafe is off: the script decides");
	assert.equal(L.loaderPending(), true);
	L.afterLoader(() => { ran = true; });
	await wait(5);
	assert.equal(ran, false, "entrances wait while the curtain is down");
	await wait(80);
	assert.equal(ran, true, "and start once it lifts");
	assert.equal(L.loaderPending(), false);
	assert.equal(document.querySelector("[data-nod-loader]"), null, "the curtain is gone (no Web Animations here: removed at once)");
});

test("a bundle later than the failsafe does not bring the curtain back", () => {
	w.__NODALITY_PRERENDER__ = true;
	L.installLoader({}, document.getElementById("mount"));
	delete w.__NODALITY_PRERENDER__;
	w.performance.now = () => 5000;
	L.installLoader({ failsafe: 3500 }, document.getElementById("mount"));
	assert.equal(document.querySelector("[data-nod-loader]"), null);
	assert.equal(L.loaderPending(), false);
	let ran = false; L.afterLoader(() => { ran = true; });
	assert.equal(ran, true, "nothing waits");
});

test("maxTime caps the wait even when an image never loads", async () => {
	const img = document.createElement("img");
	Object.defineProperty(img, "complete", { value: false });
	img.getBoundingClientRect = () => ({ top: 10, bottom: 200, width: 100, height: 190 });
	document.getElementById("mount").appendChild(img);
	w.performance.now = () => 0;
	L.installLoader({ minTime: 0, maxTime: 60, duration: 10 }, document.getElementById("mount"));
	assert.equal(L.loaderPending(), true);
	await wait(30);
	assert.equal(L.loaderPending(), true, "waiting for the on-screen image");
	await wait(80);
	assert.equal(L.loaderPending(), false, "capped");
	img.remove();
});

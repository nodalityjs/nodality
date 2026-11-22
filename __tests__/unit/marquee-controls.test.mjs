// marquee-controls.test.mjs — the marquee's built-in pause / play button.
//
// WCAG 2.2.2 (Pause, Stop, Hide): content that moves on its own for more
// than five seconds needs a mechanism to pause it. Hover and focus pauses
// last only while the pointer or focus stays, so the marquee now carries a
// real <button> once its loop runs: keyboard-reachable, named for what it
// will do, translatable, and absent when nothing moves (reduced motion,
// headless) — there is nothing to pause then.
//
// jsdom has no layout: widths are stubbed per test, as in new-elements.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>',
	{ pretendToBeVisual: true, url: "https://example.test/page" });
const W = dom.window;

const media = { reduced: false };
W.matchMedia = (q) => ({
	matches: /prefers-reduced-motion:\s*reduce/.test(q) ? media.reduced : false,
	media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
});
class FakeObserver { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} }
W.ResizeObserver = FakeObserver;
W.IntersectionObserver = FakeObserver;
W.requestAnimationFrame = () => 0;
W.cancelAnimationFrame = () => {};

const animations = [];
W.Element.prototype.animate = function (keyframes, opts) {
	const a = { keyframes, opts, state: "running", cancelled: false, currentTime: 0,
		effect: { getTiming: () => ({ duration: opts.duration }) },
		pause() { this.state = "paused"; }, play() { this.state = "running"; }, cancel() { this.cancelled = true; },
		finished: Promise.resolve() };
	animations.push(a);
	return a;
};

for (const k of ["window", "document", "HTMLElement", "Node", "Element", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent"]) {
	globalThis[k] = W[k];
}
globalThis.requestAnimationFrame = W.requestAnimationFrame;
globalThis.cancelAnimationFrame = W.cancelAnimationFrame;
Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true });

const { ElementMapper } = await import("../../lib/element-mapper.js");
const { validateNodes } = await import("../../lib/validate-nodes.js");

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const mount = () => W.document.getElementById("mount");
const show = (el) => { const c = quiet(() => ElementMapper.mapType({ el, customOptions: [], i: 0 })); mount().appendChild(c.render()); return c; };
const rect = (node, r) => { node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, ...r }); };
/** Lay the row out so the loop starts. */
const run = (m) => { rect(m.group, { width: 300 }); rect(m.res, { width: 600 }); m.measure(); return animations.at(-1); };
const toggleOf = (m) => m.res.querySelector(":scope > button[data-nodality-marquee-toggle]");

const ROW = [{ type: "a", id: "a1", text: "Alpha", url: "/a" }, { type: "p", text: "Beta" }];

beforeEach(() => { mount().innerHTML = ""; media.reduced = false; animations.length = 0; });

test("a moving marquee gets a real, named pause button outside the copied track", () => {
	const m = show({ type: "marquee", id: "logos", label: "Sponsors", children: ROW });
	assert.equal(toggleOf(m), null, "no button before the loop runs (headless, prerender)");
	run(m);
	const b = toggleOf(m);
	assert.ok(b, "button present once it moves");
	assert.equal(b.tagName, "BUTTON");
	assert.equal(b.getAttribute("type"), "button");
	assert.equal(b.getAttribute("aria-label"), "Pause");
	assert.equal(b.getAttribute("aria-controls"), m.track.id);
	assert.ok(W.document.getElementById(m.track.id), "aria-controls points at a real element");
	assert.ok(!m.track.contains(b), "never inside the track, so never copied");
	assert.equal(b.querySelector("svg").getAttribute("aria-hidden"), "true", "the glyph is decoration");
	assert.ok(!b.hasAttribute("tabindex") || b.tabIndex >= 0, "reachable with Tab");
	assert.equal(m.res.style.position, "relative", "a containing block for the overlay");
	assert.equal(b.style.position, "absolute", "overlaid: appearing after layout moves nothing");
	m.destroy();
});

test("pressing it pauses for good and turns it into Play; pressing again resumes", () => {
	const m = show({ type: "marquee", children: ROW });
	const a = run(m);
	const b = toggleOf(m);
	b.click();
	assert.equal(a.state, "paused");
	assert.equal(b.getAttribute("aria-label"), "Play");
	// Leaving the row does not undo a press (hover/focus pauses are temporary).
	m.res.dispatchEvent(new W.Event("mouseenter"));
	m.res.dispatchEvent(new W.Event("mouseleave"));
	assert.equal(a.state, "paused", "still paused after the pointer leaves");
	b.click();
	assert.equal(a.state, "running");
	assert.equal(b.getAttribute("aria-label"), "Pause");
	m.destroy();
});

test("Enter and Space work because it is a native button (click is what they fire)", () => {
	// jsdom does not synthesise the click a keypress on a <button> fires; the
	// browser does. What can be shown here is that the control is a native
	// <button> with a click handler and no keydown handling of its own that
	// could swallow the keys.
	const m = show({ type: "marquee", children: ROW });
	const a = run(m);
	const b = toggleOf(m);
	const ev = new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
	b.dispatchEvent(ev);
	assert.equal(ev.defaultPrevented, false);
	b.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
	assert.equal(a.state, "paused");
	m.destroy();
});

test("labels translate; pause() / play() from code keep the button in step", () => {
	const m = show({ type: "marquee", pauseLabel: "Pozastavit", playLabel: "Přehrát", children: ROW });
	const a = run(m);
	const b = toggleOf(m);
	assert.equal(b.getAttribute("aria-label"), "Pozastavit");
	m.pause();
	assert.equal(a.state, "paused");
	assert.equal(b.getAttribute("aria-label"), "Přehrát");
	m.play();
	assert.equal(b.getAttribute("aria-label"), "Pozastavit");
	m.destroy();
});

test("controlsStyle restyles the button over its defaults", () => {
	const m = show({ type: "marquee", controlsStyle: { background: "#111", color: "#fff" }, children: ROW });
	run(m);
	const b = toggleOf(m);
	assert.equal(b.style.color, "rgb(255, 255, 255)");
	assert.equal(b.style.background.includes("rgb(17, 17, 17)") || b.style.background === "#111", true, b.style.background);
	m.destroy();
});

test("controls: false leaves pausing to hover, focus and code", () => {
	const m = show({ type: "marquee", controls: false, children: ROW });
	const a = run(m);
	assert.equal(toggleOf(m), null);
	m.res.dispatchEvent(new W.Event("mouseenter"));
	assert.equal(a.state, "paused", "hover still pauses");
	m.destroy();
});

test("reduced motion: static row, nothing to pause, no button", () => {
	media.reduced = true;
	const m = show({ type: "marquee", children: ROW });
	run(m);
	assert.equal(animations.length, 0);
	assert.equal(toggleOf(m), null);
	m.destroy();
});

test("a position the page gave the row is kept", () => {
	const m = show({ type: "marquee", position: "absolute", children: ROW });
	run(m);
	assert.equal(m.res.style.position, "absolute");
	m.destroy();
});

test("destroy() removes the button with the loop", () => {
	const m = show({ type: "marquee", children: ROW });
	const a = run(m);
	const b = toggleOf(m);
	m.destroy();
	assert.equal(a.cancelled, true);
	assert.equal(b.isConnected, false);
});

test("the validator accepts the new options on a marquee", () => {
	const r = validateNodes([], [{ type: "marquee", id: "m", controls: true, pauseLabel: "Pause",
		playLabel: "Play", controlsStyle: { color: "#fff" }, children: [{ type: "p", text: "x" }] }]);
	const flagged = [...r.errors, ...r.warnings].filter((e) => /^elements\[0\]\.(controls|pauseLabel|playLabel|controlsStyle)/.test(e.path));
	assert.deepEqual(flagged.map((e) => `${e.code} ${e.path}`), []);
});

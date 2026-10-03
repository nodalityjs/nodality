// loop.test.mjs — `loop`, an animation that runs forever with no stylesheet.
//
// A page that wanted something to move on its own had to put a @keyframes rule
// in a <style> block, outside the page data — the suitcase site's drifting
// twill hatching did exactly that. `loop` declares it on the element and runs
// it through the Web Animations API. Rendered through Des, which runs the
// generated code: an option that toCode() drops never reaches the page.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, dom, calls, reduce;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.matchMedia = (q) => ({ matches: /reduced-motion/.test(q) ? reduce : false, media: q,
		addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	({ Des } = await import("../../lib/designer.js"));
});

beforeEach(() => {
	calls = []; reduce = false;
	document.getElementById("mount").innerHTML = "";
	dom.window.Element.prototype.animate = function (frames, opts) {
		const anim = { frames, opts, el: this, cancelled: false, cancel() { this.cancelled = true; } };
		calls.push(anim);
		return anim;
	};
});

const DRIFT = { keyframes: [{ backgroundPosition: "0px 0" }, { backgroundPosition: "99px 0" }], duration: 14000 };
const render = (el) => new Des().nodes([]).add([el]).set({ mount: "#mount", code: false, elements: false });

test("a looped element animates forever, through Des, with the declared timing", () => {
	render({ type: "wrap", id: "hatch", loop: DRIFT, children: [] });
	const node = document.querySelector('[id="hatch"]');
	const anim = calls.find((c) => c.el === node);
	assert.ok(anim, "the rendered node is the one animated");
	assert.deepEqual(anim.frames, DRIFT.keyframes);
	assert.equal(anim.opts.duration, 14000);
	assert.equal(anim.opts.iterations, Infinity);
	assert.equal(anim.opts.easing, "linear");
});

test("reduced motion: nothing moves", () => {
	reduce = true;
	render({ type: "wrap", id: "hatch", loop: DRIFT, children: [] });
	assert.equal(calls.length, 0);
});

test("no Web Animations (the prerender): nothing runs and nothing throws", () => {
	delete dom.window.Element.prototype.animate;
	render({ type: "wrap", id: "hatch", loop: DRIFT, children: [] });
	assert.ok(document.querySelector('[id="hatch"]'));
});

test("works on text too, not only wraps", () => {
	render({ type: "p", id: "t", text: "Hi", loop: { keyframes: [{ opacity: 1 }, { opacity: 0.5 }], duration: 2000, direction: "alternate" } });
	const anim = calls.find((c) => c.el === document.querySelector('[id="t"]'));
	assert.ok(anim);
	assert.equal(anim.opts.direction, "alternate");
});

test("re-applying replaces the running loop instead of stacking another", async () => {
	const { Text } = await import("../../layout/text.js");
	const w = new Text("x").set({ text: "x", loop: DRIFT });
	w.set({ text: "x", loop: DRIFT });
	const mine = calls.filter((c) => c.el === w.res);
	assert.equal(mine.length, 2);
	assert.equal(mine[0].cancelled, true);
	assert.equal(mine[1].cancelled, false);
});

test("one keyframe is refused with a warning, not animated", () => {
	const warn = console.warn; const said = [];
	console.warn = (m) => said.push(String(m));
	try { render({ type: "wrap", id: "w", loop: { keyframes: [{ opacity: 1 }] }, children: [] }); }
	finally { console.warn = warn; }
	assert.equal(calls.length, 0);
	assert.ok(said.some((m) => /two keyframes/.test(m)));
});

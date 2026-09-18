// image-reveal.test.mjs — `img.reveal`, the square-mask scroll reveal.
//
// The reveal hides most of the image until it scrolls into view, so the
// failure that matters is a mask that never opens: content hidden for good.
// The mask is therefore applied only where it can be undone — a browser with
// an IntersectionObserver and no reduced-motion preference — and each of
// those guards is asserted here, alongside the geometry (a square, not the
// rectangle a percentage inset draws on a non-square frame) and the path
// through Des, which runs generated code rather than the mapped instance.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Image, Des, dom, reduceMotion, observers, resizers, hasIO;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	dom.window.matchMedia = (q) => ({
		matches: /prefers-reduced-motion/.test(q) ? reduceMotion : false,
		media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	});

	// jsdom implements neither observer, so both are recorded and driven by hand.
	class IO {
		constructor(cb, opts) { this.cb = cb; this.opts = opts; this.targets = []; observers.push(this); }
		observe(t) { this.targets.push(t); }
		disconnect() { this.disconnected = true; }
		fire(isIntersecting) { this.cb(this.targets.map((target) => ({ target, isIntersecting }))); }
	}
	Object.defineProperty(dom.window, "IntersectionObserver", { get: () => (hasIO ? IO : undefined), configurable: true });
	dom.window.ResizeObserver = class {
		constructor(cb) { this.cb = cb; resizers.push(this); }
		observe(t) { this.target = t; }
		disconnect() { this.disconnected = true; }
		fire() { this.cb([{ target: this.target }]); }
	};

	({ Image } = await import("../../layout/image.js"));
	({ Des } = await import("../../lib/designer.js"));
});

beforeEach(() => {
	reduceMotion = false; hasIO = true; observers = []; resizers = [];
	document.getElementById("mount").innerHTML = "";
});

const img = (reveal) => new Image("/a.jpg").set({ url: "/a.jpg", alt: "A", reveal });

/** jsdom has no layout, so a frame size is stated rather than measured. */
const sized = (el, w, h) => {
	Object.defineProperty(el, "clientWidth", { value: w, configurable: true });
	Object.defineProperty(el, "clientHeight", { value: h, configurable: true });
};

test("an image without reveal is untouched", () => {
	const i = new Image("/a.jpg").set({ url: "/a.jpg" });
	assert.equal(i.res.style.clipPath, "");
	assert.equal(i.res.style.scale, "");
	assert.equal(observers.length, 0);
});

test("reveal starts masked and zoomed, and opens when it scrolls into view", () => {
	const i = img({ mask: "square" });
	assert.match(i.res.style.clipPath, /^inset\(/);
	assert.equal(i.res.style.scale, "1.12");
	assert.match(i.res.style.transition, /clip-path 1\.2s/);
	assert.equal(observers.length, 1);
	// A line in the viewport, not an area ratio: the browser measures the
	// target clipped by its own clip-path, so a closed square never reaches
	// any ratio much above its own share of the frame.
	assert.equal(observers[0].opts.threshold, 0);
	assert.equal(observers[0].opts.rootMargin, "0px 0px -20% 0px");

	observers[0].fire(false);
	assert.notEqual(i.res.style.clipPath, "inset(0px)");

	observers[0].fire(true);
	assert.match(i.res.style.clipPath, /^inset\(0(px)?( 0(px)?)?\)$/);
	assert.equal(i.res.style.scale, "1");
	assert.equal(observers[0].disconnected, true, "once: stops observing after opening");
});

test("the closed mask is a true square on a non-square frame", () => {
	const i = img({ size: 0.4 });
	sized(i.res, 720, 540);
	resizers[0].fire();
	// side = 0.4 × 540 = 216 → insets (540-216)/2 = 162 vertical, (720-216)/2 = 252 horizontal
	assert.equal(i.res.style.clipPath, "inset(162px 252px)");
});

test("reduced motion gets the image unmasked", () => {
	reduceMotion = true;
	const i = img({});
	assert.equal(i.res.style.clipPath, "");
	assert.equal(i.res.style.scale, "");
});

test("no IntersectionObserver (the prerender) leaves the image unmasked", () => {
	hasIO = false;
	const i = img({});
	assert.equal(i.res.style.clipPath, "");
});

test("once: false closes again when the image leaves", () => {
	const i = img({ once: false });
	observers[0].fire(true);
	observers[0].fire(false);
	assert.match(i.res.style.clipPath, /^inset\(3\d/);
	assert.equal(i.res.style.scale, "1.12");
	assert.notEqual(observers[0].disconnected, true);
});

test("an unknown mask is refused with a warning, not applied", () => {
	const warn = console.warn; const said = [];
	console.warn = (m) => said.push(String(m));
	try {
		const i = img({ mask: "circle" });
		assert.equal(i.res.style.clipPath, "");
		assert.ok(said.some((m) => /mask "circle"/.test(m)));
	} finally { console.warn = warn; }
});

test("reveal survives Des, which renders the generated code", () => {
	new Des().nodes([]).add([{ type: "img", id: "shot", url: "/a.jpg", alt: "A", reveal: { size: 0.3 } }])
		.set({ mount: "#mount", code: false, elements: false });
	const node = document.querySelector('[id="shot"]');
	assert.ok(node, "image rendered");
	assert.match(node.style.clipPath, /^inset\(/);
	const io = observers.find((o) => o.targets.includes(node));
	assert.ok(io, "the rendered node is the one observed");
	io.fire(true);
	assert.match(node.style.clipPath, /^inset\(0/);
});

// grid-overlay.test.mjs — GridOverlay and the geometry it shares.
//
// Two layers, tested apart:
//
//   lib/grid-geometry.js   pure arithmetic, bare Node. Anything that places
//                          content on the grid must get the SAME numbers the
//                          overlay draws, so the numbers are pinned here.
//   layout/grid-overlay.js the component, under jsdom. What matters is the
//                          contract a page relies on: the grid is inert to
//                          assistive tech and to the pointer, it draws one
//                          line per cell edge, it swaps to the mobile grid
//                          below the breakpoint, readouts update in place,
//                          and destroy() releases what it attached.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { gridGeometry, resolveGridOptions, readoutPosition } from "../../lib/grid-geometry.js";

// ── geometry ─────────────────────────────────────────────────────────

test("N cells give N+1 lines spread between the insets", () => {
	const g = gridGeometry({ width: 1440, height: 900, columns: 4, rows: 2, inset: 16 });
	assert.deepEqual(g.x, [16.5, 368.5, 720.5, 1072.5, 1424.5]);
	assert.deepEqual(g.y, [16.5, 450.5, 884.5]);
	assert.deepEqual(g.cell, { width: 352, height: 434 });
	assert.equal(g.intersections.length, 5 * 3);
});

test("1px lines snap to half pixels, 2px lines to whole pixels", () => {
	const odd = gridGeometry({ width: 1001, height: 10, columns: 2, rows: 0, inset: 0, lineWidth: 1 });
	assert.ok(odd.x.every((v) => v % 1 === 0.5), `got ${odd.x}`);
	const even = gridGeometry({ width: 1001, height: 10, columns: 2, rows: 0, inset: 0, lineWidth: 2 });
	assert.ok(even.x.every((v) => Number.isInteger(v)), `got ${even.x}`);
});

test("zero cells on an axis draws no lines there and no intersections", () => {
	const g = gridGeometry({ width: 390, height: 844, columns: 1, rows: 0, inset: 16 });
	assert.equal(g.x.length, 2);
	assert.deepEqual(g.y, []);
	assert.deepEqual(g.intersections, []);
});

test("insets can differ per axis and never exceed half the box", () => {
	const g = gridGeometry({ width: 100, height: 100, columns: 1, rows: 1, inset: { x: 10, y: 400 } });
	assert.deepEqual(g.inset, { x: 10, y: 50 });
});

test("bad input degrades to an empty grid instead of NaN", () => {
	const g = gridGeometry({ width: "wide", height: undefined, columns: "four", rows: -2 });
	assert.deepEqual([g.x, g.y, g.intersections], [[], [], []]);
});

test("the mobile override applies only below the breakpoint", () => {
	const opts = { columns: 4, rows: 2, breakpoint: 768, mobile: { columns: 1, rows: 4 } };
	assert.deepEqual([resolveGridOptions(opts, 390).columns, resolveGridOptions(opts, 390).rows], [1, 4]);
	assert.equal(resolveGridOptions(opts, 1440).columns, 4);
	assert.equal("mobile" in resolveGridOptions(opts, 390), false);
});

test("a readout anchored outside the box flips to the inside", () => {
	const box = { width: 1000, height: 500 };
	// On the right edge: "br" would be clipped, so it flips to the left.
	assert.equal(readoutPosition({ x: 1000, y: 250 }, "br", 8, box).textAnchor, "end");
	// On the left edge: "bl" would be clipped, so it flips to the right.
	assert.equal(readoutPosition({ x: 0, y: 250 }, "bl", 8, box).textAnchor, "start");
	// On the bottom edge: "br" flips upward.
	assert.equal(readoutPosition({ x: 500, y: 500 }, "br", 8, box).baseline, "alphabetic");
	// On the top edge: "tr" flips downward.
	assert.equal(readoutPosition({ x: 500, y: 0 }, "tr", 8, box).baseline, "hanging");
	// With room to spare the anchor is honoured exactly.
	assert.deepEqual(readoutPosition({ x: 500, y: 250 }, "br", 8, box),
		{ x: 508, y: 258, textAnchor: "start", baseline: "hanging" });
});

test("readout anchors name the quadrant around the intersection", () => {
	assert.deepEqual(readoutPosition({ x: 100, y: 50 }, "br", 8),
		{ x: 108, y: 58, textAnchor: "start", baseline: "hanging" });
	assert.deepEqual(readoutPosition({ x: 100, y: 50 }, "tl", 8),
		{ x: 92, y: 42, textAnchor: "end", baseline: "alphabetic" });
	assert.equal(readoutPosition({ x: 0, y: 0 }, "nonsense").textAnchor, "start");
});

// ── component ────────────────────────────────────────────────────────

let GridOverlay;
let dom;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>", { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator",
		{ value: dom.window.navigator, configurable: true });
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	globalThis.HTMLElement = dom.window.HTMLElement;
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({
			matches: false, addEventListener() {}, removeEventListener() {},
			addListener() {}, removeListener() {},
		});
	}
	({ GridOverlay } = await import("../../layout/grid-overlay.js"));
});

const setViewport = (width, height) => {
	Object.defineProperty(dom.window, "innerWidth", { value: width, configurable: true });
	Object.defineProperty(dom.window, "innerHeight", { value: height, configurable: true });
};

const lines = (host) => [...host.querySelectorAll("line")];
const vertical = (host) => lines(host).filter((l) => l.getAttribute("x1") === l.getAttribute("x2"));
const horizontal = (host) => lines(host).filter((l) => l.getAttribute("y1") === l.getAttribute("y2"));

test("the grid is hidden from assistive tech and from the pointer", () => {
	setViewport(1440, 900);
	const host = new GridOverlay().set({}).render("#mount");
	assert.equal(host.getAttribute("aria-hidden"), "true");
	assert.equal(host.style.pointerEvents, "none");
	assert.equal(host.style.position, "fixed");
	assert.equal(host.querySelectorAll("[tabindex], a, button").length, 0);
	host.remove();
});

test("draws one line per cell edge and a mark per intersection", () => {
	setViewport(1440, 900);
	const host = new GridOverlay().set({ columns: 4, rows: 2, marks: "square" }).render("#mount");
	assert.equal(vertical(host).length, 5);
	assert.equal(horizontal(host).length, 3);
	assert.equal(host.querySelectorAll("rect").length, 15);
	host.remove();
});

test("marks: cross draws one path, none draws nothing", () => {
	setViewport(1440, 900);
	const cross = new GridOverlay().set({ marks: "cross" }).render("#mount");
	assert.equal(cross.querySelectorAll("rect").length, 0);
	assert.equal(cross.querySelectorAll("path").length, 1);
	cross.remove();
	const none = new GridOverlay().set({ marks: "none" }).render("#mount");
	assert.equal(none.querySelectorAll("rect, path").length, 0);
	none.remove();
});

test("below the breakpoint the mobile grid replaces the desktop one", () => {
	setViewport(390, 844);
	const host = new GridOverlay().set({ columns: 4, rows: 2, mobile: { columns: 1, rows: 4 } }).render("#mount");
	assert.equal(vertical(host).length, 2);
	assert.equal(horizontal(host).length, 5);
	host.remove();
});

test("readouts render uppercase at their intersection and update in place", () => {
	setViewport(1440, 900);
	const overlay = new GridOverlay().set({
		readouts: [
			{ id: "part", col: 1, row: 1, text: "horná časť · 412 mm" },
			{ id: "missing", col: 99, row: 99, text: "never drawn" },
		],
	});
	const host = overlay.render("#mount");
	const part = host.querySelector('[data-readout="part"]');
	assert.equal(part.textContent, "HORNÁ ČASŤ · 412 MM");
	assert.equal(host.querySelector('[data-readout="missing"]'), null);

	overlay.readout("part", "spodná časť");
	assert.equal(part.textContent, "SPODNÁ ČASŤ");

	// A redraw keeps the value set through readout(), not the original text.
	overlay.draw();
	assert.equal(host.querySelector('[data-readout="part"]').textContent, "SPODNÁ ČASŤ");
	host.remove();
});

test("uppercase: false keeps the readout as written", () => {
	setViewport(1440, 900);
	const host = new GridOverlay()
		.set({ uppercase: false, readouts: [{ id: "a", col: 0, row: 0, text: "koliesko" }] })
		.render("#mount");
	assert.equal(host.querySelector('[data-readout="a"]').textContent, "koliesko");
	host.remove();
});

test("color recolours the whole grid through currentColor", () => {
	setViewport(1440, 900);
	const host = new GridOverlay().set({ color: "rgb(255, 255, 255)" }).render("#mount");
	assert.equal(host.style.color, "rgb(255, 255, 255)");
	assert.equal(host.querySelector("g").getAttribute("stroke"), "currentColor");
	host.remove();
});

test("geometry() exposes the numbers that were drawn", () => {
	setViewport(1440, 900);
	const overlay = new GridOverlay().set({ columns: 4, rows: 2, inset: 16 });
	overlay.render("#mount");
	assert.deepEqual(overlay.geometry().x, [16.5, 368.5, 720.5, 1072.5, 1424.5]);
	overlay.destroy();
});

test("destroy() removes the element and the resize listener", () => {
	setViewport(1440, 900);
	const overlay = new GridOverlay().set({ columns: 4 });
	const host = overlay.render("#mount");
	overlay.destroy();
	assert.equal(host.isConnected, false);
	// After destroy a resize must not redraw into the detached node.
	let drew = 0;
	const original = overlay.draw.bind(overlay);
	overlay.draw = () => { drew++; return original(); };
	dom.window.dispatchEvent(new dom.window.Event("resize"));
	assert.equal(drew, 0);
});

test("toCode() round-trips the options it was given", () => {
	const overlay = new GridOverlay().set({ columns: 3, color: "#fff", readouts: [{ id: "a", col: 0, row: 0, text: "x" }] });
	const [code] = overlay.toCode();
	assert.match(code, /^new GridOverlay\(\)\.set\(/);
	assert.match(code, /columns: 3/);
	assert.match(code, /color: "#fff"/);
	overlay.destroy();
});

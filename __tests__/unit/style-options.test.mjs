// style-options.test.mjs — CSS-named options are part of the API, and seen.
//
// commonMethods has applied CSS-named options (lineHeight, gap, exact, …)
// since April 2026, but through a map rather than by name, so the schema never
// credited them: `get_schema p` omitted `lineHeight`, and validate_nodes
// reported working options as PARAM_NOT_ON_TYPE — "accepted and ignored". The
// nav bars and the shop elements did not run commonMethods at all. The
// suitcase site therefore wrote 1 453 keySet entries, most of them for options
// the library had. These tests hold the options to working on every type that
// offers them, through Des (which runs the generated code), and hold the schema
// and validator to offering exactly those.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, validateNodes, dom, width;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	({ Des } = await import("../../lib/designer.js"));
	({ validateNodes } = await import("../../lib/validate-nodes.js"));
});

const atWidth = (w) => {
	width = w;
	dom.window.matchMedia = (q) => {
		const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
		const matches = (!min || width >= +min[1]) && (!max || width <= +max[1]);
		return { matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
	};
	Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
};

beforeEach(() => { document.getElementById("mount").innerHTML = ""; document.head.querySelectorAll("script, style").forEach((n) => n.remove()); atWidth(1440); });

const render = (els) => new Des().nodes([]).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
const byId = (id) => document.querySelector(`#mount [id="${id}"]`);

const TEXT = { exact: "0.72rem", lineHeight: "1.6", letterSpacing: "0.12em", textTransform: "uppercase", weight: "500", textAlign: "right" };

test("text elements take typography as options", () => {
	render({ type: "p", id: "t", text: "Label", ...TEXT });
	const s = byId("t").style;
	assert.equal(s.fontSize, "0.72rem");
	assert.equal(s.lineHeight, "1.6");
	assert.equal(s.letterSpacing, "0.12em");
	assert.equal(s.textTransform, "uppercase");
	assert.equal(s.fontWeight, "500");
	assert.equal(s.textAlign, "right");
});

test("a wrap takes grid and flex alignment, side borders and box sizing", () => {
	render({ type: "wrap", id: "w", display: "grid", gap: "20px", rowGap: "32px", alignContent: "start",
		justifyContent: "space-between", alignItems: "center", boxSizing: "border-box",
		borderBottom: "1px solid rgba(14, 15, 17, 0.14)", minHeight: "70vh", children: [] });
	const s = byId("w").style;
	assert.equal(s.display, "grid");
	assert.equal(s.gap === "20px" || s.columnGap === "20px", true);
	assert.equal(s.rowGap, "32px");
	assert.equal(s.alignContent, "start");
	assert.equal(s.justifyContent, "space-between");
	assert.equal(s.alignItems, "center");
	assert.equal(s.boxSizing, "border-box");
	assert.match(s.borderBottom, /1px solid/);
	assert.equal(s.minHeight, "70vh");
});

test("an image takes aspect ratio and object fit as options", () => {
	render({ type: "img", id: "i", url: "a.jpg", alt: "", width: "100%", aspectRatio: "4 / 5", objectFit: "cover" });
	assert.equal(byId("i").style.aspectRatio, "4 / 5");
	assert.equal(byId("i").style.objectFit, "cover");
});

const GLASS = { backdropFilter: "blur(20px) saturate(170%)", boxShadow: "0 10px 30px rgba(14, 15, 17, 0.25)", exact: "0.72rem", weight: "500", boxSizing: "border-box" };
const ITEMS = [{ title: "Material", link: "#material" }];

for (const [name, w] of [["desktop", 1440], ["phone", 390]]) {
	test(`the nav bar takes CSS-named options on ${name}, and keeps its own font and colour meaning`, () => {
		atWidth(w);
		render({ type: "nav", id: "nav", items: ITEMS, breakpoint: 768, font: "Menlo", color: "rgb(14, 15, 17)", ...GLASS });
		const bar = document.querySelector("#mount nav");
		assert.ok(bar, "a bar rendered");
		assert.equal(bar.style.backdropFilter, GLASS.backdropFilter);
		assert.match(bar.style.boxShadow, /0px 10px 30px|0 10px 30px/);
		assert.equal(bar.style.fontSize, "0.72rem");
		assert.equal(bar.style.fontWeight, "500");
		assert.equal(bar.style.boxSizing, "border-box");
		// `font` is the links' on a nav, not the bar's.
		assert.notEqual(bar.style.fontFamily, "Menlo");
	});
}

test("the visible commerce elements take the options, live and in their static copy", () => {
	const BUY = { background: "rgb(14, 15, 17)", color: "rgb(241, 239, 234)", radius: "999px", pad: [{ tb: 18, lr: 30 }],
		exact: "0.8rem", weight: "500", letterSpacing: "0.12em", textTransform: "uppercase", display: "inline-flex",
		justifyContent: "center", alignItems: "center", textDecoration: "none", cursor: "pointer" };
	render([{ type: "store", id: "store", domain: "https://shop.example" },
		{ type: "product", id: "p", handle: "h", children: [
			{ type: "price", id: "pr", text: "€1", exact: "2.2rem", lineHeight: "1" },
			{ type: "buy", id: "b", text: "Buy", url: "https://shop.example/h", ...BUY },
		] }]);
	const ctx = document.querySelector("#mount shopify-context");
	const live = ctx.querySelector("template").content;
	const ph = ctx.querySelector("[shopify-loading-placeholder]");
	for (const [where, root, suffix] of [["live", live, ""], ["static", ph, "-static"]]) {
		const price = root.querySelector(`[id="pr${suffix}"]`);
		assert.equal(price.style.fontSize, "2.2rem", `${where} price size`);
		assert.equal(price.style.lineHeight, "1", `${where} price line height`);
		const buy = root.querySelector(`[id="b${suffix}"]`);
		assert.equal(buy.style.borderRadius, "999px", `${where} buy radius`);
		assert.equal(buy.style.paddingTop, "18px", `${where} buy padding`);
		assert.equal(buy.style.textTransform, "uppercase", `${where} buy case`);
		assert.equal(buy.style.display, "inline-flex", `${where} buy display`);
		assert.equal(buy.style.textDecoration.includes("none"), true, `${where} buy decoration`);
	}
});

test("the schema offers them, and the validator stops calling them ignored", () => {
	const r = validateNodes([], [
		{ type: "p", id: "a", text: "x", ...TEXT },
		{ type: "wrap", id: "b", display: "grid", gap: "20px", alignContent: "start", boxSizing: "border-box", children: [] },
		{ type: "nav", id: "n", items: ITEMS, ...GLASS },
		{ type: "price", id: "c", text: "€1", exact: "2rem", lineHeight: "1" },
	]);
	const ignored = r.warnings.filter((w) => w.code === "PARAM_NOT_ON_TYPE");
	assert.deepEqual(ignored.map((w) => w.path), []);
});

test("where an option does nothing, it is still reported: a store draws nothing", () => {
	const r = validateNodes([], [{ type: "store", id: "s", domain: "https://shop.example", lineHeight: "1" }]);
	assert.ok(r.warnings.some((w) => w.code === "PARAM_NOT_ON_TYPE" && /lineHeight/.test(w.path)));
});

test("gpos with one axis leaves the other alone", () => {
	// gridRow = undefined became the line name "undefined" in a browser, which
	// moved the element to an implicit row at the end of the grid.
	render({ type: "p", id: "g", text: "x", gpos: { col: "1 / -1" } });
	const s = byId("g").style;
	assert.equal(s.gridColumn, "1 / -1");
	assert.equal(s.gridRow, "", "no row was given, so none is written");
	assert.ok(!/undefined/.test(byId("g").getAttribute("style") || ""));
});

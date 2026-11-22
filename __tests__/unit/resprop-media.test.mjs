// resprop-media.test.mjs — resprop entries keyed by any media query.
//
// A width cannot say "the visitor asked for reduced motion": a sideways track
// that is driven by the page's scroll on a desktop must become a plain
// swipeable row for those visitors, at the same width. `{media, …css}`
// entries answer that, win over width entries, lose to container entries,
// re-apply when the query flips without a resize, and do nothing at prerender.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, dom, width, flags, mqls;

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

const install = () => {
	dom.window.matchMedia = (q) => {
		if (mqls[q]) return mqls[q];
		const ls = new Set();
		return (mqls[q] = { media: q,
			get matches() {
				if (q in flags) return flags[q];
				const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
				return (!min || width >= +min[1]) && (!max || width <= +max[1]);
			},
			addEventListener(t, f) { ls.add(f); }, removeEventListener(t, f) { ls.delete(f); },
			addListener(f) { ls.add(f); }, removeListener(f) { ls.delete(f); },
			fire() { for (const f of [...ls]) f({ matches: this.matches }); },
			get listeners() { return ls.size; } });
	};
};
const atWidth = (w) => { width = w; Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true }); };
const tick = () => new Promise((r) => setTimeout(r, 5));
const RM = "(prefers-reduced-motion: reduce)";

beforeEach(() => { document.getElementById("mount").innerHTML = ""; flags = {}; mqls = {}; install(); atWidth(1440); });

const render = (els) => new Des().nodes([]).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
const byId = (id) => document.querySelector(`#mount [id="${id}"]`);

test("a media entry applies while its query matches and hands the value back after, with no resize", async () => {
	flags[RM] = false;
	render({ type: "wrap", id: "w", children: [], overflowX: "clip", resprop: [{ media: RM, overflowX: "auto" }] });
	await tick();
	assert.equal(byId("w").style.overflowX, "clip");
	flags[RM] = true; mqls[RM].fire();
	assert.equal(byId("w").style.overflowX, "auto", "reduced motion switched on: re-applied without a resize");
	flags[RM] = false; mqls[RM].fire();
	assert.equal(byId("w").style.overflowX, "clip");
	assert.ok(!byId("w").hasAttribute("media"), "media is a selector, not a property to write");
});

test("media beats width, the first media match wins, and width entries still work beside them", async () => {
	flags[RM] = true; flags["(hover: none)"] = true;
	render({ type: "wrap", id: "w", children: [], resprop: [
		{ min: 900, gap: "40px", color: "red" },
		{ media: RM, gap: "8px" },
		{ media: "(hover: none)", gap: "2px", top: "3px" },
	] });
	await tick();
	const el = byId("w");
	assert.equal(el.style.gap, "8px", "media over width, first media entry over the second");
	assert.equal(el.style.color, "red", "a key only the width entry has still comes from it");
	assert.equal(el.style.top, "", "the second media entry does not apply while the first matches");
});

test("prerender (no matchMedia): no media entry applies", async () => {
	delete dom.window.matchMedia;
	render({ type: "wrap", id: "w", children: [], overflowX: "clip", resprop: [{ media: RM, overflowX: "auto" }] });
	await tick();
	assert.equal(byId("w").style.overflowX, "clip");
});

test("the validator accepts a media entry and rejects an empty one", async () => {
	const { validateNodes } = await import("../../lib/validate-nodes.js");
	const bad = (rp) => [...validateNodes([], [{ type: "wrap", id: "a", children: [], resprop: rp }]).warnings]
		.filter((x) => x.code === "BAD_PARAM_VALUE").length;
	assert.equal(bad([{ media: "(prefers-reduced-motion: reduce)", overflowX: "auto" }]), 0);
	assert.equal(bad([{ media: "", overflowX: "auto" }]), 1);
});

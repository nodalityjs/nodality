// respond-declared.test.mjs: respond() samples both sides of every width the
// spec itself declares a change at (resprop/respad/resmar ranges, a nav's
// breakpoint).
//
// Added 27 Nov 2026 after adversarial pages for the responsive-breakpoints
// paper: a heading made huge by resprop on a 32 px band inside one sampling
// cell, off the cell's midpoint, made the row overflow there and fit at both
// ends of the cell. Cell certification (one midpoint per cell) missed it. The
// band is in the spec, so the solver can read it instead of searching for it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { respond, entryRange, declaredWidths } from "../../lib/responsive.js";

test("entryRange follows the runtime's own rule (Animator._entryRange)", async () => {
	const dom = new JSDOM("<!doctype html><html><body></body></html>");
	globalThis.window = dom.window; globalThis.document = dom.window.document;
	globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Node = dom.window.Node;
	const { Animator } = await import("../../layout/animator.js");
	const tiers = { default: [0, 100000], xs: [0, 575], sm: [576, 767], md: [768, 991], lg: [992, 1199], xl: [1200, 1399], xxl: [1400, 100000] };
	const cases = [
		[{ breakpoint: "md" }, "max"], [{ breakpoint: [600, 640] }, "max"], [{ breakpoint: "800px" }, "max"],
		[{ breakpoint: "800px" }, "min"], [{ min: 900 }, "max"], [{ max: 480 }, "min"], [{ min: 500, max: 700 }, "max"],
	];
	for (const [e, bare] of cases) assert.deepEqual(entryRange(e, bare), Animator._entryRange(e, tiers, bare), JSON.stringify(e) + " " + bare);
	assert.equal(entryRange({ container: { min: 400 } }, "max"), null, "container entries do not depend on the viewport");
	assert.equal(entryRange({ media: "(hover: hover)" }, "max"), null);
});

test("declaredWidths lists both ends of every range, nested and in card items", () => {
	const elements = [
		{ type: "row", children: [{ type: "h3", text: "a", resprop: [{ breakpoint: [1157, 1188], fontSize: "400px" }] }] },
		{ type: "nav", breakpoint: "900px", items: [] },
		{ type: "cards", items: [[{ type: "p", text: "x", respad: [{ breakpoint: "1300px", padding: "2rem" }] }]] },
	];
	assert.deepEqual(declaredWidths(elements), [900, 1157, 1189, 1300]);
});

// A fake browser: one row whose need jumps by 500 px on [1157, 1188], declared
// by a resprop on one of its members; it fits everywhere else.
const SPEC = {
	elements: [{ type: "row", children: [
		{ type: "h3", text: "Settings", resprop: [{ breakpoint: [1157, 1188], fontSize: "400px" }] },
		{ type: "h4", text: "Map" },
	] }],
	nodes: [],
};
const fake = () => {
	let w = 0;
	return {
		renderAt: async (x) => { w = x; },
		page: { evaluate: async (_f, arg) => arg.groups.map((g) => ({ id: g.id, need: w >= 1157 && w <= 1188 ? w + 450 : 300, needNarrow: 200, have: w, narrow: false, vv: w, iw: w })) },
	};
};
const columns = (out) => out.synthesized.filter((n) => n.op.mode === "column").map((n) => n.range);

test("a declared band off every cell midpoint is found exactly", async () => {
	const b = fake();
	const out = await respond(b.page, SPEC, b.renderAt);
	assert.deepEqual(columns(out), [[1157, 1188]]);
});

test("declared: false restores the old behaviour, which misses it", async () => {
	const b = fake();
	const out = await respond(b.page, SPEC, b.renderAt, { declared: false });
	assert.deepEqual(columns(out), []);
});

// With a classic scrollbar innerWidth exceeds visualViewport.width (15 px
// here). resprop ranges are visualViewport widths, samples innerWidth ones, so
// a 2 px band declared at [1157, 1158] sits at innerWidth [1172, 1173]: the
// solver must sample there, not at 1156/1157.
test("a declared band is sampled in innerWidth units when a scrollbar takes width", async () => {
	let iw = 0;
	const BAR = 15;
	const page = { evaluate: async (_f, arg) => arg.groups.map((g) => {
		const vv = iw - BAR;
		return { id: g.id, need: vv >= 1157 && vv <= 1158 ? vv + 450 : 300, needNarrow: 200, have: vv, narrow: false, vv, iw };
	}) };
	const spec = { elements: [{ type: "row", children: [
		{ type: "h3", text: "a", resprop: [{ breakpoint: [1157, 1158], fontSize: "400px" }] },
		{ type: "h4", text: "b" },
	] }], nodes: [] };
	const out = await respond(page, spec, async (x) => { iw = x; });
	const cols = out.synthesized.filter((n) => n.op.mode === "column").map((n) => n.range);
	assert.deepEqual(cols, [[1157, 1158]], "the band, in the runtime's visualViewport units");
});

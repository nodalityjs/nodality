// respond-certify.test.mjs: respond() checks every sample cell instead of
// trusting the grid.
//
// Before 8 Nov 2026 the fit residual was only reported. A layout that stopped
// fitting and fitted again between two grid widths (768 and 1024 here) was
// invisible, because brackets need the two sides of a switch on different
// samples. Each cell is now measured at its midpoint and split while the fit
// is more than 1 px off a straight line.

import { test } from "node:test";
import assert from "node:assert/strict";

import { respond } from "../../lib/responsive.js";

// A fake browser: one row group whose content needs 700 px, except between
// 860 and 900 px, where it needs 50 px more than it has.
function fakeBrowser() {
	let width = 0;
	const needAt = (w) => (w >= 860 && w <= 900 ? w + 50 : 700);
	return {
		renderAt: async (w) => { width = w; },
		page: {
			evaluate: async (_fn, arg) => arg.groups.map((g) => ({
				id: g.id, need: needAt(width), have: width, needNarrow: 100,
				vv: width, iw: width,
			})),
		},
	};
}

const SPEC = {
	elements: [{ type: "row", children: [{ type: "h2", text: "a" }, { type: "h2", text: "b" }] }],
	nodes: [],
};

const columnRanges = (out) => out.synthesized
	.filter((n) => n.op && n.op.mode === "column")
	.map((n) => n.range);

test("a switch that happens and reverts inside one grid cell is found", async () => {
	const b = fakeBrowser();
	const out = await respond(b.page, SPEC, b.renderAt);
	const ranges = columnRanges(out);
	assert.ok(ranges.some(([lo, hi]) => lo <= 860 && hi >= 900 && hi < 1024),
		`expected a column range around 860–900, got ${JSON.stringify(ranges)}`);
	assert.ok(out.certification.renders > 0);
	assert.ok(out.certification.nonAffine.some(([a, c]) => a <= 860 && c >= 900));
});

test("certify: false keeps the old behaviour, which misses it", async () => {
	const b = fakeBrowser();
	const out = await respond(b.page, SPEC, b.renderAt, { certify: false });
	const ranges = columnRanges(out);
	assert.ok(!ranges.some(([lo, hi]) => lo >= 768 && hi <= 1024), JSON.stringify(ranges));
	assert.equal(out.certification, null);
});

test("an affine layout is certified without splitting, and its switch does not move", async () => {
	const affine = () => {
		let width = 0;
		return {
			renderAt: async (w) => { width = w; },
			page: { evaluate: async (_f, arg) => arg.groups.map((g) => ({ id: g.id, need: 0.5 * width + 300, have: width, needNarrow: 100, vv: width, iw: width })) },
		};
	};
	const a = affine();
	const on = await respond(a.page, SPEC, a.renderAt);
	const b = affine();
	const off = await respond(b.page, SPEC, b.renderAt, { certify: false });
	assert.deepEqual(on.synthesized, off.synthesized, "same nodes either way");
	assert.equal(on.certification.nonAffine.length, 0);
});

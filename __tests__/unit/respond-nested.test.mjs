// respond-nested.test.mjs: nested groups are solved outer group first, in one
// top-down pass.
//
// Before 27 Nov 2026 respond() re-solved every level until no interval changed
// (at most four passes). On a row nested in a row this cycled: the parent was
// solved against the child's previous state and the child against the
// parent's new one, so the pair jumped between "both stacked" and "both rows"
// and never reached "parent row, child stacked". In the study behind the
// responsive-breakpoints paper, 37 pages cycled like this and the result
// overflowed. Now the parent is measured with its descendants stacked, and a
// child may be a row only where it fits and every ancestor still fits.

import { test } from "node:test";
import assert from "node:assert/strict";

import { respond, PROBE } from "../../lib/responsive.js";

// A parent row holding a 400 px item and a nested row. The nested row needs
// 600 px as a row and 300 px stacked. Every switch lies inside the 320-1920 px
// range respond() samples. Inside a row parent the nested row's box
// grows to its content, so its own fit always says it fits: the trap.
const SPEC = {
	elements: [{
		type: "row", children: [
			{ type: "h2", text: "a" },
			{ type: "row", children: [{ type: "h2", text: "b" }, { type: "h2", text: "c" }] },
		],
	}],
	nodes: [],
};

// Arrangement of the element with `id` at viewport `w` in a lowered spec: a
// resprop entry whose range holds w decides it; rows default to "row".
function shown(elements, id, w) {
	let found = null;
	const walk = (list) => {
		for (const el of list || []) {
			if (!el || typeof el !== "object") continue;
			if (el.id === id) found = el;
			walk(el.children);
		}
	};
	walk(elements);
	const e = (found && found.resprop || []).find((r) => r.breakpoint[0] <= w && w <= r.breakpoint[1]);
	return e ? e.flexDirection : "row";
}

function fakeBrowser() {
	let w = 0;
	let spec = null;
	return {
		renderAt: async (width, s) => { w = width; spec = s; },
		page: {
			evaluate: async (fn, arg) => {
				assert.equal(fn, PROBE);
				const parentRow = shown(spec.elements, "nod-g0", w) === "row";
				const childRow = shown(spec.elements, "nod-g1", w) === "row";
				const childWidth = childRow ? 600 : 300;
				return arg.groups.map((g) => {
					if (g.id === "nod-g0") {
						return { id: g.id, need: 400 + childWidth, needNarrow: Math.max(400, childWidth), have: w, narrow: !parentRow, vv: w, iw: w };
					}
					const have = parentRow ? (childRow ? 600 : Math.max(300, w - 400)) : w;
					return { id: g.id, need: 600, needNarrow: 300, have, narrow: !childRow, vv: w, iw: w };
				});
			},
		},
	};
}

const columns = (out, id) => out.synthesized
	.filter((n) => n.target[0] === id && n.op.mode === "column")
	.map((n) => n.range);

test("the parent stays a row where it fits with its child stacked", async () => {
	const b = fakeBrowser();
	const out = await respond(b.page, SPEC, b.renderAt);
	assert.deepEqual(columns(out, "nod-g0"), [[0, 699]]);
});

test("the child stacks where its being a row would make the parent overflow", async () => {
	const b = fakeBrowser();
	const out = await respond(b.page, SPEC, b.renderAt);
	assert.deepEqual(columns(out, "nod-g1"), [[0, 599], [700, 999]]);
});

test("one pass, no iteration", async () => {
	const b = fakeBrowser();
	const out = await respond(b.page, SPEC, b.renderAt);
	assert.equal(out.passes, 1);
	assert.equal(out.converged, true);
	const child = out.report.find((r) => r.id === "nod-g1");
	assert.ok(child.samples.some((s) => typeof s.ancestors === "number" && s.ancestors > s.own),
		"the parent's overflow, not the child's own fit, decides some samples");
});

test("a page without nesting solves as before", async () => {
	let w = 0;
	const page = { evaluate: async (_f, arg) => arg.groups.map((g) => ({ id: g.id, need: 700, needNarrow: 100, have: w, narrow: false, vv: w, iw: w })) };
	const flat = { elements: [{ type: "row", children: [{ type: "h2", text: "a" }, { type: "h2", text: "b" }] }], nodes: [] };
	const out = await respond(page, flat, async (x) => { w = x; });
	assert.deepEqual(columns(out, "nod-g0"), [[0, 699]]);
	assert.ok(out.report[0].samples.every((s) => s.g === s.own && s.ancestors === undefined));
});

// Siblings inside a column (the outer row cannot be a row even with both
// members stacked: 200 + 1950 px). A column offers each member the same width
// whatever that member's arrangement, so a member's own fit decides it; an
// overflow of the column belongs to its widest member, not to the others.
test("a member of a column is not stacked because a sibling is too wide", async () => {
	const spec = {
		elements: [{
			type: "row", children: [
				{ type: "row", children: [{ type: "h2", text: "a" }, { type: "h2", text: "b" }] },
				{ type: "row", children: [{ type: "h2", text: "c" }, { type: "h2", text: "d" }] },
			],
		}],
		nodes: [],
	};
	let w = 0, s = null;
	const page = {
		evaluate: async (_f, arg) => {
			const row = (id) => shown(s.elements, id, w) === "row";
			const width = { "nod-g1": row("nod-g1") ? 400 : 200, "nod-g2": row("nod-g2") ? 2500 : 1950 };
			const outerRow = row("nod-g0");
			return arg.groups.map((g) => {
				if (g.id === "nod-g0") return { id: g.id, need: width["nod-g1"] + width["nod-g2"], needNarrow: Math.max(width["nod-g1"], width["nod-g2"]), have: w, narrow: !outerRow, vv: w, iw: w };
				const need = g.id === "nod-g1" ? 400 : 2500;
				const narrowNeed = g.id === "nod-g1" ? 200 : 1950;
				return { id: g.id, need, needNarrow: narrowNeed, have: outerRow ? width[g.id] : w, narrow: !row(g.id), vv: w, iw: w };
			});
		},
	};
	const out = await respond(page, spec, async (x, sp) => { w = x; s = sp; });
	assert.deepEqual(columns(out, "nod-g0"), [[0, 99999]], "the outer row never fits");
	assert.deepEqual(columns(out, "nod-g1"), [[0, 399]], "the small member is a row wherever it fits");
	assert.deepEqual(columns(out, "nod-g2"), [[0, 99999]], "the wide member is always stacked");
});

// Two nested rows side by side in one row. Each needs 500 px as a row and
// 250 px stacked; inside a row each grows to its content (the trap again).
// The earlier one takes the width first: the outer row is a row from 500 px
// (both stacked), the first child from 750 px (500 + 250), the second from
// 1000 px (500 + 500). Stacking both together until 1000 px would waste the
// first child's 750-999 px.
test("among siblings in one row, the earlier one takes the width first", async () => {
	const spec = {
		elements: [{
			type: "row", children: [
				{ type: "row", children: [{ type: "h2", text: "a" }, { type: "h2", text: "b" }] },
				{ type: "row", children: [{ type: "h2", text: "c" }, { type: "h2", text: "d" }] },
			],
		}],
		nodes: [],
	};
	let w = 0, s = null;
	const page = {
		evaluate: async (_f, arg) => {
			const row = (id) => shown(s.elements, id, w) === "row";
			const width = (id) => (row(id) ? 500 : 250);
			const outerRow = row("nod-g0");
			return arg.groups.map((g) => {
				if (g.id === "nod-g0") return { id: g.id, need: width("nod-g1") + width("nod-g2"), needNarrow: Math.max(width("nod-g1"), width("nod-g2")), have: w, narrow: !outerRow, vv: w, iw: w };
				return { id: g.id, need: 500, needNarrow: 250, have: outerRow ? width(g.id) : w, narrow: !row(g.id), vv: w, iw: w };
			});
		},
	};
	const out = await respond(page, spec, async (x, sp) => { w = x; s = sp; });
	assert.deepEqual(columns(out, "nod-g0"), [[0, 499]]);
	assert.deepEqual(columns(out, "nod-g1"), [[0, 749]]);
	assert.deepEqual(columns(out, "nod-g2"), [[0, 999]]);
});

// Three levels: an outer row (a 300 px item and a middle row), the middle row
// (a 200 px item and an inner row), the inner row (400 px as a row, 200 px
// stacked). Inside a row each nested row grows to its content. The outer row
// is a row from 500 px (300 + 200, both inner levels stacked); the middle row
// from 400 px while the outer is a column, and from 700 px while the outer is
// a row (300 + 200 + 200); the inner row only from 900 px (300 + 200 + 400).
// Between 500 and 699 px the inner row fits inside the stacked middle row, and
// only the outer row's overflow, two levels up, keeps it stacked.
test("three levels: every enclosing row counts, not only the parent", async () => {
	const spec = {
		elements: [{
			type: "row", children: [
				{ type: "h2", text: "a" },
				{ type: "row", children: [
					{ type: "h2", text: "b" },
					{ type: "row", children: [{ type: "h2", text: "c" }, { type: "h2", text: "d" }] },
				] },
			],
		}],
		nodes: [],
	};
	let w = 0, s = null;
	const page = {
		evaluate: async (_f, arg) => {
			const row = (id) => shown(s.elements, id, w) === "row";
			const cw = row("nod-g2") ? 400 : 200;
			const pw = row("nod-g1") ? 200 + cw : Math.max(200, cw);
			const gRow = row("nod-g0"), pRow = row("nod-g1");
			return arg.groups.map((g) => {
				if (g.id === "nod-g0") return { id: g.id, need: 300 + pw, needNarrow: Math.max(300, pw), have: w, narrow: !gRow, vv: w, iw: w };
				if (g.id === "nod-g1") return { id: g.id, need: 200 + cw, needNarrow: Math.max(200, cw), have: gRow ? pw : w, narrow: !pRow, vv: w, iw: w };
				return { id: g.id, need: 400, needNarrow: 200, have: pRow ? cw : (gRow ? pw : w), narrow: !row("nod-g2"), vv: w, iw: w };
			});
		},
	};
	const out = await respond(page, spec, async (x, sp) => { w = x; s = sp; });
	assert.deepEqual(columns(out, "nod-g0"), [[0, 499]]);
	assert.deepEqual(columns(out, "nod-g1"), [[0, 399], [500, 699]]);
	assert.deepEqual(columns(out, "nod-g2"), [[0, 899]]);
	assert.equal(out.passes, 1);
});

// Ablation switch for the responsive-breakpoints paper (R3-9): nested: false
// solves every group at once as if nothing were nested. On the first test's
// page the child then trusts its own fit, which inside a row always says it
// fits, so it never stacks and the parent overflows.
test("nested: false (ablation) falls into the trap the nested rule avoids", async () => {
	const b = fakeBrowser();
	const out = await respond(b.page, SPEC, b.renderAt, { nested: false });
	assert.deepEqual(columns(out, "nod-g1").filter(([lo]) => lo >= 700), [], "the child stays a row inside the row parent");
});

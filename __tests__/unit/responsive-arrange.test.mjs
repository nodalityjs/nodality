// responsive-arrange.test.mjs — breakpoints solved from content.
//
// The pure half of `nodality/responsive`: finding groups, solving where a
// group's wide arrangement stops fitting, emitting `arrange` nodes, and
// lowering them onto what the runtime applies. The browser half (PROBE,
// respond) is covered by the e2e spec responsive-arrange.spec.js.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import {
	findGroups, eligibleGroups, ensureIds, affineRoot, fitAffine, brackets, nextProbe,
	narrowIntervals, toRuntimeRange, synthesize, partition, navHull, lowerArrange, MAX_WIDTH,
} from "../../lib/responsive.js";
import { validateNodes } from "../../lib/validate-nodes.js";

const deepFreeze = (o) => {
	if (o && typeof o === "object" && !Object.isFrozen(o)) {
		Object.freeze(o);
		for (const v of Object.values(o)) deepFreeze(v);
	}
	return o;
};

const PAGE = () => [
	{ type: "nav", id: "top", items: [{ title: "A", link: "/a" }, { title: "B", link: "/b" }] },
	{ type: "row", id: "hero", children: [
		{ type: "h2", text: "One" },
		{ type: "row", children: [{ type: "a", text: "x", url: "/x" }, { type: "a", text: "y", url: "/y" }] },
	] },
	{ type: "cards", id: "grid", items: ["a", "b", "c"] },
	{ type: "row", id: "own", colat: "500px", children: [{ type: "p", text: "p" }, { type: "p", text: "q" }] },
	{ type: "row", id: "single", children: [{ type: "p", text: "p" }] },
];

/** Run the solver against an exact oracle for g, as respond() runs it against a page. */
function solve(g, widths = [320, 480, 768, 1024, 1280, 1600, 1920], cap = 40) {
	const s = widths.map((v) => ({ v, g: g(v), vv: v }));
	let probes = 0;
	for (;;) {
		const open = brackets(s).map(([lo, hi]) => nextProbe(lo, hi, probes)).filter((v) => v !== null);
		if (!open.length || probes >= cap) break;
		for (const v of open) { s.push({ v, g: g(v), vv: v }); probes++; }
	}
	return { intervals: narrowIntervals(s), probes };
}

test("findGroups lists rows, cards and navs in document order with depth and parent", () => {
	const g = findGroups(PAGE());
	assert.deepEqual(g.map((x) => [x.kind, x.id, x.depth, x.parent]), [
		["nav", "top", 0, null],
		["row", "hero", 0, null],
		["row", null, 1, "hero"],
		["cards", "grid", 0, null],
		["row", "own", 0, null],
		["row", "single", 0, null],
	]);
	assert.equal(g.find((x) => x.id === "own").authored, true, "a row with its own colat is authored");
	assert.deepEqual(eligibleGroups(PAGE()).map((x) => x.id), ["top", "hero", null, "grid"],
		"authored groups and groups of one are not acted on");
});

test("ensureIds names id-less groups deterministically and never writes the input", () => {
	const page = deepFreeze(PAGE());
	const a = ensureIds(page);
	const b = ensureIds(page);
	assert.deepEqual(a, b, "same page, same ids");
	assert.equal(a[1].children[1].id, "nod-g2", "the nested row is the third group");
	assert.equal(a[0], page[0], "an untouched element is shared, not copied");
	const clash = ensureIds([{ type: "row", id: "nod-g1", children: [] }, { type: "row", children: [] }]);
	assert.notEqual(clash[1].id, "nod-g1", "a generated id never collides with a declared one");
});

test("affine sizes: two samples give the threshold exactly", () => {
	// need(v) = 300 + 0.25 v, have(v) = v - 16  =>  g = 316 - 0.75 v, root 421.33…
	const g = (v) => 316 - 0.75 * v;
	assert.ok(Math.abs(affineRoot({ v: 320, g: g(320) }, { v: 1920, g: g(1920) }) - 316 / 0.75) < 1e-9);
	const fit = fitAffine([320, 800, 1600].map((v) => ({ v, y: 300 + 0.25 * v })));
	assert.ok(Math.abs(fit.slope - 0.25) < 1e-12 && fit.residual < 1e-9);
	const { intervals, probes } = solve(g);
	assert.deepEqual(intervals, [[0, 421]], "narrow up to 421 px, wide from 422");
	assert.ok(probes <= 3, `an affine root is pinned to the pixel in at most 3 probes, took ${probes}`);
});

test("the slope condition: content that outgrows its container inverts the breakpoint", () => {
	// A capped container (have stops at 1200) with fluid type (need keeps
	// growing): the row fits only between ~1023 and ~1666 px.
	const g = (v) => (700 + 0.3 * v) - Math.min(v - 16, 1200);
	const { intervals } = solve(g);
	assert.equal(intervals.length, 2, "narrow at both ends");
	assert.deepEqual(intervals, [[0, 1022], [1667, MAX_WIDTH]]);
	assert.equal(intervals[0][0], 0);
	assert.equal(intervals[1][1], MAX_WIDTH);
	for (const [lo, hi] of intervals) {
		for (const v of [lo, hi]) if (v > 0 && v < MAX_WIDTH) assert.ok(g(v) > 0, `${v} does not fit`);
	}
	assert.ok(g(intervals[0][1] + 1) <= 0 && g(intervals[1][0] - 1) <= 0, "and the widths just outside do");
});

test("narrowIntervals emits nothing where nothing changes", () => {
	assert.deepEqual(solve(() => -10).intervals, [], "always fits: no breakpoint at all");
	assert.deepEqual(solve(() => 10).intervals, [[0, MAX_WIDTH]], "never fits: narrow everywhere");
});

test("toRuntimeRange maps through visualViewport width, outward", () => {
	const samples = [{ v: 700, vv: 685 }, { v: 701, vv: 686 }];
	assert.deepEqual(toRuntimeRange([0, 700], samples, "visualViewport"), [0, 685]);
	assert.deepEqual(toRuntimeRange([0, 700], samples, "innerWidth"), [0, 700]);
});

test("synthesize: one node per interval of each group's partition, in document order", () => {
	const groups = eligibleGroups(ensureIds(PAGE()));
	const solved = new Map([["top", [[0, 811]]], ["hero", [[0, 640], [1500, MAX_WIDTH]]], ["grid", []]]);
	assert.deepEqual(synthesize(groups, solved), [
		{ op: { name: "arrange", mode: "collapse" }, target: ["top"], range: [0, 811] },
		{ op: { name: "arrange", mode: "expand" }, target: ["top"], range: [812, MAX_WIDTH] },
		{ op: { name: "arrange", mode: "column" }, target: ["hero"], range: [0, 640] },
		{ op: { name: "arrange", mode: "row" }, target: ["hero"], range: [641, 1499] },
		{ op: { name: "arrange", mode: "column" }, target: ["hero"], range: [1500, MAX_WIDTH] },
		{ op: { name: "arrange", mode: "row" }, target: ["grid"], range: [0, MAX_WIDTH] },
	]);
});

test("partition covers every width exactly once", () => {
	for (const narrow of [[], [[0, MAX_WIDTH]], [[0, 10]], [[5, 9]], [[0, 3], [7, 7], [20, MAX_WIDTH]]]) {
		const parts = partition(narrow);
		assert.equal(parts[0].range[0], 0);
		assert.equal(parts[parts.length - 1].range[1], MAX_WIDTH);
		for (let i = 1; i < parts.length; i++) {
			assert.equal(parts[i].range[0], parts[i - 1].range[1] + 1, "contiguous, no overlap");
			assert.notEqual(parts[i].narrow, parts[i - 1].narrow, "neighbours differ: one switch per boundary");
		}
	}
});

test("a group that always fits is lowered to its wide arrangement, not the library default", () => {
	const nodes = [
		{ op: { name: "arrange", mode: "expand" }, target: ["top"], range: [0, MAX_WIDTH] },
		{ op: { name: "arrange", mode: "row" }, target: ["grid"], range: [0, MAX_WIDTH] },
	];
	const { elements, skipped } = lowerArrange(PAGE(), nodes);
	assert.equal(elements[0].breakpoint, "0px", "never collapses, instead of collapsing below 1200px");
	assert.equal(elements[2].colat, false, "the 700px switch is off");
	assert.deepEqual(elements[2].resprop, [{ breakpoint: [0, MAX_WIDTH], flexDirection: "row" }]);
	assert.deepEqual(skipped, []);
	const bad = lowerArrange(PAGE(), [
		{ op: { name: "arrange", mode: "expand" }, target: ["top"], range: [0, 500] },
		{ op: { name: "arrange", mode: "collapse" }, target: ["top"], range: [501, MAX_WIDTH] },
	]);
	assert.equal(bad.elements[0].breakpoint, undefined, "a nav cannot collapse only at wide widths");
	assert.equal(bad.skipped.length, 2);
});

test("lowerArrange writes resprop, breakpoint and colat:false onto copies", () => {
	const page = deepFreeze(PAGE());
	const nodes = deepFreeze([
		{ op: { name: "arrange", mode: "collapse" }, target: ["top"], range: [0, 811] },
		{ op: { name: "arrange", mode: "column" }, target: ["#hero"], range: [0, 640] },
		{ op: { name: "arrange", mode: "column" }, target: ["grid"], range: [0, 667] },
		{ op: { name: "arrange", mode: "column" }, target: ["hero"], range: [600, 900] },
		{ op: { name: "shadow" }, target: ["hero"] },
	]);
	const { elements, applied, skipped } = lowerArrange(page, nodes);
	assert.equal(elements[0].breakpoint, "812px", "desktop bar from the first fitting width");
	assert.deepEqual(elements[1].resprop, [{ breakpoint: [0, 640], flexDirection: "column" }]);
	assert.equal(elements[2].colat, false, "the built-in 700px switch is turned off");
	assert.deepEqual(elements[2].resprop, [{ breakpoint: [0, 667], flexDirection: "column", alignItems: "center" }]);
	assert.equal(elements[3], page[3], "an element no node targets is shared");
	assert.deepEqual(applied.map((a) => a.node), [0, 1, 2]);
	assert.deepEqual(skipped.map((s) => s.node), [3], "the later overlapping node loses: first declared wins");
	assert.equal(page[1].resprop, undefined, "the caller's element was not written");
});

test("lowering is independent of the order of disjoint nodes", () => {
	const a = { op: { name: "arrange", mode: "column" }, target: ["hero"], range: [0, 640] };
	const b = { op: { name: "arrange", mode: "column" }, target: ["grid"], range: [0, 667] };
	const c = { op: { name: "arrange", mode: "column" }, target: ["hero"], range: [1500, MAX_WIDTH] };
	const one = lowerArrange(PAGE(), [a, b, c]).elements;
	for (const order of [[c, b, a], [b, a, c], [c, a, b]]) {
		assert.deepEqual(lowerArrange(PAGE(), order).elements, one);
	}
});

test("validate_nodes knows arrange and checks its mode, range and target", () => {
	const E = PAGE();
	assert.equal(validateNodes([{ op: { name: "arrange", mode: "column" }, target: ["hero"], range: [0, 640] }], E).ok, true);
	const bad = validateNodes([
		{ op: { name: "arrange", mode: "stack" }, target: ["hero"], range: [0, 640] },
		{ op: { name: "arrange", mode: "column" }, target: ["hero"], range: [900, 100] },
		{ op: { name: "arrange", mode: "column" }, range: [0, 640] },
	], E);
	const codes = bad.errors.map((e) => `${e.code}@${e.path}`);
	assert.ok(codes.includes("BAD_FIELD@nodes[0].op.mode"), codes.join(" "));
	assert.ok(codes.includes("BAD_FIELD@nodes[1].range"), codes.join(" "));
	assert.ok(codes.includes("MISSING_FIELD@nodes[2].target"), codes.join(" "));
	assert.ok(!codes.some((c) => c.startsWith("UNKNOWN_DESIGN_OP")), "arrange is a known design op");
});

let Des, dom;
before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	dom.window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	({ Des } = await import("../../lib/designer.js"));
});

const at = async (width, elements, nodes) => {
	Object.defineProperty(dom.window, "innerWidth", { value: width, configurable: true });
	document.getElementById("mount").innerHTML = "";
	new Des().nodes(nodes).add(elements).set({ mount: "#mount", code: false, elements: false });
	await new Promise((r) => setTimeout(r, 10));
	return document.getElementById("hero");
};

test("Des applies an arrange node at the widths in its range and nowhere else", async () => {
	const E = [{ type: "row", id: "hero", children: [{ type: "p", text: "a" }, { type: "p", text: "b" }] }];
	const N = [{ op: { name: "arrange", mode: "column" }, target: ["hero"], range: [0, 640] }];
	assert.equal((await at(600, E, N)).style.flexDirection, "column");
	assert.notEqual((await at(641, E, N)).style.flexDirection, "column");
	assert.notEqual((await at(1440, E, N)).style.flexDirection, "column");
	assert.equal(E[0].resprop, undefined, "the page's own spec is not written by rendering it");
});

test("a page without arrange nodes renders exactly as before", async () => {
	const E = [{ type: "row", id: "hero", children: [{ type: "p", text: "a" }, { type: "p", text: "b" }] }];
	const plain = (await at(1000, E, [])).outerHTML;
	const withOther = (await at(1000, E, [{ op: { name: "shadow" }, target: ["nobody"] }])).outerHTML;
	assert.equal(plain, withOther);
});

test("a bracket left open by the probe cap goes to the narrow side", () => {
	// fits at 480, not at 768, never refined: the gap (480, 768) is narrow
	const s = [{ v: 320, g: -5 }, { v: 480, g: -1 }, { v: 768, g: 4 }, { v: 1024, g: 9 }];
	assert.deepEqual(narrowIntervals(s), [[481, MAX_WIDTH]]);
	const t = [{ v: 320, g: 5 }, { v: 480, g: 1 }, { v: 768, g: -4 }];
	assert.deepEqual(narrowIntervals(t), [[0, 767]]);
	const done = [{ v: 548, g: 1 }, { v: 549, g: 0.2 }, { v: 550, g: -0.3 }];
	assert.deepEqual(narrowIntervals(done), [[0, 549]], "a closed bracket is unchanged");
});

test("a nav that cannot collapse only above zero is widened to collapse from zero", () => {
	assert.deepEqual(navHull([[0, 500]]), [[0, 500]]);
	assert.deepEqual(navHull([]), []);
	assert.deepEqual(navHull([[1500, MAX_WIDTH]]), [[0, MAX_WIDTH]]);
	assert.deepEqual(navHull([[0, 400], [900, 1100]]), [[0, 1100]]);
	const nodes = synthesize([{ id: "top", kind: "nav" }], new Map([["top", [[0, 400], [900, 1100]]]]));
	assert.deepEqual(nodes.map((n) => [n.op.mode, n.range]), [["collapse", [0, 1100]], ["expand", [1101, MAX_WIDTH]]]);
	assert.equal(lowerArrange(PAGE(), nodes).elements[0].breakpoint, "1101px");
});

test("a group whose id is written with # is found under its bare id", () => {
	const groups = findGroups([{ type: "row", id: "#hero", children: [{ type: "p", text: "a" }, { type: "p", text: "b" }] }]);
	assert.equal(groups[0].id, "hero");
});

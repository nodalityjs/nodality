// op-semantics.test.mjs: the declared combine rules match the renderer, and
// the validator reports nodes that can never apply.
//
// lib/op-semantics.js was written by reading the renderer, so these tests
// pin each rule to the lookup that implements it. If the renderer changes,
// the declaration must change with it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { OP_SEMANTICS, shadowedNodes } from "../../lib/op-semantics.js";
import { validateNodes, describeOps, DESIGN_OP_NAMES } from "../../lib/validate-nodes.js";
import { RASTER_OP_NAMES } from "../../lib/raster-ops.js";

test("every op the validator accepts has a declared combine rule", () => {
	for (const name of [...DESIGN_OP_NAMES, ...RASTER_OP_NAMES, "morph", "agent-surface"]) {
		const sem = OP_SEMANTICS[name];
		assert.ok(sem, `no declaration for "${name}"`);
		assert.ok(["first", "sequence", "inert"].includes(sem.combine), `${name}: ${sem.combine}`);
		assert.ok(["element", "range", "page"].includes(sem.scope), `${name}: ${sem.scope}`);
	}
	assert.equal(describeOps().semantics, OP_SEMANTICS, "agents read the same table");
});

test("first-per-element ops: ElementMapper.filtero returns the first node that reaches the element", async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>");
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.requestAnimationFrame = () => 0;
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	}
	const { ElementMapper } = await import("../../lib/element-mapper.js");

	const firstPerElement = Object.entries(OP_SEMANTICS)
		.filter(([, s]) => s.combine === "first" && s.scope === "element")
		.map(([n]) => n);
	assert.ok(firstPerElement.length >= 9);
	for (const name of firstPerElement) {
		const a = { op: { name }, target: ["hero"] };
		const b = { op: { name }, target: ["hero"] };
		assert.equal(ElementMapper.filtero(name, "hero", [a, b]), a, `${name}: first targeted node wins`);
		const all = { op: { name } };
		assert.equal(ElementMapper.filtero(name, "hero", [all, a]), all, `${name}: an earlier untargeted node wins`);
		assert.equal(ElementMapper.filtero(name, "other", [a, all]), all, `${name}: a node for another element does not reach this one`);
	}
});

test("a later node on the same element is reported as doing nothing", () => {
	const E = [{ id: "hero", type: "h1", text: "Hi" }, { id: "sub", type: "p", text: "x" }];
	const N = [
		{ op: { name: "shadow" }, target: ["hero"] },
		{ op: { name: "shadow" }, target: ["sub"] },
		{ op: { name: "shadow" }, target: ["hero"] },
	];
	const r = validateNodes(N, E);
	assert.equal(r.ok, true, "still renders");
	const w = r.warnings.filter((x) => x.code === "SHADOWED_NODE");
	assert.equal(w.length, 1);
	assert.equal(w[0].path, "nodes[2]");
	assert.deepEqual(w[0].got, ["hero"]);
	assert.match(w[0].detail, /does nothing/);
});

test("an untargeted node shadows later targeted ones; a later untargeted one loses only where an earlier node wins", () => {
	const f1 = shadowedNodes([{ op: { name: "blast" } }, { op: { name: "blast" }, target: ["a"] }]);
	assert.equal(f1.length, 1);
	assert.equal(f1[0].index, 1);
	assert.equal(f1[0].whole, true);

	const f2 = shadowedNodes([{ op: { name: "blast" }, target: ["a"] }, { op: { name: "blast" } }]);
	assert.equal(f2.length, 1);
	assert.equal(f2[0].index, 1);
	assert.equal(f2[0].whole, false, "it still applies to every other element");
	assert.deepEqual(f2[0].lost, ["a"]);
});

test("different ops on one element, raster chains and disjoint arrange ranges are not reported", () => {
	assert.deepEqual(shadowedNodes([
		{ op: { name: "shadow" }, target: ["a"] },
		{ op: { name: "gradient" }, target: ["a"] },
		{ op: "dither", target: ["a"] },
		{ op: "dither", target: ["a"] },
		{ op: { name: "arrange", mode: "column" }, target: ["a"], range: [0, 424] },
		{ op: { name: "arrange", mode: "row" }, target: ["a"], range: [425, 99999] },
	]), []);
});

test("overlapping arrange ranges, the shared layout slot and a second agent surface are reported", () => {
	const f = shadowedNodes([
		{ op: { name: "arrange", mode: "column" }, target: ["a"], range: [0, 600] },
		{ op: { name: "arrange", mode: "row" }, target: ["a"], range: [500, 99999] },
		{ op: { name: "layout", value: "img-leftof-text" } },
		{ op: { name: "slayout", value: "x" } },
		{ op: "agent-surface", name: "one" },
		{ op: "agent-surface", name: "two" },
	]);
	assert.deepEqual(f.map((x) => x.index), [1, 3, 5]);
});

test("an op no renderer reads is reported as inert", () => {
	const f = shadowedNodes([{ op: { name: "navStyle" }, target: ["nav"] }]);
	assert.equal(f.length, 1);
	assert.equal(f[0].code, "INERT_OP");
});

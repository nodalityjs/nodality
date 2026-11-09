// conformance-sweep.test.mjs: if the validator accepts a page, it renders.
//
// Architecture scan 8 Nov 2026, P1: pages that passed validateNodes threw at
// render time. This renders every element type alone and with every design
// and raster op targeting it, and fails on any page the validator accepted
// that then throws. (1,200 pages, about two seconds.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="mount"></div></body></html>`);
for (const k of ["window", "document", "HTMLElement", "customElements", "Node", "Element", "getComputedStyle"]) {
	try { if (dom.window[k] !== undefined && !(k in globalThis)) globalThis[k] = dom.window[k]; } catch { /* getter-only */ }
}
dom.window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
dom.window.Element.prototype.animate ||= function () {
	return { finished: Promise.resolve(), cancel() {}, play() {}, pause() {}, reverse() {}, finish() {}, addEventListener() {}, removeEventListener() {}, onfinish: null };
};
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { Des } = await import("../../lib/designer.js");
const { ELEMENT_TYPES } = await import("../../lib/element-mapper.js");
const { validateNodes, DESIGN_OP_NAMES } = await import("../../lib/validate-nodes.js");
const { RASTER_OP_NAMES } = await import("../../lib/raster-ops.js");

test("every page the validator accepts renders without throwing", () => {
	const warn = console.warn;
	console.warn = () => {};
	try {
		const render = (E, N) => {
			dom.window.document.querySelector("#mount").innerHTML = "";
			const d = new Des().nodes(N).add(E).set({ mount: "#mount", code: false, elements: false });
			try { d.destroy(); } catch { /* teardown is not under test here */ }
		};
		const ops = [...DESIGN_OP_NAMES.map((n) => ({ op: { name: n } })), ...RASTER_OP_NAMES.map((n) => ({ op: n }))];
		let accepted = 0;
		const crashes = [];
		for (const type of ELEMENT_TYPES) {
			const E = [{ id: "x", type }];
			for (const node of [null, ...ops]) {
				const N = node ? [{ ...node, target: ["x"] }] : [];
				if (!validateNodes(N, E).ok) continue;
				accepted++;
				try { render(E, N); }
				catch (e) { crashes.push(`${type} + ${node ? (node.op.name || node.op) : "(no node)"}: ${e.message}`); }
			}
		}
		assert.ok(accepted > 1000, `only ${accepted} pages were accepted; the sweep lost its coverage`);
		assert.deepEqual(crashes, []);
	} finally {
		console.warn = warn;
	}
});

test("types the renderer cannot build without a field are rejected up front", () => {
	for (const [type, field] of [["video", "url"], ["audio", "url"], ["multiswitcher", "breakpoints"], ["simple", "react"]]) {
		const r = validateNodes([], [{ id: "x", type }]);
		assert.equal(r.ok, false, type);
		assert.ok(r.errors.some((e) => e.code === "MISSING_FIELD" && e.path.endsWith(`.${field}`)), `${type}: ${JSON.stringify(r.errors)}`);
	}
});

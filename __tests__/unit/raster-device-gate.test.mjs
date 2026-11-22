// raster-device-gate.test.mjs — `pointer:` gating, its registration, and the
// corrected scroll-driver / halftone / mask docs.
//
// `pointer` is a FRAMEWORK param (read off every node, like `by`), so it is
// registered once in FRAMEWORK_DOC: that is what makes describeOps() list it
// and validateNodes() accept it on any op, while an unknown param still
// warns. The pixel-level behaviour (no attach on a coarse pointer, the <img>
// left untouched) is covered in __tests__/e2e/raster-image.spec.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
	FRAMEWORK_DOC, DRIVER_DOCS, REGISTRY, resolvePointerGates, POINTER_GATE_NAMES,
} from "../../lib/raster-ops.js";
import { validateNodes, describeOps } from "../../lib/validate-nodes.js";

const ELS = [{ type: "img", id: "photo", src: "a.jpg" }];

// switchTest() reads window.matchMedia; stand one up per test.
function withPointer(fine, fn) {
	const had = Object.prototype.hasOwnProperty.call(globalThis, "window");
	const prev = globalThis.window;
	globalThis.window = {
		matchMedia: (q) => ({
			matches: q === "(pointer: fine)" ? fine : q === "(pointer: coarse)" ? !fine : false,
		}),
	};
	try { return fn(); } finally {
		if (had) globalThis.window = prev; else delete globalThis.window;
	}
}

test("pointer is a registered framework param with a summary", () => {
	assert.ok(FRAMEWORK_DOC.pointer, "FRAMEWORK_DOC.pointer missing");
	assert.equal(FRAMEWORK_DOC.pointer.unit, "name");
	assert.match(FRAMEWORK_DOC.pointer.summary, /pointer: fine/);
	assert.deepEqual(POINTER_GATE_NAMES, ["fine", "coarse", "none"]);
});

test("describeOps lists pointer among the shared params", () => {
	const shared = describeOps().shared.map((s) => s.name);
	assert.ok(shared.includes("pointer"), shared.join(", "));
});

test("validateNodes accepts pointer on any raster op; unknown params still warn", () => {
	const ok = validateNodes([{ op: "halftone", target: ["photo"], pointer: "fine" }], ELS);
	assert.equal(ok.errors.filter((e) => e.code === "UNKNOWN_PARAM").length, 0,
		JSON.stringify(ok.errors));
	const bad = validateNodes([{ op: "halftone", target: ["photo"], pointr: "fine" }], ELS);
	const unk = bad.errors.filter((e) => e.code === "UNKNOWN_PARAM");
	assert.equal(unk.length, 1);
	assert.ok(unk[0].suggestions.includes("pointer"), JSON.stringify(unk[0]));
});

test("a fine-only node is dropped on a coarse device and kept on a fine one", () => {
	const chain = [{ op: "halftone" }, { op: "offset", by: "mouse", pointer: "fine" }];
	const coarse = withPointer(false, () => resolvePointerGates(chain, 0));
	assert.deepEqual(coarse.map((n) => n.op), ["halftone"]);
	const fine = withPointer(true, () => resolvePointerGates(chain, 0));
	assert.equal(fine, chain, "nothing dropped -> the same array, node identity intact");
});

test("gates reach inside merge branches and switch arms", () => {
	const chain = [{
		op: "merge", mode: "over",
		a: [{ op: "halftone", pointer: "fine" }],
		b: [{ op: "duotone" }],
	}, {
		op: "switch", when: "(min-width: 1px)",
		use: [{ op: "dither", pointer: "coarse" }],
	}];
	const out = withPointer(true, () => resolvePointerGates(chain, 0));
	assert.deepEqual(out[0].a.map((n) => n.op), ["halftone"]);
	assert.deepEqual(out[1].use, []);
	assert.equal(chain[1].use.length, 1, "the caller's tree is not mutated");
});

test("an unknown gate fails closed; any and absent are open", () => {
	const out = withPointer(true, () => resolvePointerGates([
		{ op: "halftone", pointer: "mouse" },
		{ op: "dither", pointer: "any" },
		{ op: "duotone" },
	], 0));
	assert.deepEqual(out.map((n) => n.op), ["dither", "duotone"]);
});

test("no matchMedia (prerender) means a gated node is dropped, not guessed", () => {
	const had = Object.prototype.hasOwnProperty.call(globalThis, "window");
	const prev = globalThis.window;
	if (had) delete globalThis.window;
	try {
		assert.deepEqual(resolvePointerGates([{ op: "halftone", pointer: "fine" }], 0), []);
	} finally { if (had) globalThis.window = prev; }
});

// ── task 1: the scroll driver was documented as something it is not ──

test("the scroll driver doc says point, not band, and names the band recipe", () => {
	const d = DRIVER_DOCS.scroll;
	assert.doesNotMatch(d, /^A band that travels up the element/);
	assert.match(d, /point/);
	assert.match(d, /top edge to its bottom edge/);
	assert.match(d, /from: "band"/);
});

test("halftone says the whole element is screened whatever by: says", () => {
	assert.match(REGISTRY.halftone.doc.summary, /WHOLE element is screened/);
	assert.match(REGISTRY.halftone.doc.summary, /masked:/);
});

test("mask documents and compiles from: \"band\"", () => {
	assert.match(REGISTRY.mask.doc.params.from.summary, /"band"/);
	const glsl = REGISTRY.mask.code("u0_", { op: "mask", from: "band", as: "band" });
	assert.match(glsl, /abs\(frag\.y - \(u0_dpos\)\.y\)/);
	const at = REGISTRY.mask.code("u0_", { op: "mask", from: "band", at: [0.5, 0.25] });
	assert.match(at, /abs\(frag\.y - \(\(u0_at \* u_res\)\)\.y\)/);
});

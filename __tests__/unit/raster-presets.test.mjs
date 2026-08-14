// raster-presets.test.mjs — phase H1 of HOUDINI-IMPL-SPEC.
//
// Presets are data, so almost everything worth asserting is checkable
// without a GPU: that every name resolves, that every op and driver a
// preset mentions actually exists, that a caller cannot corrupt the
// registry, and — the one with teeth — that COMPOSING two presets does not
// let their fields collide.
//
// That last one is the whole reason compose() exists. Fields are global to
// a chain: two presets that both write `as: "mask"` would have the second
// silently overwrite the first, and the pipeline would not complain,
// because the shader declares every referenced field at 1.0 and an
// unmatched reference simply renders unmasked. A silent no-op is the exact
// bug class this library refuses, so it is a test rather than a caveat.
//
// Shader compilation is the e2e suite's job (raster-ops.spec's
// "chain builds without a shader error" pattern) — there is no GL here.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
	PRESETS, presetNames, presetInfo, preset, compose, validateChain,
} from "../../lib/raster-presets.js";
import { RASTER_OP_NAMES, DRIVER_NAMES } from "../../lib/raster-ops.js";

// ── the registry is honest about the op vocabulary ────────────────────

test("every preset names only real ops, drivers and fields", () => {
	assert.ok(presetNames().length >= 10, "the gallery needs a gallery's worth");

	for (const name of presetNames()) {
		const report = validateChain(preset(name));
		assert.deepEqual(report.errors, [], `preset "${name}" is invalid`);
		assert.equal(report.ok, true);

		// Documentation is part of the contract — the gallery renders it.
		const info = presetInfo(name);
		assert.ok(info.summary && info.summary.length > 10, `${name} needs a summary`);
		if (info.live !== undefined) {
			assert.ok(["enhanced", "required"].includes(info.live),
				`${name}: live must be "enhanced" or "required", got ${info.live}`);
		}
	}
});

test("the flow op from H2 is registered and used by a preset", () => {
	assert.ok(RASTER_OP_NAMES.includes("flow"), "flow must be a first-party op");
	const chain = preset("flow-field");
	assert.equal(chain[0].op, "flow");
	assert.deepEqual(validateChain(chain).errors, []);

	// `by:` is optional on flow — without it the current fills the element,
	// with it the current is local to the focus. Both must validate.
	assert.deepEqual(validateChain(preset("flow-pointer")).errors, []);
	assert.equal(preset("flow-pointer")[0].by, "mouse");
	assert.equal(preset("flow-field")[0].by, undefined);
});

// ── a caller cannot corrupt the registry ─────────────────────────────

test("preset() returns a fresh deep clone every time", () => {
	const a = preset("spotlight");
	const b = preset("spotlight");
	assert.notEqual(a, b);
	assert.notEqual(a[0], b[0]);
	assert.deepEqual(a, b);

	// The pipeline WRITES to node objects (solver state, the discovered
	// texElementImage2D form), so a shared object would leak between two
	// elements using the same preset.
	a[0].radius = 9999;
	a[0].as = "clobbered";
	assert.equal(preset("spotlight")[0].radius, 200);
	assert.equal(preset("spotlight")[0].as, "spot");
	assert.equal(PRESETS.spotlight.nodes[0].radius, 200);
});

test("overrides apply to every node, and only to the copy", () => {
	const chain = preset("print-shop", { by: "hover" });
	assert.ok(chain.length >= 2);
	for (const node of chain) assert.equal(node.by, "hover");
	assert.equal(preset("print-shop")[0].by, undefined);
});

test("an unknown preset throws with a did-you-mean", () => {
	assert.throws(() => preset("liqud-hero"), /Did you mean "liquid-hero"/);
	assert.throws(() => presetInfo("glas"), /Did you mean "glass"/);
	assert.throws(() => preset("nonsense"), /Unknown raster preset "nonsense"/);
	// And it lists the vocabulary rather than leaving the caller guessing.
	assert.throws(() => preset("nonsense"), /Valid raster presets:/);
});

// ── composition: the Houdini property ────────────────────────────────

test("compose concatenates in order and preserves every node", () => {
	const chain = compose("ripple", "newsprint");
	assert.deepEqual(chain.map((n) => n.op), ["offset", "dither"]);
	assert.deepEqual(validateChain(chain).errors, []);
});

test("compose renames private fields so two presets cannot collide", () => {
	// Both of these produce a field AND consume it. Concatenated naively,
	// the names would be independent here only by luck; make them collide
	// on purpose to prove the mechanism, using the same preset twice.
	const chain = compose("spotlight", "spotlight");
	const produced = chain.filter((n) => n.as).map((n) => n.as);
	assert.equal(new Set(produced).size, produced.length,
		`two copies of one preset must not share a field name: ${produced}`);

	// And each consumer still reads its OWN producer, not the other's.
	const pairs = [];
	for (let i = 0; i < chain.length; i += 2) pairs.push([chain[i].as, chain[i + 1].masked]);
	for (const [as, masked] of pairs) assert.equal(masked, as);
	assert.deepEqual(validateChain(chain).errors, []);

	// Two DIFFERENT field-producing presets, the realistic case.
	const mixed = compose("spotlight", "turbulent");
	const fields = mixed.filter((n) => n.as).map((n) => n.as);
	assert.equal(new Set(fields).size, 2);
	assert.ok(fields.every((f) => /^c\d+_/.test(f)), `namespaced: ${fields}`);
	assert.deepEqual(validateChain(mixed).errors, []);
});

test("compose leaves a field it does not produce alone, so cross-wiring works", () => {
	// Deliberate wiring: one part produces `shared`, a later part reads it.
	// That reference must survive, or composing could never share a field.
	const chain = compose(
		[{ op: "mask", from: "radial", as: "shared", radius: 120 }],
		[{ op: "halftone", masked: "shared" }],
	);
	assert.equal(chain[0].as, "shared", "a lone producer keeps its name");
	assert.equal(chain[1].masked, "shared", "the consumer still points at it");
	assert.deepEqual(validateChain(chain).errors, []);
});

test("compose accepts names, [name, overrides] and raw nodes together", () => {
	const chain = compose(
		"ripple",
		["newsprint", { ink: "#123456" }],
		[{ op: "edges", color: "#FFFFFF" }],
	);
	assert.deepEqual(chain.map((n) => n.op), ["offset", "dither", "edges"]);
	assert.equal(chain[1].ink, "#123456");
	assert.deepEqual(validateChain(chain).errors, []);
});

// ── validateChain earns its keep ─────────────────────────────────────

test("validateChain catches what the pipeline would silently tolerate", () => {
	// A dangling field reference renders UNMASKED in the pipeline — no
	// error, no warning, just the wrong picture.
	const dangling = validateChain([{ op: "duotone", masked: "nope" }]);
	assert.equal(dangling.ok, false);
	assert.match(dangling.errors[0], /names a field nothing in this chain produces/);

	// Unknown op and unknown driver, each with a suggestion.
	assert.match(validateChain([{ op: "hexalise" }]).errors[0], /Did you mean "hexalize"/);
	assert.match(validateChain([{ op: "offset", by: "mouze" }]).errors[0], /Did you mean "mouse"/);

	// Shape errors.
	assert.equal(validateChain("not an array").ok, false);
	assert.match(validateChain([{ noOp: true }]).errors[0], /needs a string `op`/);

	// A consumer BEFORE its producer is fine: fields resolve in the field
	// stage, which runs before warp/cell/displace/colour regardless of
	// array order. This must not be reported as an error.
	const reordered = validateChain([
		{ op: "duotone", masked: "m" },
		{ op: "mask", from: "radial", as: "m" },
	]);
	assert.deepEqual(reordered.errors, []);

	// `masked: true` is the default field, named "mask".
	assert.deepEqual(validateChain([
		{ op: "mask", from: "radial" }, { op: "halftone", masked: true },
	]).errors, []);
});

test("every registry preset composes with every other without error", () => {
	// The combinatorial claim the gallery rests on: any two presets can be
	// stacked. 13 × 13 pairs, checked as data — no GPU needed.
	const names = presetNames();
	for (const a of names) {
		for (const b of names) {
			const report = validateChain(compose(a, b));
			assert.deepEqual(report.errors, [], `compose("${a}", "${b}") -> ${report.errors[0]}`);
		}
	}
});

// ── H3: the structural / live split ──────────────────────────────────
//
// Which params are compiled into the shader and which are uniforms is not
// a matter of taste — it is determined by whether the op reads them in
// code() or uniforms(). Getting it wrong is invisible: a structural param
// written as a uniform silently does nothing at all.

test("isStructuralChange classifies params the way the ops actually read them", async () => {
	const { isStructuralChange } = await import("../../lib/raster-ops.js");
	const cases = [
		// [op, key, next, prev, structural?]
		["hexalize", "lift", 0.3, 0, true],    // 0 compiles the cheap path
		["hexalize", "lift", 0.5, 0.3, false], // both non-zero: same shader
		["hexalize", "size", 30, 26, false],
		["dither", "mono", true, false, true], // selects a shader body
		["dither", "levels", 4, 6, false],
		["copy", "count", 6, 5, true],         // unrolls the stamp loop
		["copy", "scale", 0.6, 0.5, false],
		["flow", "by", "mouse", undefined, true],
		["flow", "strength", 30, 18, false],
		["stir", "strength", 20, 16, false],   // 16 live params, no structural
		["offset", "strength", 30, 22, false],
		// Universally structural: they change the emitted code or backend.
		["halftone", "masked", "m", undefined, true],
		["halftone", "op", "dither", "halftone", true],
		["hexalize", "live", false, true, true],
		// Unknown key: pessimistic. An unnecessary rebuild costs a frame;
		// a missed structural param renders the wrong thing forever.
		["offset", "notAParam", 1, 2, true],
		["notAnOp", "anything", 1, 2, true],
	];
	for (const [op, key, next, prev, want] of cases) {
		assert.equal(isStructuralChange(op, key, next, prev), want,
			`${op}.${key}: ${JSON.stringify(prev)} -> ${JSON.stringify(next)} should be ` +
			(want ? "structural" : "live"));
	}
});

test("the second live-required preset needs live capture to show anything", () => {
	// `echo` accumulates the texture into a persistent buffer. On snapshot
	// the texture is one frozen frame, so the accumulation converges to it
	// and nothing moves — which is why this is badged, not "fixed".
	const info = presetInfo("comet");
	assert.equal(info.live, "required");
	assert.equal(preset("comet")[0].op, "echo");
	assert.deepEqual(validateChain(preset("comet")).errors, []);

	// Two of them now, and every live-required preset must be echo-based —
	// that is the only op whose contract genuinely needs per-frame capture.
	const required = presetNames().filter((n) => presetInfo(n).live === "required");
	assert.deepEqual(required, ["echoes", "comet"]);
	for (const n of required) {
		assert.ok(preset(n).some((node) => node.op === "echo"),
			`${n} is badged live-required but nothing in it needs live capture`);
	}
});

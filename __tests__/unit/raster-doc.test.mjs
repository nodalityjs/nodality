// raster-doc.test.mjs — phase H4 of HOUDINI-IMPL-SPEC.
//
// `registerRasterOp` was two lines that assigned and returned. Every way
// of getting an op wrong therefore succeeded, and the failure arrived
// later as a shader that would not compile — with no indication of which
// op wrote the bad line — or, worse, as an op that compiled and did
// nothing, because a misspelt `stage` matched no stage and its code was
// never emitted. That is the silently-ignored-key class one level up:
// not a bad option on a node, but a bad op in the registry.
//
// The other half is `doc`. The inspector used to derive an op's params by
// calling `def.uniforms(node, 1)` and taking the keys — but that is the
// UNIFORM list, not the param list, and the two differ whenever an op
// transforms its input. `duotone` takes `colors: [dark, light]` and
// uploads two uniforms `a` and `b`, so the panel offered an "a" and a "b"
// box and typing in either wrote a key duotone never reads.
//
// So the docs are checked three ways against the source, because a
// parameter reference that drifts from the code is worse than none: it
// is believed.
//
//   A. every `node.X` an op reads is documented by that op
//   B. every name in `structural`/`structuralOnToggle` is documented
//   C. every documented param is read SOMEWHERE (no phantom entries)
//
// Rule C spans the whole file rather than the op entry, because `merge`
// is real but its `a`/`b`/`mode` are read by the compiler — flattenRaster
// and the BLEND lookup — never inside merge's own decl/code/uniforms.
// Rule B is what makes them mandatory anyway.
//
// Runs in bare Node with no DOM, which doubles as a check that the phase
// P1 import-inert property survived: importing raster-ops.js to read the
// registry must not touch `document`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
	REGISTRY, RASTER_STAGES, RASTER_UNITS, FRAMEWORK_DOC,
	registerRasterOp, validateRasterOp,
} from "../../lib/raster-ops.js";

const SRC_PATH = fileURLToPath(new URL("../../lib/raster-ops.js", import.meta.url));
const SRC = readFileSync(SRC_PATH, "utf8");

/** The source of each REGISTRY entry, keyed by op name. */
function opSources() {
	const start = SRC.indexOf("const REGISTRY = {");
	const lines = SRC.slice(start, SRC.indexOf("\n};", start)).split("\n");
	const starts = [];
	lines.forEach((l, i) => {
		const m = /^ {4}([A-Za-z_][A-Za-z0-9_]*): \{\s*$/.exec(l);
		if (m) starts.push({ name: m[1], line: i });
	});
	const out = {};
	starts.forEach((s, i) => {
		const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
		out[s.name] = lines.slice(s.line, end).join("\n");
	});
	return out;
}

const reads = (src) =>
	new Set([...src.matchAll(/node\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));

const FRAMEWORK = new Set(Object.keys(FRAMEWORK_DOC));

// ── 1. registration is checked ───────────────────────────────────────

const OK = { stage: "color", decl: () => "", code: () => "" };

test("a misspelt stage throws and names the nearest real one", () => {
	// The failure this replaces: the op registered, compiled to nothing,
	// and rendered exactly as if it were absent.
	assert.throws(() => validateRasterOp("x", { ...OK, stage: "colour" }), (err) => {
		assert.match(err.message, /Unknown stage "colour"/);
		assert.match(err.message, /Did you mean "color"/);
		assert.match(err.message, /Valid stages:/);
		return true;
	});
	assert.throws(() => validateRasterOp("x", { ...OK, stage: "warpp" }), /Did you mean "warp"/);
	assert.throws(() => validateRasterOp("x", { ...OK, stage: undefined }), /missing "stage"/);
	// An array of stages is legal — `stir` is ["warp", "color"] — but every
	// member is checked.
	assert.ok(validateRasterOp("x", { ...OK, stage: ["warp", "color"] }));
	assert.throws(() => validateRasterOp("x", { ...OK, stage: ["warp", "nope"] }),
		/Unknown stage "nope"/);
});

test("the GLSL-producing functions are required, and uniforms is optional", () => {
	assert.throws(() => validateRasterOp("x", { stage: "color", code: () => "" }),
		/"decl" must be a function \(got nothing\)/);
	assert.throws(() => validateRasterOp("x", { stage: "color", decl: () => "" }),
		/"code" must be a function/);
	assert.throws(() => validateRasterOp("x", { ...OK, uniforms: {} }),
		/"uniforms" must be a function/);
	// `copy` has no uniforms of its own — it unrolls at compile time.
	assert.ok(validateRasterOp("x", OK));
});

test("rebuild hints and drivers are checked against their vocabularies", () => {
	// A string here rather than an array makes isStructuralChange throw
	// mid-drag, so the shape is enforced even though the names are not.
	assert.throws(() => validateRasterOp("x", { ...OK, structural: "size" }),
		/"structural" must be an array/);
	assert.throws(() => validateRasterOp("x", { ...OK, structuralOnToggle: [1] }),
		/"structuralOnToggle" must be an array/);
	assert.throws(() => validateRasterOp("x", { ...OK, defaultDriver: "moose" }), (err) => {
		assert.match(err.message, /Unknown driver "moose"/);
		assert.match(err.message, /Did you mean "mouse"/);
		return true;
	});
});

test("a doc that is supplied must be the shape every reader assumes", () => {
	// Optional — a third-party op stays registerable without one — but a
	// malformed doc would throw inside the inspector while rendering
	// somebody else's op, which is the worst place to find out.
	assert.ok(validateRasterOp("x", OK), "no doc at all is fine");
	assert.throws(() => validateRasterOp("x", { ...OK, doc: { params: {} } }),
		/"doc.summary" must be a non-empty string/);
	assert.throws(() => validateRasterOp("x", { ...OK, doc: { summary: "s", params: [] } }),
		/"doc.params" must be an object/);
	assert.throws(() =>
		validateRasterOp("x", { ...OK, doc: { summary: "s", params: { a: 3 } } }),
	/doc.params.a must be an object/);
	// A near miss gets the suggestion.
	assert.throws(() =>
		validateRasterOp("x", { ...OK, doc: { summary: "s", params: { a: { unit: "ratios" } } } }),
	/Did you mean "ratio"/);
	// A far one does not — "pixels" is four edits from "px", past the
	// two-edit threshold — but it still gets the vocabulary, which is the
	// part that actually unblocks the caller.
	assert.throws(() =>
		validateRasterOp("x", { ...OK, doc: { summary: "s", params: { a: { unit: "pixels" } } } }),
	(err) => {
		assert.match(err.message, /Unknown unit "pixels"/);
		assert.match(err.message, /Valid units: px, ratio/);
		assert.ok(!/Did you mean/.test(err.message),
			`nothing is within two edits of "pixels", so none should be offered: ${err.message}`);
		return true;
	});
});

test("registerRasterOp warns rather than throws when it replaces an op", () => {
	// Overriding a built-in is a legitimate reason this surface exists.
	// Doing it by accident, because two libraries picked the same word,
	// is not — and there is no way to tell which from here.
	const said = [];
	const orig = console.warn;
	console.warn = (m) => said.push(String(m));
	try {
		registerRasterOp("hexalize", { ...REGISTRY.hexalize });
	} finally {
		console.warn = orig;
	}
	assert.equal(said.length, 1);
	assert.match(said[0], /replaces an existing op/);
	// And it is still the real op afterwards, not a husk.
	assert.equal(typeof REGISTRY.hexalize.code, "function");
});

// ── 2. every first-party op documents itself ─────────────────────────

test("every first-party op has a doc, and passes its own validator", () => {
	const names = Object.keys(REGISTRY);
	assert.ok(names.length >= 15, `expected the full registry, got ${names.length}`);
	for (const name of names) {
		const def = REGISTRY[name];
		assert.doesNotThrow(() => validateRasterOp(name, def), `${name} fails validation`);
		assert.ok(def.doc, `op "${name}" has no doc`);
		assert.ok(def.doc.summary && def.doc.summary.length > 20,
			`op "${name}" needs a summary that says something`);
		assert.ok(def.doc.params && Object.keys(def.doc.params).length > 0,
			`op "${name}" documents no params`);
	}
});

test("every documented unit is from the closed vocabulary", () => {
	for (const [name, def] of Object.entries(REGISTRY)) {
		for (const [k, meta] of Object.entries(def.doc.params)) {
			if (meta.unit == null) continue;
			assert.ok(RASTER_UNITS.includes(meta.unit),
				`${name}.${k} has unit "${meta.unit}", not in ${RASTER_UNITS.join(", ")}`);
		}
	}
});

// ── 3. the docs match the code, three ways ───────────────────────────

test("A: every param an op reads is documented by that op", () => {
	const sources = opSources();
	const gaps = [];
	for (const [name, src] of Object.entries(sources)) {
		const documented = new Set(Object.keys(REGISTRY[name].doc.params));
		for (const key of reads(src)) {
			// Framework params — `by`, `masked`, `target`, `live` — are read
			// off every node whatever the op. They are defined once in
			// FRAMEWORK_DOC rather than in fifteen docs that would drift.
			if (documented.has(key) || FRAMEWORK.has(key)) continue;
			gaps.push(`${name}.${key}`);
		}
	}
	assert.deepEqual(gaps, [], `read but undocumented: ${gaps.join(", ")}`);
});

test("B: every param named structural is documented", () => {
	const gaps = [];
	for (const [name, def] of Object.entries(REGISTRY)) {
		const documented = new Set(Object.keys(def.doc.params));
		for (const key of [...(def.structural || []), ...(def.structuralOnToggle || [])]) {
			if (documented.has(key) || FRAMEWORK.has(key)) continue;
			gaps.push(`${name}.${key}`);
		}
	}
	assert.deepEqual(gaps, [], `structural but undocumented: ${gaps.join(", ")}`);
});

test("C: no op documents a param that nothing reads", () => {
	// The whole file, not the op entry: `merge`'s a/b/mode are read by
	// flattenRaster and the BLEND lookup, never inside merge itself.
	const everything = reads(SRC);
	const phantoms = [];
	for (const [name, def] of Object.entries(REGISTRY)) {
		for (const [key, meta] of Object.entries(def.doc.params)) {
			// A param that names another reader is checked against THAT
			// source instead. `copy` is two implementations behind one op
			// name — a shader, and the DOM builder an element of type
			// "copy" takes — and only the shader half lives in this file,
			// so a key the mapper reads would read as a phantom here.
			// The check is relocated, not dropped:
			// copy-op-declares-what-it-reads.test.mjs asserts the named
			// source really does read it.
			if (meta.readBy) continue;
			if (!everything.has(key)) phantoms.push(`${name}.${key}`);
		}
	}
	assert.deepEqual(phantoms, [], `documented but never read: ${phantoms.join(", ")}`);
});

test("the structural FLAG in a doc agrees with the op's own hints", () => {
	// Two places say "changing this rebuilds" — the hint the pipeline
	// obeys, and the doc the inspector shows. They must not disagree, or
	// a control is labelled live and then recompiles under the user.
	for (const [name, def] of Object.entries(REGISTRY)) {
		const hinted = new Set([...(def.structural || []), ...(def.structuralOnToggle || [])]);
		for (const [k, meta] of Object.entries(def.doc.params)) {
			if (!meta.structural) continue;
			assert.ok(hinted.has(k),
				`${name}.${k} is documented structural but is not in structural/structuralOnToggle`);
		}
	}
});

// ── 4. the shared vocabulary ─────────────────────────────────────────

test("stages are derived from STAGE_VARS, so the two cannot drift", () => {
	// Every stage an op declares must be a stage the compiler splices.
	for (const [name, def] of Object.entries(REGISTRY)) {
		for (const s of Array.isArray(def.stage) ? def.stage : [def.stage]) {
			assert.ok(RASTER_STAGES.includes(s), `${name} declares unknown stage "${s}"`);
		}
	}
	// `field` is the one stage with no stage vars of its own: a field op
	// writes a scalar for later ops rather than modifying the frame.
	assert.ok(RASTER_STAGES.includes("field"));
	for (const s of ["warp", "cell", "displace", "color"]) {
		assert.ok(RASTER_STAGES.includes(s), `missing stage ${s}`);
	}
});

test("framework params are documented once, not per op", () => {
	for (const k of ["by", "masked", "target", "live"]) {
		assert.ok(FRAMEWORK_DOC[k], `framework param "${k}" is undocumented`);
		assert.ok(FRAMEWORK_DOC[k].summary, `framework param "${k}" has no summary`);
	}
	// And no op repeats them, which is how fifteen copies would drift.
	for (const [name, def] of Object.entries(REGISTRY)) {
		for (const k of Object.keys(FRAMEWORK_DOC)) {
			assert.ok(!(k in def.doc.params),
				`${name} re-documents the framework param "${k}"`);
		}
	}
});

// ── 5. the worked example is a real op ───────────────────────────────

test("the documented example op registers and satisfies the contract", async () => {
	// examples/custom-raster-op.js is what the API docs tell a reader to
	// copy. If it drifts from the contract, the docs teach the drift.
	await import("../../examples/custom-raster-op.js");
	const def = REGISTRY.pixelate;
	assert.ok(def, "the example did not register");
	assert.doesNotThrow(() => validateRasterOp("pixelate", def));
	assert.equal(def.stage, "warp");
	assert.ok(def.doc.summary);
	assert.deepEqual(Object.keys(def.doc.params), ["size", "amount", "radius"]);
	// It must hold rule A too — the example is the template, so a gap
	// here is a gap every op written from it inherits.
	const src = readFileSync(
		fileURLToPath(new URL("../../examples/custom-raster-op.js", import.meta.url)), "utf8");
	const documented = new Set(Object.keys(def.doc.params));
	for (const key of reads(src)) {
		assert.ok(documented.has(key) || FRAMEWORK.has(key),
			`the example reads node.${key} without documenting it`);
	}
});

// ── phase I2: the coordinate declarations must match the code ────────

test("map / movesCoords agree with what each op's GLSL actually writes", () => {
	// Two more declarations that buy a system guarantee (a hit-test that
	// skips the GPU), so two more chances for the declaration to drift
	// from the shader. Same rule as doc.params: check it, don't trust it.
	const sources = opSources();
	const COORD = new Set(["warp", "cell", "displace"]);
	const problems = [];

	for (const [name, src] of Object.entries(sources)) {
		const def = REGISTRY[name];
		const stages = Array.isArray(def.stage) ? def.stage : [def.stage];
		if (!stages.some((s) => COORD.has(s))) continue;

		// Does its GLSL assign to the sampling coordinate?
		const writesCoord = /\bwarped\s*[-+*/]?=[^=]/.test(src)
			|| /\bsampleP\s*[-+*/]?=[^=]/.test(src);

		if (def.movesCoords === false && writesCoord) {
			problems.push(`${name} declares movesCoords:false but assigns to warped/sampleP`);
		}
		// An op that moves coordinates and offers no twin is legitimate —
		// `flow` and `stir` are exactly that — but it must not ALSO claim
		// to be coordinate-neutral, or hit-testing would skip it.
		if (writesCoord && def.movesCoords === false) {
			problems.push(`${name} would be skipped by the CPU path despite moving coordinates`);
		}
		// And an op that never touches them should not pretend it does.
		if (!writesCoord && def.movesCoords === undefined && typeof def.map !== "function") {
			// Fine: it blocks the CPU path conservatively. Flag it only so
			// the list of such ops stays visible in review.
			problems.push(`${name}: coordinate-stage op with neither map nor movesCoords ` +
				"— hit-tests fall back to readback (declare movesCoords:false if it is neutral)");
		}
	}
	assert.deepEqual(problems, [], problems.join("\n  "));
});

test("every declared map is callable and returns a point or null", () => {
	for (const [name, def] of Object.entries(REGISTRY)) {
		if (typeof def.map !== "function") continue;
		const ctx = { res: [800, 600], dpr: 2, dpos: [400, 300], damt: 1, time: 0, mouse: [0, 0] };
		const out = def.map([123, 45], { op: name }, ctx);
		assert.ok(out === null || (Array.isArray(out) && out.length === 2
			&& Number.isFinite(out[0]) && Number.isFinite(out[1])),
		`${name}.map returned ${JSON.stringify(out)} — expected [x, y] or null`);
	}
});

// ── phase I4: the interaction taxonomy ───────────────────────────────

test("every op classifies, and the classes match their declarations", async () => {
	const { interactionClass } = await import("../../lib/raster-ops.js");
	const VALID = ["neutral", "analytic", "conditional", "readback", "many-to-one"];
	const byClass = {};
	for (const op of Object.keys(REGISTRY)) {
		const c = interactionClass(op);
		assert.ok(VALID.includes(c), `${op} classified as "${c}"`);
		(byClass[c] ||= []).push(op);
	}

	// The classification is DERIVED, so these assertions are about the
	// declarations, not about a maintained list.
	//   analytic    => has a map that always answers
	//   conditional => has a map that can decline
	//   readback    => moves coordinates, no map
	//   neutral     => does not move the sampling coordinate
	for (const op of byClass.analytic || []) {
		assert.equal(typeof REGISTRY[op].map, "function", `${op} is analytic without a map`);
	}
	for (const op of byClass.conditional || []) {
		assert.equal(typeof REGISTRY[op].map, "function");
	}
	for (const op of byClass.readback || []) {
		assert.notEqual(typeof REGISTRY[op].map, "function",
			`${op} is classed readback but declares a map`);
	}
	for (const op of byClass["many-to-one"] || []) {
		assert.equal(REGISTRY[op].multiSample, true);
	}

	// An unknown op is not silently "neutral" — that would report a
	// third-party op as safe to skip on the CPU path.
	assert.equal(interactionClass("definitely-not-an-op"), "unknown");

	// Every class that the docs describe is actually populated, so the
	// taxonomy is a description of this registry rather than an aspiration.
	for (const c of ["neutral", "analytic", "conditional", "readback", "many-to-one"]) {
		assert.ok((byClass[c] || []).length > 0, `no op falls in class "${c}"`);
	}
});

test("hexalize is conditional for the reason claimed", async () => {
	const { interactionClass } = await import("../../lib/raster-ops.js");
	assert.equal(interactionClass("hexalize"), "conditional");
	const ctx = { res: [800, 600], dpr: 1, dpos: [400, 300], damt: 1, time: 0, mouse: [0, 0] };
	// The cheap path never writes `warped`, so the coordinate is unchanged.
	assert.deepEqual(REGISTRY.hexalize.map([10, 20], { op: "hexalize" }, ctx), [10, 20]);
	// With lift it declines rather than approximating the seven-neighbour
	// probe — declining routes the query to the exact GPU readback.
	assert.equal(REGISTRY.hexalize.map([10, 20], { op: "hexalize", lift: 0.3 }, ctx), null);
});

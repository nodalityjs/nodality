// param-values-and-scope.test.mjs
//
// Two checks the validator did not make, both of which let a wrong page pass:
//
//   VALUES. It checked names and never values, so `{width: 7}`, `{mar: 7}`
//   and `{columns: "four"}` were all reported as fine and all rendered
//   nothing. A CSS length written as a bare number is dropped by the CSSOM
//   without a word — the silent no-op this validator exists to remove, one
//   level below the names it already checked.
//
//   SCOPE. It checked names against the union of every parameter any type
//   reads, so a name that is real *somewhere* passed everywhere. `keySet` on
//   a `table` is the case that cost an afternoon: a known name, a type that
//   never reads it, and a grid placement that simply did not happen.
//
// Severity is deliberate. A violation is an error only where the value is
// provably inert; everything else is a warning, because several components
// accept looser input than they document and an error would stop `preview`
// rendering a page that works.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let validateNodes;
before(async () => { ({ validateNodes } = await import("../../lib/validate-nodes.js")); });

const find = (list, code, path) => list.find((e) => e.code === code && (!path || e.path === path));

// ── values ───────────────────────────────────────────────────────────

test("a CSS length written as a bare number is an error, with the fix", () => {
	const r = validateNodes([], [{ type: "p", id: "a", text: "x", width: 7 }]);
	assert.equal(r.ok, false);
	const err = find(r.errors, "BAD_PARAM_VALUE", "elements[0].width");
	assert.ok(err, "a width of 7 renders at the default width and says nothing");
	assert.match(err.valid[0], /CSS length/);
	assert.deepEqual(err.suggestions, ['"7px"'], "the repair is the value the author meant");
});

test("a value outside a declared enum is an error naming the alternatives", () => {
	const r = validateNodes([], [{ type: "video", id: "v", url: "/a.mp4", objectFit: "cover-ish" }]);
	assert.equal(r.ok, false);
	const err = find(r.errors, "BAD_PARAM_VALUE", "elements[0].objectFit");
	assert.match(err.valid[0], /"cover"/);
	assert.ok(err.suggestions.includes('"cover"'));
});

test("a looser mistake is a warning, so the page still validates", () => {
	// `mar: 7` is wrong — the shape is [{a: 7}] — but components vary in what
	// they tolerate, so this must not stop a page from rendering.
	const r = validateNodes([], [{ type: "wrap", id: "w", children: [], mar: 7 }]);
	assert.equal(r.ok, true, "warnings must not change ok");
	const warning = find(r.warnings, "BAD_PARAM_VALUE", "elements[0].mar");
	assert.ok(warning);
	assert.match(warning.valid[0], /side objects/);
	assert.deepEqual(warning.suggestions, ["[{ a: 7 }]"]);
});

test("correct values produce nothing at all", () => {
	const r = validateNodes([], [
		{ type: "p", id: "a", text: "x", width: "100%", mar: [{ a: 40 }], size: "S3" },
		{ type: "video", id: "v", url: "/a.mp4", autoplay: true, objectFit: "cover", opacity: 0.4 },
		{ type: "gridOverlay", id: "g", columns: 4, rows: 2, inset: 16, marks: "square" },
	]);
	assert.equal(r.ok, true);
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.warnings, []);
});

test("a parameter with no declared shape is not guessed at", () => {
	// Shapes come from `//@ name {unit}:` annotations. Where the source has
	// not declared one, silence is the honest answer.
	const r = validateNodes([], [{ type: "p", id: "a", text: "x", clampc: 12345 }]);
	assert.deepEqual(r.warnings.filter((w) => w.path === "elements[0].clampc"), []);
});

// ── scope ────────────────────────────────────────────────────────────

test("a real name on a type that ignores it is a warning, not silence", () => {
	const r = validateNodes([], [{
		type: "table", id: "t",
		items: [["date", "race"], ["29/08", "Krusnoman"]],
		keySet: [{ key: "gridColumn", value: "3 / span 2" }],
	}]);
	assert.equal(r.ok, true, "the table still renders; it just ignores the key");
	const warning = find(r.warnings, "PARAM_NOT_ON_TYPE", "elements[0].keySet");
	assert.ok(warning, "keySet on a table did nothing and was reported nowhere");
	assert.match(warning.detail, /does not read "keySet"/);
	assert.match(warning.valid[0], /npx nodality schema table/);
});

test("a name the type does read is not warned about", () => {
	const r = validateNodes([], [{ type: "wrap", id: "w", children: [], keySet: [{ key: "display", value: "grid" }] }]);
	assert.deepEqual(r.warnings.filter((w) => w.code === "PARAM_NOT_ON_TYPE"), []);
});

test("the report always carries a warnings array", () => {
	// Callers destructure it; an absent array would be a second shape to
	// handle for the commonest case, which is no warnings at all.
	const clean = validateNodes([], [{ type: "p", id: "a", text: "x" }]);
	assert.ok(Array.isArray(clean.warnings));
	const broken = validateNodes("not an array", []);
	assert.ok(Array.isArray(broken.warnings), "including on the early return");
});

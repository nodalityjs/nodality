// raster-needs.test.mjs — an op that draws nothing on its own is reported.
//
// `edges` colours the cell borders a cell-stage op (hexalize) writes. Alone,
// or after the cell op on a DIFFERENT target, it validated clean and drew
// nothing. The op now declares `needs: "cell"`, the validator warns
// (INERT_RASTER_OP), and describeOps() carries the declaration, plus what each
// driver shows at rest — the facts an agent needed on the suitcase site and
// found only in shader comments.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNodes, describeOps } from "../../lib/validate-nodes.js";

const ELS = [{ type: "wrap", id: "a", children: [] }, { type: "wrap", id: "b", children: [] }];
const inert = (nodes) => validateNodes(nodes, ELS).warnings.filter((w) => w.code === "INERT_RASTER_OP");

test("edges alone is reported, naming the ops that would feed it", () => {
	const w = inert([{ op: "edges", target: ["a"] }]);
	assert.equal(w.length, 1);
	assert.equal(w[0].path, "nodes[0].op");
	assert.ok(w[0].suggestions.includes("hexalize"));
	assert.match(w[0].detail, /draws nothing/);
});

test("edges after hexalize on the same target is fine, in either id form", () => {
	assert.equal(inert([{ op: "hexalize", target: ["a"], lift: 0.3 }, { op: "edges", target: ["#a"] }]).length, 0);
});

test("the producer must come first, and on the same target", () => {
	assert.equal(inert([{ op: "edges", target: ["a"] }, { op: "hexalize", target: ["a"] }]).length, 1, "order matters");
	assert.equal(inert([{ op: "hexalize", target: ["b"] }, { op: "edges", target: ["a"] }]).length, 1, "another element's cells do not count");
});

test("it is a warning, not an error: the page still renders", () => {
	const r = validateNodes([{ op: "edges", target: ["a"] }], ELS);
	assert.equal(r.ok, true);
});

test("describeOps carries needs, the resting behaviour of lift, and driver docs", () => {
	const d = describeOps();
	const edges = d.ops.find((o) => o.op === "edges");
	assert.equal(edges.needs, "cell");
	assert.equal(d.ops.find((o) => o.op === "hexalize").needs, undefined);
	assert.match(d.ops.find((o) => o.op === "hexalize").summary, /pixel-identical at rest/);
	assert.deepEqual(d.drivers, d.driverDocs.map((x) => x.name), "names stay a plain list");
	const hover = d.driverDocs.find((x) => x.name === "hover");
	assert.match(hover.summary, /nothing shows at rest/);
	for (const x of d.driverDocs) assert.ok(x.summary.length > 10, `${x.name} needs a summary`);
});

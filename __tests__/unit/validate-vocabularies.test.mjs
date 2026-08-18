// validate-vocabularies.test.mjs — the vocabularies the validator could not
// see until 1.2.3.
//
// Each case here was a SILENT no-op or an uncaught throw: the report said
// ok, and the page then did nothing, or crashed at render. They are the
// same defect the validator exists to remove, sitting in its own blind
// spots — a preset name it never checked, an element array it never read,
// and a parameter it refused to judge because the op beside it was wrong.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNodes, describeOps } from "../../lib/validate-nodes.js";

const E = [{ id: "a", type: "h1", text: "A" }, { id: "b", type: "wrap" }];
const codes = (r) => r.errors.map((e) => e.code);

test("list_ops advertises the transition presets a morph may name", () => {
  // Without this an agent had to guess `effect` from an example in the tool
  // description; the enum was never published.
  const v = describeOps();
  assert.ok(Array.isArray(v.presets) && v.presets.length > 0);
  const names = v.presets.map((p) => p.name);
  for (const expected of ["t-vhs", "t-split", "t-bloom"]) {
    assert.ok(names.includes(expected), `${expected} missing from ${names.join(", ")}`);
  }
  for (const p of v.presets) assert.equal(typeof p.summary, "string");
});

test("list_ops advertises the element vocabulary too", () => {
  const v = describeOps();
  assert.ok(v.elementTypes.includes("wrap") && v.elementTypes.includes("h1"));
});

test("an effect naming no preset is caught, not silently ignored", () => {
  // `chainFor` swallows the failed lookup and returns an empty chain, so the
  // transition ran with no effect at all and reported nothing.
  const r = validateNodes([{ op: "morph", from: "a", to: { Go: "b" }, effect: "t-vhss" }], E);
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "UNKNOWN_EFFECT");
  assert.ok(err, JSON.stringify(r.errors));
  assert.ok(err.suggestions.includes("t-vhs"));
  assert.ok(err.valid.length > 3, "the valid presets should be listed for repair");
});

test("a real preset, and an inline node array, both validate", () => {
  assert.equal(validateNodes([{ op: "morph", from: "a", to: { Go: "b" }, effect: "t-vhs" }], E).ok, true);
  assert.equal(validateNodes([{ op: "morph", from: "a", to: { Go: "b" },
    effect: [{ op: "dither", levels: 6 }] }], E).ok, true);
});

test("an element type that names nothing is reported rather than thrown", () => {
  // The mapper throws on an unknown type, so this reached a generator as a
  // stack trace instead of a repairable report.
  const r = validateNodes([{ op: "dither", target: ["a"] }], [{ id: "a", type: "h11", text: "A" }]);
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "UNKNOWN_ELEMENT_TYPE");
  assert.ok(err, JSON.stringify(r.errors));
  assert.equal(err.path, "elements[0].type");
  assert.ok(err.suggestions.includes("h1"));
});

test("E is walked into children, not only at the top level", () => {
  const r = validateNodes([], [{ id: "w", type: "wrap",
    children: [{ id: "k", type: "buton", text: "Go" }] }]);
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "UNKNOWN_ELEMENT_TYPE");
  assert.equal(err.path, "elements[0].children[0].type");
  assert.ok(err.suggestions.includes("button"));
});

test("an element with no type at all is reported", () => {
  const r = validateNodes([], [{ id: "x", text: "no type" }]);
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes("MISSING_FIELD"));
});

test("without E, element checking is skipped rather than guessed", () => {
  assert.equal(validateNodes([{ op: "dither", target: ["anything"] }]).ok, true);
});

test("a near-miss op reports its parameters too, in ONE turn", () => {
  // Parameter checking used to stop dead at an unknown op, so a node wrong
  // in both ways took two round-trips: the op error hid the parameter error
  // until it was fixed.
  const r = validateNodes([{ op: "dithr", target: ["a"], levles: 6 }], E);
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes("UNKNOWN_OP"));

  const param = r.errors.find((e) => e.code === "UNKNOWN_PARAM");
  assert.ok(param, `expected a parameter error too, got ${JSON.stringify(codes(r))}`);
  assert.ok(param.suggestions.includes("levels"));
  assert.equal(param.assuming, "dither",
    "a provisional finding must say which op it assumed");
});

test("an op with no near miss reports only the op — nothing is invented", () => {
  const r = validateNodes([{ op: "zzzzzzzz", target: ["a"], levles: 6 }], E);
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ["UNKNOWN_OP"]);
});

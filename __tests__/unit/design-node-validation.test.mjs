// design-node-validation.test.mjs — the family the validator skipped.
//
// Until 1.2.7 `validateNodes` handled design nodes with one line:
//
//     if (family === "design") return;   // design nodes carry their own vocabulary
//
// True, and it left the whole family unchecked. The cost was paid in the
// project's own documentation: the README's install example and the docs
// landing page both wrote a gradient's colours as a top-level `colors:`
// key. Nothing reads that key, so the gradient string stayed undefined —
// and the gradient path still applied `-webkit-text-fill-color:
// transparent`, painting the element out with nothing behind it. The
// example rendered its own headline INVISIBLE, through several releases,
// with a clean validation report and no console output.
//
// Two defects, fixed together and tested together here: the validator now
// reads design nodes, and the gradient now fails closed.
//
// The allowlists these tests pin were assembled by reading every
// `customOptions[i].x` in designer.js and then sweeping the e2e fixtures
// and every local Nodality project. That sweep is what caught `style` and
// `duration`, which ARE read and would otherwise have become false
// positives on working pages — and `preview` refuses to render a pair the
// validator rejects, so a false positive is not a cosmetic problem.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNodes } from "../../lib/validate-nodes.js";

const E = [{ id: "hero", type: "h1", text: "A" }];
const codes = (r) => r.errors.map((e) => e.code);
const at = (r, code) => r.errors.find((e) => e.code === code);

// ── the defect that shipped ──────────────────────────────────────────

test("a design option written at the top level is reported, not ignored", () => {
  // Verbatim the README's install example before 1.2.6.
  const r = validateNodes(
    [{ op: { name: "gradient" }, target: ["hero"], colors: ["#1d6fe0", "#7fd1ff"] }], E);
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes("UNKNOWN_PARAM"));

  // The useful part is WHERE it should have gone. Design options live
  // inside `op`, so a bare vocabulary list would leave the reader to
  // work that out; the suggestion says it.
  const err = at(r, "UNKNOWN_PARAM");
  assert.equal(err.path, "nodes[0].colors");
  assert.deepEqual(err.suggestions, ["op.colors"]);
});

test("a gradient with nothing to paint is reported", () => {
  const r = validateNodes([{ op: { name: "gradient" }, target: ["hero"] }], E);
  assert.equal(r.ok, false);
  assert.equal(at(r, "MISSING_FIELD").path, "nodes[0].op.gradient");
});

test("a misspelled design op is reported with the name it meant", () => {
  const r = validateNodes([{ op: { name: "gradiant", gradient: "x" }, target: ["hero"] }], E);
  assert.equal(r.ok, false);
  assert.deepEqual(at(r, "UNKNOWN_DESIGN_OP").suggestions, ["gradient"]);
});

test("the reference's own name for link-style is corrected", () => {
  // The API index titles the page "LinkStyle" while the runtime matches
  // "link-style", so this is a mistake the documentation actively invites.
  const r = validateNodes([{ op: { name: "linkStyle" }, target: ["hero"] }], E);
  assert.deepEqual(at(r, "UNKNOWN_DESIGN_OP").suggestions, ["link-style"]);
});

// ── the forms that must keep working ─────────────────────────────────
//
// Every case below is real, documented usage. A regression here is worse
// than the bug above: it rejects a page that renders correctly.

test("the bare-string design shorthand is not a raster op", () => {
  // `{ op: "gradient" }` is on the gradient docs page and renders the
  // default gradient. familyOf() sent every string op to the raster
  // family, so this validated as UNKNOWN_OP suggesting a raster op that
  // would not do it — a false positive on the documentation.
  for (const op of ["blast", "gradient", "shadow", "filter", "animation", "transform", "span"]) {
    const r = validateNodes([{ op }], E);
    assert.equal(r.ok, true, `{ op: "${op}" } should validate, got ${codes(r).join(",")}`);
  }
});

test("the bare-string form keeps the four keys its expansion lifts into the op", () => {
  // `{ op: "gradient", gradient: "…" }` is the docs' "custom gradient".
  // These four are read only for this form, which is why the two forms
  // cannot share one allowlist.
  const r = validateNodes([
    { op: "gradient", gradient: "linear-gradient(orange, green)" },
    { op: "blast", color: "green", width: "2px" },
    { op: "filter", filter: "sepia(1)" },
  ], E);
  assert.equal(r.ok, true, codes(r).join(","));
});

test("style and duration are read for every design node", () => {
  // Caught by sweeping the e2e fixtures, not by reading the docs:
  // designer.js reads both off protoOptions for all nodes, so reporting
  // them would have broken designer-contract.spec.js and transformStyle.
  const r = validateNodes([
    { op: "blast", color: "red", target: ["hero"], style: "default" },
    { op: { name: "transform" }, target: ["hero"], style: "WAVE", duration: "FAST" },
  ], E);
  assert.equal(r.ok, true, codes(r).join(","));
});

test("object design ops from every dispatch site still validate", () => {
  for (const name of ["animation", "background", "blast", "card-style", "filter",
                      "layout", "link-style", "margin", "shadow", "slayout",
                      "span", "transform"]) {
    const r = validateNodes([{ op: { name }, target: ["hero"] }], E);
    assert.equal(r.ok, true, `{ op: { name: "${name}" } } should validate, got ${codes(r).join(",")}`);
  }
});

test("raster ops are still raster ops", () => {
  // The bare-string design list must not swallow the raster family. No
  // name appears in both, and this is what pins that.
  const good = validateNodes([{ op: "dither", target: ["hero"], levels: 6 }], E);
  assert.equal(good.ok, true, codes(good).join(","));

  const typo = validateNodes([{ op: "dithr", target: ["hero"] }], E);
  assert.equal(typo.ok, false);
  assert.deepEqual(at(typo, "UNKNOWN_OP").suggestions, ["dither"]);
});

// The repair loop's fairness contract — AGENTIC-FIRST-PLAN.md §10 Tier 7.
//
// The loop reports two numbers: what a model repairs from the SHIPPED tools'
// reports alone, and what it repairs when it is additionally told which of the
// task's strings are missing from the page. The second is an upper bound,
// because that list is the scorer's answer key rather than anything the
// library can see.
//
// Everything here guards the boundary between them. If content feedback ever
// leaks into library mode the two numbers silently become one, the upper bound
// gets quoted as the defensible one, and nothing else in the suite would
// notice — the eval would simply start reporting a better result.
import test from "node:test";
import assert from "node:assert/strict";
import { feedback, librarySpeaks, contentSpeaks } from "../../evals/repair.mjs";

const clean = { diag: { validate: { ok: true, errors: [] }, threw: null,
                        missing: [], leaked: [], undescribed: false, quality: null } };
const contentOnly = { diag: { ...clean.diag, missing: ["Terms & privacy"] } };
const threw = { diag: { ...clean.diag, threw: `[nodality] Unknown element type "undefined".` } };
const invalid = { diag: { ...clean.diag,
  validate: { ok: false, errors: [{ code: "UNKNOWN_TARGET", path: "N[0].target", got: "hom",
                                    suggestions: ["home"], valid: ["home"] }] } } };
const dirty = { diag: { ...clean.diag,
  quality: { ok: false, errors: [{ code: "TAP_TARGET_TOO_SMALL", path: "button", got: "54x23" }] } } };

test("a result the tools are happy with produces no feedback, so no retry", () => {
  assert.equal(librarySpeaks(clean), false);
  assert.equal(contentSpeaks(clean), false);
  assert.equal(feedback(clean, { includeContent: true }), null);
});

test("library mode never mentions the missing strings", () => {
  // The whole point. A content-only failure is INVISIBLE to the library, and
  // the run has to report it as unrepairable rather than quietly repairing it.
  assert.equal(librarySpeaks(contentOnly), false);
  assert.equal(contentSpeaks(contentOnly), true);
  assert.equal(feedback(contentOnly, { includeContent: false }), null);
  assert.match(feedback(contentOnly, { includeContent: true }), /Terms & privacy/);
});

test("a throw, a validate error and a check_page finding are each library-visible", () => {
  for (const r of [threw, invalid, dirty]) assert.equal(librarySpeaks(r), true);
  assert.match(feedback(threw, {}), /Unknown element type/);
  assert.match(feedback(invalid, {}), /UNKNOWN_TARGET/);
  assert.match(feedback(dirty, {}), /TAP_TARGET_TOO_SMALL/);
});

test("reports go back as the JSON the MCP server actually returns", () => {
  // An agent parses these. If they were reformatted into prose here, the loop
  // would be measuring a friendlier library than the one that ships.
  const text = feedback(invalid, {});
  const block = /validate_nodes:\n([\s\S]*?)\n\nFix these/.exec(text);
  assert.ok(block, "the validate report is delimited");
  assert.deepEqual(JSON.parse(block[1]), invalid.diag.validate);
  assert.match(text, /did you mean|suggestions/i);
});

test("a multi-page result names the page each report came from", () => {
  const site = { pages: [
    { id: "site/index", diag: clean.diag },
    { id: "site/races", diag: threw.diag },
  ] };
  assert.equal(librarySpeaks(site), true);
  assert.match(feedback(site, {}), /page "races"/);
  assert.doesNotMatch(feedback(site, {}), /page "index"/);
});

test("the whole spec is demanded back, not a patch", () => {
  // A diff would have to be applied by the harness, and then the harness would
  // be doing part of the repair.
  assert.match(feedback(threw, {}), /COMPLETE spec/);
  assert.match(feedback(threw, {}), /not a patch/);
});

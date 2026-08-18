// agent-surface-validate.test.mjs — W4: the authoring half.
//
// The surface is derived, so there is very little to get wrong in the
// node itself — which is exactly why the little there is must be caught.
// Naming a form that does not exist, or excluding a state that is spelled
// differently, produces a page that renders perfectly and registers a
// tool the author expected and never got. An agent has no screen to
// notice that on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNodes } from "../../lib/validate-nodes.js";

const E = [
  { id: "home", type: "wrap", children: [{ id: "home-t", type: "h3", text: "Hi" }] },
  { id: "work", type: "wrap" },
  { id: "contact-form", type: "form", children: [
    { id: "cf-name", type: "input", inputType: "text", name: "name" }] },
  { id: "newsletter", type: "form" },
];
const CHAIN = { op: "morph", chain: [{ from: "home", to: { Work: "work" } }] };
const check = (node, nodes = [CHAIN, node]) => validateNodes(nodes, E);
const codes = (r) => r.errors.map((e) => e.code);

test("a well-formed surface node validates", () => {
  const r = check({ op: "agent-surface", name: "site", forms: ["contact-form"] });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("a form that does not exist is caught, with the forms that do", () => {
  const r = check({ op: "agent-surface", forms: ["contact-from"] });
  assert.equal(r.ok, false);
  const e = r.errors.find((x) => x.path === "nodes[1].forms[0]");
  assert.equal(e.code, "UNKNOWN_FORM");
  assert.ok(e.suggestions.includes("contact-form"), JSON.stringify(e.suggestions));
  // suggested from FORMS, not from every id on the page
  assert.deepEqual(e.valid.sort(), ["contact-form", "newsletter"]);
});

test("naming a non-form element is caught even though the id exists", () => {
  // `home` is a real id, so an ids-only check would pass it — and the
  // node would derive no tool at all, silently.
  const r = check({ op: "agent-surface", forms: ["home"] });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, "UNKNOWN_FORM");
});

test("excluding a misspelled state is caught", () => {
  const r = check({ op: "agent-surface", exclude: ["wrok"], forms: ["contact-form"] });
  assert.equal(r.ok, false);
  const e = r.errors.find((x) => x.path === "nodes[1].exclude[0]");
  assert.equal(e.code, "UNKNOWN_STATE");
  assert.ok(e.suggestions.includes("work"));
});

test("a surface with nothing to expose says so", () => {
  // Legitimate — a page can be worth reading and nothing else — so it is
  // reported rather than rejected on the author's behalf, but a node
  // written expecting navigation should not fail silently.
  const r = validateNodes([{ op: "agent-surface" }], E);
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ["EMPTY_SURFACE"]);

  // with a form it is a real surface again
  assert.equal(
    validateNodes([{ op: "agent-surface", forms: ["contact-form"] }], E).ok, true);
});

test("an unknown key is caught with its suggestion", () => {
  const r = check({ op: "agent-surface", form: ["contact-form"] });
  assert.equal(r.ok, false);
  const e = r.errors.find((x) => x.path === "nodes[1].form");
  assert.equal(e.code, "UNKNOWN_PARAM");
  assert.ok(e.suggestions.includes("forms"));
});

test("wrong types are reported rather than coerced", () => {
  assert.equal(check({ op: "agent-surface", forms: "contact-form" }).errors[0].code,
    "BAD_FIELD");
  assert.equal(check({ op: "agent-surface", name: 7, forms: ["contact-form"] })
    .errors[0].code, "BAD_FIELD");
  assert.equal(check({ op: "agent-surface", forms: [7] }).errors[0].code, "BAD_TARGET");
});

test("selector-form ids are accepted here too", () => {
  const r = check({ op: "agent-surface", forms: ["#contact-form"], exclude: ["#work"] });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("without E, id checks are skipped rather than guessed", () => {
  const r = validateNodes([CHAIN, { op: "agent-surface", forms: ["anything"] }]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

// agent-surface.test.mjs — W1: the derivation, as a pure function.
//
// The three properties this phase exists to establish, and the reason
// each is asserted here rather than in a browser:
//
//   1. the surface is DERIVED from (E, N) — no annotation, no handler
//      authored beside it;
//   2. the view graph comes from the morph chain, which no other
//      framework holds as data;
//   3. the same derivation yields a STATIC manifest, so a declaration
//      exists without a script having run.
//
// All three are properties of a function from data to data, so they are
// provable without a DOM — which is the point of keeping this module
// free of any browser or protocol surface.

import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSurface } from "../../lib/agent-surface.js";

const CHAIN = {
  op: "morph", effect: "t-vhs", duration: 620, back: true,
  chain: [
    { from: "home",   to: { Work: "work", Contact: "contact" } },
    { from: "work",   to: { Aurora: "aurora" },  effect: "t-split" },
    { from: "aurora", to: { Contact: "contact" }, effect: "t-bloom" },
  ],
};

const FORM = {
  id: "contact-form", type: "form", action: "/inquiry", method: "post",
  children: [
    { id: "cf-name",  type: "input", inputType: "text", name: "name",
      placeholder: "Your name", required: true },
    { id: "cf-mail",  type: "input", inputType: "email", name: "email",
      label: "Email address", required: true },
    { id: "cf-topic", type: "picker", name: "topic", items: ["Sales", "Support"] },
    { id: "cf-optin", type: "checkbox", name: "optin", label: "Keep me posted" },
    { id: "cf-send",  type: "button", text: "Send" },
  ],
};

const E = [
  { id: "home", type: "wrap", children: [{ id: "home-t", type: "h1", text: "Studio" }] },
  { id: "work", type: "wrap" },
  { id: "aurora", type: "wrap" },
  { id: "contact", type: "wrap", children: [FORM] },
];

const surfaceOf = (nodes, elements = E, opts) => deriveSurface(elements, nodes, opts);
const byKind = (s, kind) => s.tools.find((t) => t.kind === kind);

test("no agent-surface node derives nothing — the surface is opt-in", () => {
  // Turning a page's interaction structure into callable tools is the
  // page's decision. A framework that did it on upgrade would be
  // deciding for every site that ever installed it.
  assert.equal(surfaceOf([CHAIN]), null);
});

test("the view graph is derived from the morph chain", () => {
  const s = surfaceOf([CHAIN, { op: "agent-surface" }]);
  const nav = byKind(s, "navigate");
  assert.ok(nav, "no navigate tool was derived");
  assert.deepEqual(nav.inputSchema.properties.destination.enum,
    ["work", "contact", "aurora"]);
  assert.deepEqual(nav.inputSchema.required, ["destination"]);
});

test("the description carries the labels a human sees, not internal ids", () => {
  // Agent vocabulary and human vocabulary are the same strings by
  // construction, so they cannot drift apart as the page is edited.
  const nav = byKind(surfaceOf([CHAIN, { op: "agent-surface" }]), "navigate");
  assert.match(nav.description, /from home: Work → work, Contact → contact/);
  assert.match(nav.description, /from work: Aurora → aurora/);
  // And it says what these destinations ARE, since Nodality has no router.
  assert.match(nav.description, /in-page views/);
});

test("go_back appears only where an edge actually declares back", () => {
  const on = surfaceOf([CHAIN, { op: "agent-surface" }]);
  assert.ok(byKind(on, "back"), "back was declared but no tool derived");

  const off = surfaceOf([{ ...CHAIN, back: false }, { op: "agent-surface" }]);
  assert.equal(byKind(off, "back"), undefined,
    "a chain with back:false must not offer go_back");
});

test("`#id` spellings resolve, because normalisation is imported not copied", () => {
  // The runtime accepts both spellings (1.1.15). A second copy of that
  // rule here would drift; this asserts there is only one.
  const s = surfaceOf([
    { op: "morph", chain: [{ from: "#home", to: { Work: "#work" } }] },
    { op: "agent-surface" },
  ]);
  assert.deepEqual(byKind(s, "navigate").inputSchema.properties.destination.enum, ["work"]);
});

test("unreachable states are not offered as destinations", () => {
  // A well-formed edge from a state nothing leads to is the graph
  // version of the silent no-op: it can never fire.
  const s = surfaceOf([
    { op: "morph", chain: [
      { from: "home", to: { Work: "work" } },
      { from: "orphan", to: { Nowhere: "nowhere" } },
    ] },
    { op: "agent-surface" },
  ]);
  const en = byKind(s, "navigate").inputSchema.properties.destination.enum;
  assert.deepEqual(en, ["work"]);
  assert.ok(!en.includes("nowhere"));
});

test("exclude removes a state from the surface and from the routes", () => {
  const s = surfaceOf([CHAIN, { op: "agent-surface", exclude: ["aurora"] }]);
  const nav = byKind(s, "navigate");
  assert.ok(!nav.inputSchema.properties.destination.enum.includes("aurora"));
  assert.ok(!nav.description.includes("aurora"));
  assert.ok(!s.manifest.views.states.includes("aurora"));
});

test("no form is exposed unless the node names it", () => {
  // A derived submit tool is an agent ACTING — the one derived
  // capability with a real side effect, so nothing about it is inferred.
  const s = surfaceOf([CHAIN, { op: "agent-surface" }]);
  assert.equal(byKind(s, "submit"), undefined,
    "a form was exposed without being allowlisted");
});

test("an allowlisted form's schema is read from its field descriptors", () => {
  const s = surfaceOf([CHAIN, { op: "agent-surface", forms: ["contact-form"] }]);
  const sub = byKind(s, "submit");
  assert.ok(sub, "no submit tool derived for the allowlisted form");
  assert.equal(sub.name, "submit_contact-form");
  assert.equal(sub.formId, "contact-form");

  const p = sub.inputSchema.properties;
  assert.deepEqual(p.name, { type: "string", description: "Your name" });
  assert.deepEqual(p.email, { type: "string", format: "email",
    description: "Email address" });
  assert.deepEqual(p.topic, { type: "string", enum: ["Sales", "Support"] });
  assert.deepEqual(p.optin, { type: "boolean", description: "Keep me posted" });
  // the submit button is a trigger, not a field
  assert.ok(!("Send" in p) && !p.send);
  assert.deepEqual(sub.inputSchema.required, ["name", "email"]);
});

test("an unknown inputType degrades to a string rather than inventing a format", () => {
  const s = surfaceOf(
    [{ op: "agent-surface", forms: ["f"] }],
    [{ id: "f", type: "form", children: [
      { id: "x", type: "input", inputType: "quantum", name: "x" }] }],
  );
  assert.deepEqual(byKind(s, "submit").inputSchema.properties.x, { type: "string" });
});

test("read_view is always present — reading is the baseline capability", () => {
  const s = surfaceOf([{ op: "agent-surface" }]);
  assert.ok(byKind(s, "read"));
  assert.equal(s.tools.length, 1, "a pageless surface should offer only read_view");
});

test("`name` prefixes every tool, so two surfaces cannot collide", () => {
  const s = surfaceOf([CHAIN, { op: "agent-surface", name: "gesos", forms: ["contact-form"] }]);
  assert.deepEqual(s.tools.map((t) => t.name),
    ["gesos_navigate", "gesos_go_back", "gesos_submit_contact-form", "gesos_read_view"]);
});

test("the manifest is the same derivation minus the handler-facing facts", () => {
  const s = surfaceOf([CHAIN, { op: "agent-surface", forms: ["contact-form"] }]);
  assert.deepEqual(s.manifest.tools.map((t) => t.name), s.tools.map((t) => t.name),
    "the static declaration and the live registration must describe one surface");
  for (const t of s.manifest.tools) {
    assert.ok(!("kind" in t) && !("formId" in t),
      "internal binding facts leaked into the static manifest");
    assert.ok(t.description && t.inputSchema);
  }
  assert.equal(s.manifest.views.root, "home");
  assert.deepEqual(s.manifest.views.states, ["home", "work", "contact", "aurora"]);
});

test("the manifest records the spec label the CALLER supplies", () => {
  // This module stays ignorant of any particular protocol: the spec is
  // in origin trial and has already moved its entry point once.
  assert.equal(surfaceOf([{ op: "agent-surface" }]).manifest.spec, null);
  assert.equal(
    surfaceOf([{ op: "agent-surface" }], E, { specDraft: "2026-07-21" }).manifest.spec,
    "2026-07-21");
});

test("derivation is deterministic — same pair, byte-identical manifest", () => {
  // The manifest ships from a build, so it inherits the determinism
  // property the whole model rests on, and the build stays reproducible.
  const a = surfaceOf([CHAIN, { op: "agent-surface", forms: ["contact-form"] }]);
  const b = surfaceOf([CHAIN, { op: "agent-surface", forms: ["contact-form"] }]);
  assert.equal(JSON.stringify(a.manifest), JSON.stringify(b.manifest));
});

test("a named form that does not exist is skipped, not crashed", () => {
  const s = surfaceOf([CHAIN, { op: "agent-surface", forms: ["nope"] }]);
  assert.equal(byKind(s, "submit"), undefined);
  assert.ok(byKind(s, "read"), "the rest of the surface survives a bad form name");
});

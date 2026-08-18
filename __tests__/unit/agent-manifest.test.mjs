// agent-manifest.test.mjs — W3: the half that needs no browser.
//
// Runs the real CLI over a real upload directory in a temp dir, so what
// is asserted is the artefact a deploy would actually ship — not a
// derivation called directly in-process, which would prove only that the
// pure function still works (agent-surface.test.mjs already does that).
//
// The property under test is the one that has no counterpart anywhere in
// this space: a capability declaration that exists in static files,
// readable by a crawler or by an agent deciding whether to visit at all,
// without document.modelContext existing and without a script running.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CLI = path.join(ROOT, "bin", "nodality.js");

/** A minimal site with one page carrying a chain and an allowlisted form. */
function scaffold() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nod-agent-"));
  const upload = path.join(dir, "upload");
  fs.mkdirSync(path.join(upload, "pages"), { recursive: true });

  for (const sub of ["lib", "layout", "assets"]) {
    fs.cpSync(path.join(ROOT, sub), path.join(upload, sub), { recursive: true });
  }

  fs.writeFileSync(path.join(upload, "index.html"),
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    "<title>Agent surface</title></head><body><div id=\"mount\"></div>" +
    '<script type="module" src="./pages/index.js"></script></body></html>\n');

  fs.writeFileSync(path.join(upload, "pages", "index.js"), `
import { Des } from "../lib/designer.js";

const CONTACT = { id: "contact-form", type: "form", action: "/inquiry", method: "post",
  children: [
    { id: "cf-name", type: "input", inputType: "text", name: "name", required: true },
    { id: "cf-mail", type: "input", inputType: "email", name: "email", label: "Email" },
  ] };

// The form sits OUTSIDE the graph, which is the shape a brochure site
// actually has — and the only shape whose annotations can reach the
// static HTML: a non-root morph state is held detached until it is
// transitioned to, so nothing inside one is serialised by prerender.
const E = [
  { id: "home", type: "wrap", children: [
      { id: "home-t", type: "h3", text: "Studio" },
      { id: "home-go", type: "button", text: "Work" } ] },
  { id: "work", type: "wrap", children: [
      { id: "work-t", type: "h3", text: "Selected work" } ] },
  CONTACT,
];

const N = [
  { op: "morph", duration: 300, back: true,
    chain: [{ from: "home", to: { Work: "work" } }] },
  { op: "agent-surface", name: "demo", forms: ["contact-form"] },
];

new Des().nodes(N).add(E).set({ mount: "#mount", code: false });
`);

  fs.writeFileSync(path.join(dir, "nodality.config.json"), JSON.stringify({
    origin: "https://example.com", uploadDir: "upload", defaultLocale: null,
    sitemap: false, tolerateAsyncErrors: true,
  }, null, 2));
  return { dir, upload };
}

const build = (dir) =>
  execFileSync(process.execPath, [CLI, "prerender"], { cwd: dir, encoding: "utf8" });

test("prerender emits a manifest a crawler can read without running scripts", () => {
  const { dir, upload } = scaffold();
  try {
    build(dir);
    const file = path.join(upload, "agent-manifest.json");
    assert.ok(fs.existsSync(file), "no agent-manifest.json was written");

    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(m.origin, "https://example.com");
    const page = m.pages["index.html"];
    assert.ok(page, `index.html missing from ${Object.keys(m.pages)}`);
    assert.equal(page.spec, "2026-07-21");
    assert.deepEqual(page.tools.map((t) => t.name).sort(),
      ["demo_go_back", "demo_navigate", "demo_read_view", "demo_submit_contact-form"]);
    assert.equal(page.views.root, "home");
    assert.deepEqual(page.views.states, ["home", "work"]);

    // the declaration is IN the served page too, not only beside it
    const html = fs.readFileSync(path.join(upload, "index.html"), "utf8");
    assert.match(html, /id="nodality-agent-manifest"/);

    // and the form the node named carries the spec's own annotations
    assert.match(html, /toolname="demo_submit_contact-form"/);
    assert.match(html, /tooldescription="/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the form schema in the manifest was read from the descriptors", () => {
  // Claim (1) as a build artefact: nobody annotated these types or this
  // requiredness onto the DOM — they are what E already said.
  const { dir, upload } = scaffold();
  try {
    build(dir);
    const m = JSON.parse(fs.readFileSync(path.join(upload, "agent-manifest.json"), "utf8"));
    const submit = m.pages["index.html"].tools.find((t) => t.name.startsWith("demo_submit"));
    assert.deepEqual(submit.inputSchema.properties.email, { type: "string", format: "email",
      description: "Email" });
    assert.deepEqual(submit.inputSchema.required, ["name"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the manifest is byte-identical across two builds", () => {
  // It ships from a build, so it inherits the determinism the model
  // rests on; a manifest that churned would make every deploy a diff.
  const { dir, upload } = scaffold();
  try {
    build(dir);
    const first = fs.readFileSync(path.join(upload, "agent-manifest.json"));
    build(dir);
    const second = fs.readFileSync(path.join(upload, "agent-manifest.json"));
    assert.equal(first.toString(), second.toString());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a site that declares no surface ships no manifest", () => {
  const { dir, upload } = scaffold();
  try {
    const entry = path.join(upload, "pages", "index.js");
    fs.writeFileSync(entry, fs.readFileSync(entry, "utf8")
      .replace(/\{ op: "agent-surface".*?\},/s, ""));
    build(dir);
    assert.equal(fs.existsSync(path.join(upload, "agent-manifest.json")), false,
      "a manifest was written for a site that never opted in");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// react-host.test.mjs — nodality/react, the <Nodality> host component.
//
// Imported by PACKAGE NAME, so the exports map and the "nodality"
// self-import inside lib/react.js are exercised the way a React app
// resolves them. React is pinned to exactly 19.2.4 in devDependencies on
// purpose: 1.3.25 passed this suite on React 18 and was broken on 19.0–19.2,
// which re-apply dangerouslySetInnerHTML whenever the prop OBJECT changes
// (see the re-render test below). 19.3 compares the string again, so a
// looser range would let the test pass without testing anything.
//
// Covered:
//   - view regime: mounts the component's render(), rebuilds only when
//     `deps` change, and an inline factory alone does not rebuild
//   - spec regime: Des renders into the host, the specification travels in
//     a <script data-nodality-for> that create-nodality-react's
//     prerender.mjs looks for, and '<' cannot close that script
//   - unmount clears the host
//   - the host id is usable as a CSS selector (Des mounts by selector)

import { test, before } from "node:test";
import assert from "node:assert/strict";

let React, act, createRoot, Nodality, DefaultExport, N, container;

before(async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = await import("react");
  ({ act } = React);
  ({ createRoot } = await import("react-dom/client"));
  N = await import("nodality");
  const mod = await import("nodality/react");
  Nodality = mod.Nodality;
  DefaultExport = mod.default;
  container = document.getElementById("app");
});

const h = (...a) => React.createElement(...a);

test("default and named exports are the same component", () => {
  assert.equal(typeof Nodality, "function");
  assert.equal(DefaultExport, Nodality);
});

test("view regime: mounts, rebuilds on deps, not on a new inline factory", async () => {
  let builds = 0;
  const factory = (label) => () => {
    builds++;
    return new N.Text(label).set({ color: "red" });
  };
  const root = createRoot(container);

  await act(async () => root.render(h(Nodality, { view: factory("one"), deps: [1] })));
  const host = container.querySelector("div[id^='nod-']");
  assert.ok(host, "renders a host div");
  assert.match(host.textContent, /one/);
  assert.equal(builds, 1);

  // Same deps, a brand-new inline factory: must NOT rebuild.
  await act(async () => root.render(h(Nodality, { view: factory("two"), deps: [1] })));
  assert.equal(builds, 1, "a new factory with the same deps does not rebuild");
  assert.match(host.textContent, /one/);

  // Changed deps: rebuilds with the latest factory.
  await act(async () => root.render(h(Nodality, { view: factory("three"), deps: [2] })));
  assert.equal(builds, 2);
  assert.match(host.textContent, /three/);
  assert.doesNotMatch(host.textContent, /one/, "the previous build is replaced, not appended to");

  await act(async () => root.unmount());
  assert.equal(container.innerHTML, "", "unmount removes the host");
});

test("a parent re-render with unchanged deps keeps the view (React 19)", async () => {
  // React 19 compares dangerouslySetInnerHTML by object identity and writes
  // innerHTML again when it differs. A fresh { __html: "" } on every render
  // therefore wiped the built view on any parent re-render — typing into a
  // field the parent tracks in state emptied a whole login form — and since
  // `deps` had not changed, nothing rebuilt it.
  let builds = 0;
  const view = () => { builds++; return new N.Text("kept").set({}); };
  const root = createRoot(container);
  await act(async () => root.render(h(Nodality, { view, deps: ["a"], className: "one" })));
  const host = container.querySelector("div[id^='nod-']");
  assert.match(host.textContent, /kept/);

  // Re-render the host with a different unrelated prop and the same deps.
  await act(async () => root.render(h(Nodality, { view, deps: ["a"], className: "two" })));
  assert.equal(host.className, "two", "the re-render reached the host");
  assert.match(host.textContent, /kept/, "the view survives the re-render");
  assert.equal(builds, 1, "and was not rebuilt to get there");

  await act(async () => root.unmount());
});

test("spec regime: renders through Des and carries the spec for a prerenderer", async () => {
  const root = createRoot(container);
  const elements = [{ type: "h1", id: "title", text: "Declared </script> as data" }];
  await act(async () => root.render(h(Nodality, { elements, nodes: [] })));

  const host = container.querySelector("div[id^='nod-']");
  assert.ok(host.querySelector("h1"), "Des rendered the element into the host");
  assert.match(host.textContent, /Declared/);

  const script = container.querySelector(`script[data-nodality-for="${host.id}"]`);
  assert.ok(script, "spec script is tied to the host id");
  assert.equal(script.type, "application/json");
  assert.doesNotMatch(script.textContent, /<\/script>/i, "'<' is escaped");
  assert.deepEqual(JSON.parse(script.textContent).elements, elements);

  // Des's on-page code panel must not leak into the document.
  assert.equal(document.querySelectorAll("textarea#elements").length, 0);

  await act(async () => root.unmount());
});

test("host id is a valid CSS selector (useId's ':' stripped)", async () => {
  const root = createRoot(container);
  await act(async () => root.render(h(Nodality, { view: () => new N.Text("x") })));
  const host = container.querySelector("div[id^='nod-']");
  assert.doesNotMatch(host.id, /:/);
  assert.equal(document.querySelector("#" + host.id), host);
  await act(async () => root.unmount());
});

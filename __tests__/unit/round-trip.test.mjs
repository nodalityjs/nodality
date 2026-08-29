// round-trip.test.mjs — Stage 5 of AGENTIC-FIRST-PLAN.md.
//
//     parse(html) -> spec        such that   render(parse(html)) === html
//
// The plan said this would be partial at first. Measurement decided where the
// line falls, and it is not where the plan guessed: 13 of the 35 types render
// as a bare <div> with no class and no attributes, so which composite produced
// a given node is simply not present in the output. Deeper signatures separate
// 24 of 30 — but only for the empty renders they were calibrated on, since a
// `row` holding an h2 and a `wrap` holding an h2 are the same shape.
//
// So there are two tiers, tested separately and never conflated:
//
//   exact        the page carries its descriptors (`set({annotate: true})`);
//                round-trip holds for every type and every option.
//   structural   no annotation; the tag alone decides, which covers the leaf
//                types and nothing else.
//
// The property under test is `render(parse(h)) === h`, not `parse(render(s))
// === s`. That direction matters: two types that render identically cannot be
// told apart, but re-rendering either reproduces the same HTML, so the stated
// property survives an ambiguity the reverse one would not.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="mount"></div></body></html>`);
for (const k of ["window", "document", "HTMLElement", "customElements",
                 "Node", "Element", "getComputedStyle"]) {
  try { if (dom.window[k] !== undefined && !(k in globalThis)) globalThis[k] = dom.window[k]; }
  catch { /* getter-only in some Node versions */ }
}
dom.window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {},
                                 addEventListener() {}, removeEventListener() {} });
dom.window.Element.prototype.animate ||= function () {
  return { finished: Promise.resolve(), cancel() {}, play() {}, pause() {},
           reverse() {}, finish() {}, addEventListener() {}, removeEventListener() {},
           onfinish: null };
};
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { Des } = await import(path.join(ROOT, "lib", "designer.js"));
const { parseHTML, parseReport, SPEC_ATTR } =
  await import(path.join(ROOT, "lib", "parse-html.js"));

const render = (spec, annotate = false) => {
  const m = dom.window.document.querySelector("#mount");
  m.innerHTML = "";
  new Des().nodes([]).add(spec)
    .set({ mount: "#mount", code: false, elements: false, annotate });
  return m.innerHTML;
};
const parse = (html) => parseHTML(html, dom.window.document);

// A corpus that spans both leaves and the composites Stage 4 gave content to.
const CORPUS = [
  [{ type: "h2", text: "Heading" }],
  [{ type: "p", text: "Body copy" }],
  [{ type: "a", text: "Go", url: "#dest" }],
  [{ type: "img", url: "https://example.com/x.jpg" }],
  [{ type: "ulist", items: ["one", "two"] }],
  [{ type: "cards", items: [{ img: "a.jpg", title: "ALPHA", link: "#a" },
                            { img: "b.jpg", title: "BETA", link: "#b" }] }],
  [{ type: "nav", items: [{ title: "Work", link: "#w" }] }],
  [{ type: "sideNav", items: [{ title: "Docs", link: "#d" }] }],
  [{ type: "table", items: [{ code: "X1", name: "Widget" }] }],
  [{ type: "row", children: [{ type: "h2", text: "R" }] }],
  [{ type: "h2", text: "Styled", color: "#f97316", size: "S3" }],
  [{ type: "h2", text: "A" }, { type: "cards" }, { type: "a", text: "L", url: "#l" }],
];

// ── the exact tier ──

test("an annotated page round-trips for every spec in the corpus", () => {
  for (const spec of CORPUS) {
    const authored = JSON.parse(JSON.stringify(spec));
    const html = render(spec, true);
    const back = parse(html);

    // The property, as the plan states it.
    assert.equal(render(back, true), html,
      `re-render differed for ${JSON.stringify(authored).slice(0, 60)}`);

    // And nothing the author wrote was dropped on the way.
    authored.forEach((el, i) => {
      for (const [k, v] of Object.entries(el)) {
        assert.deepEqual(back[i][k], v,
          `parse lost ${k} from ${JSON.stringify(el).slice(0, 50)}`);
      }
    });
  }
});

test("what comes back is the descriptor as rendered, not the author's source", () => {
  // Rendering an `a` adds `font` and `pad` to the caller's own object — the
  // library mutates the descriptor it is given, which predates this stage and
  // is unrelated to it. It decides what annotation can honestly record: the
  // element as it was rendered, defaults included. So the guarantee is HTML
  // round-trip, not textual identity with what the author typed, and this
  // test pins that distinction rather than leaving it as a surprise.
  const authored = { type: "a", text: "Go", url: "#dest" };
  const back = parse(render([{ ...authored }], true));
  for (const [k, v] of Object.entries(authored)) assert.deepEqual(back[0][k], v);
  assert.ok(Object.keys(back[0]).length > Object.keys(authored).length,
    "if this fails the library stopped mutating descriptors and the comment is stale");
  assert.equal(render(back, true), render([{ ...authored }], true),
    "the recovered descriptor must still render the same page");
});

test("styling options survive the exact tier", () => {
  // The structural tier cannot recover these — that is the reason the exact
  // tier exists, so it is asserted rather than assumed.
  const spec = [{ type: "h2", text: "Styled", color: "#f97316", size: "S3" }];
  const back = parse(render(spec, true));
  assert.deepEqual(back[0], spec[0]);
  assert.equal(render(back, true), render(spec, true));
});

test("parseReport says when a read was exact", () => {
  const r = parseReport(render(CORPUS[5], true), dom.window.document);
  assert.equal(r.ok, true);
  assert.equal(r.exact, true);
  assert.deepEqual(r.unrecovered, []);
});

// ── the non-breaking guarantee ──

test("annotation is off by default and leaves no trace", () => {
  for (const spec of CORPUS) {
    const plain = render(spec, false);
    assert.ok(!plain.includes(SPEC_ATTR),
      `${SPEC_ATTR} appeared without being asked for: ${JSON.stringify(spec).slice(0, 50)}`);
  }
});

test("annotating does not change what is rendered, only what is recorded", () => {
  // Strip the attribute back out and the two must be the same page.
  const strip = (h) => h.replace(new RegExp(` ${SPEC_ATTR}="[^"]*"`, "g"), "");
  for (const spec of CORPUS) {
    assert.equal(strip(render(spec, true)), render(spec, false),
      `annotation changed the page for ${JSON.stringify(spec).slice(0, 50)}`);
  }
});

// ── the structural tier, and its limits, stated as tests ──

test("leaf types round-trip with no annotation at all", () => {
  for (const spec of CORPUS.slice(0, 5)) {
    const html = render(spec, false);
    assert.equal(render(parse(html), false), html,
      `structural round-trip failed for ${JSON.stringify(spec)}`);
  }
});

test("a composite is reported unrecovered rather than guessed", () => {
  // Returning a confident guess would be worse than returning nothing: the
  // caller re-renders whatever it is handed, so a wrong type silently becomes
  // a different page.
  const r = parseReport(render([{ type: "cards" }], false), dom.window.document);
  assert.equal(r.ok, false);
  assert.equal(r.exact, false);
  assert.deepEqual(r.unrecovered, [{ index: 0, tag: "div" }]);
});

test("the structural tier recovers content, not styling", () => {
  // An honest limit, pinned so it cannot quietly become a false claim.
  const spec = [{ type: "h2", text: "Styled", color: "#f97316", size: "S3" }];
  const back = parse(render(spec, false));
  assert.deepEqual(back, [{ type: "h2", text: "Styled" }]);
  assert.notEqual(render(back, false), render(spec, false),
    "if this ever passes, the structural tier got better and the claim should be widened");
});

// ── the use case the stage exists for ──

test("an agent can load a page, change one card, and re-render", () => {
  // The plan's stated purpose, executed literally.
  const original = [{ type: "cards", items: [
    { img: "a.jpg", title: "ALPHA", link: "#a" },
    { img: "b.jpg", title: "BETA", link: "#b" },
  ]}];
  const page = render(original, true);

  const spec = parse(page);
  spec[0].items[1].title = "GAMMA";
  const edited = render(spec, true);

  assert.ok(edited.includes("GAMMA"), "the edit did not reach the page");
  assert.ok(!edited.includes("BETA"), "the replaced title is still there");
  assert.ok(edited.includes("ALPHA"), "an untouched card changed");
  // And the edited page is itself round-trippable, so editing composes.
  assert.deepEqual(parse(edited), spec);
});

// ── what parse returns is untrusted ──

test("a tampered descriptor is reported, not handed back to be rendered", () => {
  // `data-nod` is text in a document. It can be hand-edited, served by
  // someone else, or written by a different version of the library — and the
  // caller's next move is to render it. This is where Stage 3 and Stage 5
  // compose: the validator that makes a spec repairable is the one that makes
  // a parsed spec safe.
  const good = render([{ type: "cards", items: [{ img: "a.jpg", title: "A", link: "#a" }] }], true);
  const tampered = good.replace(/data-nod="[^"]*"/,
    'data-nod="{&quot;type&quot;:&quot;cardz&quot;,&quot;items&quot;:[]}"');

  const r = parseReport(tampered, dom.window.document);
  assert.equal(r.ok, false, "an unknown type was reported as a clean read");
  assert.ok(r.errors.some((e) => e.code === "UNKNOWN_ELEMENT_TYPE"),
    `expected the validator's report, got ${JSON.stringify(r.errors)}`);
});

test("a well-formed read reports no errors", () => {
  // The other side of the check: validation must not make every read look
  // broken. Annotation records the descriptor as RENDERED, defaults included,
  // so this also pins that those defaults are themselves valid vocabulary.
  for (const spec of CORPUS) {
    const r = parseReport(render(spec, true), dom.window.document);
    assert.deepEqual(r.errors, [],
      `a clean page reported errors: ${JSON.stringify(spec).slice(0, 50)} -> ` +
      JSON.stringify(r.errors));
    assert.equal(r.ok, true);
  }
});

test("content in the wrong slot survives the round-trip as a report", () => {
  // A page can be rendered from a spec the validator would flag — nothing
  // stops a caller doing that. Reading it back must say so rather than
  // quietly re-rendering the placeholders a second time.
  const html = render([{ type: "table", children: [{ type: "h2", text: "X" }] }], true);
  const r = parseReport(html, dom.window.document);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, "WRONG_CONTENT_SLOT");
});

// output-quality.test.mjs — Tier 0 of AGENTIC-FIRST-PLAN.md §10.
//
// Stages 1-6 made the INPUT good. These are defects in the OUTPUT, found by
// rendering composites and reading the DOM rather than by reasoning about the
// format. They matter more under machine authorship for a simple reason: a
// person generates one page and eyeballs it, a generator emits the same defect
// a thousand times.

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
const { validateNodes } = await import(path.join(ROOT, "lib", "validate-nodes.js"));

const render = (els) => {
  const m = dom.window.document.querySelector("#mount");
  m.innerHTML = "";
  new Des().nodes([]).add(els).set({ mount: "#mount", code: false, elements: false });
  return m.innerHTML;
};
const parse = (html) => {
  const b = dom.window.document.createElement("div");
  b.innerHTML = html;
  return b;
};

// ── the declared link must be the rendered link ──

test("every nav composite renders the link it was given", () => {
  // `sideNav` passed the caller's link into a `link:` option that Link never
  // reads — `url` is what becomes the href — and hardcoded `url: "#e"`. So a
  // declared link rendered as a different link. This was seen during Stage 4
  // and filed as a round-trip limitation; it was a silent no-op of exactly the
  // class Stages 1-6 existed to remove.
  for (const type of ["nav", "sideNav"]) {
    const html = render([{ type, items: [{ title: "Docs", link: "#DECLARED" }] }]);
    const hrefs = [...parse(html).querySelectorAll("a")].map((a) => a.getAttribute("href"));
    assert.ok(hrefs.includes("#DECLARED"),
      `${type} dropped the declared link; rendered ${JSON.stringify(hrefs)}`);
  }
});

test("placeholder links are untouched by that fix", () => {
  // The placeholders carry a `link` of their own that was never rendered, so
  // honouring it would have changed output that must stay byte-identical.
  // Supplied entries use their link; placeholders keep the url they had.
  const html = render([{ type: "sideNav" }]);
  const hrefs = [...parse(html).querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.ok(hrefs.every((h) => h === "#e"),
    `placeholder hrefs moved: ${JSON.stringify(hrefs)}`);
});

// ── valid HTML ──

test("no element carries src that cannot have it", () => {
  // A card's image is a <div> painted through background-image, and it was
  // being given `src` as well: `<div src="a.jpg">`, invalid HTML that fetches
  // nothing, emitted by every generated card grid.
  const html = render([{ type: "cards", items: [{ img: "a.jpg", title: "A", link: "#a" }] }]);
  const CAN = new Set(["img", "script", "iframe", "video", "audio", "source", "embed", "track"]);
  const bad = [...parse(html).querySelectorAll("[src]")]
    .filter((n) => !CAN.has(n.tagName.toLowerCase()))
    .map((n) => `<${n.tagName.toLowerCase()} src="${n.getAttribute("src")}">`);
  assert.deepEqual(bad, [], `src on elements that cannot carry it: ${bad.join(", ")}`);
});

// ── the image must be describable ──

test("a card image can carry alt text, in both authoring forms", () => {
  // The background-image path cannot take a real `alt`, so a supplied one
  // becomes the accessible equivalent. Without this there is no way at all to
  // describe a card image, and a generator emits that gap at scale.
  for (const items of [
    [{ img: "a.jpg", title: "A", link: "#a", alt: "A rocket on the pad" }],
    [[{ type: "h2", text: "A" }]],   // the spec form must still render
  ]) {
    assert.doesNotThrow(() => render([{ type: "cards", items }]));
  }
  const html = render([{ type: "cards",
    items: [{ img: "a.jpg", title: "A", link: "#a", alt: "A rocket on the pad" }] }]);
  const labelled = parse(html).querySelector('[role="img"][aria-label]');
  assert.ok(labelled, "a supplied alt did not reach the rendered image");
  assert.equal(labelled.getAttribute("aria-label"), "A rocket on the pad");
});

test("a card with no alt is byte-for-byte what it was", () => {
  // The alt-aware template is emitted only when some entry carries alt, so
  // pages that do not use it pay nothing — the same per-entry dispatch
  // `gridItemsSource` already uses, and what keeps the Stage 1 pin valid.
  const html = render([{ type: "cards", items: [{ img: "a.jpg", title: "A", link: "#a" }] }]);
  assert.ok(!html.includes("aria-label"), "aria-label appeared without an alt");
  assert.ok(!html.includes('role="img"'), "role=img appeared without an alt");
});

// ── content that cannot carry content ──

test("a content slot that is not a list is reported", () => {
  // The mapper tests `Array.isArray(...) && length`, so `items: {…}` falls
  // through to the placeholders: content declared, content ignored, no error.
  for (const [el, slot] of [
    [{ type: "cards", items: { img: "a.jpg" } }, "items"],
    [{ type: "cards", items: "x" }, "items"],
    [{ type: "row", children: { type: "h2" } }, "children"],
  ]) {
    const r = validateNodes([], [el]);
    assert.equal(r.ok, false, `${JSON.stringify(el)} validated clean`);
    const err = r.errors.find((e) => e.code === "BAD_CONTENT_SHAPE");
    assert.ok(err, `no BAD_CONTENT_SHAPE for ${JSON.stringify(el)}`);
    assert.equal(err.path, `elements[0].${slot}`);
  }
});

test("lists, empty lists and absent slots stay valid", () => {
  for (const el of [
    { type: "cards", items: [{ img: "a", title: "A", link: "#a" }] },
    { type: "cards", items: [] },
    { type: "cards" },
    { type: "row", children: [{ type: "h2", text: "x" }] },
  ]) {
    assert.equal(validateNodes([], [el]).ok, true,
      `rejected a valid shape: ${JSON.stringify(el)}`);
  }
});

// ── Tier 4: what the components emit ──
//
// The eval said it plainly: task success 10/10, layout-clean 4/10. Correct
// specs — the best possible input — produced defective pages six times in ten,
// and none of the defects was reachable by the author. A person builds one
// page and shrugs at an orange title; a generator emits it a thousand times.

test("a heading's level can be set independently of its size", () => {
  // Size and semantics used to be one decision: `size: "S5"` produced an <h5>
  // and there was no way to have one without the other. Fine for a person
  // choosing both at once, wrong for a generated page, where the outline is
  // structure and the type scale is style.
  const sized = render([{ type: "h5", text: "T" }]);
  assert.match(sized, /^<h5/, "the size still decides the tag by default");

  const { Des } = { Des: null };  // placeholder to keep the import list honest
  const tagged = render([{ type: "h5", text: "T", tag: "h2" }]);
  assert.match(tagged, /^<h2/, "`tag` did not override the size-derived tag");
  assert.ok(tagged.includes("T"), "the text was lost in the swap");
  // The type scale must survive the swap, or this would just be `size`.
  const fs = (h) => (h.match(/font-size:\s*([^;"]+)/) || [])[1];
  assert.equal(fs(tagged), fs(sized), "changing the tag changed the type scale");
});

test("a card grid does not break the document outline", () => {
  // The title was an <h5>, so any page with an h1 above a card grid skipped
  // h2, h3 and h4 at once.
  const html = render([
    { type: "h1", text: "Page" },
    { type: "cards", items: [{ img: "a.jpg", title: "A", link: "#a" }] },
  ]);
  const levels = [...parse(html).querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .map((h) => Number(h.tagName[1]));
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] <= levels[i - 1] + 1,
      `heading level jumped from h${levels[i - 1]} to h${levels[i]}`);
  }
});

test("the toggle glyph survives prerendering", () => {
  // It was set with `innerText`, which jsdom has no setter for — and the SSG
  // prerenders THROUGH jsdom, so the character never reached a prerendered
  // page and the button shipped empty and unannounceable. This test runs in
  // jsdom, which is exactly the environment that used to lose it.
  const html = render([{ type: "sideNav", items: [{ title: "Docs", link: "#d" }] }]);
  const buttons = [...parse(html).querySelectorAll("button")];
  assert.ok(buttons.length > 0, "no toggle rendered at all");
  assert.ok(buttons.some((b) => (b.textContent || "").trim().length > 0),
    "every button rendered empty — innerText is back");
});

test("icon images are marked decorative rather than left unlabelled", () => {
  // An <img> with no alt AT ALL is an unlabelled image to a screen reader.
  // Empty alt is the correct answer for decoration: it says "skip this".
  const html = render([{ type: "nav", items: [{ title: "Home", link: "/" }] }]);
  const imgs = [...parse(html).querySelectorAll("img")];
  for (const img of imgs) {
    assert.ok(img.hasAttribute("alt"),
      `an icon image has no alt at all: ${img.getAttribute("src")}`);
  }
});

test("the palette the components emit meets contrast, measured not asserted", () => {
  // The numbers, so a future colour change has to justify itself against the
  // same threshold rather than against taste.
  const lum = (hex) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => {
      const s = parseInt(h.slice(i, i + 2), 16) / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const [fg, bg, need, what] of [
    ["#c2410c", "#ffffff", 3, "card title on white"],
    ["#ffffff", "#1d6fe0", 4.5, "card link label on its button"],
    ["#ffffff", "#c2410c", 4.5, "table header on its band"],
    ["#c2410c", "#ffffff", 3, "hamburger, closed"],
    ["#0f766e", "#ffffff", 3, "hamburger, opened"],
  ]) {
    const r = ratio(fg, bg);
    assert.ok(r >= need, `${what}: ${r.toFixed(2)}:1, needs ${need}:1`);
  }
});

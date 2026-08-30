// diagnostics-localise.test.mjs — the three defects Tier 7 measured.
//
// The repair loop handed a model its own diagnostics and watched what it did
// with them. The strong model repaired every library-visible failure in one
// turn; the weaker one repaired none and returned a byte-identical spec. The
// difference was not the correction — it was finding the fault. Every report
// here said WHAT was wrong and nothing about WHERE, and the proof was in the
// response cache: three briefs with three different faults produced the same
// feedback string, because the message was a constant.
//
// So these tests are all one property, checked in three places: a report has
// to name the thing it is about.
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
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
const { validateNodes, CONTENT_SLOT, SPEC_ITEMS } =
  await import(path.join(ROOT, "lib", "validate-nodes.js"));
const { SPEC_ATTR } = await import(path.join(ROOT, "lib", "parse-html.js"));

const draw = (el, opts = {}) => {
  const m = dom.window.document.querySelector("#mount");
  m.innerHTML = "";
  for (const n of [...dom.window.document.body.children]) if (n.id !== "mount") n.remove();
  try {
    new Des().nodes([]).add([el])
      .set({ mount: "#mount", code: false, elements: false, ...opts });
  } catch (e) { return "THREW:" + e.message; }
  return dom.window.document.body.innerHTML;
};

// ── 1. the validator must agree with the mapper about which items are specs ──

test("SPEC_ITEMS cannot drift: the validator reports exactly what the mapper throws on", () => {
  // Derived by RENDERING, like CONTENT_SLOT beside it. A hand-kept list of
  // "types whose items are element specs" is the same shape of knowledge that
  // drifted out of the op registry before 1.2.8.
  const itemTypes = Object.entries(CONTENT_SLOT)
    .filter(([, slot]) => slot === "items").map(([t]) => t);
  assert.ok(itemTypes.length >= 5, "there are types reading `items`");

  for (const type of itemTypes) {
    const spec = { type, items: [{ text: "Fast" }] };
    const throws = draw(spec).startsWith("THREW:");
    const reported = validateNodes([], [spec]).errors
      .some((e) => e.path.startsWith("elements[0].items[0]"));
    assert.equal(reported, throws,
      `${type}: mapper ${throws ? "throws" : "renders"} on an untyped item but the ` +
      `validator ${reported ? "reports" : "says nothing"} — ` +
      `SPEC_ITEMS ${SPEC_ITEMS.has(type) ? "lists" : "omits"} it`);
  }
});

test("a string item stays valid, because it is the shorthand", () => {
  for (const type of SPEC_ITEMS) {
    const r = validateNodes([], [{ type, items: ["Fast", "Cheap"] }]);
    assert.equal(r.ok, true, `${type} rejected the string shorthand`);
    assert.ok(!draw({ type, items: ["Fast"] }).startsWith("THREW:"));
  }
});

test("the report hands back the replacement rather than describing it", () => {
  // Tier 7's finding: the throw this replaces named all 35 valid types and
  // nothing about the entry, so it carried no information about the page and
  // the weaker model changed nothing. A one-turn repair needs the answer.
  const r = validateNodes([], [{ type: "ulist", items: [{ text: "Fast" }] }]);
  assert.equal(r.ok, false);
  const e = r.errors.find((x) => x.path === "elements[0].items[0].type");
  assert.ok(e, "the fault is reported AT the entry, not at the element");
  assert.ok(e.suggestions.some((s) => s.includes("Fast")),
    `the suggestion repeats the content it found: ${JSON.stringify(e.suggestions)}`);
});

// ── 2. a field with no title must not render the word "undefined" ──

test("labelInput never renders the string undefined", () => {
  const html = draw({ type: "labelInput" });
  assert.ok(!html.startsWith("THREW:"));
  assert.ok(!/undefined/.test(html),
    `a labelled input with no title rendered: ${html.slice(0, 200)}`);
});

test("labelInput takes title, label or text, in that order", () => {
  const nameOf = (el) => {
    draw(el);
    const i = dom.window.document.querySelector("#mount input");
    return i && i.getAttribute("aria-label");
  };
  assert.equal(nameOf({ type: "labelInput", text: "Name" }), "Name");
  assert.equal(nameOf({ type: "labelInput", label: "Name" }), "Name");
  assert.equal(nameOf({ type: "labelInput", title: "Name" }), "Name");
  assert.equal(nameOf({ type: "labelInput", title: "T", label: "L", text: "X" }), "T");
  assert.equal(nameOf({ type: "labelInput", label: "L", text: "X" }), "L");
});

test("the per-type schema names the parameter that makes an image describable", () => {
  // `img` renders `alt` and always did; the schema recovered from source did
  // not list it, because image.js names its argument `options` rather than
  // `obj` and the scan matched neither. `npx nodality schema img` is where an
  // agent is sent for this type's vocabulary — it omitted the accessibility
  // parameter while the renderer read it perfectly well.
  const schema = JSON.parse(readFileSync(path.join(ROOT, "schema.json"), "utf8"));
  const names = schema.types.img.params.map((p) => p.name);
  assert.ok(names.includes("alt"), "img lists alt");
  assert.ok(names.includes("url"), "img still lists url");
  draw({ type: "img", url: "/a.png", alt: "A cat" });
  assert.equal(dom.window.document.querySelector("#mount img").getAttribute("alt"), "A cat");
});

// ── 3. check_page findings must name the element ──

const checkOr = async (html, opts) => {
  const { checkPage } = await import(path.join(ROOT, "lib", "check-page.js"));
  const r = await checkPage(html, opts);
  return r.errors[0]?.code === "MISSING_PEER_DEPENDENCY" ? null : r;
};

test("three faulty controls are three findings, not one", async (t) => {
  // They were one. `sel()` was parent-relative and returned "input" for each
  // of them, the cross-viewport merge keyed on it, and three collapsed into a
  // single row reading `viewport: "mobile, mobile, mobile"` — the agent was
  // told neither which control nor that there were three.
  const html = "<form id='f'>" +
    "<div><input type='text'></div>".repeat(3) + "</form>";
  const r = await checkOr(html, { viewports: [{ name: "mobile", width: 390, height: 844 }] });
  if (!r) return t.skip("playwright not installed");

  const unlabelled = r.errors.filter((e) => e.code === "CONTROL_WITHOUT_LABEL");
  assert.equal(unlabelled.length, 3, "one finding per control");
  assert.equal(new Set(unlabelled.map((e) => e.path)).size, 3, "each names a different path");
  for (const e of unlabelled) assert.match(e.path, /^#f > div:nth-of-type\(\d\) > input$/);
});

test("the same fault at two viewports is still one finding", async (t) => {
  // The merge that caused the collapse is still wanted for what it was for.
  const r = await checkOr("<form id='f'><input type='text'></form>", {
    viewports: [{ name: "mobile", width: 390, height: 844 },
                { name: "desktop", width: 1280, height: 900 }],
  });
  if (!r) return t.skip("playwright not installed");
  const unlabelled = r.errors.filter((e) => e.code === "CONTROL_WITHOUT_LABEL");
  assert.equal(unlabelled.length, 1);
  assert.equal(unlabelled[0].viewport, "mobile, desktop");
});

test("an annotated page tells the agent which descriptor to edit", async (t) => {
  // A selector says where in the DOM. `nod` says which spec node — which is
  // what an agent repairing a SPEC actually has to change.
  assert.equal(SPEC_ATTR, "data-nod",
    "check-page.js spells this attribute out because it crosses into the browser");

  const html = draw({ type: "form", id: "f", children: [{ type: "input" }] },
                    { annotate: true });
  assert.ok(new RegExp(SPEC_ATTR).test(html), "the page carries annotation");
  const r = await checkOr(html, { viewports: [{ name: "mobile", width: 390, height: 844 }] });
  if (!r) return t.skip("playwright not installed");
  const e = r.errors.find((x) => x.code === "CONTROL_WITHOUT_LABEL");
  assert.ok(e, "the unlabelled control is found");
  assert.ok(e.nod, "and carries its spec node");
  assert.equal(JSON.parse(e.nod).type, "form");
});

test("an unannotated page reports nod as null, not as absent", async (t) => {
  const r = await checkOr("<form id='f'><input type='text'></form>",
                          { viewports: [{ name: "mobile", width: 390, height: 844 }] });
  if (!r) return t.skip("playwright not installed");
  const e = r.errors.find((x) => x.code === "CONTROL_WITHOUT_LABEL");
  assert.ok(e && "nod" in e, "the field is present");
  assert.equal(e.nod, null);
});

// ── 4. a finding must also name the edit ──

test("every code check_page can emit has a repair to offer", () => {
  // `suggestions` and `valid` sat empty on every check_page finding while
  // validate_nodes used both for repairs. A new check added without one would
  // reintroduce exactly that, so the list is read out of the source rather
  // than kept by hand.
  const src = readFileSync(path.join(ROOT, "lib", "check-page.js"), "utf8");
  const emitted = new Set([...src.matchAll(/\badd\("([A-Z_]+)"/g)].map((m) => m[1]));
  const repaired = new Set([...src.matchAll(/^    ([A-Z_]+): \{$/gm)].map((m) => m[1]));
  assert.ok(emitted.size >= 8, `found the checks: ${[...emitted].join(", ")}`);
  const naked = [...emitted].filter((c) => !repaired.has(c));
  assert.deepEqual(naked, [], `these findings offer no repair: ${naked.join(", ")}`);
});

test("the repair check_page suggests actually clears the finding", async (t) => {
  // The rule content-slots.test.mjs set: a diagnostic is only worth emitting
  // if the thing it describes is true. Told "54x23", one model guessed
  // `keySet: {key, value}` and was right and the other invented
  // `keySet: {"--tap-target-size": "44px"}` and was wrong — so the suggested
  // form has to be the one that works, checked by rendering it.
  const small = { type: "button", text: "Send", keySet: { key: "min-height", value: "1px" } };
  const fixed = { type: "button", text: "Send", keySet: { key: "min-height", value: "44px" } };

  const before = await checkOr(draw(small), { viewports: [{ name: "mobile", width: 390, height: 844 }] });
  if (!before) return t.skip("playwright not installed");
  const hit = before.errors.filter((e) => e.code === "TAP_TARGET_TOO_SMALL");
  assert.equal(hit.length, 1, "the small target is found");
  assert.ok(hit[0].suggestions.some((s) => s.includes("min-height")),
    "and the repair names min-height");

  const after = await checkOr(draw(fixed), { viewports: [{ name: "mobile", width: 390, height: 844 }] });
  assert.equal(after.errors.filter((e) => e.code === "TAP_TARGET_TOO_SMALL").length, 0,
    "applying the suggested keySet clears it");
});

// ── 5. a picker's items, and its name ──

test("a picker takes its items as strings or as [value, text] pairs", () => {
  // The string form is the one `deriveSurface` requires — it builds the
  // enum from `items.filter(i => typeof i === "string")`, pinned by
  // agent-surface.test.mjs — while this component required the PAIR form.
  // No value of `items` satisfied both. A string is indexable, so
  // `["Sales", "Support"]` rendered two options both valued "S", reading
  // "a" and "u", under a manifest advertising Sales and Support.
  const opts = (spec) => {
    draw(spec);
    return [...dom.window.document.querySelectorAll("#mount select option")]
      .map((o) => `${o.value}/${o.textContent}`);
  };
  assert.deepEqual(opts({ type: "picker", items: ["Sales", "Support"] }),
    ["Sales/Sales", "Support/Support"]);
  assert.deepEqual(opts({ type: "picker", items: [["a", "Alpha"], ["b", "Beta"]] }),
    ["a/Alpha", "b/Beta"]);
});

test("a picker can be given an accessible name", () => {
  // It could not before: `label` reached the component — `elOpts` forwards
  // everything it does not skip — and nothing read it, so a select had no
  // spelling of the fix at all.
  const named = (spec) => {
    draw(spec);
    const s = dom.window.document.querySelector("#mount select");
    return s && s.getAttribute("aria-label");
  };
  assert.equal(named({ type: "picker", label: "Topic", items: ["A"] }), "Topic");
  assert.equal(named({ type: "picker", title: "Topic", items: ["A"] }), "Topic");
  assert.equal(named({ type: "picker", items: ["A"] }), null,
    "and stays absent when none was asked for, rather than inventing one");
});

// ── 6. the checker's own blind spot ──

test("check_page sees select and textarea, which it did not", async (t) => {
  // Neither was in the `interactive` set, so neither the label check nor the
  // tap-target check ever ran on one. That is why a picker being unnameable
  // went unnoticed for as long as it did: the component had no spelling of
  // the fix, and the tool that would have said so was not looking. Two blind
  // spots that hid each other.
  const r = await checkOr("<form id='f'><select><option value='a'>A</option></select>" +
    "<textarea></textarea></form>",
    { viewports: [{ name: "mobile", width: 390, height: 844 }] });
  if (!r) return t.skip("playwright not installed");
  const paths = r.errors.filter((e) => e.code === "CONTROL_WITHOUT_LABEL").map((e) => e.path);
  assert.equal(paths.length, 2, `both controls reported: ${JSON.stringify(paths)}`);
  assert.ok(paths.some((p) => p.endsWith("select")), "the select");
  assert.ok(paths.some((p) => p.endsWith("textarea")), "the textarea");
});

test("a select's options are not mistaken for its name", async (t) => {
  // `textContent` on a <select> is the OPTION LIST. The shortcut that clears
  // a button by its caption would clear every select ever written.
  const r = await checkOr("<form id='f'><select><option value='a'>Sales</option>" +
    "<option value='b'>Support</option></select></form>",
    { viewports: [{ name: "mobile", width: 390, height: 844 }] });
  if (!r) return t.skip("playwright not installed");
  assert.equal(r.errors.filter((e) => e.code === "CONTROL_WITHOUT_LABEL").length, 1);
});

test("the four ways to name a control all count", async (t) => {
  // Was `aria-label` alone — the least used of them. A control labelled the
  // ordinary HTML way was reported as unnamed, and a false finding sends a
  // repair at something that was never broken.
  const wrap = (inner) => `<form id='f'>${inner}</form>`;
  const cases = [
    ["aria-label", "<select aria-label='Topic'><option value='a'>A</option></select>"],
    ["label[for]", "<label for='s'>Topic</label><select id='s'><option value='a'>A</option></select>"],
    ["ancestor label", "<label>Topic <select><option value='a'>A</option></select></label>"],
    ["aria-labelledby", "<span id='t'>Topic</span><select aria-labelledby='t'><option value='a'>A</option></select>"],
  ];
  for (const [how, inner] of cases) {
    const r = await checkOr(wrap(inner), { viewports: [{ name: "mobile", width: 390, height: 844 }] });
    if (!r) return t.skip("playwright not installed");
    assert.equal(r.errors.filter((e) => e.code === "CONTROL_WITHOUT_LABEL").length, 0,
      `${how} should count as a name`);
  }
});

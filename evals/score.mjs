/**
 * Tier 2 of AGENTIC-FIRST-PLAN.md §10 — scoring one attempt at one brief.
 *
 * §5 measures tokens. A token count is a PROXY: the claim "agentic-first"
 * makes is that machine authorship succeeds, and the metric for that is
 * whether the agent produced a correct page, not how few tokens it spent
 * being wrong. This is the scorer for that.
 *
 * Four gates, in the order a failure actually stops you:
 *
 *   valid     the spec passes validate_nodes
 *   renders   it produces a page without throwing
 *   content   every string the brief asked for reaches the RENDERED page,
 *             and nothing the brief forbade does
 *   quality   check_page finds nothing at either viewport
 *
 * `content` is the one that matters most and is easiest to fake. It is
 * checked against the rendered DOM, never against the spec: "declared but not
 * rendered" is the exact defect this project spent six stages removing, and a
 * scorer that read the spec would score it as a pass.
 */
import { JSDOM } from "jsdom";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="mount"></div></body></html>`);
for (const k of ["window", "document", "HTMLElement", "customElements",
                 "Node", "Element", "getComputedStyle"]) {
  try { if (dom.window[k] !== undefined && !(k in globalThis)) globalThis[k] = dom.window[k]; }
  catch { /* getter-only in some Node versions */ }
}
// A matchMedia that ANSWERS FOR A WIDTH, not yes to everything.
//
// This is not a detail. `nav` and `sideNav` are Switchers that mount one view
// per media query. A stub that matches every query mounts the DESKTOP bar at
// every width — so measuring the result in a 390px browser reported
// HORIZONTAL_OVERFLOW and three ELEMENT_OVERFLOWS_VIEWPORT findings that were
// entirely an artefact of the harness. Rendered at 390px with this, the mobile
// bar mounts and the page is clean. A false finding sends an agent off to fix
// something that was never broken, which is worse than missing a real one.
let currentWidth = 1280;
export const setViewportWidth = (w) => {
  currentWidth = w;
  try { Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true }); } catch {}
};
dom.window.matchMedia = (q) => {
  const min = /min-width:\s*(\d+)/.exec(String(q));
  const max = /max-width:\s*(\d+)/.exec(String(q));
  let m = true;
  if (min) m = m && currentWidth >= Number(min[1]);
  if (max) m = m && currentWidth <= Number(max[1]);
  return { matches: m, media: String(q), addListener() {}, removeListener() {},
           addEventListener() {}, removeEventListener() {} };
};
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

/**
 * @param brief    one entry from briefs.json
 * @param answer   { elements, nodes } as the solver produced them
 * @param opts     { quality: boolean } — quality needs a browser, so it is
 *                 opt-in; the other three gates run anywhere.
 */
/**
 * A multi-page brief carries `pages` instead of `must`/`forbid`, and its answer
 * carries `pages` instead of `elements`. Every page is scored on its own and
 * the brief passes only if all of them do — a site where three pages are right
 * and the fourth lost its nav is not a pass.
 */
export async function scoreBrief(brief, answer, opts = {}) {
  if (!brief.pages) return (answer && answer.jsx !== undefined)
    ? scoreJSX(brief, answer, opts)
    : score(brief, answer, opts);

  const parts = [];
  for (const page of brief.pages) {
    const one = answer?.pages?.[page.id];
    const scorer = (one && one.jsx !== undefined) ? scoreJSX : score;
    parts.push(await scorer(
      { ...page, id: `${brief.id}/${page.id}`, needsImageDescription: brief.needsImageDescription },
      // Shared definitions belong to the answer, not to the page: every page
      // of a site references the same ones, which is the whole point.
      { ...(one || { elements: [] }), defs: answer?.defs }, opts));
  }
  const every = (k) => parts.every((r) => r.gates[k]);
  const anyNull = parts.some((r) => r.gates.quality === null);
  return {
    id: brief.id,
    gates: {
      valid: every("valid"), renders: every("renders"), content: every("content"),
      quality: anyNull ? null : every("quality"),
    },
    pass: parts.every((r) => r.pass),
    notes: parts.flatMap((r) => r.notes.map((n) => `${r.id.split("/")[1]}: ${n}`)),
    pages: parts,
  };
}

/**
 * The React baseline runs through the same four gates. Each is translated
 * rather than approximated — see evals/render-jsx.mjs for what each one means
 * on that side and why.
 */
export async function scoreJSX(brief, answer, opts = {}) {
  const gates = { valid: false, renders: false, content: false, quality: null };
  const notes = [];
  const { parsesJSX, renderJSX, withTailwind } = await import("./render-jsx.mjs");
  const jsx = answer?.jsx ?? "";

  gates.valid = parsesJSX(jsx);
  if (!gates.valid) notes.push("JSX does not parse");

  let markup = "";
  try {
    markup = await renderJSX(jsx);
    gates.renders = markup.trim().length > 0;
    if (!gates.renders) notes.push("rendered nothing");
  } catch (e) { notes.push(`THREW: ${String(e.message).slice(0, 80)}`); }

  if (gates.renders) {
    const box = dom.window.document.createElement("div");
    box.innerHTML = markup;
    const hay = `${box.textContent || ""} ` +
      [...box.querySelectorAll("[href],[src]")]
        .map((n) => n.getAttribute("href") || n.getAttribute("src")).join(" ");
    const missing = (brief.must || []).filter((w) => !hay.includes(w));
    const leaked = (brief.forbid || []).filter((w) => hay.includes(w));
    if (missing.length) notes.push(`missing: ${missing.join(", ")}`);
    if (leaked.length) notes.push(`leaked: ${leaked.join(", ")}`);
    let described = true;
    if (brief.needsImageDescription) {
      const imgs = [...box.querySelectorAll("img, [role='img']")];
      described = imgs.length > 0 && imgs.every((n) =>
        (n.getAttribute("alt") || "").trim() || (n.getAttribute("aria-label") || "").trim());
      if (!described) notes.push("images carry no description");
    }
    gates.content = missing.length === 0 && leaked.length === 0 && described;
  }

  if (opts.quality && gates.renders) {
    const { checkPage } = await import(path.join(ROOT, "lib", "check-page.js"));
    // networkidle, because Tailwind arrives over the network and a page
    // measured before its stylesheet lands has no layout to fail.
    const r = await checkPage(withTailwind(markup), { waitUntil: "networkidle" });
    if (r.errors[0]?.code === "MISSING_PEER_DEPENDENCY") {
      gates.quality = null;
      notes.push("quality skipped: playwright not installed");
    } else {
      gates.quality = r.ok;
      if (!r.ok) notes.push(`quality: ${[...new Set(r.errors.map((e) => e.code))].join(", ")}`);
    }
  }

  return { id: brief.id, gates,
           pass: [gates.valid, gates.renders, gates.content].every(Boolean), notes };
}

export async function score(brief, answer, opts = {}) {
  const gates = { valid: false, renders: false, content: false, quality: null };
  const notes = [];

  const elements = answer?.elements ?? [];
  const nodes = answer?.nodes ?? [];

  // 1. valid
  const report = validateNodes(nodes, elements, answer?.defs);
  gates.valid = report.ok;
  if (!report.ok) notes.push(...report.errors.map((e) => `${e.code} at ${e.path}`));

  // 2. renders
  let html = "";
  try {
    const m = dom.window.document.querySelector("#mount");
    m.innerHTML = "";
    // Portalled panels outlive their owner, so clear anything a previous
    // brief left in the body or one page's options leak into the next one's
    // score.
    for (const n of [...dom.window.document.body.children]) if (n.id !== "mount") n.remove();
    const des = new Des();
    if (answer?.defs) des.defs(answer.defs);      // must precede add()
    des.nodes(nodes).add(elements).set({ mount: "#mount", code: false, elements: false });
    // The whole BODY, not just the mount. A dropdown portals its panel to
    // document.body — `position: fixed` with viewport coordinates, so it
    // escapes any `overflow: hidden` ancestor — which is a legitimate popover
    // pattern and not something the author did wrong. Scoring only the mount
    // reported those options as missing when a visitor can see them, i.e. the
    // harness was wrong about the page rather than the page being wrong.
    html = dom.window.document.body.innerHTML;
    gates.renders = html.trim().length > 0;
    if (!gates.renders) notes.push("rendered nothing");
  } catch (e) {
    notes.push(`THREW: ${e.message}`);
  }

  // 3. content — against the rendered page, never the spec
  if (gates.renders) {
    const box = dom.window.document.createElement("div");
    box.innerHTML = html;
    const text = box.textContent || "";
    const hrefs = [...box.querySelectorAll("[href],[src]")]
      .map((n) => n.getAttribute("href") || n.getAttribute("src")).join(" ");
    const hay = `${text} ${hrefs}`;

    const missing = (brief.must || []).filter((w) => !hay.includes(w));
    const leaked = (brief.forbid || []).filter((w) => hay.includes(w));
    if (missing.length) notes.push(`missing: ${missing.join(", ")}`);
    if (leaked.length) notes.push(`placeholder leaked: ${leaked.join(", ")}`);

    let described = true;
    if (brief.needsImageDescription) {
      const imgs = [...box.querySelectorAll("img, [role='img']")];
      described = imgs.length > 0 && imgs.every((n) =>
        (n.getAttribute("alt") || "").trim() || (n.getAttribute("aria-label") || "").trim());
      if (!described) notes.push("images carry no description");
    }
    gates.content = missing.length === 0 && leaked.length === 0 && described;
  }

  // 4. quality — real layout, so opt-in.
  //
  // Rendered once PER VIEWPORT and checked at that same width. A responsive
  // composite picks its view at render time, so checking one rendering at two
  // widths measures the wrong page at one of them.
  if (opts.quality && gates.renders) {
    const { checkPage, DEFAULT_VIEWPORTS } = await import(path.join(ROOT, "lib", "check-page.js"));
    const found = [];
    let skipped = false;
    for (const vp of DEFAULT_VIEWPORTS) {
      setViewportWidth(vp.width);
      let atWidth = "";
      try {
        const m = dom.window.document.querySelector("#mount");
        m.innerHTML = "";
        for (const n of [...dom.window.document.body.children]) if (n.id !== "mount") n.remove();
        const d = new Des();
        if (answer?.defs) d.defs(answer.defs);
        d.nodes(nodes).add(elements).set({ mount: "#mount", code: false, elements: false });
        atWidth = dom.window.document.body.innerHTML;
      } catch { continue; }
      const r = await checkPage(atWidth, { viewports: [vp] });
      if (r.errors[0]?.code === "MISSING_PEER_DEPENDENCY") { skipped = true; break; }
      found.push(...r.errors);
    }
    setViewportWidth(1280);
    if (skipped) {
      gates.quality = null;
      notes.push("quality skipped: playwright not installed");
    } else {
      gates.quality = found.length === 0;
      if (found.length) {
        notes.push(`quality: ${[...new Set(found.map((e) => e.code))].join(", ")}`);
      }
    }
  }

  const required = [gates.valid, gates.renders, gates.content];
  return {
    id: brief.id,
    gates,
    // A pass is all three hard gates. Quality is reported separately rather
    // than folded in: it is advisory on a first attempt and the interesting
    // number is how often it is clean, not a pass/fail hidden inside one.
    pass: required.every(Boolean),
    notes,
  };
}

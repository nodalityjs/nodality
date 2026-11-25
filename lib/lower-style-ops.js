/*!
 * nodality v1.5.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * lower-style-ops.js — the values of the `background` and `margin` design ops.
 *
 * Both ops reached the component and were applied by Animator.chainReact,
 * which read none of their values: `background` painted every target green
 * whatever colour the node named, and `margin`'s `margin` key was stored
 * (`useMargin`) and never read back. Only `margin.offsets` worked.
 *
 * A node that names a value is applied here instead, per element, when the
 * mapper builds it (ElementMapper.mapType):
 *
 *   { op: { name: "background", color: "#fde68a" }, target: ["hero"], range: [0, 700] }
 *   { op: { name: "background", gradient: "linear-gradient(#fff, #eee)" }, target: ["box"] }
 *   { op: { name: "margin", margin: "2rem 0" }, target: ["a", "b"] }
 *
 * Which node applies is chainReact's rule, kept: per element, the FIRST
 * background (margin) node whose target names it — or that has no target —
 * decides; `range` only gates it, read as chainReact reads it (parseInt of
 * each end, both inclusive, every width when absent). When that node is
 * applied here the mapper hands the component no `backgroundOp`/`marginOp`
 * (ElementMapper.filtero asks `isLowered`), so chainReact does not paint its
 * green over the colour.
 *
 * Why not `resprop`, like `arrange`? Two reasons found by rendering. resprop
 * takes ONE entry per width for all its keys, so a lowered entry and the
 * element's own entries (or a background and a margin node with different
 * ranges) silenced each other. And chainReact, when the element carries any
 * other design op, clears `background`/`margin` each time its own ranges
 * change; a resprop task registered before chainReact's listener ran first and
 * lost. The listener here is registered after set(), so it runs after
 * chainReact on every resize, and writes only when the value differs.
 *
 * Outside the range the element gets back the value it had when it was built
 * (its own `background`/`mar`, or nothing).
 *
 * A `background` node with neither value is not touched and still paints
 * green through chainReact.
 *
 * Round 3:
 *   - `margin` with only `offsets` is applied here too: the element with
 *     `index: i` takes offsets[i] px. chainReact applied them only where the
 *     component hands it a margin node and keeps `this.index` — an img, a
 *     text with a non-zero index — so the same node did nothing on a p
 *     (index 0) or a wrap.
 *   - an element without an id is reached by the untargeted nodes, as
 *     chainReact reached it (filtero withheld the node and nothing applied).
 *   - a nav's nodes go to its two bars (ElementMapper.navBars); chainReact
 *     never sees them, so there a valueless background paints green here.
 *   - what is applied here is applied after set(), so no option carries it;
 *     wrapCode puts it into the component's generated code as
 *     `ElementMapper.lowered(<source>, [{css, range}])`.
 */

import { unquoteKeys } from "./codegen.js";

const bare = (id) => String(id).replace(/^#/, "");

const filled = (v) => (typeof v === "string" && v.trim() !== "") || (typeof v === "number" && Number.isFinite(v));

/**
 * A margin node that only carries `offsets`: each element takes
 * offsets[its own `index` option]. chainReact applied these, but only on the
 * components that hand it a margin node AND set `this.index` (img; text only
 * for a non-zero index; never wrap), so the same node gave 17px on an img and
 * nothing on a p. They are applied here instead, for every element.
 */
const offsetsOnly = (op) => !filled(op.margin) && Array.isArray(op.offsets);

/**
 * The CSS a node of these ops writes, or null when the node is left to
 * chainReact. `el` (the element spec) is needed only for `offsets`, which
 * depend on the element's `index`; `opts.green` gives a background node with
 * no value chainReact's green (used for a nav, whose bars chainReact never
 * reaches).
 */
export function loweredStyle(node, el, opts = {}) {
    const op = node && node.op;
    if (!op || typeof op !== "object") return null;
    if (op.name === "background") {
        const css = {};
        if (filled(op.color)) css.backgroundColor = String(op.color);
        if (filled(op.gradient)) css.backgroundImage = String(op.gradient);
        if (!Object.keys(css).length && opts.green) css.backgroundColor = "green";
        return Object.keys(css).length ? css : null;
    }
    if (op.name === "margin") {
        if (filled(op.margin)) {
            // A bare number is px, as the offsets are.
            return { margin: typeof op.margin === "number" ? `${op.margin}px` : String(op.margin) };
        }
        if (offsetsOnly(op)) {
            const index = el && el.index;
            if (index === undefined || index === null || index === "") return null;
            const v = op.offsets[Number(index)];
            if (typeof v === "number" && Number.isFinite(v)) return { margin: `${v}px` };
            if (typeof v === "string" && v.trim() !== "") return { margin: /^-?\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}px` : v.trim() };
        }
        return null;
    }
    return null;
}

/**
 * Is this node applied here rather than by chainReact? Decided by the node
 * alone (the component must not get it either way), so an offsets node is
 * lowered even for an element without an `index` — which chainReact gave
 * nothing too.
 */
export function isLowered(node) {
    const op = node && node.op;
    if (!op || typeof op !== "object") return false;
    if (op.name === "margin" && offsetsOnly(op)) return true;
    return loweredStyle(node) !== null;
}

/** chainReact's reading of a range. */
function rangeOf(node) {
    const r = Array.isArray(node.range) && node.range.length === 2 ? node.range : null;
    if (!r) return [0, Infinity];
    const lo = parseInt(r[0], 10);
    const hi = parseInt(r[1], 10);
    return [Number.isFinite(lo) ? lo : 0, Number.isFinite(hi) ? hi : Infinity];
}

// A node without a target reaches every element, one with an id or not; a
// targeted node only an element whose id it names.
const reaches = (node, id) => !Array.isArray(node.target) || !node.target.length
    ? true
    : id != null && id !== "" && node.target.some((t) => bare(t) === bare(id));

/**
 * What applies to the element `id`: [{ node, range: [lo, hi], css }], at most
 * one per op, from the deciding (first) node — and only when that node is a
 * lowered one. `el` is the element spec (for margin `offsets`); `opts` as
 * for loweredStyle. An element without an id is reached by untargeted
 * nodes only.
 */
export function loweredFor(nodes, id, el, opts = {}) {
    if (!Array.isArray(nodes)) return [];
    const out = [];
    for (const name of ["background", "margin"]) {
        const index = nodes.findIndex((n) => n && n.op && typeof n.op === "object" && n.op.name === name && reaches(n, id));
        if (index < 0) continue;
        const css = loweredStyle(nodes[index], el, opts);
        if (css) out.push({ node: index, range: rangeOf(nodes[index]), css });
    }
    return out;
}

/**
 * The list in the form generated code carries: [{ css, range? }], a range
 * only when it is not "every width", and an open upper end as null (JSON has
 * no Infinity). ElementMapper.lowered reads it back.
 */
export function serialLowered(list) {
    return list.map(({ range, css }) => {
        const all = !range || (range[0] <= 0 && range[1] === Infinity);
        return all ? { css: { ...css } } : { css: { ...css }, range: [range[0], range[1] === Infinity ? null : range[1]] };
    });
}

/** serialLowered's form back to applyLowered's. */
export function parseLowered(list) {
    return (Array.isArray(list) ? list : [])
        .filter((e) => e && typeof e === "object" && e.css && typeof e.css === "object")
        .map((e) => {
            const r = Array.isArray(e.range) ? e.range : [0, null];
            const lo = Number(r[0]);
            const hi = r[1] === null || r[1] === undefined ? Infinity : Number(r[1]);
            return { css: e.css, range: [Number.isFinite(lo) ? lo : 0, Number.isNaN(hi) ? Infinity : hi] };
        });
}

/**
 * Apply `list` (from loweredFor) to a built component: now, and on every
 * resize through the component's own tracked listener, so destroy() releases
 * it. `width()` is the library's viewport width (Animator.viewportWidth).
 * Components without a `res` box or `_on` (Form, a Switcher before render)
 * are skipped. Returns true when something was attached.
 */
export function applyLowered(component, list, width) {
    if (!list.length || !component || typeof component._on !== "function") return false;
    const node = component.res;
    if (!node || !node.style || typeof window === "undefined") return false;
    const own = new Map();
    for (const { css } of list) for (const k of Object.keys(css)) if (!own.has(k)) own.set(k, node.style[k] || "");
    const run = () => {
        const w = Math.floor(width());
        const want = new Map(own);
        for (const { range, css } of list) {
            if (w >= range[0] && w <= range[1]) for (const [k, v] of Object.entries(css)) want.set(k, v);
        }
        for (const [k, v] of want) if (node.style[k] !== v) node.style[k] = v;
    };
    run();
    component._on(window, "resize", run);
    // Once more after the current task: a component that runs its design
    // ops at render rather than in set() would otherwise clear the first write.
    if (typeof setTimeout === "function") {
        const t = setTimeout(run, 0);
        if (typeof component._track === "function") component._track(() => clearTimeout(t));
    }
    return true;
}

/**
 * Make the component's generated code (toCode(): the code panel,
 * `nodality compile`) carry what was applied here, which happens after the
 * component's own set() and so is in none of its options: the source is
 * wrapped as `ElementMapper.lowered(<source>, [{css, range}])`, which applies
 * the same list to the instance the source builds and returns it, so
 * `.render(…)` still chains. Done on the instance, so a parent that asks its
 * children for their code (a wrap, a nav's Switcher) gets the wrapped form
 * too. An excluded component (empty source) stays empty.
 */
export function wrapCode(component, call, payload) {
    if (!component || typeof component.toCode !== "function") return;
    const orig = component.toCode;
    const arg = unquoteKeys(JSON.stringify(payload));
    const one = (s) => {
        if (typeof s !== "string" || !s.trim()) return s;
        const lead = s.match(/^\s*/)[0];
        return `${lead}${call}(${s.slice(lead.length).replace(/\s+$/, "")}, ${arg})`;
    };
    component.toCode = function (...args) {
        const out = orig.apply(this, args);
        if (Array.isArray(out)) return out.length && out.join("").trim() ? [one(out.join(""))] : out;
        return one(out);
    };
}

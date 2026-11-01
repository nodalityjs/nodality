/*! responsive — breakpoints solved from content, emitted as `arrange` nodes.
 *
 * A group (a `row`, a `cards` grid, a `nav`) has a wide arrangement and a
 * narrow one. The wide one fits at viewport width v exactly when
 *
 *     g(v) = need(v) - have(v) <= 0,
 *
 * where need(v) is the group's min-content width on one line and have(v) the
 * width its parent gives it, both measured by the browser. The breakpoints of
 * the group are the sign changes of g, and nothing else: one is emitted where
 * the arrangement has to change and none where it does not. Each interval on
 * which the wide arrangement does not fit becomes one `arrange` node scoped by
 * the group's id and that interval.
 *
 * Pure apart from respond(), which drives a Playwright page the caller owns —
 * this module never imports a browser. No randomness, no clock; everything
 * runs in declaration order, so the same page always yields the same nodes.
 */

export const ARRANGE = "arrange";
export const MAX_WIDTH = 99999;
export const DEFAULT_SAMPLE_WIDTHS = [320, 480, 768, 1024, 1280, 1600, 1920];
// Widths at which the library's own components change style by themselves
// (the (max-device-width: 415px) rules of rows, buttons and inputs). A group's
// fit can jump there, so both sides are always sampled.
export const LIBRARY_WIDTHS = [415, 416];

const bare = (id) => (typeof id === "string" && id.charAt(0) === "#" ? id.slice(1) : id == null ? id : String(id));

const RESPONSIVE_KEYS = {
    row: ["colat", "column", "resprop", "toColumn"],
    cards: ["colat", "column", "resprop"],
    nav: ["breakpoint"],
};

function groupKind(el) {
    if (el.type === "row") return "row";
    if (el.type === "cards") return "cards";
    if (el.type === "nav") return "nav";
    return null;
}

function memberCount(el, kind) {
    if (kind === "row") return Array.isArray(el.children) ? el.children.length : 0;
    return Array.isArray(el.items) ? el.items.length : 0;
}

/**
 * Every group on the page, in document order. `authored` is true when the
 * author already wrote responsive behaviour for it; such a group is left alone.
 */
export function findGroups(elements) {
    const out = [];
    const walk = (list, path, depth, parent) => {
        if (!Array.isArray(list)) return;
        list.forEach((el, i) => {
            if (!el || typeof el !== "object") return;
            const at = `${path}[${i}]`;
            const kind = groupKind(el);
            let inner = parent;
            let innerDepth = depth;
            if (kind) {
                const id = el.id == null || el.id === "" ? null : bare(String(el.id));
                out.push({
                    id,
                    kind,
                    path: at,
                    depth,
                    parent,
                    members: memberCount(el, kind),
                    authored: RESPONSIVE_KEYS[kind].some((k) => el[k] !== undefined),
                });
                inner = id;
                innerDepth = depth + 1;
            }
            walk(el.children, `${at}.children`, innerDepth, inner);
        });
    };
    walk(elements, "elements", 0, null);
    return out;
}

/** The groups a synthesis pass can act on: unauthored, with two or more members. */
export function eligibleGroups(elements) {
    return findGroups(elements).filter((g) => !g.authored && g.members >= 2);
}

function collectIds(elements) {
    const ids = new Set();
    const walk = (list) => {
        if (!Array.isArray(list)) return;
        for (const el of list) {
            if (!el || typeof el !== "object") continue;
            if (el.id != null && el.id !== "") ids.add(bare(String(el.id)));
            walk(el.children);
        }
    };
    walk(elements);
    return ids;
}

/**
 * A copy of `elements` in which every group without an id gets one, so that a
 * node can target it. Ids are `prefix` plus the group's document-order index;
 * a clash with an existing id appends a letter. Untouched elements are shared.
 */
export function ensureIds(elements, prefix = "nod-g") {
    const taken = collectIds(elements);
    let index = 0;
    const fresh = (n) => {
        let base = `${prefix}${n}`;
        let id = base;
        let k = 0;
        while (taken.has(id)) id = `${base}${String.fromCharCode(97 + (k++ % 26))}${k > 26 ? k : ""}`;
        taken.add(id);
        return id;
    };
    const walk = (list) => {
        if (!Array.isArray(list)) return list;
        let changed = false;
        const next = list.map((el) => {
            if (!el || typeof el !== "object") return el;
            let out = el;
            if (groupKind(el)) {
                const n = index++;
                if (el.id == null || el.id === "") out = { ...out, id: fresh(n) };
            }
            const kids = walk(el.children);
            if (kids !== el.children) out = { ...(out === el ? el : out), children: kids };
            if (out !== el) changed = true;
            return out;
        });
        return changed ? next : list;
    };
    return walk(elements);
}

/* ---------- solving g(v) = 0 ---------- */

/** Where the line through two samples crosses zero, or null if it is flat. */
export function affineRoot(a, b) {
    const dv = b.v - a.v;
    const dg = b.g - a.g;
    if (dv === 0 || dg === 0) return null;
    return a.v - (a.g * dv) / dg;
}

/** Least-squares line through samples {v, y}: slope, intercept, worst residual. */
export function fitAffine(samples, key = "y") {
    const n = samples.length;
    if (n < 2) return null;
    let sv = 0, sy = 0, svv = 0, svy = 0;
    for (const s of samples) { sv += s.v; sy += s[key]; svv += s.v * s.v; svy += s.v * s[key]; }
    const den = n * svv - sv * sv;
    if (den === 0) return null;
    const slope = (n * svy - sv * sy) / den;
    const intercept = (sy - slope * sv) / n;
    let residual = 0;
    for (const s of samples) residual = Math.max(residual, Math.abs(s[key] - (intercept + slope * s.v)));
    return { slope, intercept, residual };
}

const fitsBy = (key) => (s) => !(typeof s[key] === "number") || s[key] <= 0;

/**
 * Adjacent sample pairs between which an arrangement starts or stops fitting.
 * `key` is "g" for the wide arrangement and "gn" for the narrow one.
 */
export function brackets(samples, key = "g") {
    const fits = fitsBy(key);
    const sorted = [...samples].filter((s) => typeof s[key] === "number").sort((a, b) => a.v - b.v);
    const out = [];
    for (let i = 0; i + 1 < sorted.length; i++) {
        if (fits(sorted[i]) !== fits(sorted[i + 1])) {
            const lo = sorted[i], hi = sorted[i + 1];
            out.push([{ ...lo, g: lo[key] }, { ...hi, g: hi[key] }]);
        }
    }
    return out;
}

/**
 * The next integer width to measure inside a bracket. For the first probes it
 * is the affine root, rounded and nudged one pixel inside when it lands on an
 * end: where sizes are affine in the width that pins the threshold to the
 * pixel in two probes. After `affineTries` probes it bisects, which bounds the
 * cost where they are not (a capped container, a scrollbar appearing).
 * Returns null once the bracket is one pixel wide, the resolution of a viewport.
 */
export function nextProbe(lo, hi, tries = 0, affineTries = 3) {
    if (hi.v - lo.v <= 1) return null;
    const mid = Math.floor((lo.v + hi.v) / 2);
    if (tries >= affineTries) return mid;
    const r = affineRoot(lo, hi);
    if (r == null || !Number.isFinite(r)) return mid;
    let v = Math.round(r);
    if (v <= lo.v) v = lo.v + 1;
    if (v >= hi.v) v = hi.v - 1;
    return v;
}

/**
 * The integer viewport intervals on which the wide arrangement does not fit,
 * from samples refined to one-pixel brackets. Below the narrowest sample and
 * above the widest, the nearest sample's state is assumed to hold.
 */
export function narrowIntervals(samples, key = "g") {
    const fits = fitsBy(key);
    const s = [...samples].filter((x) => typeof x[key] === "number").sort((a, b) => a.v - b.v);
    if (!s.length) return [];
    const out = [];
    let start = fits(s[0]) ? null : 0;
    for (let i = 0; i + 1 < s.length; i++) {
        const a = s[i];
        const b = s[i + 1];
        if (fits(a) === fits(b)) continue;
        // A bracket still wider than one pixel (the probe cap stopped it) is
        // unresolved; its widths go to the narrow side, which overflows less.
        if (!fits(a)) { out.push([start, b.v - 1]); start = null; }
        else start = a.v + 1;
    }
    if (start !== null) out.push([start, MAX_WIDTH]);
    return out;
}

/**
 * Translate a measured interval into the width the runtime compares against.
 * Measurements are taken at integer `innerWidth`; `resprop` compares
 * `visualViewport.width`, which is narrower by the scrollbar. Each end is
 * mapped through the sample at that width, so the narrow arrangement covers
 * every non-fitting width and none of the fitting ones.
 */
export function toRuntimeRange(interval, samples, unit) {
    if (unit === "innerWidth") return interval;
    const at = new Map(samples.map((s) => [s.v, s]));
    const map = (v, edge) => {
        if (v === 0 || v === MAX_WIDTH) return v;
        const s = at.get(v);
        if (!s || typeof s.vv !== "number") return v;
        return edge === "lo" ? Math.floor(s.vv) : Math.ceil(s.vv);
    };
    return [map(interval[0], "lo"), map(interval[1], "hi")];
}

/**
 * Split [0, MAX_WIDTH] into the narrow intervals given and the wide ones
 * between them, in ascending order: every width belongs to exactly one.
 */
export function partition(narrow) {
    const out = [];
    let next = 0;
    for (const [lo, hi] of [...narrow].sort((a, b) => a[0] - b[0])) {
        if (lo > next) out.push({ narrow: false, range: [next, lo - 1] });
        out.push({ narrow: true, range: [lo, hi] });
        next = hi + 1;
    }
    if (next <= MAX_WIDTH) out.push({ narrow: false, range: [next, MAX_WIDTH] });
    return out;
}

/**
 * The nodes for solved groups, in document order and, within a group, from
 * narrow viewports to wide. `solved` maps a group id to its narrow intervals.
 * A group gets one node per interval of its partition, wide ones included, so
 * its arrangement is stated at every width and no library default (the 700px
 * cards switch, the 1200px nav breakpoint) is left to decide any of them.
 */
export function navHull(ranges) {
    if (!ranges.length) return ranges;
    if (ranges.length === 1 && ranges[0][0] === 0) return ranges;
    return [[0, Math.max(...ranges.map((r) => r[1]))]];
}

export function synthesize(groups, solved) {
    const nodes = [];
    for (const g of groups) {
        let ranges = solved.get ? solved.get(g.id) : solved[g.id];
        if (!g.id || !Array.isArray(ranges)) continue;
        // A nav can only collapse below one width. If its bar does not fit on
        // some interval that starts above zero, it collapses from zero up to
        // the end of the last such interval: never overflowing, at the cost of
        // collapsing early in between (respond() reports it as widened).
        if (g.kind === "nav") ranges = navHull(ranges);
        for (const part of partition(ranges)) {
            const mode = g.kind === "nav" ? (part.narrow ? "collapse" : "expand") : (part.narrow ? "column" : "row");
            nodes.push({ op: { name: ARRANGE, mode }, target: [g.id], range: part.range });
        }
    }
    return nodes;
}

/* ---------- lowering `arrange` onto the runtime ---------- */

const toInt = (x) => (typeof x === "number" ? Math.round(x) : parseInt(x, 10));

function parseRange(range) {
    if (!Array.isArray(range) || range.length !== 2) return null;
    const lo = toInt(range[0]);
    const hi = toInt(range[1]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi < lo) return null;
    return [lo, hi];
}

const overlaps = (a, b) => a[0] <= b[1] && b[0] <= a[1];

/**
 * Lower every `arrange` node onto the element it targets, returning a new
 * element array; the caller's arrays are never written. A `row` or `cards`
 * group gets one `resprop` entry per range (and `cards` loses its built-in
 * 700px column switch, which would otherwise write the same property); a
 * `nav` gets its `breakpoint`. Of two nodes whose ranges overlap on one
 * element, the first declared is kept and the later one reported.
 */
export function lowerArrange(elements, nodes) {
    const applied = [];
    const skipped = [];
    const plan = new Map();
    (Array.isArray(nodes) ? nodes : []).forEach((node, i) => {
        if (!node || !node.op || typeof node.op !== "object" || node.op.name !== ARRANGE) return;
        const range = parseRange(node.range);
        const targets = Array.isArray(node.target) ? node.target : [];
        if (!range || !targets.length) { skipped.push({ node: i, reason: "needs target and range [lo, hi]" }); return; }
        for (const t of targets) {
            const id = bare(String(t));
            const list = plan.get(id) || [];
            const clash = list.find((p) => overlaps(p.range, range));
            if (clash) { skipped.push({ node: i, target: id, reason: `overlaps node ${clash.node}` }); continue; }
            list.push({ node: i, mode: node.op.mode || "column", range });
            plan.set(id, list);
        }
    });
    if (!plan.size) return { elements, applied, skipped };

    const lowerOne = (el) => {
        const id = el.id == null ? null : bare(String(el.id));
        const list = id && plan.get(id);
        if (!list) return el;
        const kind = groupKind(el);
        const sorted = list.slice().sort((a, b) => a.range[0] - b.range[0]);
        if ((kind === "row" || kind === "cards") && list.every((p) => p.mode === "column" || p.mode === "row")) {
            const entries = sorted.map((p) => {
                const e = { breakpoint: [p.range[0], p.range[1]], flexDirection: p.mode };
                if (kind === "cards" && p.mode === "column") e.alignItems = "center";
                return e;
            });
            list.forEach((p) => applied.push({ node: p.node, target: id, via: "resprop" }));
            const out = { ...el, resprop: [...(Array.isArray(el.resprop) ? el.resprop.map((e) => ({ ...e })) : []), ...entries] };
            if (kind === "cards") out.colat = false;
            return out;
        }
        if (kind === "nav" && list.every((p) => p.mode === "collapse" || p.mode === "expand")) {
            // A nav has one switch: collapsed on [0, b-1], expanded from b up.
            // The nodes must say exactly that, in at most two pieces.
            const collapsed = sorted.filter((p) => p.mode === "collapse");
            const expanded = sorted.filter((p) => p.mode === "expand");
            let at = null;
            if (!collapsed.length && expanded.length === 1 && expanded[0].range[0] === 0) at = 0;
            else if (collapsed.length === 1 && collapsed[0].range[0] === 0) {
                const hi = collapsed[0].range[1];
                if (!expanded.length) at = hi >= MAX_WIDTH ? MAX_WIDTH : hi + 1;
                else if (expanded.length === 1 && expanded[0].range[0] === hi + 1) at = hi + 1;
            }
            if (at !== null) {
                list.forEach((p) => applied.push({ node: p.node, target: id, via: "breakpoint" }));
                return { ...el, breakpoint: `${at}px` };
            }
            list.forEach((p) => skipped.push({ node: p.node, target: id, reason: "a nav collapses below one width and expands above it; these ranges say otherwise" }));
            return el;
        }
        list.forEach((p) => skipped.push({ node: p.node, target: id, reason: `mode "${p.mode}" does not apply to ${el.type}` }));
        return el;
    };

    const walk = (list) => {
        if (!Array.isArray(list)) return list;
        let changed = false;
        const next = list.map((el) => {
            if (!el || typeof el !== "object") return el;
            let out = lowerOne(el);
            const kids = walk(el.children);
            if (kids !== el.children) out = { ...(out === el ? el : out), children: kids };
            if (out !== el) changed = true;
            return out;
        });
        return changed ? next : list;
    };
    return { elements: walk(elements), applied, skipped };
}

/* ---------- measuring in a real browser ---------- */

/**
 * Evaluated inside the page. For each group: the width it has, the width its
 * members need on one line (min-content of a nowrap flex container is the sum
 * of its items' min-content contributions), and both viewport widths. A `cards`
 * grid is measured with its first two cards, the narrowest wide arrangement.
 */
export const PROBE = (arg) => {
    const groups = Array.isArray(arg) ? arg : arg.groups;
    const fit = (!Array.isArray(arg) && arg.fit) || "min-content";
    const iw = window.innerWidth;
    const vv = window.visualViewport ? window.visualViewport.width : iw;
    return groups.map((g) => {
        let el = document.getElementById(g.id);
        if (!el) return { id: g.id, missing: true, iw, vv };
        if (g.kind === "nav") {
            const view = el.firstElementChild;
            if (!view) return { id: g.id, missing: true, iw, vv };
            el = view;
        }
        // The width the group is given. A flex row parent allocates it, so
        // the group's own box is right; any other parent (a block, a column,
        // a centred column) offers its content width, and a group whose box
        // has grown past that to fit its own content does not fit.
        const box = el.getBoundingClientRect().width;
        let have = box;
        const parent = el.parentElement;
        if (parent) {
            const ps = getComputedStyle(parent);
            const rowParent = ps.display.includes("flex") && ps.flexDirection.startsWith("row");
            if (!rowParent) {
                const offered = parent.clientWidth - (parseFloat(ps.paddingLeft) || 0) - (parseFloat(ps.paddingRight) || 0);
                if (offered > 0) have = Math.min(box, offered);
            }
        }
        have = Math.min(have, document.documentElement.clientWidth);
        const saved = el.getAttribute("style");
        const hidden = [];
        if (g.kind === "cards") {
            [...el.children].slice(2).forEach((c) => { hidden.push([c, c.style.display]); c.style.display = "none"; });
        }
        el.style.flexDirection = "row";
        el.style.flexWrap = "nowrap";
        // min-content: the row fits while nothing overflows (members may wrap
        // their text). max-content: it fits only while no member has to wrap.
        el.style.width = fit === "max-content" ? "max-content" : "min-content";
        el.style.maxWidth = "none";
        el.style.minWidth = "0";
        const need = el.getBoundingClientRect().width;
        // The narrow arrangement's own need: its widest member. Where even
        // that exceeds what the group has, no arrangement in the family fits.
        let needNarrow = null;
        if (g.kind !== "nav") {
            el.style.flexDirection = "column";
            el.style.width = "min-content";
            needNarrow = el.getBoundingClientRect().width;
        }
        if (saved == null) el.removeAttribute("style"); else el.setAttribute("style", saved);
        hidden.forEach(([c, d]) => { c.style.display = d; });
        return { id: g.id, have, need, needNarrow, iw, vv };
    });
};

/** A page that renders whatever spec it is handed, for respond() to drive. */
export function harnessHTML(designerURL) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1"></head>` +
        `<body><div id="mount"></div><script type="module">` +
        `import { Des } from ${JSON.stringify(designerURL)};` +
        `window.__nodalityRender = (spec) => { const m = document.querySelector("#mount"); m.innerHTML = "";` +
        `const d = new Des(); if (spec.defs) d.defs(spec.defs);` +
        `d.nodes(spec.nodes || []).add(spec.elements || []).set({ mount: "#mount", code: false, elements: false }); };` +
        `window.__nodalityReady = true;</script></body></html>`;
}

/**
 * Measure, solve and emit. `renderAt(width, spec)` must leave the page showing
 * `spec` freshly rendered at viewport `width`; respond() calls it for every
 * measurement, so no listener or state carries over between widths.
 *
 * Groups are solved by depth, top-down first: a nested group is measured with
 * the nodes already chosen for its ancestors in force, because its available
 * width is whatever their arrangement leaves it. A parent's need in turn can
 * depend on its children's arrangement, so pages with nested groups are solved
 * again, every level with all other groups' nodes in force, until no interval
 * changes (`passes`, `converged` in the result).
 */
export async function respond(page, spec, renderAt, opts = {}) {
    const widths = (opts.widths || DEFAULT_SAMPLE_WIDTHS).slice().sort((a, b) => a - b);
    const maxProbes = opts.maxProbes || 24;
    const elements = ensureIds(spec.elements || []);
    const userNodes = Array.isArray(spec.nodes) ? spec.nodes : [];
    const groups = eligibleGroups(elements);
    const maxPasses = opts.maxPasses || 4;
    let measurements = 0;

    // Solve one depth level, with `others` (the current nodes of every group
    // not in the level) in force. Returns each group's narrow intervals and
    // report entry.
    // The sample widths for a level: the grid, the library's own style
    // widths, and both sides of every switch of the other groups. A group's
    // fit can jump where a neighbour switches (a nested row that stacks makes
    // its parent need less); sampling there puts every such jump on a sample
    // width, where bracketing resolves it instead of missing two changes in
    // one cell.
    const lo = widths[0], hi = widths[widths.length - 1];
    const levelWidths = (others) => {
        const ws = new Set([...widths, ...(opts.libraryWidths || LIBRARY_WIDTHS).filter((w) => w > lo && w < hi)]);
        for (const n of others) {
            for (const b of [n.range[0], n.range[1] + 1]) {
                for (const w of [b - 1, b]) if (w > lo && w < hi) ws.add(w);
            }
        }
        return [...ws].sort((a, b) => a - b);
    };

    const solveLevel = async (level, others) => {
        const grid = levelWidths(others);
        // A nav is measured showing its desktop bar, whatever the width.
        const measureSpec = {
            ...spec,
            elements: lowerArrange(forceDesktop(elements, level), others).elements,
            nodes: userNodes,
        };
        const samples = new Map(level.map((g) => [g.id, []]));
        const measureAt = async (width, only) => {
            await renderAt(width, measureSpec);
            measurements++;
            const found = await page.evaluate(PROBE, {
                groups: only.map((g) => ({ id: g.id, kind: g.kind })),
                fit: opts.fit || "min-content",
            });
            for (const f of found) {
                if (f.missing) continue;
                samples.get(f.id).push({
                    v: width, g: f.need - f.have, need: f.need, have: f.have, vv: f.vv, iw: f.iw,
                    ...(typeof f.needNarrow === "number" ? { gn: f.needNarrow - f.have, needNarrow: f.needNarrow } : {}),
                });
            }
        };
        for (const w of grid) await measureAt(w, level);
        const solved = new Map();
        const reports = new Map();
        for (const g of level) {
            const s = samples.get(g.id);
            // Probes are counted per root: per arrangement (g or gn) and per
            // cell of the sample grid the root lies in, so one root's cost
            // never depends on how many others the group has.
            const cell = (v) => grid.filter((w) => w <= v).length;
            // The wide arrangement's fit (g) and the narrow one's (gn) each
            // have their own budget, so infeasible widths never use up the
            // probes that decide the nodes.
            const tries = new Map();
            const spent = { g: 0, gn: 0 };
            let probes = 0;
            for (;;) {
                const open = [];
                for (const key of ["g", "gn"]) {
                    if (spent[key] >= maxProbes) continue;
                    for (const [lo, hi] of brackets(s, key)) {
                        const k = `${key}:${cell(lo.v)}`;
                        const v = nextProbe(lo, hi, tries.get(k) || 0);
                        if (v === null) continue;
                        tries.set(k, (tries.get(k) || 0) + 1);
                        open.push([key, v]);
                    }
                }
                if (!open.length) break;
                const widthsNow = [...new Set(open.map(([, v]) => v))];
                for (const [key] of open) spent[key]++;
                for (const v of widthsNow) { await measureAt(v, [g]); probes++; }
            }
            const unit = g.kind === "nav" ? "innerWidth" : "visualViewport";
            const intervals = narrowIntervals(s).map((iv) => toRuntimeRange(iv, s, unit));
            solved.set(g.id, intervals);
            const sorted = [...s].sort((a, b) => a.v - b.v);
            reports.set(g.id, {
                id: g.id, kind: g.kind, depth: g.depth, parent: g.parent, grid,
                widened: g.kind === "nav" && JSON.stringify(navHull(intervals)) !== JSON.stringify(intervals),
                samples: sorted, probes, intervals,
                // Widths (innerWidth) where even the narrow arrangement does not
                // fit: a member wider than the group. No arrangement fixes it.
                infeasible: narrowIntervals(s, "gn"),
                roots: brackets(sorted).map(([lo, hi]) => [lo.v, hi.v]),
                need: fitAffine(sorted.filter((x) => x.v >= 320), "need"),
                have: fitAffine(sorted.filter((x) => x.v >= 320), "have"),
            });
        }
        return { solved, reports };
    };

    // The first pass is top-down: each level is measured with its ancestors'
    // nodes in force and its descendants in their defaults. A parent's need
    // can depend on how its children are arranged, so on a page with nested
    // groups every level is then solved again with all other groups' current
    // nodes in force, until a pass changes no interval (at most maxPasses).
    const depths = [...new Set(groups.map((g) => g.depth))].sort((a, b) => a - b);
    const intervalsById = new Map();
    const reportById = new Map();
    const others = (level) => synthesize(groups.filter((g) => !level.includes(g) && intervalsById.has(g.id)), intervalsById);
    let passes = 0;
    let converged = depths.length < 2;
    for (let pass = 0; pass < maxPasses; pass++) {
        passes++;
        let changed = false;
        for (const depth of depths) {
            const level = groups.filter((g) => g.depth === depth);
            const { solved, reports } = await solveLevel(level, others(level));
            for (const g of level) {
                const next = solved.get(g.id);
                if (pass > 0 && JSON.stringify(intervalsById.get(g.id)) !== JSON.stringify(next)) changed = true;
                intervalsById.set(g.id, next);
                reportById.set(g.id, { ...reports.get(g.id), pass });
            }
        }
        if (depths.length < 2) break;
        if (pass > 0 && !changed) { converged = true; break; }
    }
    const synthesized = synthesize(groups, intervalsById);
    const report = groups.map((g) => reportById.get(g.id)).filter(Boolean);

    return {
        elements,
        nodes: [...userNodes, ...synthesized],
        synthesized,
        report,
        measurements,
        passes,
        converged,
        skipped: findGroups(elements).filter((g) => g.authored || g.members < 2).map((g) => ({ id: g.id, kind: g.kind, reason: g.authored ? "authored" : "fewer than two members" })),
    };
}

function forceDesktop(elements, level) {
    const navIds = new Set(level.filter((g) => g.kind === "nav").map((g) => g.id));
    if (!navIds.size) return elements;
    const walk = (list) => {
        if (!Array.isArray(list)) return list;
        let changed = false;
        const next = list.map((el) => {
            if (!el || typeof el !== "object") return el;
            let out = el.type === "nav" && navIds.has(el.id == null ? null : bare(String(el.id))) ? { ...el, breakpoint: "0px" } : el;
            const kids = walk(el.children);
            if (kids !== el.children) out = { ...out, children: kids };
            if (out !== el) changed = true;
            return out;
        });
        return changed ? next : list;
    };
    return walk(elements);
}

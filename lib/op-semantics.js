/*!
 * nodality v1.5.2
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * op-semantics.js: how the nodes of each op combine, declared as data.
 *
 * Read from the renderer, not designed. Each entry records what the code does
 * today; __tests__/unit/op-semantics.test.mjs checks the lookups behind it.
 * The validator uses it to report nodes that can never apply, and
 * describeOps() hands it to agents.
 *
 *   combine
 *     first     the first node with this op that reaches an element applies;
 *               later ones are ignored (ElementMapper.filtero, Array.find)
 *     sequence  every node applies, in array order. link-style: later values
 *               overwrite earlier ones. Raster ops: chained within their stage,
 *               and stages always run field, warp, cell, displace, color, so
 *               order only matters between ops of one stage.
 *     inert     accepted by the validator, read by no renderer code
 *
 *   scope (what "reaches" means)
 *     element   per target element; a node without `target` reaches every one
 *     range     per element and overlapping viewport range (arrange)
 *     page      one decision per page; `target` is not consulted
 *
 *   slot        ops that share one decision (layout and slayout)
 *
 * Pure module: no DOM at import.
 */
import { RASTER_OP_NAMES } from "./raster-ops.js";

const MAX_WIDTH = 99999;

const DESIGN_SEMANTICS = {
    animation: { combine: "first", scope: "element" },
    arrange: { combine: "first", scope: "range" },
    background: { combine: "first", scope: "element" },
    blast: { combine: "first", scope: "element" },
    "card-style": { combine: "first", scope: "page" },
    filter: { combine: "first", scope: "element" },
    gradient: { combine: "first", scope: "element" },
    layout: { combine: "first", scope: "page", slot: "layout" },
    slayout: { combine: "first", scope: "page", slot: "layout" },
    // LinkStyler.style applies every matching node in order and only
    // compares an element against target[0].
    "link-style": { combine: "sequence", scope: "element", firstTargetOnly: true },
    margin: { combine: "first", scope: "element" },
    navStyle: { combine: "inert", scope: "element" },
    shadow: { combine: "first", scope: "element" },
    span: { combine: "first", scope: "element" },
    transform: { combine: "first", scope: "element" },
};

export const OP_SEMANTICS = Object.freeze({
    ...DESIGN_SEMANTICS,
    ...Object.fromEntries(RASTER_OP_NAMES.map((name) =>
        [name, { combine: "sequence", scope: "element", byStage: true }])),
    morph: { combine: "sequence", scope: "page" },
    "agent-surface": { combine: "first", scope: "page" },
});

/** The op name a node carries, whichever form it is written in. */
export function opName(node) {
    if (!node || typeof node !== "object") return null;
    if (typeof node.op === "string") return node.op;
    if (node.op && typeof node.op === "object" && typeof node.op.name === "string") return node.op.name;
    return null;
}

const bare = (id) => String(id).replace(/^#/, "");

function rangeOf(node) {
    const r = Array.isArray(node.range) && node.range.length === 2 ? node.range : [0, MAX_WIDTH];
    const lo = Number(r[0]);
    const hi = Number(r[1]);
    return [Number.isFinite(lo) ? lo : 0, Number.isFinite(hi) ? hi : MAX_WIDTH];
}

/**
 * Nodes that lose to an earlier node under the declared rules, and nodes of
 * inert ops. Each finding: { index, code, by, lost, detail }.
 *   SHADOWED_NODE  `lost` lists the targets (or "page") the node loses on;
 *                  `by` the indices of the nodes that win there; `whole` is
 *                  true when the node applies nowhere.
 *   INERT_OP       no renderer code reads this op.
 */
export function shadowedNodes(nodes) {
    const out = [];
    if (!Array.isArray(nodes)) return out;
    const seenPage = new Map();       // slot -> first index
    const seenAll = new Map();        // slot -> first untargeted index
    const seenEl = new Map();         // `${slot}|${id}` -> first index
    const seenRange = new Map();      // `${slot}|${id}` -> [{ index, lo, hi }]

    nodes.forEach((node, index) => {
        const name = opName(node);
        const sem = name && OP_SEMANTICS[name];
        if (!sem) return;
        if (sem.combine === "inert") {
            out.push({ index, code: "INERT_OP", by: [], lost: [], whole: true,
                detail: `No renderer code reads "${name}"; this node does nothing.` });
            return;
        }
        if (sem.combine !== "first") return;
        const slot = sem.slot || name;

        if (sem.scope === "page") {
            if (seenPage.has(slot)) {
                const by = seenPage.get(slot);
                out.push({ index, code: "SHADOWED_NODE", by: [by], lost: ["page"], whole: true,
                    detail: `Node ${by} already decides "${slot}" for the page; this node does nothing.` });
            } else {
                seenPage.set(slot, index);
            }
            return;
        }

        const targets = Array.isArray(node.target) && node.target.length ? node.target.map(bare) : null;

        if (sem.scope === "range") {
            if (!targets) return;
            const [lo, hi] = rangeOf(node);
            const lost = [];
            const by = new Set();
            for (const id of targets) {
                const key = `${slot}|${id}`;
                const earlier = seenRange.get(key) || [];
                const hits = earlier.filter((e) => e.lo <= hi && lo <= e.hi);
                if (hits.length) {
                    lost.push(id);
                    hits.forEach((h) => by.add(h.index));
                }
                seenRange.set(key, [...earlier, { index, lo, hi }]);
            }
            if (lost.length) {
                out.push({ index, code: "SHADOWED_NODE", by: [...by], lost, whole: false,
                    detail: `On ${lost.join(", ")}, an earlier "${slot}" node covers part of [${lo}, ${hi}]; there the earlier node wins.` });
            }
            return;
        }

        // scope "element"
        if (seenAll.has(slot)) {
            const by = seenAll.get(slot);
            out.push({ index, code: "SHADOWED_NODE", by: [by], lost: targets || ["all"], whole: true,
                detail: `Node ${by} has no target, so it reaches every element first; this node does nothing.` });
            return;
        }
        if (!targets) {
            const earlier = [...seenEl.entries()].filter(([k]) => k.startsWith(`${slot}|`));
            if (earlier.length) {
                out.push({ index, code: "SHADOWED_NODE", by: [...new Set(earlier.map(([, i]) => i))],
                    lost: earlier.map(([k]) => k.slice(slot.length + 1)), whole: false,
                    detail: `On ${earlier.map(([k]) => k.slice(slot.length + 1)).join(", ")}, an earlier "${slot}" node wins; this node applies to every other element.` });
            }
            seenAll.set(slot, index);
            return;
        }
        const lost = [];
        const by = new Set();
        for (const id of targets) {
            const key = `${slot}|${id}`;
            if (seenEl.has(key)) { lost.push(id); by.add(seenEl.get(key)); }
            else seenEl.set(key, index);
        }
        if (lost.length) {
            const whole = lost.length === targets.length;
            out.push({ index, code: "SHADOWED_NODE", by: [...by], lost, whole,
                detail: whole
                    ? `An earlier "${slot}" node already applies to ${lost.join(", ")}; this node does nothing.`
                    : `On ${lost.join(", ")}, an earlier "${slot}" node wins; this node still applies to the rest.` });
        }
    });
    return out;
}

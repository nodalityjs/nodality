/*!
 * nodality v1.1.10
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * validate-nodes.js — check an `N` array before it is applied.
 *
 * The library already validates an op DEFINITION when it is registered
 * (`validateRasterOp`), which catches a bad op author. Nothing checked a
 * node INSTANCE — the thing a page, or an agent, actually writes. A
 * misspelled op name, a parameter that belongs to a different op, a
 * driver that does not exist: all of these were silent, and a silent
 * no-op is the worst possible failure for a generator that cannot see
 * the screen.
 *
 * The report shape is deliberately identical to the one `layout/morph.js`
 * `validate()` returns — `{ ok, errors: [{ code, path, got, suggestions,
 * valid }] }` — so that a consumer, human or agent, learns one shape and
 * reads every diagnostic this library produces with it.
 *
 * Suggestions are the point. An agent that writes "dithr" should be told
 * "dither" and repair itself in one turn, rather than receiving nothing
 * and concluding the effect simply does not work.
 */

import {
    REGISTRY, RASTER_OP_NAMES, DRIVER_NAMES, RASTER_UNITS,
    FRAMEWORK_DOC, EASING_NAMES,
} from "./raster-ops.js";
import { didYouMean, suggest } from "./suggest.js";

/**
 * Every key a morph node reads. Anything else on the node is ignored by
 * the runtime, which is why it has to be reported here.
 */
const MORPH_FIELDS = [
    "op", "target", "from", "to",
    "effect", "duration", "back", "live", "fade",
];

/** Node families, told apart exactly the way the runtime tells them apart. */
const familyOf = (node) => {
    if (!node || typeof node !== "object") return "invalid";
    const op = node.op;
    if (typeof op === "string") return op === "morph" ? "morph" : "raster";
    if (op && typeof op === "object" && typeof op.name === "string") return "design";
    return "invalid";
};

/**
 * Check an array of nodes against the registry.
 *
 * @param {Array} nodes  the `N` array
 * @param {Array} [elements] the `E` array; when given, `target` and a
 *   morph's `from`/`to` are checked to name ids that actually exist,
 *   which is the other half of the "silent no-op" problem: a correctly
 *   spelled op aimed at an element that is not there does nothing at all.
 */
export function validateNodes(nodes, elements) {
    const errors = [];
    const push = (code, path, got, suggestions, valid) => {
        errors.push({
            code, path, got,
            suggestions: suggestions || [],
            valid: valid || [],
        });
    };

    if (!Array.isArray(nodes)) {
        push("BAD_NODES", "nodes", nodes, [], ["an array of node objects"]);
        return { ok: false, errors };
    }

    // Ids declared by E, including children, since `target` may name any
    // of them. Absent E, id checking is skipped rather than guessed at.
    const ids = [];
    const walk = (list) => {
        if (!Array.isArray(list)) return;
        for (const el of list) {
            if (!el || typeof el !== "object") continue;
            if (typeof el.id === "string") ids.push(el.id);
            walk(el.children);
        }
    };
    if (elements !== undefined) walk(elements);
    const idsKnown = elements !== undefined;

    const checkTargets = (value, path) => {
        if (value === undefined) return;
        const list = Array.isArray(value) ? value : [value];
        list.forEach((t, i) => {
            const at = Array.isArray(value) ? `${path}[${i}]` : path;
            if (typeof t !== "string") {
                push("BAD_TARGET", at, t, [], ["an element id"]);
                return;
            }
            // Ids are written bare in E and may be written with a leading
            // "#" in a node; accept both rather than inventing a rule.
            const bare = t.startsWith("#") ? t.slice(1) : t;
            if (idsKnown && !ids.includes(bare)) {
                push("UNKNOWN_TARGET", at, t, suggest(bare, ids), ids);
            }
        });
    };

    nodes.forEach((node, i) => {
        const path = `nodes[${i}]`;
        const family = familyOf(node);

        if (family === "invalid") {
            push("BAD_NODE", path, node, [],
                ["{ op: \"<raster op>\" }", "{ op: { name: \"<design op>\" } }",
                 "{ op: \"morph\", from, to }"]);
            return;
        }

        checkTargets(node.target, `${path}.target`);

        if (family === "design") return;   // design nodes carry their own vocabulary

        if (family === "morph") {
            // The morph node's own contract. `from` and `to` are what make
            // it a morph; without them the node is inert.
            if (typeof node.from !== "string") {
                push("MISSING_FIELD", `${path}.from`, node.from, [],
                    ["the id of the element that morphs"]);
            } else {
                checkTargets(node.from, `${path}.from`);
            }
            if (node.to === undefined) {
                push("MISSING_FIELD", `${path}.to`, undefined, [],
                    ["[\"id\", ...]", "{ \"Link label\": \"id\" }"]);
            } else if (Array.isArray(node.to)) {
                checkTargets(node.to, `${path}.to`);
            } else if (node.to && typeof node.to === "object") {
                for (const label in node.to) {
                    checkTargets(node.to[label], `${path}.to.${label}`);
                }
            } else {
                push("BAD_FIELD", `${path}.to`, node.to, [],
                    ["an array of ids, or a map of link label to id"]);
            }
            if (node.duration !== undefined &&
                (typeof node.duration !== "number" || !(node.duration > 0))) {
                push("BAD_VALUE", `${path}.duration`, node.duration, [],
                    ["a positive number of milliseconds"]);
            }
            if (node.effect !== undefined &&
                typeof node.effect !== "string" && !Array.isArray(node.effect)) {
                push("BAD_FIELD", `${path}.effect`, node.effect, [],
                    ["a preset name, or an inline array of raster nodes"]);
            }
            // Unknown keys, checked here for the same reason they are
            // checked on a raster node: a morph silently ignores what it
            // does not recognise, so `duraton: 900` produces a transition
            // that runs at the default speed and reports nothing. Found by
            // driving the published server end to end, which is precisely
            // the mistake an agent makes.
            for (const key in node) {
                if (MORPH_FIELDS.includes(key)) continue;
                push("UNKNOWN_PARAM", `${path}.${key}`, key,
                    suggest(key, MORPH_FIELDS), MORPH_FIELDS);
            }
            return;
        }

        // ── raster nodes ────────────────────────────────────────────
        const def = REGISTRY[node.op];
        if (!def) {
            push("UNKNOWN_OP", `${path}.op`, node.op,
                suggest(node.op, RASTER_OP_NAMES), RASTER_OP_NAMES);
            return;   // parameters cannot be judged without a definition
        }

        const params = (def.doc && def.doc.params) || {};
        const known = Object.keys(params);
        const shared = Object.keys(FRAMEWORK_DOC);

        for (const key in node) {
            if (key === "op") continue;
            if (shared.includes(key) || known.includes(key)) continue;
            // A parameter that belongs to no op is a typo; one that belongs
            // to a DIFFERENT op is the more interesting mistake, and the
            // suggestion list covers both because it is drawn from this
            // op's vocabulary plus the shared one.
            push("UNKNOWN_PARAM", `${path}.${key}`, key,
                suggest(key, known.concat(shared)), known.concat(shared));
        }

        if (node.by !== undefined && !DRIVER_NAMES.includes(node.by)) {
            push("UNKNOWN_DRIVER", `${path}.by`, node.by,
                suggest(node.by, DRIVER_NAMES), DRIVER_NAMES);
        }
        if (node.ease !== undefined && typeof node.ease === "string" &&
            !EASING_NAMES.includes(node.ease)) {
            push("UNKNOWN_EASING", `${path}.ease`, node.ease,
                suggest(node.ease, EASING_NAMES), EASING_NAMES);
        }
        if (node.side !== undefined && !["old", "new"].includes(node.side)) {
            push("BAD_VALUE", `${path}.side`, node.side,
                suggest(String(node.side), ["old", "new"]), ["old", "new"]);
        }
    });

    return { ok: errors.length === 0, errors };
}

/**
 * The vocabulary, as data — what an agent needs before writing anything.
 * Assembled from the registry rather than maintained separately, so it
 * cannot drift from what the pipeline actually accepts.
 */
export function describeOps() {
    const ops = RASTER_OP_NAMES.map((name) => {
        const def = REGISTRY[name] || {};
        const doc = def.doc || {};
        const params = doc.params || {};
        return {
            op: name,
            stage: Array.isArray(def.stage) ? def.stage : [def.stage].filter(Boolean),
            summary: doc.summary || "",
            params: Object.keys(params).map((p) => ({
                name: p,
                default: params[p].default,
                unit: params[p].unit,
                structural: !!params[p].structural,
                summary: params[p].summary || "",
            })),
        };
    });
    return {
        ops,
        shared: Object.keys(FRAMEWORK_DOC).map((k) => ({
            name: k,
            default: FRAMEWORK_DOC[k].default,
            unit: FRAMEWORK_DOC[k].unit,
            summary: FRAMEWORK_DOC[k].summary || "",
        })),
        drivers: DRIVER_NAMES,
        easings: EASING_NAMES,
        units: RASTER_UNITS,
    };
}

export { didYouMean };

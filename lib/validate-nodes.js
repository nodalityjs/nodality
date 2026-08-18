/*!
 * nodality v1.2.2
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
import { presetNames, presetInfo } from "./raster-presets.js";
import { ELEMENT_TYPES } from "./element-mapper.js";
import { didYouMean, suggest } from "./suggest.js";

/**
 * Every key a morph node reads. Anything else on the node is ignored by
 * the runtime, which is why it has to be reported here.
 */
const MORPH_FIELDS = [
    "op", "target", "from", "to", "chain",
    "effect", "duration", "back", "live", "fade",
];

/**
 * Every key an entry in `chain` reads. `from` and `to` make the edge; the
 * rest are the node's own settings, overridable per edge — which is why
 * this list is MORPH_FIELDS without `op`, `target` or `chain`, an edge
 * being able to carry neither an op nor a nested chain of its own.
 */
const EDGE_FIELDS = [
    "from", "to", "effect", "duration", "back", "live", "fade",
];

/**
 * Every key an `agent-surface` node reads. The node is small on purpose:
 * what it exposes is DERIVED, so there is nothing here to describe the
 * tools with — only which parts of the page may be reached.
 */
const AGENT_SURFACE_FIELDS = ["op", "name", "forms", "exclude"];

/** Node families, told apart exactly the way the runtime tells them apart. */
const familyOf = (node) => {
    if (!node || typeof node !== "object") return "invalid";
    const op = node.op;
    if (typeof op === "string") {
        if (op === "morph") return "morph";
        if (op === "agent-surface") return "agent-surface";
        return "raster";
    }
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
            // An id may be written bare ("home") or in selector form
            // ("#home"). Both are accepted here because both are accepted
            // by the runtime — `bareId` in morph-node.js reduces them to
            // one key before anything is resolved. The two must agree: for
            // a while this check tolerated "#home" while the runtime did
            // not, so the validator passed a node that silently never
            // morphed, which is the exact failure it exists to prevent.
            const bare = t.startsWith("#") ? t.slice(1) : t;
            if (idsKnown && !ids.includes(bare)) {
                push("UNKNOWN_TARGET", at, t, suggest(bare, ids), ids);
            }
        });
    };

    // ── the E array ─────────────────────────────────────────────────
    //
    // Checked here because half the pair was previously unvalidated: an
    // element whose `type` names nothing is not a silent no-op but a THROW
    // from the mapper at render time, which reaches a generator as a stack
    // trace rather than as a report it can repair from.
    if (idsKnown) {
        const walkEls = (list, at) => {
            if (!Array.isArray(list)) return;
            list.forEach((el, i) => {
                const p = `${at}[${i}]`;
                if (!el || typeof el !== "object" || Array.isArray(el)) {
                    push("BAD_ELEMENT", p, el, [], ["{ type: \"<element type>\", ... }"]);
                    return;
                }
                if (typeof el.type !== "string") {
                    push("MISSING_FIELD", `${p}.type`, el.type, [],
                        ["an element type, e.g. \"h1\", \"wrap\", \"nav\""]);
                } else if (!ELEMENT_TYPES.includes(el.type)) {
                    push("UNKNOWN_ELEMENT_TYPE", `${p}.type`, el.type,
                        suggest(el.type, ELEMENT_TYPES), ELEMENT_TYPES);
                }
                walkEls(el.children, `${p}.children`);
            });
        };
        walkEls(elements, "elements");
    }

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

        if (family === "agent-surface") {
            // The ids this node names must exist, for the usual reason:
            // a surface that silently exposes nothing is the agentic
            // form of the silent no-op, and an agent has no way to see
            // that the tool it expected was never registered.
            const formIds = [];
            const walkForms = (list) => {
                if (!Array.isArray(list)) return;
                for (const el of list) {
                    if (!el || typeof el !== "object") continue;
                    if (el.type === "form" && typeof el.id === "string") formIds.push(el.id);
                    walkForms(el.children);
                }
            };
            if (idsKnown) walkForms(elements);

            if (node.name !== undefined && typeof node.name !== "string") {
                push("BAD_FIELD", `${path}.name`, node.name, [],
                    ["a string used to prefix every derived tool name"]);
            }

            for (const key of ["forms", "exclude"]) {
                if (node[key] === undefined) continue;
                if (!Array.isArray(node[key])) {
                    push("BAD_FIELD", `${path}.${key}`, node[key], [], ["an array of ids"]);
                    continue;
                }
                node[key].forEach((v, k) => {
                    const at = `${path}.${key}[${k}]`;
                    if (typeof v !== "string") {
                        push("BAD_TARGET", at, v, [], ["an element id"]);
                        return;
                    }
                    const bare = v.startsWith("#") ? v.slice(1) : v;
                    if (key === "forms") {
                        // Checked against FORMS, not against every id: a
                        // node naming a heading would otherwise pass here
                        // and derive no tool at all.
                        if (idsKnown && !formIds.includes(bare)) {
                            push("UNKNOWN_FORM", at, v, suggest(bare, formIds), formIds);
                        }
                    } else if (idsKnown && !ids.includes(bare)) {
                        push("UNKNOWN_STATE", at, v, suggest(bare, ids), ids);
                    }
                });
            }

            // A surface with no graph and no forms still derives
            // `read_view`, which is legitimate — a page can be worth
            // reading and nothing else. Reported so that a node written
            // in the expectation of more says so.
            const hasChain = nodes.some((n) => n && n.op === "morph");
            const hasForms = Array.isArray(node.forms) && node.forms.length > 0;
            if (!hasChain && !hasForms) {
                push("EMPTY_SURFACE", path, node, [],
                    ["add a { op: \"morph\" } node, or name a form in `forms`"]);
            }

            for (const key in node) {
                if (AGENT_SURFACE_FIELDS.includes(key)) continue;
                push("UNKNOWN_PARAM", `${path}.${key}`, key,
                    suggest(key, AGENT_SURFACE_FIELDS), AGENT_SURFACE_FIELDS);
            }
            return;
        }

        if (family === "morph") {
            // `from` and `to` are what make a hop; without them it is
            // inert. Factored out because a chain edge has exactly the
            // same two ends as a single-hop node, and the diagnostics
            // should not differ by where the edge was written.
            const checkEnds = (o, at) => {
                if (typeof o.from !== "string") {
                    push("MISSING_FIELD", `${at}.from`, o.from, [],
                        ["the id of the element that morphs"]);
                } else {
                    checkTargets(o.from, `${at}.from`);
                }
                if (o.to === undefined) {
                    push("MISSING_FIELD", `${at}.to`, undefined, [],
                        ["[\"id\", ...]", "{ \"Link label\": \"id\" }"]);
                } else if (Array.isArray(o.to)) {
                    checkTargets(o.to, `${at}.to`);
                } else if (o.to && typeof o.to === "object") {
                    for (const label in o.to) {
                        checkTargets(o.to[label], `${at}.to.${label}`);
                    }
                } else {
                    push("BAD_FIELD", `${at}.to`, o.to, [],
                        ["an array of ids, or a map of link label to id"]);
                }
            };

            // The settings, which are hoisted defaults on the node and
            // overrides on an edge, so both are checked the same way.
            // `back` and `live` are compared against `false`/`true` by
            // identity in the runtime, which makes a STRING the dangerous
            // mistake: `live: "true"` is not `=== true`, so the live
            // backend silently stays off and the page still works, on the
            // other backend, looking as though the flag took.
            const checkOpts = (o, at) => {
                if (o.duration !== undefined &&
                    (typeof o.duration !== "number" || !(o.duration > 0))) {
                    push("BAD_VALUE", `${at}.duration`, o.duration, [],
                        ["a positive number of milliseconds"]);
                }
                if (o.effect !== undefined &&
                    typeof o.effect !== "string" && !Array.isArray(o.effect)) {
                    push("BAD_FIELD", `${at}.effect`, o.effect, [],
                        ["a preset name, or an inline array of raster nodes"]);
                } else if (typeof o.effect === "string" &&
                           !presetNames().includes(o.effect)) {
                    // A preset that does not exist resolves to an EMPTY chain
                    // and the transition runs with no effect at all: it
                    // validates, renders, and does nothing. That is the silent
                    // omission this validator exists to remove, and it sat
                    // inside the validator's own blind spot until 1.2.3.
                    push("UNKNOWN_EFFECT", `${at}.effect`, o.effect,
                        suggest(o.effect, presetNames()), presetNames());
                }
                for (const flag of ["back", "live"]) {
                    if (o[flag] !== undefined && typeof o[flag] !== "boolean") {
                        push("BAD_VALUE", `${at}.${flag}`, o[flag], [],
                            ["true", "false"]);
                    }
                }
                if (o.fade !== undefined && typeof o.fade !== "string") {
                    push("BAD_FIELD", `${at}.fade`, o.fade, [],
                        ["a fade mode, as a string"]);
                }
            };

            // A node is either one hop or a chain, and the runtime decides
            // by looking at `chain` FIRST: `normalizeEdges` takes a
            // non-empty chain and never reads node-level `from`/`to`. The
            // check mirrors that order, so what passes here is what runs.
            const chained = Array.isArray(node.chain) && node.chain.length > 0;

            if (node.chain !== undefined && !Array.isArray(node.chain)) {
                push("BAD_FIELD", `${path}.chain`, node.chain, [],
                    ["an array of edges: [{ from, to }, ...]"]);
            } else if (Array.isArray(node.chain) && !node.chain.length) {
                // The runtime does not reject this — it falls back to the
                // single-hop fields — but it is never what was meant.
                push("BAD_VALUE", `${path}.chain`, node.chain, [],
                    ["at least one edge, or no `chain` key at all"]);
            }

            checkOpts(node, path);

            if (chained) {
                // `from`/`to` written BESIDE a chain are dead, not merged.
                // Worth reporting precisely because the page still works,
                // using the chain, so the ignored pair looks as though it
                // took effect.
                for (const key of ["from", "to"]) {
                    if (node[key] !== undefined) {
                        push("IGNORED_FIELD", `${path}.${key}`, node[key], [],
                            ["remove it, or drop `chain` and keep the single hop"]);
                    }
                }
                node.chain.forEach((edge, j) => {
                    const at = `${path}.chain[${j}]`;
                    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
                        push("BAD_FIELD", at, edge, [], ["{ from, to }"]);
                        return;
                    }
                    checkEnds(edge, at);
                    checkOpts(edge, at);
                    for (const key in edge) {
                        if (EDGE_FIELDS.includes(key)) continue;
                        push("UNKNOWN_PARAM", `${at}.${key}`, key,
                            suggest(key, EDGE_FIELDS), EDGE_FIELDS);
                    }
                });
            } else {
                checkEnds(node, path);
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
            const guesses = suggest(node.op, RASTER_OP_NAMES);
            push("UNKNOWN_OP", `${path}.op`, node.op, guesses, RASTER_OP_NAMES);

            // Parameters cannot be judged without a definition — but where the
            // op is a near miss, they can be judged against the op that was
            // MEANT, and reported as provisional. Without this a node with a
            // misspelled op AND a misspelled parameter takes two round-trips:
            // the op error hides the parameter error until it is fixed. The
            // `assuming` field says which definition the check used, so a
            // consumer can tell a certain finding from a conditional one.
            const meant = guesses.length ? REGISTRY[guesses[0]] : null;
            if (meant) {
                const known = Object.keys((meant.doc && meant.doc.params) || {});
                const shared = Object.keys(FRAMEWORK_DOC);
                for (const key in node) {
                    if (key === "op" || shared.includes(key) || known.includes(key)) continue;
                    errors.push({
                        code: "UNKNOWN_PARAM", path: `${path}.${key}`, got: key,
                        suggestions: suggest(key, known.concat(shared)),
                        valid: known.concat(shared),
                        assuming: guesses[0],
                    });
                }
            }
            return;
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
        // The transition presets a morph's `effect` may name. Absent from
        // this reply until 1.2.3, which left an agent to guess them from an
        // example in the tool description.
        presets: presetNames().map((name) => {
            const info = presetInfo(name) || {};
            return { name, summary: info.summary || "", live: info.live };
        }),
        // The vocabulary of E, so both halves of the pair are discoverable
        // from one call rather than only the half that is transformed.
        elementTypes: ELEMENT_TYPES,
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

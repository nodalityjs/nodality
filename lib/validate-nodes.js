/*!
 * nodality v1.3.1
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
import { collectRefs, isRef, resolveRefs } from "./resolve-refs.js";
import { normalizeSpec, aliasConflicts, ALIASES } from "./normalize-spec.js";
import { ELEMENT_TYPES } from "./element-mapper.js";
import { ELEMENT_PARAM_NAMES } from "./element-params.generated.js";
import { didYouMean, suggest, levenshtein } from "./suggest.js";

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

/**
 * Design ops that may be written as a BARE STRING, `{ op: "gradient" }`,
 * and are expanded against a table of defaults by `Des.add`. This list is
 * that table's key set (`ops` in designer.js) and must track it: a string
 * outside it is never expanded, so it reaches the renderer as a node
 * nothing matches and does nothing at all.
 *
 * None of these collide with a raster op name, which is what makes the
 * two string families separable at all.
 */
const BARE_DESIGN_OPS = [
    "blast", "gradient", "shadow", "filter", "animation", "transform", "span",
];

/**
 * Design ops written in object form, `{ op: { name: "gradient", … } }`.
 *
 * Assembled from the dispatch sites rather than from the documentation,
 * because the two disagree: the reference calls one of these "LinkStyle"
 * while the runtime matches `"link-style"`. Deliberately generous — a
 * name missing from this list produces a false UNKNOWN_DESIGN_OP on a
 * node that works, and `preview` refuses to render an invalid pair, so
 * over-reporting costs more than under-reporting.
 */
const DESIGN_OP_NAMES = [
    "animation", "background", "blast", "card-style", "filter", "gradient",
    "layout", "link-style", "margin", "navStyle", "shadow", "slayout",
    "span", "transform",
];

/**
 * Every top-level key a design node reads.
 *
 * Both forms read `op`, `target`, `range`, and — from the loop that runs
 * over every node, not just the expanded ones — `style` and `duration`.
 * Anything else on the object form is ignored in silence, which is
 * precisely how the README's `colors: [...]` survived.
 *
 * The bare-string form reads four more, because its expansion lifts them
 * INTO the op it substitutes: that is how
 * `{ op: "gradient", gradient: "linear-gradient(…)" }` customises the
 * default, and it is documented, so the two forms cannot share one list.
 *
 * Assembled by reading every `customOptions[i].x` and `protoOptions[i].x`
 * in designer.js, then swept against the e2e fixtures — which is how
 * `style` and `duration` were caught. Guessing this list produces false
 * positives on working pages, and `preview` refuses an invalid pair.
 */
const DESIGN_FIELDS = ["op", "target", "range", "style", "duration"];
const BARE_DESIGN_FIELDS = [
    ...DESIGN_FIELDS, "filter", "gradient", "color", "width",
];

/** Node families, told apart exactly the way the runtime tells them apart. */
const familyOf = (node) => {
    if (!node || typeof node !== "object") return "invalid";
    const op = node.op;
    if (typeof op === "string") {
        if (op === "morph") return "morph";
        if (op === "agent-surface") return "agent-surface";
        // Checked BEFORE falling through to raster. A bare-string design
        // op is not a raster op, and reporting it as an unknown one was a
        // false positive on documented usage: `{ op: "gradient" }` is on
        // the gradient page, renders the default gradient, and validated
        // as UNKNOWN_OP suggesting a raster op that would not do it.
        if (BARE_DESIGN_OPS.includes(op)) return "design";
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
// Which key actually carries a composite's content.
//
// GROUND TRUTH, DERIVED BY RENDERING, not by reading the source. A static scan
// got this wrong: `mapRow` appears to read `items` because a helper it calls
// does, and that helper's `items` belongs to a different element entirely. So
// each type was rendered with a distinctive payload in `items` and again in
// `children`, and only the slot the output actually followed is recorded here.
// `__tests__/unit/content-slots.test.mjs` re-derives it the same way and fails
// if this table drifts, which is the arrangement Stage 2 established for the
// schema.
//
// ONLY types with positive evidence appear. A type whose content slot could not
// be demonstrated is absent, and absent means silent: reporting a slot that
// might work would stop `preview` rendering a page that renders, which 1.2.7
// established is the costlier direction to be wrong in.
export const CONTENT_SLOT = {
    cards: "items", nav: "items", sideNav: "items", table: "items", ulist: "items",
    row: "children", form: "children", wrap: "children",
};

// Of the types that read `items`, which read the entries as ELEMENT SPECS
// rather than as data. `ulist` maps every object entry through the mapper;
// `cards`, `nav`, `sideNav` and `table` read theirs as data — nav entries are
// `{title, link}`, table entries are rows — and walking those as elements
// would report every correct page. Pinned against the mapper by a test rather
// than trusted, because a hand-kept table beside a mapper is exactly what
// drifted before 1.2.8.
export const SPEC_ITEMS = new Set(["ulist"]);

export function validateNodes(nodes, elements, defs) {
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
    // Tier 3: a reference with no definition. Reported here as well as
    // refused at render, because a report is repairable in one turn and a
    // throw is not — the Stage 3 contract applied to the newest way of being
    // wrong. `defs` is optional: without it references are left alone rather
    // than all reported missing, since a caller may validate a page before
    // deciding what to share.
    if (defs && typeof defs === "object" && Array.isArray(elements)) {
        const defined = Object.keys(defs);
        for (const { name, path } of collectRefs(elements)) {
            if (!Object.prototype.hasOwnProperty.call(defs, name)) {
                push("DANGLING_REF", path, name, suggest(name, defined), defined);
            }
        }
    }

    // Walk the RESOLVED tree when definitions are available. A reference
    // with keys beside it is a real element once merged, and only the merged
    // form can be checked: `{ $ref: "nav", itms: [] }` is a typo in an
    // override, and validating the unexpanded reference would miss it —
    // a silent no-op inside the mechanism built to remove silent no-ops.
    let toWalk = (defs && typeof defs === "object" && Array.isArray(elements))
        ? resolveRefs(elements, defs)
        : elements;

    // An alias and its canonical name both present, disagreeing: one of them
    // is going to be ignored. The author hears it here rather than finding it
    // in the page.
    for (const c of aliasConflicts(Array.isArray(elements) ? elements : [])) {
        push("CONFLICTING_ALIAS", c.path, c.alias, [c.canonical],
            [`"${c.alias}" is accepted as "${c.canonical}"; give one of them, not both`]);
    }

    // Walk the normalised tree, so `{type:"img", src:"..."}` is checked as the
    // element it actually becomes rather than reported as an unknown parameter.
    if (Array.isArray(toWalk)) toWalk = normalizeSpec(toWalk);

    if (idsKnown) {
        const walkEls = (list, at) => {
            if (!Array.isArray(list)) return;
            list.forEach((el, i) => {
                const p = `${at}[${i}]`;
                if (!el || typeof el !== "object" || Array.isArray(el)) {
                    // A bare string here is almost always the pre-S1 way of
                    // gesturing at a composite's shape —
                    // `children: ["image","text","link"]`. The mapper accepts
                    // it and ignores it, which is the silent no-op this
                    // validator exists to remove, so name the working form
                    // rather than emitting a generic shape error.
                    if (typeof el === "string") {
                        push("LEGACY_CHILD_STRING", p, el, [`items: [[{ type: "${el}", ... }]]`],
                            ["an element descriptor, or a composite's `items` for card content"]);
                        return;
                    }
                    push("BAD_ELEMENT", p, el, [], ["{ type: \"<element type>\", ... }"]);
                    return;
                }
                // A reference is not an element and has no `type` by design.
                // Its validity is whether the name resolves, which the
                // DANGLING_REF pass above decides; reporting MISSING_FIELD
                // here rejected every correct `$ref` there is.
                if (isRef(el)) return;

                if (typeof el.type !== "string") {
                    push("MISSING_FIELD", `${p}.type`, el.type, [],
                        ["an element type, e.g. \"h1\", \"wrap\", \"nav\""]);
                } else if (!ELEMENT_TYPES.includes(el.type)) {
                    push("UNKNOWN_ELEMENT_TYPE", `${p}.type`, el.type,
                        suggest(el.type, ELEMENT_TYPES), ELEMENT_TYPES);
                }
                // Content declared in the slot this type does not read.
                // `{type:"table", children:[...]}` validated clean and then
                // rendered its placeholders — the exact silent no-op Stage 1
                // removed for `cards`, surviving one slot over. It is not a
                // typo, so near-miss detection cannot reach it.
                const wants = CONTENT_SLOT[el.type];
                if (wants) {
                    // A content slot that is present but not a list. The
                    // mapper tests `Array.isArray(...) && length`, so
                    // `items: {…}` and `items: "x"` fall through to the
                    // placeholders — content declared, content ignored, no
                    // error. Same family as WRONG_CONTENT_SLOT: the key is
                    // right and the value cannot carry anything.
                    const given = el[wants];
                    if (given !== undefined && given !== null && !Array.isArray(given)) {
                        push("BAD_CONTENT_SHAPE", `${p}.${wants}`, given, [],
                            [`an array — "${el.type}" reads \`${wants}\` as a list`]);
                    }
                }
                if (wants) {
                    const other = wants === "items" ? "children" : "items";
                    const filled = (v) => Array.isArray(v) ? v.length > 0 : v != null;
                    // All-strings is the pre-S1 gesture and already gets its own
                    // diagnostic from the walk below; do not report it twice.
                    const allStrings = Array.isArray(el[other])
                        && el[other].every((x) => typeof x === "string");
                    if (filled(el[other]) && !filled(el[wants]) && !allStrings) {
                        push("WRONG_CONTENT_SLOT", `${p}.${other}`, other, [wants],
                            [`"${el.type}" carries its content in \`${wants}\``]);
                    }
                }

                walkEls(el.children, `${p}.children`);

                // Phase S3: a misspelled element parameter. `{type:"cards",
                // itms:[…]}` used to validate clean and then render a grid
                // with no items — the silent no-op this validator exists to
                // remove, one level up from the node vocabulary it already
                // checked.
                //
                // Reported ONLY for a near miss of a known parameter name.
                // An unrecognised name with no close match is left alone on
                // purpose: several mappers spread the whole element into
                // their component, so they accept names no static scan can
                // enumerate, and rejecting one would stop `preview` from
                // rendering a page that works. Detection here, full per-type
                // vocabulary from `npx nodality schema <type>`.
                if (typeof el.type === "string") {
                    for (const key in el) {
                        if (ELEMENT_PARAM_NAMES.includes(key)) continue;
                        // Ranked, closest first, capped at three. `suggest`
                        // returns everything within distance 2 in list order,
                        // so `txt` offered ["at","text","tint","top","x"] with
                        // the answer second — five guesses is not a one-turn
                        // repair, which is Stage 3's acceptance test.
                        // Ranked by a transposition-aware score. Plain
                        // Levenshtein calls `ulr`→`url` distance 2, the same
                        // as `ulr`→`mar`, so the alphabetical tiebreak put
                        // the wrong word first. A swapped pair of letters is
                        // the commonest typo there is, so a candidate built
                        // from exactly the same characters ranks ahead of an
                        // equal-distance one that is not.
                        const sorted = (w) => [...w].sort().join("");
                        const score = (c) => levenshtein(key, c)
                            - (sorted(c) === sorted(key) ? 1.5 : 0)
                            - (c[0] === key[0] ? 0.25 : 0);
                        const near = suggest(key, ELEMENT_PARAM_NAMES)
                            .sort((a, b) => score(a) - score(b)
                                         || a.length - b.length
                                         || a.localeCompare(b))
                            .slice(0, 3);
                        if (!near.length) continue;
                        push("UNKNOWN_ELEMENT_PARAM", `${p}.${key}`, key, near,
                            [`run \`npx nodality schema ${el.type}\` for this type's parameters`]);
                    }
                }

                // Phase S1: a composite's `items` carries either element
                // specs (a card's children) or shorthand data objects. Walk
                // the spec form so a typo inside a card is reported at its
                // real path; leave the shorthand alone, since it is data for
                // the emitted template rather than elements to validate.
                //
                // Checked here rather than in a per-type table because
                // `items` means the same thing wherever a composite accepts
                // it, and a table would drift from the mapper the way the
                // op registry did before 1.2.8.
                if (Array.isArray(el.items)) {
                    el.items.forEach((entry, k) => {
                        if (Array.isArray(entry)) walkEls(entry, `${p}.items[${k}]`);
                    });
                }

                // Phase S7: an object entry with no `type`, in a slot whose
                // entries ARE elements. `{type:"ulist", items:[{text:"Fast"}]}`
                // validated clean and then threw from deep in the mapper —
                // `Unknown element type "undefined"` — which is the Stage 3
                // contract exactly inverted: validate-then-render handed the
                // agent a stack trace in the one place the tool exists to
                // prevent it.
                //
                // Tier 7 measured what that cost. The throw names every valid
                // type and not one word about WHICH entry, so it is the same
                // string for every fault of this shape on any page; the weaker
                // of the two models repaired none of them and returned a
                // byte-identical spec. The suggestion below therefore hands
                // back the replacement rather than describing it.
                //
                // A string entry is the shorthand and stays valid.
                if (SPEC_ITEMS.has(el.type) && Array.isArray(el.items)) {
                    el.items.forEach((entry, k) => {
                        const at = `${p}.items[${k}]`;
                        if (typeof entry === "string" || typeof entry === "number") return;
                        if (Array.isArray(entry)) return;
                        if (!entry || typeof entry !== "object") {
                            push("BAD_ELEMENT", at, entry, [],
                                ["a string, or { type: \"<element type>\", ... }"]);
                            return;
                        }
                        if (isRef(entry)) return;
                        if (typeof entry.type !== "string") {
                            const text = ["text", "title", "label"]
                                .map((k2) => entry[k2]).find((v) => typeof v === "string");
                            push("MISSING_FIELD", `${at}.type`, entry.type,
                                text === undefined ? []
                                    : [JSON.stringify(text),
                                       `{ "type": "p", "text": ${JSON.stringify(text)} }`],
                                [`"${el.type}" reads each item as an element; a plain string is the shorthand`]);
                        } else if (!ELEMENT_TYPES.includes(entry.type)) {
                            push("UNKNOWN_ELEMENT_TYPE", `${at}.type`, entry.type,
                                suggest(entry.type, ELEMENT_TYPES), ELEMENT_TYPES);
                        }
                    });
                }
            });
        };
        walkEls(toWalk, "elements");
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

        if (family === "design") {
            // Was `return` — "design nodes carry their own vocabulary", which
            // was true and yet left the whole family unchecked. The cost was
            // paid in the reference: a design option written in the wrong
            // place is not a no-op with a warning, it is a no-op in silence,
            // and the gradient one made the target INVISIBLE. Checked here at
            // the two levels the runtime actually reads.
            const bare = typeof node.op === "string";
            const name = bare ? node.op : node.op.name;

            if (!bare && !DESIGN_OP_NAMES.includes(name)) {
                push("UNKNOWN_DESIGN_OP", `${path}.op.name`, name,
                    suggest(name, DESIGN_OP_NAMES), DESIGN_OP_NAMES);
            }

            // Top-level keys. The object form reads three; the bare-string
            // form reads four more because its expansion lifts them into the
            // op it substitutes.
            const allowed = bare ? BARE_DESIGN_FIELDS : DESIGN_FIELDS;
            for (const key in node) {
                if (allowed.includes(key)) continue;
                // A near miss of a real top-level field is a typo and gets
                // the usual suggestion. Anything else, on the object form,
                // is almost always an option written one level too high —
                // design options live INSIDE `op` — so say where it goes
                // rather than only listing what may sit out here. That is
                // the whole of the README's `colors` mistake.
                const near = suggest(key, allowed);
                const hint = near.length || bare ? near : [`op.${key}`];
                push("UNKNOWN_PARAM", `${path}.${key}`, key, hint, allowed);
            }

            // A gradient with nothing to paint. `op.gradient` is the CSS
            // string and `op.direction: "radial"` substitutes a built-in
            // one; with neither, the node names an effect that cannot
            // happen. It renders as nothing since 1.2.7 and rendered as an
            // invisible element before that, so it is worth a report either
            // way. The bare-string form is exempt: its whole purpose is to
            // take the default.
            if (!bare && name === "gradient" &&
                node.op.gradient === undefined && node.op.direction === undefined) {
                push("MISSING_FIELD", `${path}.op.gradient`, undefined, [],
                    ["a CSS gradient, e.g. \"linear-gradient(#1d6fe0, #7fd1ff)\"",
                     "or direction: \"radial\" to take the built-in one"]);
            }
            return;
        }

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

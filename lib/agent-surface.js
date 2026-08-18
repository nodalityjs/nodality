/*!
 * nodality v1.2.1
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * agent-surface.js — derive a site's agent-operable surface from (E, N).
 *
 * The premise this file exists to prove: a page's interaction structure
 * is ALREADY data here, so the tool surface an agent operates need not
 * be authored a second time. Every other approach in this space is
 * either hand-written JavaScript registrations or per-element HTML
 * annotations; both restate, by hand, something the pair already says.
 *
 * Three things are derived, and each answers a different half of what
 * an agent can do with a static site:
 *
 *   navigate / go_back  — the morph chain's VIEW graph. Not routing:
 *                         Nodality has no router, and between PAGES an
 *                         agent already has URLs. What it cannot reach
 *                         by fetching is a chain's non-root states,
 *                         which are in-page views; the graph is their
 *                         only machine door.
 *   submit_<form>       — the one action a fetch cannot perform. The
 *                         schema is read from the field descriptors,
 *                         not from annotations added to the DOM.
 *   read_view           — what is on screen now, as structured text.
 *
 * Pure and synchronous: no DOM, no browser API, no WebMCP. It returns
 * declarations plus the binding facts a runtime adapter needs to hang
 * handlers on them, so the same derivation serves both the live
 * registration and the build-time manifest — they cannot disagree,
 * because there is only one of them.
 *
 * WebMCP is deliberately not named anywhere below. The spec is six
 * months old, in origin trial, and has already moved its entry point
 * once; everything spec-shaped belongs in the adapter, and the only
 * concession here is `specDraft`, which the CALLER supplies and this
 * module merely records.
 */

import { normalizeEdges } from "./morph-node.js";

/** Descriptor types that carry a value an agent would fill. */
const FIELD_TYPES = new Set(["input", "labelInput", "checkbox", "radio", "picker"]);

/**
 * `inputType` → JSON Schema. Kept small and explicit: a guessed schema
 * is worse than an absent one, because an agent will believe it.
 */
const INPUT_SCHEMA = {
    text: { type: "string" },
    email: { type: "string", format: "email" },
    tel: { type: "string" },
    url: { type: "string", format: "uri" },
    number: { type: "number" },
    password: { type: "string" },
    date: { type: "string", format: "date" },
    time: { type: "string", format: "time" },
    search: { type: "string" },
};

const isObj = (v) => !!v && typeof v === "object";

/** Depth-first walk of a descriptor subtree, children included. */
function* walk(el) {
    if (!isObj(el)) return;
    yield el;
    const kids = Array.isArray(el.children) ? el.children : [];
    for (const k of kids) yield* walk(k);
}

/** Every descriptor in E, flattened — ids are unique across the tree. */
function flatten(elements) {
    const out = [];
    for (const el of Array.isArray(elements) ? elements : []) {
        for (const d of walk(el)) out.push(d);
    }
    return out;
}

/**
 * One form field → one JSON Schema property.
 *
 * The property NAME is `name ?? id`: `name` is what a submitted form
 * actually sends, and where a descriptor declares one it is the honest
 * key for an agent to use.
 */
function fieldSchema(el) {
    const key = typeof el.name === "string" ? el.name : el.id;
    if (typeof key !== "string" || !key) return null;

    let schema;
    if (el.type === "checkbox") {
        schema = { type: "boolean" };
    } else if (el.type === "radio" || el.type === "picker") {
        const items = Array.isArray(el.items) ? el.items.filter((i) => typeof i === "string") : [];
        schema = items.length ? { type: "string", enum: items } : { type: "string" };
        if (el.type === "radio" && el.multiple === true) {
            schema = { type: "array", items: schema };
        }
    } else {
        // input / labelInput. An unknown inputType degrades to a plain
        // string rather than inventing a format.
        schema = { ...(INPUT_SCHEMA[el.inputType] || INPUT_SCHEMA.text) };
    }

    // Whatever the descriptor says the field is FOR, in the agent's
    // words. Label first: it is what a human reader is shown.
    const desc = [el.label, el.placeholder, el.title]
        .find((d) => typeof d === "string" && d.trim());
    if (desc) schema.description = desc.trim();

    return { key, schema, required: el.required === true };
}

/**
 * The morph chains in N, normalised into one edge list per node.
 *
 * Normalisation is IMPORTED, never reimplemented: the runtime resolves
 * `#id` spellings, per-edge defaults and the two `to` forms in
 * `normalizeEdges`, and a second copy of those rules here would drift
 * from the controller the first time either changed. That drift is the
 * exact failure that made the validator accept a node the runtime
 * silently refused to run.
 */
function graphOf(nodes, exclude) {
    const morphs = (Array.isArray(nodes) ? nodes : [])
        .filter((n) => isObj(n) && n.op === "morph");
    if (!morphs.length) return null;

    const edges = [];
    for (const m of morphs) {
        for (const e of normalizeEdges(m)) {
            if (typeof e.from !== "string") continue;
            edges.push(e);
        }
    }
    if (!edges.length) return null;

    const root = edges[0].from;
    const edgesFrom = (id) => edges.filter((e) => e.from === id);

    // Reachability from the root, forward edges only. A state no edge
    // leads to is not a destination an agent can be offered, however
    // well-formed its own edge may be.
    const reachable = new Set([root]);
    const queue = [root];
    while (queue.length) {
        const at = queue.shift();
        for (const e of edgesFrom(at)) {
            for (const id of e.toIds) {
                if (typeof id !== "string" || reachable.has(id)) continue;
                reachable.add(id);
                queue.push(id);
            }
        }
    }

    // Routes, in declaration order, as the USER sees them: the labels
    // in the description are the same strings the visible controls
    // carry, so an agent's vocabulary and a human's cannot drift.
    const routes = [];
    for (const e of edges) {
        if (!reachable.has(e.from) || exclude.has(e.from)) continue;
        const pairs = [];
        if (e.byLabel) {
            for (const [label, id] of Object.entries(e.byLabel)) {
                const to = typeof id === "string" && id.startsWith("#") ? id.slice(1) : id;
                if (exclude.has(to)) continue;
                pairs.push({ label, to });
            }
        } else {
            for (const to of e.toIds) {
                if (exclude.has(to)) continue;
                pairs.push({ label: null, to });
            }
        }
        if (pairs.length) routes.push({ from: e.from, to: pairs, back: e.back === true });
    }

    const destinations = [];
    for (const r of routes) {
        for (const p of r.to) if (!destinations.includes(p.to)) destinations.push(p.to);
    }

    return {
        root,
        states: [root, ...destinations.filter((d) => d !== root)],
        destinations,
        routes,
        canGoBack: routes.some((r) => r.back),
    };
}

/** "from home: Work → work, Contact → contact; from work: Aurora → aurora" */
function describeRoutes(graph) {
    return graph.routes
        .map((r) => {
            const to = r.to
                .map((p) => (p.label ? `${p.label} → ${p.to}` : p.to))
                .join(", ");
            return `from ${r.from}: ${to}`;
        })
        .join("; ");
}

/**
 * Derive the tool surface for one (E, N) pair.
 *
 * @param {Array} elements  the E array
 * @param {Array} nodes     the N array
 * @param {object} [opts]
 * @param {string|null} [opts.specDraft] a label recorded in the manifest
 *   to say which draft of the consuming spec it was derived against.
 *   Supplied by the caller precisely so this module stays ignorant of
 *   any particular protocol.
 * @returns {{tools: object[], manifest: object}|null} null when no
 *   `agent-surface` node is present — the surface is opt-in, because
 *   turning a page's interaction structure into callable tools is the
 *   page's decision to make and never the framework's.
 */
export function deriveSurface(elements, nodes, { specDraft = null } = {}) {
    const node = (Array.isArray(nodes) ? nodes : [])
        .find((n) => isObj(n) && n.op === "agent-surface");
    if (!node) return null;

    const flat = flatten(elements);
    const byId = new Map();
    for (const el of flat) if (typeof el.id === "string") byId.set(el.id, el);

    const exclude = new Set(
        (Array.isArray(node.exclude) ? node.exclude : []).filter((s) => typeof s === "string"),
    );
    const prefix = typeof node.name === "string" && node.name.trim()
        ? node.name.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
        : null;
    const named = (base) => (prefix ? `${prefix}_${base}` : base);

    const tools = [];
    const graph = graphOf(nodes, exclude);

    // ── the view graph ───────────────────────────────────────────────
    if (graph) {
        const enumStates = graph.destinations.filter((d) => !exclude.has(d));
        if (enumStates.length) {
            tools.push({
                name: named("navigate"),
                kind: "navigate",
                description:
                    "Move to another view of this page. These are in-page views " +
                    "reached by a transition, not separate URLs. Routes: " +
                    describeRoutes(graph) + ".",
                inputSchema: {
                    type: "object",
                    properties: {
                        destination: {
                            type: "string",
                            enum: enumStates,
                            description: "The view to move to.",
                        },
                    },
                    required: ["destination"],
                },
            });
        }
        if (graph.canGoBack) {
            tools.push({
                name: named("go_back"),
                kind: "back",
                description:
                    "Return to the previous view, unwinding the path actually " +
                    "taken rather than following an edge.",
                inputSchema: { type: "object", properties: {} },
            });
        }
    }

    // ── the forms, allowlisted only ──────────────────────────────────
    //
    // A derived submit tool is an agent ACTING, the one derived
    // capability with a real side effect, so nothing here is inferred:
    // a form is exposed because the node named it.
    const wanted = (Array.isArray(node.forms) ? node.forms : [])
        .filter((f) => typeof f === "string");
    for (const id of wanted) {
        const form = byId.get(id);
        if (!form || form.type !== "form") continue;

        const properties = {};
        const required = [];
        for (const el of walk(form)) {
            if (!FIELD_TYPES.has(el.type)) continue;
            const f = fieldSchema(el);
            if (!f || properties[f.key]) continue;
            properties[f.key] = f.schema;
            if (f.required) required.push(f.key);
        }
        if (!Object.keys(properties).length) continue;

        tools.push({
            name: named(`submit_${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`),
            kind: "submit",
            formId: id,
            description:
                (typeof form.title === "string" && form.title.trim())
                    ? form.title.trim()
                    : `Fill and submit the "${id}" form on this page.`,
            inputSchema: {
                type: "object",
                properties,
                ...(required.length ? { required } : {}),
            },
        });
    }

    // ── what is on screen ────────────────────────────────────────────
    tools.push({
        name: named("read_view"),
        kind: "read",
        description:
            "Read the content currently on screen as structured text: " +
            "headings, body text and the labels of anything actionable.",
        inputSchema: { type: "object", properties: {} },
    });

    // The manifest is the same derivation with the handler-facing
    // binding facts dropped — a static declaration of capability that
    // needs no script to have run, which is what a crawler or an agent
    // deciding whether to visit at all can actually read.
    const manifest = {
        spec: specDraft,
        tools: tools.map(({ kind, formId, ...decl }) => decl),
        ...(graph
            ? {
                views: {
                    root: graph.root,
                    states: graph.states.filter((s) => !exclude.has(s)),
                    routes: graph.routes,
                },
            }
            : {}),
    };

    return { tools, manifest };
}

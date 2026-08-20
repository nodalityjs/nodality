/*!
 * nodality v1.2.5
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * webmcp-adapter.js — the derived surface, made callable.
 *
 * Everything protocol-shaped in this library lives HERE, in one file,
 * on purpose. WebMCP is six months old, is a Draft Community Group
 * Report rather than a standard, is available only in an origin trial,
 * and has ALREADY moved its entry point once (`navigator.modelContext`
 * → `document.modelContext`). A library that scattered those facts
 * through the designer and the prerenderer would need archaeology every
 * time the draft moved; here the next move is one file and a failing
 * test.
 *
 * The registration itself is a REQUEST, not a guarantee — exactly the
 * posture the live raster backend takes toward HTML-in-Canvas. Where
 * the API is absent (every stock browser today, and jsdom at build
 * time) nothing registers, nothing warns, and the page behaves
 * identically. What still happens everywhere is the DECLARATION: the
 * manifest is written into the document as data, so a crawler, an
 * indexer, or an agent deciding whether to visit at all can read the
 * site's capabilities without executing anything and without the API
 * existing. That half needs no browser support and no standard.
 */

import { deriveSurface } from "./agent-surface.js";

/**
 * The draft this adapter is written against. Asserted in ONE place so
 * that a spec move is a single-file change with a failing test, and so
 * that every emitted manifest records what it was derived against
 * rather than implying a stability the spec does not yet have.
 */
export const SPEC_DRAFT = "2026-07-21";

/** Where the declaration lives in the document, JSON-LD style. */
export const MANIFEST_ID = "nodality-agent-manifest";

/**
 * The registry, wherever this browser currently keeps it.
 *
 * Both spellings are accepted because the trial spans the rename: the
 * draft moved to `document.modelContext`, Chrome 150 deprecated the
 * older location, and pages served to both are the normal case for the
 * length of an origin trial.
 */
function registry() {
    if (typeof document !== "undefined" && document.modelContext) return document.modelContext;
    if (typeof navigator !== "undefined" && navigator.modelContext) return navigator.modelContext;
    return null;
}

/**
 * `CSS.escape`, or a serviceable stand-in.
 *
 * jsdom has no `CSS` global, and the build-time pass runs there — the
 * unguarded call threw, was swallowed by the designer's try/catch, and
 * every prerendered page silently shipped without its declaration. The
 * fallback escapes what an id may legally contain and a selector may
 * not; ids here come from descriptors the author wrote, not from user
 * input, so this is about correctness on ordinary hyphens and dots
 * rather than about hostile strings.
 */
const esc = (s) => {
    const str = String(s);
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(str);
    return str.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
};

/**
 * Text an agent can read, from the subtree being presented.
 *
 * `visibility: hidden` is NOT treated as absent, and that is the whole
 * subtlety. Under the live backend the presented state is hosted inside
 * the canvas: it has real layout and real text, and the DOM copy is
 * hidden precisely BECAUSE the canvas is painting it. Filtering on
 * visibility — the correct test for "can this be clicked" — made
 * `read_view` return nothing at all on exactly the pages that use the
 * feature, while navigation worked perfectly. So the caller passes the
 * subtree it knows is current, and this reads it; `display: none` still
 * counts as absent, because that element is not laid out at all.
 */
function readSubtree(root) {
    if (!root) return { text: "", actions: [] };
    const visible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.opacity === "0") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };
    const lines = [];
    for (const el of root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li")) {
        if (!visible(el)) continue;
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!t) continue;
        const tag = el.tagName.toLowerCase();
        lines.push(/^h[1-6]$/.test(tag) ? `${"#".repeat(+tag[1])} ${t}` : t);
    }
    const actions = [];
    for (const el of root.querySelectorAll("a,button,[role=button]")) {
        if (!visible(el)) continue;
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t && !actions.includes(t)) actions.push(t);
    }
    return { text: lines.join("\n"), actions };
}

/** A structured refusal, in the shape every other report in this library uses. */
const refuse = (code, got, valid) => ({ ok: false, code, got, valid });

/**
 * Give a derived surface its handlers and offer it to the browser.
 *
 * @param {object} args
 * @param {Element} args.mount     the rendered mount
 * @param {Array}  args.elements   E
 * @param {Array}  args.nodes      N
 * @param {Array}  args.morphs     handles returned by applyMorphNodes
 * @returns {{manifest: object, tools: object[], registered: boolean,
 *   destroy: function}|null}
 */
export function installAgentSurface({ mount, elements, nodes, morphs }) {
    const derived = deriveSurface(elements, nodes, { specDraft: SPEC_DRAFT });
    if (!derived) return null;           // opt-in: no node, no surface

    const { tools, manifest } = derived;
    const handles = Array.isArray(morphs) ? morphs.filter(Boolean) : [];
    const graphFor = (id) => handles.find((h) => h.states && h.states.has(id)) || null;

    /**
     * The subtree to read: the state the graph is actually in.
     *
     * Known, not inferred. Asking "what is painted" cannot answer this
     * on a live morph, where the painting is done by a canvas and the
     * DOM behind it is deliberately hidden.
     */
    const currentSubtree = () => {
        for (const h of handles) {
            const el = h.states && h.current != null ? h.states.get(h.current) : null;
            if (el) return el;
        }
        return mount;
    };

    /**
     * The rendered form a descriptor id names, wherever it currently is.
     *
     * A morph state that has not been visited is DETACHED — held by the
     * controller, absent from the document — so a form inside one cannot
     * be found by querying the mount. It is reachable through the state
     * elements the controller holds, and stamping or filling it there
     * works exactly as well: the attributes and values travel with the
     * element when the transition inserts it.
     */
    const findForm = (formId) => {
        const dig = (root) => {
            if (!root || typeof root.querySelector !== "function") return null;
            if (root.id === formId) {
                return root.tagName === "FORM" ? root : root.querySelector("form");
            }
            const host = root.querySelector(`#${esc(formId)}`);
            if (!host) return null;
            return host.tagName === "FORM" ? host : host.querySelector("form");
        };
        const here = dig(mount);
        if (here) return here;
        for (const h of handles) {
            if (!h.states) continue;
            for (const el of h.states.values()) {
                const found = dig(el);
                if (found) return found;
            }
        }
        return null;
    };

    // ── the declaration, written wherever we are ─────────────────────
    //
    // In jsdom this ends up inside the prerendered HTML, which is the
    // whole point: the static declaration exists because the same code
    // ran at build time, not because a second emitter was written for
    // it. In a browser it is simply inert data in the page.
    if (typeof document !== "undefined") {
        const prev = document.getElementById(MANIFEST_ID);
        if (prev) prev.remove();
        const tag = document.createElement("script");
        tag.type = "application/json";
        tag.id = MANIFEST_ID;
        tag.textContent = JSON.stringify(manifest, null, 2);
        (document.body || document.documentElement).appendChild(tag);
    }

    // ── the spec's own form annotations ──────────────────────────────
    //
    // Emitted rather than resisted. The draft's declarative path derives
    // a tool from `toolname`/`tooldescription` on a form, and Lighthouse
    // already audits for them; stamping the SAME forms we derive from
    // means the annotated surface and the derived surface describe one
    // thing by construction, and a browser that only implements the
    // declarative path still gets the form.
    for (const t of tools) {
        if (t.kind !== "submit" || !mount) continue;
        const el = findForm(t.formId);
        if (!el) continue;
        el.setAttribute("toolname", t.name);
        el.setAttribute("tooldescription", t.description);
    }

    // ── handlers ─────────────────────────────────────────────────────
    //
    // Traversals are SERIALISED, and this is an agent-specific hazard
    // rather than a controller bug: a human cannot click twice inside
    // one tick, so the controller's interrupt handling has never had to
    // survive two transitions starting before either has built its
    // pipeline. An agent does it trivially — two executeTool calls, no
    // await — and the observed result was an interface with NOTHING on
    // screen. Queuing here means the second call runs from the state the
    // first actually landed in, which may make it unreachable; that
    // returns a constructive refusal, which is a coherent answer. The
    // controller is left exactly as it is, because for its own callers
    // it is exactly right.
    let queue = Promise.resolve();
    const serial = (fn) => {
        const run = queue.then(fn, fn);
        queue = run.then(() => {}, () => {});
        return run;
    };

    const currentView = () => {
        for (const h of handles) if (h.current != null) return h.current;
        return null;
    };

    const execute = {
        navigate: ({ destination } = {}) => serial(async () => {
            const h = graphFor(destination);
            if (!h) {
                return refuse("UNKNOWN_VIEW", destination,
                    handles.flatMap((x) => [...x.states.keys()]));
            }
            // Reachability is a property of WHERE THE GRAPH IS, not of
            // the schema, so it is answered here and not by the enum: a
            // destination valid from `work` is invalid from `home`, and
            // the honest answer names what is reachable right now.
            const from = h.current;
            await h.goToState(destination);
            if (h.current !== destination) {
                const edge = [...h.states.keys()];
                return refuse("UNREACHABLE_FROM_HERE", destination,
                    edge.filter((id) => id !== from));
            }
            return { ok: true, view: h.current, ...readSubtree(h.states.get(h.current) || mount) };
        }),

        back: () => serial(async () => {
            const h = handles.find((x) => x.history && x.history.length);
            if (!h) return refuse("NO_HISTORY", null, []);
            await h.goBack();
            return { ok: true, view: h.current, ...readSubtree(h.states.get(h.current) || mount) };
        }),

        read: async () => ({ ok: true, view: currentView(), ...readSubtree(currentSubtree()) }),

        submit: async (args = {}, tool) => {
            const form = findForm(tool.formId);
            if (!form) return refuse("NO_FORM", tool.formId, []);

            const props = (tool.inputSchema && tool.inputSchema.properties) || {};
            const required = (tool.inputSchema && tool.inputSchema.required) || [];
            const missing = required.filter(
                (k) => args[k] === undefined || args[k] === "" || args[k] === null);
            if (missing.length) {
                // The constraint, not a boolean. A generator repairs from
                // this in one turn; "false" costs it a guess.
                return refuse("MISSING_REQUIRED", missing, Object.keys(props));
            }

            const filled = [];
            for (const key of Object.keys(props)) {
                if (args[key] === undefined) continue;
                const field = form.querySelector(
                    `[name="${key}"], #${CSS.escape(key)}`);
                if (!field) continue;
                if (field.type === "checkbox") field.checked = !!args[key];
                else field.value = String(args[key]);
                // Both, because component state may listen for either.
                field.dispatchEvent(new Event("input", { bubbles: true }));
                field.dispatchEvent(new Event("change", { bubbles: true }));
                filled.push(key);
            }

            // Submitted through the form's OWN path, so its listeners,
            // its validation attributes and the browser's constraint
            // checking all apply. An agent submit is a user submit.
            if (typeof form.requestSubmit === "function") form.requestSubmit();
            else form.submit();
            return { ok: true, submitted: tool.formId, filled };
        },
    };

    // ── registration, if this browser has anywhere to register ───────
    const reg = registry();
    let registered = false;
    if (reg && typeof reg.registerTool === "function") {
        for (const t of tools) {
            try {
                reg.registerTool({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema,
                    execute: (args) => execute[t.kind](args, t),
                });
                registered = true;
            } catch (e) {
                // A failed registration must never take the page down.
                console.warn("[nodality] agent surface: tool rejected", t.name, e);
            }
        }
    }

    return {
        manifest, tools, registered,
        destroy() {
            if (reg && typeof reg.unregisterTool === "function") {
                for (const t of tools) {
                    try { reg.unregisterTool(t.name); } catch (e) { /* already gone */ }
                }
            }
            if (typeof document !== "undefined") {
                const tag = document.getElementById(MANIFEST_ID);
                if (tag) tag.remove();
            }
        },
    };
}

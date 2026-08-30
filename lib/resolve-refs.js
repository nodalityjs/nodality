/*!
 * nodality v1.3.1
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/**
 * Tier 3 of AGENTIC-FIRST-PLAN.md §10 — declare shared structure once.
 *
 * MEASURED FIRST, as the plan asked. Chrome taken from a real site: a nav and
 * a footer are 184 tokens, and **61% of every token in that site is the same
 * nav and footer**. Referencing rather than repeating them is 1.98x at ten
 * pages and 2.10x at twenty — and a NET LOSS at one page, which is why this is
 * opt-in and why nothing changes for a caller who never uses it.
 *
 * The reason it is needed is not that the data format is verbose. The site
 * used for that measurement does not repeat itself: it imports `renderNav`
 * from a shared module and calls it. That is the imperative layer, where reuse
 * is just a function. An element array cannot call a function, so an agent
 * authoring as data pays for the chrome once per page, and the only way out is
 * to drop into code — which is what property 1, "total", exists to prevent.
 * A human never feels this and an agent always does.
 *
 *     new Des()
 *       .defs({ nav: { type: "nav", items: [...] } })
 *       .add([{ $ref: "nav" }, { type: "h1", text: "Page" }])
 *
 * The definitions are ordinary data, so they serialise, ship in one file, and
 * are imported by every page's entry — the sharing is a plain import of a
 * plain object, not a new authoring mode.
 */

/** The key that marks a reference. `$`-prefixed so it cannot collide with a
 *  parameter name: the schema's vocabulary is all bare identifiers. */
export const REF_KEY = "$ref";

/** True for `{ $ref: "name" }` and nothing else. */
export const isRef = (v) =>
    !!v && typeof v === "object" && !Array.isArray(v) && typeof v[REF_KEY] === "string";

/** Every name referenced anywhere in a spec, with the path that reached it. */
export function collectRefs(elements, at = "elements") {
    const found = [];
    const walk = (node, path) => {
        if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
        if (!node || typeof node !== "object") return;
        if (isRef(node)) { found.push({ name: node[REF_KEY], path }); return; }
        for (const key of ["children", "items"]) {
            if (node[key] !== undefined) walk(node[key], `${path}.${key}`);
        }
    };
    walk(elements, at);
    return found;
}

/**
 * Replace every `{ $ref: name }` with a deep copy of `defs[name]`.
 *
 * A copy, not the definition itself: two pages referencing one nav must not
 * share an object the mapper then mutates — rendering an `a` already adds
 * `font` and `pad` to the descriptor it is given, so a shared definition would
 * accumulate the leavings of every page that used it.
 *
 * An unresolvable reference is left in place rather than dropped or guessed.
 * The validator reports it as DANGLING_REF with a did-you-mean; silently
 * removing it would make a missing nav look like a page that never had one.
 */
export function resolveRefs(elements, defs, seen = new Set()) {
    if (!defs || typeof defs !== "object") return elements;

    const expand = (node) => {
        if (Array.isArray(node)) return node.map(expand);
        if (!node || typeof node !== "object") return node;

        if (isRef(node)) {
            const name = node[REF_KEY];
            if (!Object.prototype.hasOwnProperty.call(defs, name)) return node;
            if (seen.has(name)) {
                // A definition that reaches itself. Returning the ref rather
                // than recursing means a cycle is a reported error instead of
                // a stack overflow at render time.
                return node;
            }
            const next = new Set(seen).add(name);
            const base = resolveRefs([defs[name]], defs, next)[0];

            // Keys written BESIDE the reference override the definition.
            //
            // Without this they were silently dropped — `{ $ref: "nav", id:
            // "topnav" }` expanded to the bare definition and the id went
            // nowhere, which is precisely the declared-but-ignored failure
            // this project spent six stages removing. Having built a new one,
            // the choice was to reject the shape or to honour it; honouring it
            // is what makes a shared fragment reusable at all, since the whole
            // point of sharing a nav is that each page marks a different entry.
            //
            // Shallow, deliberately: a deep merge would make it unclear
            // whether `items` replaces the definition's or extends it. It
            // replaces.
            const { [REF_KEY]: _drop, ...overrides } = node;
            return Object.keys(overrides).length
                ? { ...(base && typeof base === "object" ? base : {}), ...overrides }
                : base;
        }

        const out = { ...node };
        for (const key of ["children", "items"]) {
            if (out[key] !== undefined) out[key] = expand(out[key]);
        }
        return out;
    };

    return Array.isArray(elements) ? elements.map(expand) : elements;
}

/** Names defined but never referenced — dead weight in a shared file. */
export function unusedDefs(elements, defs) {
    if (!defs) return [];
    const used = new Set(collectRefs(elements).map((r) => r.name));
    return Object.keys(defs).filter((n) => !used.has(n));
}

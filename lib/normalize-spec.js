/*!
 * nodality v1.2.11
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/**
 * Tier 6 of AGENTIC-FIRST-PLAN.md §10 — accept what the world already writes.
 *
 * MEASURED FIRST. Running claude-sonnet-5 over the 24-brief eval scored 17/24
 * against 23/24 for a hand-written solver, and **four of the seven failures
 * were one mistake wearing different clothes**: the model reached for the name
 * HTML uses and the library wanted another.
 *
 *     src      ->  url      an <img> has src. Two briefs lost to this.
 *     href     ->  url      an <a> has href.
 *     options  ->  items    a <select> has options.
 *
 * These are not typos, so the did-you-mean built in Stage 3 cannot reach them:
 * `src` is three edits from `url`. And a model writing `src` for an image is
 * not confused — it is applying the most widely attested convention there is.
 * The divergence bought nothing and cost three briefs in twenty-four.
 *
 * The same measurement found one more failure of the same shape rather than
 * the same name: a table's rows written as arrays, header row first, which is
 * how every CSV and every markdown table on earth is laid out. That is handled
 * here too — see `normalizeShapes`.
 *
 * Purely additive. A spec that uses the canonical names and shapes is
 * untouched, so no existing page can observe this. Where both are present the canonical name
 * wins and the collision is REPORTED rather than silently resolved, because
 * quietly dropping a key the author wrote is the exact failure this project
 * has spent every stage removing.
 */

/** alias -> canonical. Deliberately short: each entry has to earn its place by
 *  being what a generator actually writes, not by being plausible. */
export const ALIASES = Object.freeze({
    src: "url",
    href: "url",
    options: "items",
});

const CANONICAL = new Set(Object.values(ALIASES));

/** Walk children and items as well, so nested specs get the same treatment. */
const walk = (node, fn) => {
    if (Array.isArray(node)) return node.map((n) => walk(n, fn));
    if (!node || typeof node !== "object") return node;
    const out = fn({ ...node });
    for (const key of ["children", "items"]) {
        if (out[key] !== undefined) out[key] = walk(out[key], fn);
    }
    return out;
};

/** Rewrite every alias to its canonical name. */
export function normalizeAliases(elements) {
    return walk(elements, (node) => {
        for (const [alias, canonical] of Object.entries(ALIASES)) {
            if (!Object.prototype.hasOwnProperty.call(node, alias)) continue;
            // Canonical wins. `aliasConflicts` is what tells the author.
            if (!Object.prototype.hasOwnProperty.call(node, canonical)) {
                node[canonical] = node[alias];
            }
            delete node[alias];
        }
        return node;
    });
}

/**
 * Places where an alias and its canonical name are both present with
 * DIFFERENT values — one of them is going to be ignored, and the author should
 * hear it from the validator rather than discover it in the page.
 */
export function aliasConflicts(elements, at = "elements") {
    const found = [];
    const visit = (node, path) => {
        if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${path}[${i}]`));
        if (!node || typeof node !== "object") return;
        for (const [alias, canonical] of Object.entries(ALIASES)) {
            if (Object.prototype.hasOwnProperty.call(node, alias) &&
                Object.prototype.hasOwnProperty.call(node, canonical) &&
                JSON.stringify(node[alias]) !== JSON.stringify(node[canonical])) {
                found.push({ path: `${path}.${alias}`, alias, canonical });
            }
        }
        for (const key of ["children", "items"]) {
            if (node[key] !== undefined) visit(node[key], `${path}.${key}`);
        }
    };
    visit(elements, at);
    return found;
}

/** Every name this module accepts, for the validator's vocabulary. */
export const ALIAS_NAMES = Object.freeze(Object.keys(ALIASES));
export const isCanonical = (name) => CANONICAL.has(name);


/**
 * Shapes that are not the library's but are what everyone writes.
 *
 * A table's rows as ARRAYS, header row first:
 *
 *     items: [["date","race"], ["29/08","Krusnoman"]]
 *       ->   items: [{ date: "29/08", race: "Krusnoman" }]
 *
 * The model in the Tier 2b run wrote exactly this, and it is the layout of
 * every CSV and every markdown table there is. Header-first is not a guess:
 * a table whose first row is data has no column names at all, and the mapper
 * needs them to build the head.
 *
 * Narrow on purpose — `table` only, and only when EVERY entry is an array.
 * A mixed list is left alone rather than half-converted.
 */
export function normalizeShapes(elements) {
    return walk(elements, (node) => {
        if (node.type !== "table" || !Array.isArray(node.items) || node.items.length < 2) return node;
        if (!node.items.every((r) => Array.isArray(r))) return node;

        const [head, ...rows] = node.items;
        if (!head.every((h) => typeof h === "string" || typeof h === "number")) return node;
        node.items = rows.map((row) =>
            Object.fromEntries(head.map((key, i) => [String(key), row[i]])));
        return node;
    });
}

/** Both passes, in the order the caller wants: names first, then shapes. */
export function normalizeSpec(elements) {
    return normalizeShapes(normalizeAliases(elements));
}

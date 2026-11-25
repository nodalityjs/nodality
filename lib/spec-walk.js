/*!
 * nodality v1.5.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * spec-walk.js — where an element spec can hold other element specs.
 *
 * One answer for every pass that walks E: the validator collecting the ids a
 * node may target, and the lowering passes that rewrite elements before they
 * are mapped. They used to walk `children` (plus a tab's children and a
 * disclosure's summary) and nothing else, so an element written inside a card
 * (`items: [[{type, id}]]`) or a list (`items: [{type, id}]`) rendered with
 * its id and every node aimed at it was reported UNKNOWN_TARGET.
 *
 * A slot entry counts as an element spec when it is an object with a string
 * `type` (or a `$ref`). That is the shape test, not a per-type table: data
 * entries — a nav's {title, link}, a card's {img, title, link}, a dropdown's
 * strings — carry no `type` and are left alone, whichever type holds them.
 *
 *   children        [spec]
 *   items           [spec | [spec] | {label, children: [spec]}]
 *   summary         spec            (disclosure)
 *   actions         [spec]          (nav)
 *   brand           spec            (nav)
 *
 * Pure data, no DOM, no imports.
 */

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Is `v` an element spec (or a reference to one)? */
export function isSpec(v) {
    return isObj(v) && (typeof v.type === "string" || typeof v.$ref === "string");
}

/**
 * Every element spec held directly by `el`'s spec-shaped slots, with the
 * path segment it sits at (".children[0]", ".items[2][0]", …).
 */
export function nestedSpecs(el) {
    const out = [];
    if (!isObj(el)) return out;
    const list = (arr, at) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((v, i) => { if (isSpec(v)) out.push({ spec: v, at: `${at}[${i}]` }); });
    };
    list(el.children, ".children");
    if (Array.isArray(el.items)) {
        el.items.forEach((entry, k) => {
            if (Array.isArray(entry)) list(entry, `.items[${k}]`);
            else if (isSpec(entry)) out.push({ spec: entry, at: `.items[${k}]` });
            else if (isObj(entry)) list(entry.children, `.items[${k}].children`);
        });
    }
    if (isSpec(el.summary)) out.push({ spec: el.summary, at: ".summary" });
    list(el.actions, ".actions");
    if (isSpec(el.brand)) out.push({ spec: el.brand, at: ".brand" });
    return out;
}

/**
 * Rewrite every spec in a tree, depth first. `fn(spec)` returns the spec to
 * use (the same object when nothing changes). Returns the input array itself
 * when nothing anywhere changed, so a page that the pass does not concern is
 * handed on untouched; otherwise new arrays/objects along the changed paths
 * only — the caller's objects are never written.
 */
export function mapSpecs(list, fn) {
    if (!Array.isArray(list)) return list;
    let changed = false;
    const next = list.map((v) => {
        const out = isSpec(v) ? mapOne(v, fn) : v;
        if (out !== v) changed = true;
        return out;
    });
    return changed ? next : list;
}

function mapOne(el, fn) {
    let out = fn(el);
    const set = (key, value) => {
        if (value === el[key]) return;
        if (out === el) out = { ...el };
        out[key] = value;
    };
    set("children", mapSpecs(el.children, fn));
    if (Array.isArray(el.items)) {
        let changed = false;
        const items = el.items.map((entry) => {
            let next = entry;
            if (Array.isArray(entry)) next = mapSpecs(entry, fn);
            else if (isSpec(entry)) next = mapOne(entry, fn);
            else if (isObj(entry) && Array.isArray(entry.children)) {
                const kids = mapSpecs(entry.children, fn);
                if (kids !== entry.children) next = { ...entry, children: kids };
            }
            if (next !== entry) changed = true;
            return next;
        });
        if (changed) set("items", items);
    }
    if (isSpec(el.summary)) set("summary", mapOne(el.summary, fn));
    set("actions", mapSpecs(el.actions, fn));
    if (isSpec(el.brand)) set("brand", mapOne(el.brand, fn));
    return out;
}

/*!
 * nodality v1.5.7
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * page-defaults.js — options every element on a page takes unless it says
 * otherwise: `new Des().defaults({ font: "Inter", color: "#111" })`.
 *
 * Why it exists: mappers default `el.font ?? "Arial"`, so an element without
 * `font` renders in Arial, and pages repeated the same font and colour on
 * every element to avoid it. Theme.setDefaults cannot help — it fills inline
 * style AFTER render and only for light/dark colours — and `Des.set()` runs
 * after `add()` has already built every component, so a default given there
 * would arrive too late. Defaults are therefore applied to the SPEC, before
 * the mapper sees it, which also makes the code panel and the round-trip show
 * them as ordinary options.
 *
 * Rules, each the conservative choice:
 *   - fill only keys that are missing (`undefined`); an explicit value —
 *     including `null` or `false` — always wins;
 *   - apply a key only to types whose schema lists it AND that are not known
 *     to ignore it (lib/known-inert.js), so a page-wide `color` does not plant
 *     PARAM_NOT_ON_TYPE / PARAM_INERT warnings on every checkbox;
 *   - recurse into `children` and into spec-shaped `items` (an entry that is
 *     an element — has a string `type` — or an array of them, the cards
 *     form). Data entries such as nav's `{ title, link }` are left alone;
 *   - never write to the caller's objects: the spec is copied on the way.
 *
 * Pure: no DOM. Shared by Des (designer.js) and validateNodes, so the page
 * that is validated is the page that renders.
 */
import { ELEMENT_PARAM_NAMES, ELEMENT_PARAMS_BY_TYPE } from "./element-params.generated.js";
import { KNOWN_INERT } from "./known-inert.js";
import { suggest, levenshtein } from "./suggest.js";

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Does `type` read `key` in a way that has an effect? */
export function typeTakes(type, key) {
    const vocab = ELEMENT_PARAMS_BY_TYPE[type];
    return !!vocab && vocab.includes(key) && !KNOWN_INERT.has(`${type}.${key}`);
}

/**
 * A copy of `elements` with `defaults` filled into every element that takes
 * them. With no defaults (or an empty object) the input array itself is
 * returned, so a page that does not use the feature is untouched by identity.
 */
export function applyPageDefaults(elements, defaults) {
    if (!Array.isArray(elements) || !isPlainObject(defaults)) return elements;
    const keys = Object.keys(defaults).filter((k) => defaults[k] !== undefined && k !== "type" && k !== "id");
    if (!keys.length) return elements;

    const fill = (el) => {
        if (Array.isArray(el)) return el.map(fill);
        if (!isPlainObject(el) || typeof el.type !== "string") return el;
        const out = { ...el };
        for (const k of keys) {
            if (out[k] === undefined && typeTakes(el.type, k)) out[k] = defaults[k];
        }
        if (Array.isArray(el.children)) out.children = el.children.map(fill);
        if (Array.isArray(el.items)) {
            out.items = el.items.map((entry) =>
                (Array.isArray(entry) || (isPlainObject(entry) && typeof entry.type === "string")) ? fill(entry) : entry);
        }
        return out;
    };
    return elements.map(fill);
}

/**
 * Findings about the defaults object itself, in the validator's report shape:
 * not an object, or a key no element type reads (with did-you-mean). Returned
 * as warnings — a bad default renders the page without it, it does not stop
 * the page.
 */
export function checkPageDefaults(defaults) {
    const out = [];
    if (defaults === undefined) return out;
    if (!isPlainObject(defaults)) {
        out.push({ code: "BAD_FIELD", path: "defaults", got: defaults, suggestions: [],
            valid: ['an object of element options, e.g. { font: "Inter", color: "#111" }'] });
        return out;
    }
    for (const key of Object.keys(defaults)) {
        if (key === "type" || key === "id") {
            out.push({ code: "BAD_FIELD", path: `defaults.${key}`, got: key, suggestions: [],
                valid: ["element options only: a page-wide `type` or `id` is never applied"] });
            continue;
        }
        if (!ELEMENT_PARAM_NAMES.includes(key)) {
            // Closest first, and a candidate holding every letter of the typo
            // in order (a dropped letter, `fnt` → `font`) ahead of one that
            // needs a letter changed — the ranking validate-nodes uses.
            const within = (c) => { let i = 0; for (const ch of c) if (ch === key[i]) i++; return i === key.length; };
            const score = (c) => levenshtein(key, c) - (c.length > key.length && within(c) ? 0.5 : 0) - (c[0] === key[0] ? 0.25 : 0);
            out.push({ code: "UNKNOWN_ELEMENT_PARAM", path: `defaults.${key}`, got: key,
                suggestions: suggest(key, ELEMENT_PARAM_NAMES)
                    .sort((a, b) => score(a) - score(b) || a.length - b.length || a.localeCompare(b)).slice(0, 3),
                valid: ["run `npx nodality schema <type>` for what each type reads"] });
        }
    }
    return out;
}

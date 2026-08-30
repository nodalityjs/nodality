/*!
 * nodality v1.2.11
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/**
 * Stage 5 of AGENTIC-FIRST-PLAN.md — the round-trip.
 *
 *     parse(html) -> spec        such that   render(parse(html)) === html
 *
 * The plan expected this to be partial at first, and measurement decided
 * exactly where the partial line falls.
 *
 * WHAT THE MEASUREMENT SAID. Rendering all 35 declared types in isolation and
 * comparing their DOM signatures: 13 of them — `cards`, `nav`, `sideNav`,
 * `row`, `dropdown`, `radio`, `labelInput`, `filePicker`, `checkbox`, `wrap`,
 * `circle`, `polygon`, `table` — produce a bare `<div>` with no class and no
 * attributes. Nothing in the output says which one produced it. Looking two
 * levels deeper separates 24 of 30, but only for the placeholder renders it
 * was calibrated on: a `row` holding an `h2` and a `wrap` holding an `h2` are
 * the same shape, so a signature table built from empty composites does not
 * match a page with content in it. Structural recognition of a composite is
 * therefore guesswork, and a parser that guesses wrong hands an agent a spec
 * that renders a different page.
 *
 * SO THERE ARE TWO TIERS, and they are not presented as one.
 *
 *   exact        The page carries its own spec: `set({annotate: true})` writes
 *                each element's descriptor onto the node it produced. parse
 *                reads it back. Round-trip is exact for every type, including
 *                every style option, because nothing is being inferred.
 *
 *   structural   No annotation: recover what the tag alone determines —
 *                headings, paragraphs, links, images, lists. These are the
 *                leaf types, which is the case the paper measures, and their
 *                tag is not shared with anything ambiguous.
 *
 * Annotation is OPT-IN and off by default. It writes attributes into the
 * output, and the whole project rests on existing pages rendering byte for
 * byte as they always did.
 *
 * The 1:1 correspondence between descriptors and mounted children that
 * `annotate` relies on is not a new assumption: morph nodes already resolve
 * `from`/`to` against the rendered children by position, for the same reason
 * (components do not all carry their id into the DOM). It was re-measured for
 * this stage across mixed leaf-and-composite specs.
 */

import { validateNodes } from "./validate-nodes.js";

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** The attribute a page uses to carry its own descriptors. */
export const SPEC_ATTR = "data-nod";

/**
 * Write each descriptor onto the child it produced. Returns how many were
 * written, which is what the caller needs to know if the two ever diverge.
 */
export function annotateRoundTrip(host, elements) {
    if (!host || !Array.isArray(elements)) return 0;
    const kids = Array.from(host.children || []);
    let written = 0;
    for (let i = 0; i < kids.length && i < elements.length; i++) {
        try {
            kids[i].setAttribute(SPEC_ATTR, JSON.stringify(elements[i]));
            written++;
        } catch (e) { /* a node that refuses attributes is skipped, not fatal */ }
    }
    return written;
}

/**
 * Recover what the tag alone determines. Deliberately narrow: returning a
 * confident guess for a composite would be worse than returning nothing,
 * because the caller re-renders whatever comes back.
 */
export function inferNode(node) {
    const tag = (node.tagName || "").toLowerCase();
    if (HEADINGS.has(tag)) return { type: tag, text: node.textContent };
    if (tag === "p") return { type: "p", text: node.textContent };
    if (tag === "a") {
        return { type: "a", text: node.textContent, url: node.getAttribute("href") || "" };
    }
    if (tag === "img") return { type: "img", url: node.getAttribute("src") || "" };
    if (tag === "ul") {
        return { type: "ulist", items: Array.from(node.children).map((c) => c.textContent) };
    }
    return null;
}

/** One node to one descriptor: the carried spec if there is one, else inference. */
export function parseNode(node) {
    if (!node || node.nodeType !== 1) return null;
    const carried = node.getAttribute && node.getAttribute(SPEC_ATTR);
    if (carried) {
        try { return JSON.parse(carried); }
        catch (e) { /* a corrupted attribute falls through to inference */ }
    }
    return inferNode(node);
}

/**
 * parse(html) -> spec. `doc` is only needed off-browser, where the caller
 * supplies a document; the library's own globals are shadowed by the bridge,
 * so this builds its container through createElement rather than a
 * constructor.
 */
export function parseHTML(html, doc) {
    const d = doc || (typeof document !== "undefined" ? document : null);
    if (!d) throw new Error("[nodality] parseHTML needs a document");
    const box = d.createElement("div");
    box.innerHTML = String(html == null ? "" : html);
    return Array.from(box.children).map(parseNode).filter(Boolean);
}

/**
 * What parse could NOT recover, so a caller can tell a partial read from a
 * complete one instead of discovering it at render time.
 */
export function parseReport(html, doc) {
    const d = doc || (typeof document !== "undefined" ? document : null);
    if (!d) throw new Error("[nodality] parseReport needs a document");
    const box = d.createElement("div");
    box.innerHTML = String(html == null ? "" : html);
    const kids = Array.from(box.children);
    const spec = [], unrecovered = [];
    kids.forEach((node, i) => {
        const one = parseNode(node);
        if (one) spec.push(one);
        else unrecovered.push({ index: i, tag: (node.tagName || "").toLowerCase() });
    });
    // What parse returns is UNTRUSTED. A `data-nod` attribute is just text in
    // a document: hand-edited, served by someone else, or written by a version
    // of the library that is not this one. The caller's next move is to render
    // it, so the recovered spec is checked here rather than after it has
    // already become a page. This is also the first place Stage 3 and Stage 5
    // compose — the validator that makes a spec repairable is the one that
    // makes a parsed spec safe.
    const check = validateNodes([], spec);

    return {
        ok: unrecovered.length === 0 && check.ok,
        exact: kids.every((n) => n.getAttribute && n.getAttribute(SPEC_ATTR)),
        total: kids.length,
        spec,
        unrecovered,
        errors: check.errors,
    };
}

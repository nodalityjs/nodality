/**
 * Tier 1 of AGENTIC-FIRST-PLAN.md §10 — what a page actually does.
 *
 * Everything else in this library checks the INPUT. `validate_nodes` checks
 * vocabulary, the schema says what a type accepts, the parser says what a page
 * was made from. None of them can tell an agent that the page it just produced
 * overflows its viewport, clips its own text, or is unreadable. The loop is
 * write-only: a spec can be perfect and the page still wrong.
 *
 * This closes it. The checks need REAL LAYOUT — geometry, computed styles,
 * stacking — which jsdom does not have, so this drives a browser through
 * Playwright. Playwright is not a dependency of this package, for the same
 * reason jsdom is not: it is a build-time concern and bundling it would put a
 * large download into every install that never renders anything. Its absence
 * arrives as a report, never as a stack trace.
 *
 * The report shape is deliberately the one `validate_nodes` returns —
 * `{ ok, errors: [{ code, path, got, suggestions, valid }] }` — because an
 * agent should parse one thing. `path` is a CSS selector rather than a spec
 * path: these are facts about the rendered page, and the selector is what
 * locates them in it.
 *
 * WHAT IT DOES NOT DO. It does not judge whether a design is good. Every check
 * here is a fact that can be measured and that a reasonable page does not
 * exhibit — text outside its box, a target too small to hit, a heading level
 * skipped. Taste is not in scope and should not be faked.
 */

/** Viewports every page is checked at unless the caller says otherwise. */
export const DEFAULT_VIEWPORTS = [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
];

/**
 * The checks, as a function evaluated inside the page. Written as one string
 * so it crosses the browser boundary intact; everything it needs is in scope
 * there and nothing from this module is.
 */
const IN_PAGE = () => {
    const out = [];

    /**
     * A PAGE-UNIQUE selector, so a report can be acted on.
     *
     * The first version was parent-relative and returned `input` for any input
     * that was the only one under its own div. A form with three unlabelled
     * fields produced the string "input" three times, the merge at the bottom
     * of this file keyed on it, and three findings collapsed into one row
     * reading `viewport: "mobile, mobile, mobile"`. The agent was told neither
     * which control nor that there were three — Tier 7 watched a model fail to
     * repair exactly that. A path walks to the nearest id, or to the body.
     */
    const sel = (el) => {
        if (!el || !el.tagName) return "?";
        const seg = (n) => {
            const tag = n.tagName.toLowerCase();
            const sibs = n.parentElement
                ? [...n.parentElement.children].filter((x) => x.tagName === n.tagName) : [];
            return sibs.length > 1 ? `${tag}:nth-of-type(${sibs.indexOf(n) + 1})` : tag;
        };
        const parts = [];
        for (let n = el; n && n !== document.body; n = n.parentElement) {
            if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
            parts.unshift(seg(n));
        }
        return parts.join(" > ") || el.tagName.toLowerCase();
    };

    /**
     * The SPEC node an element came from, when the page carries annotation.
     * A selector says where in the DOM; this says which descriptor to edit,
     * which is the thing an agent repairing a spec actually needs. Free when
     * the annotation is there, null when it is not — it is opt-in, and the
     * attribute name is spelled out here because this function crosses into
     * the browser as a string and cannot import `SPEC_ATTR`. A test pins the
     * two together.
     */
    const nod = (el) => {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
            const v = n.getAttribute && n.getAttribute("data-nod");
            if (v) return v;
        }
        return null;
    };

    // `target` is the element itself, so a finding can carry both. A string is
    // passed for findings about the document rather than about an element.
    const add = (code, target, got, detail) => {
        const isEl = !!(target && target.tagName);
        out.push({
            code, path: isEl ? sel(target) : String(target), got, detail,
            nod: isEl ? nod(target) : null,
        });
    };

    /**
     * A name assistive technology can announce.
     *
     * Was `aria-label` alone, which is only one of the four ways to give one
     * and the least used. A control correctly labelled by a `<label for>` —
     * the ordinary HTML way — was reported as unnamed, and a false finding
     * sends a repair at something that was never broken, which this file
     * argues elsewhere is worse than a miss.
     */
    const hasName = (el) => {
        if ((el.getAttribute("aria-label") || "").trim()) return true;
        if ((el.getAttribute("title") || "").trim()) return true;
        const by = (el.getAttribute("aria-labelledby") || "").trim();
        if (by && by.split(/\s+/).some((id) => {
            const t = document.getElementById(id);
            return t && (t.textContent || "").trim();
        })) return true;
        if (el.id) {
            const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (l && (l.textContent || "").trim()) return true;
        }
        const wrap = el.closest && el.closest("label");
        if (wrap && (wrap.textContent || "").trim()) return true;
        return false;
    };

    const all = [...document.body.querySelectorAll("*")];
    const vw = window.innerWidth;

    // 1. The page scrolls sideways. Almost never intended, and the single most
    //    common way a generated layout is visibly broken on a phone.
    if (document.documentElement.scrollWidth > vw + 1) {
        add("HORIZONTAL_OVERFLOW", "html", document.documentElement.scrollWidth,
            `the document is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`);
    }

    for (const el of all) {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;

        // 2. An element sticking out past the right edge. Left/top are not
        //    checked: off-canvas menus and slide-in panels park there legitimately.
        if (r.right > vw + 1 && cs.position !== "fixed") {
            add("ELEMENT_OVERFLOWS_VIEWPORT", el, Math.round(r.right),
                `extends ${Math.round(r.right - vw)}px past the ${vw}px viewport`);
        }

        // 3. Content taller than its own box, with the overflow hidden — the
        //    signature of clipped text, which reads as missing content.
        if ((cs.overflow === "hidden" || cs.overflowY === "hidden") &&
            el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0 &&
            (el.textContent || "").trim().length > 0) {
            add("CONTENT_CLIPPED", el, el.scrollHeight,
                `content is ${el.scrollHeight}px in a ${el.clientHeight}px box with overflow hidden`);
        }

        // 4. An image nobody can describe. Covers the background-image form
        //    too, which is what this library's cards emit.
        const tag = el.tagName.toLowerCase();
        if (tag === "img" && !el.hasAttribute("alt")) {
            add("IMAGE_WITHOUT_ALT", el, el.getAttribute("src") || "", "no alt attribute");
        }
        if (el.getAttribute("role") === "img" && !el.getAttribute("aria-label")) {
            add("IMAGE_WITHOUT_ALT", el, "role=img", "role=img with no aria-label");
        }

        // 5. A target too small to hit. 24px is the WCAG 2.2 AA minimum.
        //
        // `select` and `textarea` were both missing from this set, so neither
        // check below ever ran on one. A picker could not be given an
        // accessible name at all — `label` reached the component and nothing
        // read it — and no report said so, because the checker was not
        // looking. Two blind spots that hid each other.
        const interactive = tag === "a" || tag === "button" ||
            (tag === "input" && el.type !== "hidden") ||
            tag === "select" || tag === "textarea" ||
            el.getAttribute("role") === "button";
        if (interactive && r.width > 0 && (r.width < 24 || r.height < 24)) {
            add("TAP_TARGET_TOO_SMALL", el, `${Math.round(r.width)}x${Math.round(r.height)}`,
                "below the 24x24 minimum");
        }

        // 6. A control with nothing to announce.
        //
        // A <select>'s own text is its OPTIONS and a <textarea>'s is its
        // VALUE. Neither names the control, so the textContent shortcut that
        // clears a button by its caption must not clear these.
        const ownText = (tag === "select" || tag === "textarea")
            ? "" : (el.textContent || "").trim();
        if (interactive && !ownText && !hasName(el) &&
            !el.querySelector("img[alt]:not([alt=''])")) {
            add("CONTROL_WITHOUT_LABEL", el, tag, "no text and no accessible name");
        }
    }

    // 7. Heading levels that skip. A generated page is often read by machines
    //    before people, and the outline is the structure they read.
    const heads = all.filter((e) => /^H[1-6]$/.test(e.tagName));
    let prev = 0;
    for (const h of heads) {
        const lvl = Number(h.tagName[1]);
        if (prev && lvl > prev + 1) {
            add("HEADING_LEVEL_SKIPPED", h, h.tagName,
                `h${prev} is followed by ${h.tagName.toLowerCase()}`);
        }
        prev = lvl;
    }

    // 8. Text nobody can read. Only where a background colour is actually
    //    resolvable — guessing through an image would produce false alarms,
    //    and a false alarm here costs more than a miss.
    const lum = (c) => {
        const m = c.match(/[\d.]+/g);
        if (!m || m.length < 3) return null;
        if (m.length > 3 && Number(m[3]) === 0) return null;
        const [r, g, b] = m.slice(0, 3).map((v) => {
            const s = Number(v) / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bgOf = (el) => {
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
            const l = lum(cs.backgroundColor);
            if (l !== null) return l;
        }
        return lum(getComputedStyle(document.body).backgroundColor);
    };
    for (const el of all) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!own) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const fg = lum(cs.color), bg = bgOf(el);
        if (fg === null || bg === null) continue;
        const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        const size = parseFloat(cs.fontSize) || 16;
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const need = large ? 3 : 4.5;
        if (ratio < need) {
            add("LOW_CONTRAST", el, `${ratio.toFixed(2)}:1`,
                `needs ${need}:1 at ${Math.round(size)}px`);
        }
    }
    return out;
};

/**
 * How to repair each finding, in THIS library's vocabulary.
 *
 * `suggestions` and `valid` are in the finding shape because `validate_nodes`
 * puts repairs there, and check_page left both empty on every finding it has
 * ever emitted — a field that is always blank is a field an agent learns to
 * ignore. Tier 7 measured the cost. Told only "54x23, below the 24x24
 * minimum", the strong model guessed `keySet: {key, value}` and was right, the
 * weaker one invented `keySet: {"--tap-target-size": "44px"}` and was wrong,
 * and the page stayed broken through the repair turn. Naming the element was
 * not enough; the report has to name the edit.
 *
 * Kept deliberately short. These are the repair that fits the overwhelming
 * majority of cases, not a treatment of every way a page can be wrong — an
 * agent that needs more has `npx nodality schema <type>`.
 */
const REPAIRS = {
    TAP_TARGET_TOO_SMALL: {
        suggestions: [`keySet: { key: "min-height", value: "44px" }`,
                      `keySet: { key: "min-width", value: "44px" }`,
                      `pad: [{ a: 12 }]`],
        valid: ["at least 24x24 CSS pixels, per WCAG 2.2 AA target size (minimum)"],
    },
    CONTROL_WITHOUT_LABEL: {
        suggestions: [`label: "<what the field is for>"  (input, labelInput, picker)`,
                      `text: "<what the control does>"  (button, a)`],
        valid: ["every control needs a name assistive technology can announce; " +
                "a placeholder is not one"],
    },
    IMAGE_WITHOUT_ALT: {
        suggestions: [`alt: "<what the image shows>"`,
                      `alt: ""  if it is decorative and repeats nearby text`],
        valid: ["img takes `alt`; a background image takes it too and becomes aria-label"],
    },
    LOW_CONTRAST: {
        suggestions: [`color: "<a darker or lighter text colour>"`,
                      `background: "<a background with more separation>"`],
        valid: ["4.5:1 for body text, 3:1 at 24px or at 18.66px bold"],
    },
    HEADING_LEVEL_SKIPPED: {
        suggestions: [`tag: "h<the next level down>"`],
        valid: ["`tag` sets the heading level independently of the size scale, " +
                "so the outline can be correct without changing the design"],
    },
    ELEMENT_OVERFLOWS_VIEWPORT: {
        suggestions: [`maxWidth: "100%"`, `width: "100%"`, `breakWord: true`],
        valid: ["nothing may extend past the right edge of the viewport"],
    },
    HORIZONTAL_OVERFLOW: {
        suggestions: [`maxWidth: "100%" on whichever element the other findings name`],
        valid: ["the document may not be wider than the viewport"],
    },
    CONTENT_CLIPPED: {
        suggestions: [`height: "auto"`, `overflow: "visible"`],
        valid: ["a box with `overflow: hidden` must be tall enough for its text"],
    },
};

/**
 * Check rendered HTML and return a report in the shape everything else here
 * returns. `html` is a full document or a fragment; a fragment is wrapped.
 */
export async function checkPage(html, opts = {}) {
    const viewports = opts.viewports || DEFAULT_VIEWPORTS;
    // `load` is right for a self-contained page, which is what this library
    // emits. A page whose styling arrives over the network — a CDN stylesheet,
    // a webfont — has not been laid out yet at `load`, and measuring it there
    // reports the unstyled document. Callers checking such a page pass
    // "networkidle".
    const waitUntil = opts.waitUntil || "load";
    let chromium;
    try {
        ({ chromium } = await import("playwright"));
    } catch (e) {
        // The same arrangement `preview` uses for jsdom: a missing build-time
        // package is a report, not a crash, and it names what to install.
        return {
            ok: false,
            errors: [{
                code: "MISSING_PEER_DEPENDENCY",
                path: "check_page",
                got: "playwright",
                suggestions: ["npm install --save-dev playwright", "npx playwright install chromium"],
                valid: [],
                detail: "checking a page needs real layout — geometry and computed " +
                    "styles — which only a browser has. The library does not bundle " +
                    "one: it is needed for checking, not for rendering, and bundling " +
                    "it would put a large download into every install.",
            }],
        };
    }

    const doc = /<html[\s>]/i.test(html)
        ? html
        : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;

    const browser = await chromium.launch();
    const errors = [];
    try {
        for (const vp of viewports) {
            const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            try {
                await page.setContent(doc, { waitUntil });
                const found = await page.evaluate(IN_PAGE);
                for (const f of found) {
                    errors.push({
                        code: f.code,
                        path: f.path,
                        got: f.got,
                        suggestions: REPAIRS[f.code]?.suggestions ?? [],
                        valid: REPAIRS[f.code]?.valid ?? [],
                        detail: f.detail,
                        // The spec node, when the page was annotated. Null
                        // otherwise, rather than absent, so the field's
                        // meaning does not depend on whether it is there.
                        nod: f.nod ?? null,
                        viewport: vp.name,
                    });
                }
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }

    // The same finding at two viewports is one problem, reported once, with
    // the widths it was seen at. An agent repairing a page should see a list
    // of problems, not a list of measurements.
    const merged = new Map();
    for (const e of errors) {
        const key = `${e.code}|${e.path}|${e.detail}`;
        if (merged.has(key)) merged.get(key).viewport += `, ${e.viewport}`;
        else merged.set(key, { ...e });
    }
    const list = [...merged.values()];
    return { ok: list.length === 0, errors: list, viewports: viewports.map((v) => v.name) };
}

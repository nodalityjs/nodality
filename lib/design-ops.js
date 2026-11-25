/*!
 * nodality v1.5.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * design-ops.js — what each DESIGN op reads inside its `op` object.
 *
 * Raster ops declare their parameters where they are defined
 * (lib/raster-ops.js, `doc.params`), so `list_ops` has always described them
 * and the validator has always rejected a misspelled one. Design ops had no
 * such table: their options are read in a dozen places — chainReact in
 * layout/animator.js, each component's callReact (`obj.gradient.op.gradient`,
 * `obj.stroke.op.width`), designer.js's shorthand expansion, the link styler,
 * the free-layout mapper — and nothing collected them. So `list_ops` listed no
 * parameters for any of them, and `{ op: { name: "shadow", colours: [...] } }`
 * validated clean and rendered a grey shadow: the silent no-op this library
 * keeps paying for, one object deeper than the validator looked.
 *
 * Every entry below was recovered by reading the code that consumes it, and
 * names that code in `readIn`. It is NOT generated: the reads go through
 * aliases (`let ass = this.options.animation.op`, `const { op } = …shadow`,
 * `transform = obj.op`) that no regex can attribute to an op reliably.
 * Instead __tests__/unit/core-gaps.test.mjs scans the same sources for every
 * `.op.<key>` read (and the known aliases) and fails if one is not registered
 * here — and fails the other way if a registered key is read nowhere. That is
 * the drift guard; this file is the description.
 *
 * `unit` is a shape the validator knows (see SHAPES in validate-nodes.js).
 * `inert` marks a key that IS read but provably changes nothing, with the
 * reason; the validator reports it as PARAM_INERT rather than accepting it in
 * silence, because "registered" must not be read as "works".
 *
 * Pure data, no DOM, no imports — safe in the bundle and in the MCP server.
 */

/**
 * The presets a transform node's top-level `style` may name. Read off the
 * `cool === "…"` chain in designer.js (a test re-reads it and compares), so
 * an unknown name — which silently falls through to the default motion — can
 * be reported.
 */
export const TRANSFORM_STYLES = [
    "SOLARIUM", "WAVE", "CUBE-SPIN", "TORNADO-SWITCH", "LASER-SWEEP",
    "TORNADO-TWIST", "JELLY-WOBBLE", "DRUNKEN-SWAY", "FLAME-FLICKER",
    "PHANTOM-SHIFT", "RUBBER-BOUNCE", "ASTEROID-CRASH", "CYBER-GLITCH",
    "BUBBLE-POP", "SUPERNOVA-BURST", "GRAVITY-DROP", "VORTEX-SINK", "SHOCKWAVE",
];

/** Free-layout arrangements `mapFree` recognises for `layout`/`slayout`. */
const FREE_LAYOUTS = ["text-above-image", "image-above-text", "img-overlay-text", "img-leftof-text"];

/** Tokens LinkStyler.style splits `ops` into ("air-round-hover"). */
export const LINK_STYLE_TOKENS = ["air", "round", "full", "pill", "hover"];

// A Des transform node: the preset named by the node's top-level `style`
// (default motion when absent) supplies `values`, and every key written
// inside `op` is laid over it (designer.js, Des.transformOwnOptions). Until
// round 2 the preset REPLACED the op and these keys were all dropped.

/**
 * op name -> { summary, readIn, params: { key: { unit, summary, inert? } } }.
 * `params` is what may appear inside `op` besides `name`.
 */
export const DESIGN_OP_PARAMS = {
    animation: {
        summary:
            "Plays Web Animations keyframes on the target. With fireAt \"inview\" the element is put in its " +
            "keyframesClose end state at once and plays keyframesOpen the first time it scrolls into view " +
            "(IntersectionObserver, once). With fireAt \"<n>px\" the same happens once window.scrollY passes n. " +
            "With no fireAt it plays keyframesOpen/keyframesClose on the window events \"sidebar:open\" / " +
            "\"sidebar:closed\" (how the side nav animates its links).",
        readIn: ["layout/animator.js chainReact", "layout/side-nav-bar.js"],
        params: {
            fireAt: {
                unit: "fire-at",
                summary: "When to play: \"inview\" (first time visible) or \"<n>px\" (scrollY past n). Omit for the sidebar open/close events. Anything else plays nothing.",
            },
            keyframesOpen: {
                unit: "keyframes",
                summary: "Keyframes played to reveal, Web Animations form: [{opacity: 0, transform: \"translateY(20px)\"}, {opacity: 1, transform: \"none\"}].",
            },
            keyframesClose: {
                unit: "keyframes",
                summary: "Keyframes of the hidden state. Applied instantly (duration 0, fill forwards) before the reveal for fireAt \"inview\"/\"<n>px\", so its LAST frame is the start state; played with closeOptions on \"sidebar:closed\".",
            },
            openOptions: {
                unit: "anim-options",
                summary: "Web Animations options for the reveal: {duration: ms, delay, easing, fill: \"forwards\"}, or a duration in ms. Without fill: \"forwards\" the element snaps back to keyframesClose when it ends.",
            },
            closeOptions: {
                unit: "anim-options",
                summary: "Web Animations options for keyframesClose on \"sidebar:closed\" (fireAt omitted only).",
            },
        },
    },
    arrange: {
        summary: "Switches a row, cards grid or nav between arrangements inside the node's `range` (lowered onto resprop / the nav breakpoint).",
        readIn: ["lib/responsive.js lowerArrange"],
        params: {
            mode: { unit: "enum(row|column|expand|collapse)", summary: "row / column for a row or cards; collapse / expand for a nav. Default column." },
        },
    },
    background: {
        summary:
            "Paints the target's background inside `range`: `color` and/or `gradient`. Applied per element when it is " +
            "built (lib/lower-style-ops.js), the first background node reaching the element deciding; on a nav, to its " +
            "bars. With neither option it paints green, as it always did.",
        readIn: ["lib/lower-style-ops.js loweredStyle", "layout/animator.js chainReact (no options: green)"],
        params: {
            color: { unit: "color", summary: "Background colour, any CSS colour (written as background-color)." },
            gradient: { unit: "css-gradient", summary: "A CSS gradient (written as background-image), e.g. \"linear-gradient(#fff, #eee)\". With `color` too, the colour shows through transparent parts." },
        },
    },
    blast: {
        summary: "Outlined text: transparent fill with a coloured stroke (text), or an orange border (wrap, row).",
        readIn: ["layout/animator.js chainReact", "every component's callReact (globalBlast)"],
        params: {
            color: { unit: "color", summary: "Stroke colour, any CSS colour." },
            width: { unit: "css-length", summary: "Stroke width with a unit, e.g. \"2px\" (default \"1px\"). A bare number works on wrap/row only." },
        },
    },
    "card-style": {
        summary:
            "Inert: accepted and changes nothing (INERT_OP). Its options were read only by CardGen, a code " +
            "generator for an external theme store that the library does not ship and no mapper calls. Style a " +
            "`cards` grid with element options and the gradient/shadow/filter/blast nodes aimed at its id.",
        readIn: ["lib/card-getter.js (unreachable)", "lib/element-mapper.js mapGrid (assigned, never used)"],
        params: {
            theme: { unit: "text", summary: "A CardGen theme name.", inert: "card-style is inert: CardGen, the only reader, is never called and its themes are not in the library" },
            ops: { unit: "text", summary: "CardGen options, e.g. \"text-blast\".", inert: "card-style is inert: CardGen, the only reader, is never called and its themes are not in the library" },
        },
    },
    filter: {
        summary: "A CSS filter on the target, e.g. grayscale or blur.",
        readIn: ["layout/animator.js chainReact", "layout/image.js"],
        params: {
            filter: { unit: "css-filter", summary: "A CSS filter value, verbatim: \"grayscale(0.7)\", \"blur(4px) brightness(1.2)\"." },
        },
    },
    gradient: {
        summary: "Gradient fill: clipped to the text on text elements, the background on wrap/row.",
        readIn: ["each component's callReact (globalGradient)", "layout/animator.js chainReact"],
        params: {
            gradient: { unit: "css-gradient", summary: "A CSS gradient: \"linear-gradient(90deg, #1d6fe0, #7fd1ff)\". Required unless direction is \"radial\"." },
            direction: { unit: "enum(radial)", summary: "\"radial\" REPLACES the gradient with the built-in radial one (orange to green). Any other value is ignored." },
        },
    },
    layout: {
        summary: "Arrangement of a `free` element's text and image. Shares one decision per page with slayout.",
        readIn: ["lib/element-mapper.js mapFree"],
        params: {
            value: { unit: `enum(${FREE_LAYOUTS.join("|")})`, summary: "How the free layout places its text and image." },
        },
    },
    slayout: {
        summary: "Same as layout (one decision per page, shared with layout).",
        readIn: ["lib/element-mapper.js mapFree"],
        params: {
            value: { unit: `enum(${FREE_LAYOUTS.join("|")})`, summary: "How the free layout places its text and image." },
        },
    },
    "link-style": {
        summary: "Button-like styling for links. Every matching node applies in order; only target[0] is compared.",
        readIn: ["lib/link-getter.js LinkStyler.style"],
        params: {
            ops: { unit: "link-style-ops", summary: `Dash-joined tokens, e.g. "air-round-hover": ${LINK_STYLE_TOKENS.join(", ")}.` },
        },
    },
    margin: {
        summary:
            "Margins: `margin` for every target inside `range`, or, without it, `offsets` indexed by each " +
            "element's own `index` option. Both are applied per element when it is built " +
            "(lib/lower-style-ops.js), on every element type — on a nav, to its bars.",
        readIn: ["lib/lower-style-ops.js loweredStyle"],
        params: {
            offsets: { unit: "numbers", summary: "Margins in px; the element with `index: i` takes offsets[i] (an element without `index` takes none). Used only by a node without `margin`." },
            margin: { unit: "px-or-length", summary: "A CSS margin for every target, e.g. \"2rem 0\" or \"12px\"; a bare number is px." },
        },
    },
    navStyle: {
        summary: "Accepted and read by nothing (see semantics: inert).",
        readIn: [],
        params: {},
    },
    shadow: {
        summary: "Stacked shadows: box-shadow on wrap/row, drop-shadow filters on everything else.",
        readIn: ["layout/animator.js chainReact"],
        params: {
            steps: { unit: "count", summary: "How many shadows to stack (default 1)." },
            colors: { unit: "colors", summary: "Colour of each step: [\"#000\", \"#333\"]. A step without its own colour takes the first (default [\"gray\"])." },
            movements: { unit: "css-lengths", summary: "[x, y] offset with units, or one value for both (default [\"3px\", \"3px\"])." },
            radius: { unit: "css-length", summary: "Blur radius with a unit (default \"3px\")." },
        },
    },
    span: {
        summary: "Styles parts of a text element's text separately. Text elements only.",
        readIn: ["layout/animator.js chainReact"],
        params: {
            parts: { unit: "span-parts", summary: "[{ text, style }]: each `text` must occur in the element's text, in order; `style` takes Text options (color, weight, italic, …)." },
        },
    },
    transform: {
        summary:
            "Animates a transform onto the target on load (or on `on`) and back after half the duration. In a Des node " +
            "the node's TOP-LEVEL `style` picks a preset of `values`; every key inside `op` is laid over the preset, so " +
            "`values` replaces it and `on`, `keep`, `delay`, … apply as written.",
        readIn: ["lib/designer.js (preset, then the op's own keys)", "layout/animator.js reactOnTransform"],
        params: {
            values: { unit: "array", summary: "Transform steps, e.g. [\"ty:-20px\", \"scale(1.1)\", \"rotate(3deg)\"]. Replaces the preset's." },
            duration: { unit: "transform-duration", summary: "\"3s-ease-in-out\" form (a whole number of seconds), \"<n>s\", or \"fast\" | \"medium\" | \"slow\". Default 3s. Wins over the node's top-level `duration`." },
            on: { unit: "text", summary: "DOM event that triggers it, e.g. \"mouseover\" (it resets on mouseout unless `keep`). Default: page load." },
            delay: { unit: "count", summary: "Delay in ms." },
            keep: { unit: "bool", summary: "Keep the end state instead of resetting." },
            static: { unit: "bool", summary: "No transition: jump to the end state." },
            closeAfter: { unit: "count", summary: "Extra ms before resetting (load-triggered only)." },
            hardCSS: { unit: "text", summary: "A CSS transform written verbatim, applied after the steps." },
        },
    },
};

/**
 * Top-level keys of a design node, documented once for list_ops. The
 * validator's allowlist (DESIGN_FIELDS in validate-nodes.js) decides which
 * are accepted; this says what they do.
 */
export const DESIGN_NODE_FIELDS = {
    op: "{ name, …params } — or one of the shorthand strings blast, gradient, shadow, filter, animation, transform, span.",
    target: "Element ids the node applies to. Omitted: every element.",
    range: "[from, to] viewport widths in px (\"0px\" strings or numbers) inside which the node applies. Omitted: every width.",
    style: `transform only: the preset — ${TRANSFORM_STYLES.join(", ")}. Omitted: a default skew/rotate motion. Keys inside \`op\` (values, on, keep, …) are laid over it.`,
    duration: "transform only: the motion's duration — \"fast\" | \"medium\" | \"slow\" or \"<n>s-ease-in-out\" — used unless `op.duration` is given (designer.js). Omitted: 3s.",
};

/*!
 * morph-node.js — `{ op: "morph" }`, the (E,N) form of a transition.
 *
 * Everything else in N describes how an element LOOKS. A morph node
 * describes which element BECOMES which, and on what interaction:
 *
 *     { op: "morph", from: "topnav", to: ["work", "about", "contact"],
 *       effect: "t-vhs", duration: 900, back: true }
 *
 * Before this, a transition was the one thing the two arrays could not
 * express. A page wanting a morph had to capture both sides itself,
 * measure two rects, call applyRasterPipeline with a `transition` block,
 * drive `t` through a timeline, and wire the clicks — a few hundred lines
 * sitting *around* the arrays rather than in them.
 *
 * What this owns, so a caller does not have to:
 *
 *   - the destinations start hidden, so only the source is on screen
 *   - link i in the source maps to destination i
 *   - both sides are captured as stills and travel one converging box
 *   - `back: true` wires the destination's own button to return
 *
 * Runs AFTER Des has mounted, because it needs rendered geometry: rects
 * come from real layout, not from the descriptors.
 */

import { applyRasterPipeline, activeRasterPipelines } from "./raster-ops.js";
import { preset } from "./raster-presets.js";
import { progressTimeline } from "./transition.js";

/** An element's box in its host's coordinates — what a transition wants. */
const rectIn = (host, el) => {
    const h = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.x - h.x, y: r.y - h.y, w: r.width, h: r.height };
};

/**
 * Freeze a subtree into an Image.
 *
 * Two things a naive foreignObject capture gets wrong, both of which show
 * up as a jump at the handover:
 *
 *   - RESOLUTION. Asking for w x h rasterises at CSS density, so on a 2x
 *     display the still is half the density of the box it is drawn into
 *     and reads soft next to real text. The viewBox stays in CSS units;
 *     only the raster grid grows.
 *   - VIEWPORT UNITS. Nodality sizes text with calc(1.375rem + 3.525vw).
 *     Inside a foreignObject, vw resolves against the SVG's OWN viewport,
 *     not the page — so the same heading renders ~33px in a 300px capture
 *     and ~89px on a wide window. Computed type is copied onto the clone
 *     so the still matches the layout it replaces.
 */
async function capture(el, w, h) {
    const clone = el.cloneNode(true);
    clone.style.position = "static";
    clone.style.left = clone.style.top = "0";
    clone.style.margin = "0";
    // The element being captured is kept visibility:hidden so it cannot
    // flash before the pipeline owns it (see goTo). It still lays out, so
    // rects and serialisation are correct — but the clone has to paint.
    clone.style.visibility = "visible";

    const src = [el, ...el.querySelectorAll("*")];
    const dst = [clone, ...clone.querySelectorAll("*")];
    for (let i = 0; i < src.length; i++) {
        const cs = getComputedStyle(src[i]);
        dst[i].style.fontSize = cs.fontSize;
        dst[i].style.lineHeight = cs.lineHeight;
        dst[i].style.fontWeight = cs.fontWeight;
        dst[i].style.fontFamily = cs.fontFamily;
        dst[i].style.letterSpacing = cs.letterSpacing;
        // BOX metrics too, not just type. `width: min(560px, 92vw)`
        // re-resolves inside the foreignObject against the SVG's viewport
        // rather than the page, so a card measured at 307px lays out at
        // 282px in the capture — and that narrower layout is then
        // stretched back into the 307px box. The BOX matches, so it
        // measures clean; the CONTENT inside is visibly scaled up, and
        // swapping it for the real element at t=1 is a pop.
        dst[i].style.width = cs.width;
        dst[i].style.height = cs.height;
        dst[i].style.padding = cs.padding;
        dst[i].style.boxSizing = "content-box";
    }

    const R = Math.max(1, Math.min(
        (typeof window !== "undefined" && window.devicePixelRatio) || 1, 3));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * R}" ` +
        `height="${h * R}" viewBox="0 0 ${w} ${h}">` +
        `<foreignObject width="100%" height="100%">` +
        `<div xmlns="http://www.w3.org/1999/xhtml">` +
        new XMLSerializer().serializeToString(clone) +
        `</div></foreignObject></svg>`;
    // createElement, NOT `new Image()`. This library EXPORTS a component
    // called `Image`, and the standard way to consume it is
    // `Object.assign(globalThis, N)` — which overwrites the DOM
    // constructor with the component on every page that does it. The
    // failure is silent and total: `new Image()` returns a component,
    // `onload`/`src` become inert properties, the promise below never
    // settles, and the awaiting morph hangs forever with no error, no
    // canvas and no rejected promise to log. See also `toImage` in
    // raster-ops.js, which had the same bug.
    const img = document.createElement("img");
    await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
    return img;
}

const chainFor = (effect) => {
    if (!effect) return [];
    if (Array.isArray(effect)) return effect;         // an inline node array
    try { return preset(effect) || []; } catch (e) { return []; }
};

const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * An id as written, reduced to the id itself.
 *
 * A node may name a state bare (`"home"`) or in selector form
 * (`"#home"`). Both are accepted and both mean the same thing, because
 * this is an element IDENTIFIER rather than a selector: the lookup is
 * `getElementById`, plus a positional fallback against `E`, so `"#home"`
 * would otherwise match nothing and the morph would fail with a console
 * warning and no visible effect.
 *
 * Normalised HERE, once, rather than at the point of lookup: the states
 * are keyed by this string, so a chain whose first edge writes `"#home"`
 * and whose second writes `"home"` must arrive at ONE key. Stripping at
 * lookup time would resolve both to the same element while keeping two
 * entries in the map, and the second edge would then be unreachable.
 */
const bareId = (id) =>
    typeof id === "string" && id.startsWith("#") ? id.slice(1) : id;

/**
 * A morph node, in one shape: a list of EDGES.
 *
 * A node is written either as a single hop —
 *
 *     { op: "morph", from: "topnav", to: { About: "about" } }
 *
 * — or as a chain, which is the same thing with more than one edge:
 *
 *     { op: "morph", effect: "t-vhs", duration: 900, back: true,
 *       chain: [ { from: "topnav",  to: { About: "about" } },
 *                { from: "about",   to: { Detail: "about-detail" } } ] }
 *
 * Both arrive here as a list, so there is exactly one code path below and
 * the single hop is not a special case of anything. `chain` entries are
 * EDGES rather than keyframes: entry two does not happen after entry one,
 * it is reachable FROM the state entry one lands on. That is why they
 * carry no ordinal — array order is already order, and a number would
 * claim a sequence the graph does not have.
 *
 * Per-edge options fall back to the node, so the common settings are
 * written once and an edge overrides only what differs.
 */
const normalizeEdges = (m) => {
    const raw = Array.isArray(m.chain) && m.chain.length
        ? m.chain
        : [{ from: m.from, to: m.to }];

    return raw.map((e) => {
        const opt = (key, fallback) =>
            (e[key] !== undefined ? e[key]
                : m[key] !== undefined ? m[key] : fallback);

        // `to` takes two forms, and the object form is the one that
        // survives a real navbar:
        //
        //   ["work", "about"]                by POSITION — link i goes to i
        //   { Work: "work", About: "about" } by LABEL — link text decides
        //
        // Position looks tidier and is wrong for anything but a toy nav. A
        // responsive bar renders a DIFFERENT set of links per breakpoint
        // (About/Services/Contact wide, About/About/Contact collapsed), so
        // index i is not the same destination at two window sizes. And a
        // nav that repeats a label sends two links to one arbitrary place.
        // Labels are what the user is actually reading and clicking.
        const byLabel = e.to && !Array.isArray(e.to) && typeof e.to === "object"
            ? e.to : null;
        // Deduplicated on the label side only. The array form is POSITIONAL
        // — `toIds[triggers.indexOf(a)]` below — so collapsing a repeated
        // id there would shift every later link onto the wrong destination.
        const toIds = byLabel
            ? [...new Set(Object.values(e.to))].map(bareId)
            : (Array.isArray(e.to) ? e.to : [e.to]).map(bareId);

        const labelToId = new Map();
        if (byLabel) {
            for (const [label, id] of Object.entries(e.to)) {
                labelToId.set(norm(label), bareId(id));
            }
        }

        return {
            from: bareId(e.from), byLabel, toIds, labelToId,
            effect: opt("effect"),
            duration: opt("duration", 900),
            // Written as `!== false` rather than a truthy test: the
            // documented default is on, and only an explicit false is a
            // request to leave the destination without a way back.
            back: opt("back", true) !== false,
            live: opt("live") === true,
            fade: opt("fade", "morph"),
        };
    });
};

/**
 * @param {Element} mount     the container Des rendered into
 * @param {object[]} elements the E array, in order
 * @param {object[]} nodes    the N array
 * @returns {object[]} one handle per morph node, for tests and teardown
 */
function applyMorphNodes(mount, elements, nodes) {
    if (!mount || typeof document === "undefined") return [];
    const morphs = (nodes || []).filter((n) => n && n.op === "morph");
    if (!morphs.length) return [];

    // Pair descriptors with rendered nodes BY POSITION. Some components
    // carry their `id` through to the DOM (wrap does) and some do not
    // (protoNav drops it), so an id lookup alone silently misses half the
    // page. Position is what Des actually guarantees.
    const rendered = [...mount.children];
    const resolve = (id) => {
        // `bareId` again, and not only for symmetry: the descriptor in E
        // may itself be written with a leading "#", so both sides are
        // reduced before they are compared.
        const want = bareId(id);
        const byId = document.getElementById(want);
        if (byId && mount.contains(byId)) return byId;
        const i = (elements || []).findIndex((e) => e && bareId(e.id) === want);
        return i >= 0 ? rendered[i] : null;
    };

    return morphs.map((m) => setUpMorph(mount, m, resolve)).filter(Boolean);
}

function setUpMorph(mount, m, resolve) {
    // ── the controller's model ───────────────────────────────────────
    //
    // One controller owns one stage and EVERY state in the graph. The
    // alternative — a controller per edge — cannot work: edge two's
    // source is edge one's destination, which the first controller has
    // already detached as a template, so two controllers would fight over
    // the same element and stack two block-level stages.
    //
    // States are keyed by id rather than held in a positional array,
    // because an edge names its destinations by id and a chain's second
    // edge starts from a state the first edge introduced. Position means
    // nothing once there is more than one source.
    const edges = normalizeEdges(m);
    const rootEdge = edges[0];
    const rootId = rootEdge && rootEdge.from;
    const rootEl = rootId != null ? resolve(rootId) : null;

    const states = new Map();
    if (rootEl) states.set(rootId, rootEl);
    for (const e of edges) {
        const src = resolve(e.from);
        if (src && !states.has(e.from)) states.set(e.from, src);
        for (const id of e.toIds) {
            const el = resolve(id);
            if (el && !states.has(id)) states.set(id, el);
        }
    }

    if (!rootEl || !rootEdge.toIds.some((id) => states.has(id))) {
        console.warn("[nodality] morph: could not resolve",
            rootId, "->", rootEdge ? rootEdge.toIds : []);
        return null;
    }

    /** The edge leaving a state, or null where the graph ends. */
    const edgeFrom = (id) => edges.find((e) => e.from === id) || null;

    // A positioned stage, standing where the source stood. The source and
    // the destinations are siblings inside it rather than in page flow,
    // because a morph interpolates a BOX and both ends need a common
    // coordinate space to be measured in.
    const stage = document.createElement("div");
    stage.className = "nod-morph";
    stage.style.cssText = "position:relative;";
    mount.insertBefore(stage, rootEl);

    const rhost = document.createElement("div");
    rhost.className = "nod-morph-host";
    rhost.style.cssText = "position:absolute;inset:0;";
    // The source stays OUTSIDE the raster host on purpose: the pipeline
    // suppresses its host's ink while t is in (0,1), and the source must
    // stay clickable and selectable at rest.
    const live = document.createElement("div");
    live.className = "nod-morph-live";
    live.style.cssText = "position:absolute;inset:0;";
    stage.appendChild(rhost);
    stage.appendChild(live);

    live.appendChild(rootEl);
    rootEl.style.position = "absolute";
    rootEl.style.left = rootEl.style.top = "0";

    // Every state except the root starts OFF the page. Without this every
    // subview renders stacked under the nav, which is the whole "why is
    // everything visible at once" problem.
    for (const [id, el] of states) {
        if (id !== rootId) el.remove();
    }

    // Where the graph is now. `current` moves only when a transition
    // COMPLETES — a morph that is interrupted half way has not arrived
    // anywhere, and treating it as though it had is what makes interrupt
    // handling incoherent. The history stack is the record of states
    // actually landed on, which is what `back` unwinds.
    let current = rootId;
    const history = [];

    const currentEl = () => states.get(current) || rootEl;

    const sizeStage = (h) => {
        stage.style.minHeight =
            Math.max(currentEl().getBoundingClientRect().height, h || 0) + 24 + "px";
    };
    sizeStage(0);

    let pipe = null;
    let tl = null;
    let active = -1;
    // The two elements a running transition is between. The frame loop
    // needs them by identity rather than by position in the host: from
    // the second hop onward the outgoing state is ALSO a child of the
    // host, so "the first child" no longer means "the destination".
    let incoming = null;
    let outgoing = null;
    // The pair the CURRENT pipeline was built from, as state ids. A
    // reversal may reuse that pipeline only when it is already exactly
    // the hop being unwound — keying the decision on the history top
    // instead let a stale pipeline satisfy it, resolve at zero
    // immediately, and move the graph without moving the screen.
    let lastFrom = null;
    // Set while the root is being measured for a reversal INTO it. The
    // root lives in the live layer, which is display:none whenever the
    // graph is deeper in — and an element inside display:none has no box
    // at all, so capturing it without this yields a 0x0 still and a
    // transition that reverses into nothing.
    let measuring = false;
    let pipeOld = null;   // state id on the pipeline's old side
    let pipeNew = null;   // state id on its new side

    // A chain replaces one view with another in the same place; a single
    // hop opens its destination BELOW the source and has done since the
    // first morph shipped. gesos.cz renders with that placement today, so
    // it stays exactly as it was, and only a genuine chain changes it —
    // marching each successive state further down the page would also
    // break hop two's arithmetic, which assumes a source at the top.
    const inPlace = edges.length > 1;

    /**
     * Capture two states and stand a transition pipeline up between them.
     *
     * Shared by both directions. A reversal is not a forward transition
     * to an earlier state: it is THIS, with the state being returned to
     * passed as the old side, so the effect runs backwards rather than
     * playing forwards into the past.
     */
    const buildTransition = async (oldEl, newEl, edge) => {
        // WAIT FOR IMAGES before measuring anything.
        //
        // An <img> has no intrinsic box until it decodes — even from a
        // data: URL, which is async too. Measure before that and the
        // rect is the pre-image layout, so the shader draws the capture
        // into a box that does not match where the real card ends up.
        // The handover then pops between two different sizes.
        const imgs = [...newEl.querySelectorAll("img")];
        if (imgs.length) {
            await Promise.all(imgs.map((im) => {
                if (im.complete && im.naturalWidth) return null;
                if (typeof im.decode === "function") return im.decode().catch(() => {});
                return new Promise((res) => {
                    im.addEventListener("load", res, { once: true });
                    im.addEventListener("error", res, { once: true });
                });
            }));
            await new Promise((r) => requestAnimationFrame(r));
        }

        const oldRect = rectIn(rhost, oldEl);
        const newRect = rectIn(rhost, newEl);
        sizeStage(Math.max(oldRect.y + oldRect.h, newRect.y + newRect.h));

        const [oldImage, newImage] = await Promise.all([
            capture(oldEl, oldRect.w, oldRect.h),
            capture(newEl, newRect.w, newRect.h),
        ]);

        pipe = applyRasterPipeline(rhost, chainFor(edge.effect), {
            transition: {
                oldImage, newImage,
                oldRect, oldTo: newRect,
                newRect, newFrom: oldRect,
                // The morph owns the screen strictly BETWEEN its ends: the
                // real source presents at t=0, the real destination at t=1.
                standDownAtStart: true,
                // Opt back into the HTML-in-Canvas backend. Off by default
                // for a morph: it moves the content INTO the canvas, where
                // it becomes fallback content and stops being hit-testable.
                live: edge.live === true,
                // Per-pixel choice rather than a uniform mix. A crossfade
                // shows 50% of each at the midpoint, which reads as two
                // states at once rather than one becoming the other.
                fade: edge.fade || "morph",
            },
        });

        if (tl) tl.destroy();
        tl = progressTimeline(pipe, {
            duration: edge.duration != null ? edge.duration : 900,
        });
    };

    /**
     * Transition from wherever the graph is now to `destId`.
     *
     * Keyed by state id rather than by index: an index is only meaningful
     * relative to one edge's destination list, and the controller has to
     * answer "go here" from whichever state happens to be current.
     */
    const goToState = async (destId) => {
        const edge = edgeFrom(current);
        if (!edge || !edge.toIds.includes(destId)) return;
        const dest = states.get(destId);
        if (!dest) return;
        const srcEl = currentEl();
        active = edge.toIds.indexOf(destId);
        lastFrom = current;

        for (const p of activeRasterPipelines()) {
            if (stage.contains(p.canvas)) p.destroy();
        }
        // Clear everything EXCEPT the state being transitioned from.
        // Emptying the host outright is what the single hop did, and it
        // was safe only because the source lived in the live layer. From
        // the second hop onward the source is a landed state sitting in
        // this host, and emptying would delete the very element about to
        // be captured. For a single hop the source is still in the live
        // layer, so this removes exactly what it always did.
        for (const child of [...rhost.children]) {
            if (child !== srcEl) child.remove();
        }
        rhost.appendChild(dest);
        outgoing = srcEl;
        incoming = dest;
        // Hidden from the moment it enters the document. Between insertion
        // and applyRasterPipeline there are two awaited captures, and a
        // destination that is merely in the DOM paints for those frames —
        // which is the destination flashing before the morph runs.
        // visibility (not display) so it still lays out and can be measured.
        dest.style.visibility = "hidden";

        // Place the destination before anything is measured: in a chain
        // it takes the source's own position, so views replace each other
        // in one region rather than marching down the page.
        const fromRect = rectIn(rhost, srcEl);
        // POSITION only. This used to also force `boxSizing: border-box`,
        // which silently relaid the author's element: a card written as
        // `width: min(560px, 92vw)` with padding renders 612px wide in
        // normal flow (content-box) and 560px once border-box is imposed.
        // The source keeps its own box model, so the two ends of the
        // transition were different sizes and the handover to real DOM
        // snapped by the padding — the jump visible at the end of a hop.
        Object.assign(dest.style, { position: "absolute", left: "0",
            top: Math.round(inPlace ? fromRect.y : fromRect.h + 20) + "px" });

        await buildTransition(srcEl, dest, edge);
        if (!tl) return;
        pipeOld = lastFrom; pipeNew = destId;
        tl.set(0);

        // Wire the destination BEFORE the timeline runs, not on arrival.
        // Progress reaches 1 a frame before `to(1)`'s promise resolves, so
        // wiring at landing leaves a window in which the destination is
        // fully presented and its controls are dead — which a caller
        // polling progress hits every time.
        //
        // Order still matters: forward triggers first, then back from
        // whatever is left, so the roles cannot swap.
        wireState(destId);
        if (edge.back) claimBack(dest);

        // `to()` resolves with the progress actually reached, and resolves
        // rather than hanging when something interrupts it. So the
        // resolved value IS the answer to "did we arrive?" — anything
        // short of 1 means another transition took over, and a morph that
        // did not arrive must not move the graph.
        const reached = await tl.to(1);
        if (reached === 1 && incoming === dest) land(destId, srcEl, edge);
    };

    /**
     * Unwind one step of the path actually taken.
     *
     * `back` is history, not an edge. The graph may offer a route from
     * here to somewhere else entirely — `aurora` has a forward edge to
     * `contact` — but going back means returning the way you came, which
     * is what every user already expects from a browser. So the stack of
     * landed states decides the destination, not the edge list.
     */
    let backing = false;
    let queuedBacks = 0;

    /** Unwind exactly one step of the path taken. */
    const stepBack = async () => {
        if (!history.length) return;
        const targetId = history[history.length - 1];
        const targetEl = states.get(targetId);
        if (!targetEl) return;
        const fromEl = currentEl();

        // The live pipeline is already the right pair when the last thing
        // that ran was the hop being unwound. Reusing it is what makes an
        // immediate back feel instant, and it is also what lets a back
        // INTERRUPT a still-running forward — the timeline simply
        // reverses from wherever it is.
        if (pipe && tl && pipeOld === targetId && pipeNew === current) {
            const reached = await tl.to(0);
            if (reached === 0) landBack(targetId);
            return;
        }
        await reverseRebuild(targetId, targetEl, fromEl);
    };

    const goBack = async () => {
        // Presses arriving mid-reversal are QUEUED, not dropped and not
        // run concurrently. Dropping them makes a user hammering back sit
        // one level down and look stuck; running them at once re-targets
        // the hop that just finished, because `current` updates a tick
        // after progress reaches its endpoint. Queuing gives the only
        // behaviour that matches the control: one press, one level.
        if (backing) { queuedBacks++; return; }
        backing = true;
        try {
            await stepBack();
            while (queuedBacks > 0 && history.length) {
                queuedBacks--;
                await stepBack();
            }
        } finally { backing = false; queuedBacks = 0; }
    };

    /** The reversal that cannot reuse the live pipeline: build it. */
    const reverseRebuild = async (targetId, targetEl, fromEl) => {

        // The old pipeline is kept ALIVE across the measuring phase and
        // retired only once its replacement exists. It is what covers the
        // stage while the state being returned to is revealed underneath
        // it, and that ordering is what lets the reveal use `display`
        // alone — no `visibility: hidden` anywhere.
        //
        // That matters beyond flicker. HTML-in-Canvas uploads an element
        // through its PAINT RECORD, and a hidden element has none:
        // `texElementImage2D` then throws "No cached paint record for
        // element" and the pipeline falls back to snapshot mid-flight.
        // Measuring something while hiding it is not an option on the
        // live backend — it has to be painted, and merely covered.
        //
        // Retiring it too early is the other failure: destroying it
        // before the replacement exists leaves a gap with nothing
        // presenting, and never retiring it leaves its canvas stacked in
        // the host showing a stale frame over the real transition.
        const stale = [...activeRasterPipelines()].filter(
            (p) => stage.contains(p.canvas));

        const edge = edgeFrom(targetId) || {};
        if (targetEl === rootEl) {
            // Revealed, not shown: it needs a box to be measured and a
            // paint record to be uploaded. The stale canvas above covers
            // it until the transition takes over.
            measuring = true;
            live.style.display = "";
        } else if (targetEl.parentNode !== rhost) {
            // A later hop swept it out of the host; it has to be back in
            // the document to be measured and captured.
            targetEl.style.visibility = "hidden";
            rhost.appendChild(targetEl);
            const cur = rectIn(rhost, fromEl);
            Object.assign(targetEl.style, {
                position: "absolute", left: "0",
                top: Math.round(inPlace ? cur.y : 0) + "px",
            });
        }

        await buildTransition(targetEl, fromEl, edge);
        for (const p of stale) p.destroy();
        measuring = false;
        if (!tl) return;
        pipeOld = targetId; pipeNew = current;
        outgoing = targetEl;
        incoming = fromEl;
        tl.set(1);
        const reached = await tl.to(0);
        if (reached === 0) landBack(targetId);
    };

    /** Arriving back: pop the step being unwound and present it. */
    const landBack = (targetId) => {
        if (history[history.length - 1] === targetId) history.pop();
        current = targetId;

        // Hand the DOM back before presenting.
        //
        // On the live backend the state being returned to is INSIDE the
        // canvas — that is how the backend samples it — and the canvas
        // stands down at t=0. So the moment a reversal completes, the
        // thing it returned to stops being painted at all: canvas hidden,
        // content hosted, nothing on screen. A forward landing has no
        // such problem, because there the canvas stays up and presents
        // the destination itself.
        //
        // `destroy()` is precisely the handover needed: it moves hosted
        // children back out into the host and restores the suppressed
        // ink. The cost is that the next transition rebuilds rather than
        // reusing, which is the right trade for a state that would
        // otherwise be invisible.
        for (const p of activeRasterPipelines()) {
            if (stage.contains(p.canvas)) p.destroy();
        }
        pipe = null; tl = null; pipeOld = null; pipeNew = null;
        lastFrom = history.length ? history[history.length - 1] : null;
        wireState(targetId);
    };

    /**
     * A transition completed: the destination is now where the graph is,
     * and therefore now a source in its own right.
     */
    const land = (id, previousEl, viaEdge) => {
        // The step just completed becomes the top of the stack — this is
        // what `back` unwinds, and why back returns the way you came
        // rather than following some edge that happens to point earlier.
        if (lastFrom != null && lastFrom !== id) history.push(lastFrom);
        current = id;
        // The state left behind STAYS in the host, hidden by the frame
        // loop. Removing it here was wrong in both directions: going back
        // has to present it again, and the shader's t=0 frame is a
        // picture of it, so the real element must be there to take over.
        // The next forward transition sweeps it out, because the
        // selective clear keeps only the state it departs from.
        outgoing = previousEl && previousEl !== rootEl ? previousEl : null;
        // Idempotent re-wire. The destination was wired before the
        // timeline ran; this covers anything its own subtree changed
        // during the transition.
        wireState(id);
        if (viaEdge && viaEdge.back) claimBack(states.get(id));
    };

    /** The back control is a button the forward wiring did not claim. */
    const claimBack = (el) => {
        if (!el) return;
        const btn = [...el.querySelectorAll("button")].find(
            (b) => !b.dataset.nodMorphWired && !b.dataset.nodMorphBack);
        if (!btn) return;
        btn.dataset.nodMorphBack = "1";
        btn.addEventListener("click", () => { goBack(); });
    };

    // Positional entry point, kept for the handle's published shape: the
    // index is resolved against the CURRENT state's edge.
    const goTo = (i) => {
        const edge = edgeFrom(current);
        return edge ? goToState(edge.toIds[i]) : undefined;
    };

    // Link i in the source goes to destination i. By POSITION, not label:
    // a prototype nav can render two links reading the same thing, and
    // matching on text would send both to one destination.
    /**
     * What in the source starts the morph.
     *
     * Anchors take PRIORITY, and that ordering is load-bearing rather
     * than stylistic: a navbar's own hamburger is a <button>, and it
     * DISCLOSES the menu — it must never navigate. So buttons are only
     * considered when the source contains no links at all, which is the
     * case a plain call-to-action button is. If the source is itself the
     * control (a lone button), the source is the trigger.
     */
    const triggersOf = (el) => {
        const links = [...el.querySelectorAll("a")];
        if (links.length) return links;
        const btns = [...el.querySelectorAll("button, [role=button]")];
        if (btns.length) return btns;
        return [el];
    };

    /**
     * Wire one trigger against the edge leaving its state.
     *
     * `byName` says the edge's labels actually match something in this
     * state, and it decides which rule applies. The single-destination
     * shortcut — any trigger goes to the only destination — is right for
     * a lone call-to-action button whose text matches no declared label,
     * and wrong for a card that has both a forward control and a back
     * control: there, "any trigger" sweeps up the back button too. When
     * the labels match, the labels rule.
     */
    const wire = (a, edge, triggers, byName) => {
        if (a.dataset.nodMorphWired) return;
        // The back control is claimed first and is never also a forward
        // trigger. The two wirings guard on independent flags, so a state
        // whose only controls are buttons — `triggersOf` falls through to
        // buttons — and whose edge has a single destination — any trigger
        // goes there — would otherwise fire BOTH on one click.
        if (a.dataset.nodMorphBack) return;
        const destId = byName ? edge.labelToId.get(norm(a.textContent))
            // One destination and no matching label: nothing to
            // disambiguate, so any trigger goes there.
            : edge.toIds.length === 1 ? edge.toIds[0]
            : edge.byLabel ? edge.labelToId.get(norm(a.textContent))
            : edge.toIds[triggers.indexOf(a)];
        if (!destId || !states.has(destId)) return;
        a.dataset.nodMorphWired = "1";
        a.dataset.nodMorphTo = destId;
        a.addEventListener("click", (e) => {
            // Nothing resolved -> the link keeps its own behaviour, which
            // on an ordinary page is real navigation.
            if (!states.has(destId)) return;
            e.preventDefault();
            goToState(destId);
        });
    };

    /** Wire every trigger of a state, if that state has an outgoing edge. */
    const observed = new Set();
    const wireState = (id) => {
        const edge = edgeFrom(id);
        const el = states.get(id);
        if (!edge || !el) return;
        const triggers = triggersOf(el);
        const byName = !!edge.byLabel &&
            triggers.some((t) => edge.labelToId.has(norm(t.textContent)));
        triggers.forEach((t) => wire(t, edge, triggers, byName));

        // A responsive nav REPLACES its links when it crosses a
        // breakpoint — the Switcher swaps the whole view — so anything
        // wired once is gone after a resize. Re-wire whatever appears;
        // `nodMorphWired` keeps it idempotent. Every state that can be a
        // source gets this, not just the root, because a chain can be
        // resized while three levels deep.
        if (typeof MutationObserver !== "undefined" && !observed.has(id)) {
            observed.add(id);
            new MutationObserver(() => wireState(id))
                .observe(el, { childList: true, subtree: true });
        }
    };
    wireState(rootId);

    // Only the source is on screen until something is chosen.
    const frame = () => {
        if (!stage.isConnected) return;
        // Who presents: the real source at t=0, the canvas in between, the
        // real destination at t=1. Driving BOTH ends off progress means
        // there is no moment where two of them are on screen together, and
        // none where the destination appears before its morph has run.
        const t = pipe ? pipe.progress : 0;
        const cv = rhost.querySelector("canvas");
        // Is the canvas ACTUALLY presenting right now? Not "should it be" —
        // the pipeline owns that flag and re-asserts it from its own rAF
        // loop, which is a different loop from this one.
        //
        // Both endpoints used to be computed from `t` alone, in parallel
        // with the pipeline's decision. Whichever loop ran first that
        // frame won, and when the pipeline hid the canvas before this loop
        // revealed the DOM there was a single frame with NEITHER on
        // screen — a flash at the end of the transition, in both
        // directions.
        //
        // Keying off the canvas's real state makes the two states OVERLAP
        // instead of gapping. Overlap is invisible: the shader's last
        // frame is the destination and its first is the source, so a frame
        // showing both is identical to a frame showing either. A frame
        // showing neither is the background.
        const canvasUp = !!cv && (cv.style.visibility || "visible") === "visible";
        // Hand over only once the canvas has ACTUALLY stood down, and let
        // `t` decide which end takes over. Both conditions are needed:
        //
        //   canvas still up  -> it is presenting; both DOM ends stay
        //                       hidden, whatever t says
        //   canvas down      -> the pipeline has finished its handover
        //                       pass, which is also where it restores the
        //                       host's ink. Revealing before that shows a
        //                       real element whose colours are still
        //                       suppressed — a transparent box for one
        //                       frame, which is the flash.
        //
        // Gating on `t` alone raced the pipeline's own loop; gating on the
        // canvas alone showed BOTH ends at t=1, because at that point the
        // canvas is down and nothing distinguished the two.
        const handover = !pipe || !canvasUp;
        // The live layer holds the ROOT state only. Landed states live in
        // the host, so from the second hop onward "t is at zero" does not
        // mean the root should be showing — `current` decides that.
        const wantLive = measuring ? ""
            : handover && t <= 0 && (current === rootId || outgoing === rootEl)
                ? "" : "none";
        if (live.style.display !== wantLive) live.style.display = wantLive;
        // By identity, not by position: during a chain hop the outgoing
        // state is also a child of this host, so `firstElementChild`
        // would sometimes name the wrong one of the two.
        const dest = incoming || rhost.firstElementChild;
        if (dest && dest.style) {
            const want = pipe && handover && t >= 1 ? "" : "hidden";
            if (dest.style.visibility !== want) dest.style.visibility = want;
        }
        // The state being left behind is the other end of the same rule:
        // it presents at t=0, and only while the canvas has stood down.
        // The root is exempt because the live layer's display already
        // governs it, and driving both would fight.
        if (outgoing && outgoing !== rootEl && outgoing.style) {
            const want = handover && t <= 0 ? "" : "hidden";
            if (outgoing.style.visibility !== want) outgoing.style.visibility = want;
        }
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    return {
        stage, from: rootEl,
        get destinations() { return rootEdge.toIds.map((id) => states.get(id) || null); },
        get states() { return states; },
        get current() { return current; },
        get history() { return [...history]; },
        get progress() { return pipe ? pipe.progress : 0; },
        get active() { return active; },
        goTo, goToState,
        back() { if (tl) tl.to(0); },
        // The control's own entry point, published for the agent surface.
        // `back()` above reverses a RUNNING timeline and does nothing at
        // rest; `goBack` is what the back button calls — queued, one
        // press one level, reusing the live pipeline or rebuilding it.
        // A derived go_back tool has to be the same action as the button
        // or the two would unwind differently from the same state.
        goBack,
        destroy() {
            if (tl) tl.destroy();
            for (const p of activeRasterPipelines()) {
                if (stage.contains(p.canvas)) p.destroy();
            }
            stage.remove();
        },
    };
}

// `normalizeEdges` is exported for DERIVATION, not for use: the agent
// surface reads the same edge list the controller runs, so the two can
// never describe different graphs. Reimplementing the normalisation
// there would have drifted the first time either side changed — which
// is precisely how the validator came to accept a `#id` the runtime
// refused to resolve.
export { applyMorphNodes, normalizeEdges };

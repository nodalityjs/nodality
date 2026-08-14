/*!
 * nodality v1.0.224
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

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
    const img = new Image();
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
        const byId = document.getElementById(id);
        if (byId && mount.contains(byId)) return byId;
        const i = (elements || []).findIndex((e) => e && e.id === id);
        return i >= 0 ? rendered[i] : null;
    };

    return morphs.map((m) => setUpMorph(mount, m, resolve)).filter(Boolean);
}

function setUpMorph(mount, m, resolve) {
    const fromEl = resolve(m.from);

    // `to` takes two forms, and the object form is the one that survives
    // a real navbar:
    //
    //   ["work", "about"]              by POSITION — link i goes to i
    //   { Work: "work", About: "about" }  by LABEL — link text decides
    //
    // Position looks tidier and is wrong for anything but a toy nav. A
    // responsive bar renders a DIFFERENT set of links per breakpoint
    // (About/Services/Contact wide, About/About/Contact collapsed), so
    // index i is not the same destination at two window sizes. And a nav
    // that repeats a label sends two links to one arbitrary place. Labels
    // are what the user is actually reading and clicking.
    const byLabel = m.to && !Array.isArray(m.to) && typeof m.to === "object"
        ? m.to : null;
    const toIds = byLabel
        ? [...new Set(Object.values(m.to))]
        : (Array.isArray(m.to) ? m.to : [m.to]);
    const toEls = toIds.map(resolve);
    if (!fromEl || !toEls.some(Boolean)) {
        console.warn("[nodality] morph: could not resolve", m.from, "->", toIds);
        return null;
    }
    const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
    const labelToIndex = new Map();
    if (byLabel) {
        for (const [label, id] of Object.entries(m.to)) {
            const i = toIds.indexOf(id);
            if (i >= 0) labelToIndex.set(norm(label), i);
        }
    }

    // A positioned stage, standing where the source stood. The source and
    // the destinations are siblings inside it rather than in page flow,
    // because a morph interpolates a BOX and both ends need a common
    // coordinate space to be measured in.
    const stage = document.createElement("div");
    stage.className = "nod-morph";
    stage.style.cssText = "position:relative;";
    mount.insertBefore(stage, fromEl);

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

    live.appendChild(fromEl);
    fromEl.style.position = "absolute";
    fromEl.style.left = fromEl.style.top = "0";

    // Destinations start OFF the page. Without this every subview renders
    // stacked under the nav, which is the whole "why is everything
    // visible at once" problem.
    const templates = toEls.map((el) => {
        if (!el) return null;
        el.remove();
        return el;
    });

    const sizeStage = (h) => {
        stage.style.minHeight =
            Math.max(fromEl.getBoundingClientRect().height, h || 0) + 24 + "px";
    };
    sizeStage(0);

    let pipe = null;
    let tl = null;
    let active = -1;

    const goTo = async (i) => {
        const dest = templates[i];
        if (!dest) return;
        active = i;

        for (const p of activeRasterPipelines()) {
            if (stage.contains(p.canvas)) p.destroy();
        }
        rhost.innerHTML = "";
        rhost.appendChild(dest);
        // Hidden from the moment it enters the document. Between insertion
        // and applyRasterPipeline there are two awaited captures, and a
        // destination that is merely in the DOM paints for those frames —
        // which is the destination flashing before the morph runs.
        // visibility (not display) so it still lays out and can be measured.
        dest.style.visibility = "hidden";

        // WAIT FOR IMAGES before measuring anything.
        //
        // An <img> has no intrinsic box until it decodes — even from a
        // data: URL, which is async too. Measure before that and the
        // destination's rect is its pre-image layout, so the shader draws
        // the capture into a box that does not match where the real card
        // ends up. The handover then pops between two different sizes,
        // which is the flash at the end of the transition.
        const imgs = [...dest.querySelectorAll("img")];
        if (imgs.length) {
            await Promise.all(imgs.map((im) => {
                if (im.complete && im.naturalWidth) return null;
                if (typeof im.decode === "function") return im.decode().catch(() => {});
                return new Promise((res) => {
                    im.addEventListener("load", res, { once: true });
                    im.addEventListener("error", res, { once: true });
                });
            }));
            // One more frame so layout reflects the decoded intrinsic size.
            await new Promise((r) => requestAnimationFrame(r));
        }

        const fromRect = rectIn(rhost, fromEl);
        Object.assign(dest.style, { position: "absolute", left: "0",
            top: Math.round(fromRect.h + 20) + "px", boxSizing: "border-box" });
        const toRect = rectIn(rhost, dest);
        sizeStage(toRect.y + toRect.h);

        const [oldImage, newImage] = await Promise.all([
            capture(fromEl, fromRect.w, fromRect.h),
            capture(dest, toRect.w, toRect.h),
        ]);

        pipe = applyRasterPipeline(rhost, chainFor(m.effect), {
            transition: {
                oldImage, newImage,
                oldRect: fromRect, oldTo: toRect,
                newRect: toRect, newFrom: fromRect,
                // The morph owns the screen strictly BETWEEN its ends: the
                // real source presents at t=0, the real destination at t=1.
                standDownAtStart: true,
                // Opt back into the HTML-in-Canvas backend. Off by default
                // for a morph: it moves the content INTO the canvas, where
                // it becomes fallback content and stops being hit-testable.
                live: m.live === true,
                // Per-pixel choice rather than a uniform mix. A crossfade
                // shows 50% of each at the midpoint, which reads as two
                // states at once rather than one becoming the other.
                fade: m.fade || "morph",
            },
        });

        if (tl) tl.destroy();
        tl = progressTimeline(pipe, { duration: m.duration != null ? m.duration : 900 });
        tl.set(0);

        if (m.back !== false) {
            const btn = dest.querySelector("button");
            if (btn && !btn.dataset.nodMorphBack) {
                btn.dataset.nodMorphBack = "1";
                btn.addEventListener("click", () => { if (tl) tl.to(0); });
            }
        }
        tl.to(1);
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
    const triggersOf = () => {
        const links = [...fromEl.querySelectorAll("a")];
        if (links.length) return links;
        const btns = [...fromEl.querySelectorAll("button, [role=button]")];
        if (btns.length) return btns;
        return [fromEl];
    };

    const wire = (a) => {
        if (a.dataset.nodMorphWired) return;
        const triggers = triggersOf();
        // One destination means there is nothing to disambiguate: any
        // trigger goes there, whatever it is labelled. Only a fan-out
        // needs a label map or an index.
        const idx = toIds.length === 1 ? 0
            : byLabel ? labelToIndex.get(norm(a.textContent))
            : triggers.indexOf(a);
        if (idx == null || idx < 0 || !templates[idx]) return;
        a.dataset.nodMorphWired = "1";
        a.dataset.nodMorphTo = toIds[idx];
        a.addEventListener("click", (e) => {
            // Nothing resolved -> the link keeps its own behaviour, which
            // on an ordinary page is real navigation.
            if (!templates[idx]) return;
            e.preventDefault();
            goTo(idx);
        });
    };
    const wireAll = () => triggersOf().forEach(wire);
    wireAll();

    // A responsive nav REPLACES its links when it crosses a breakpoint —
    // the Switcher swaps the whole view — so anything wired once is gone
    // after a resize. Re-wire whatever appears; `nodMorphWired` keeps it
    // idempotent.
    if (typeof MutationObserver !== "undefined") {
        new MutationObserver(wireAll).observe(fromEl,
            { childList: true, subtree: true });
    }

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
        const wantLive = handover && t <= 0 ? "" : "none";
        if (live.style.display !== wantLive) live.style.display = wantLive;
        const dest = rhost.firstElementChild;
        if (dest && dest.style) {
            const want = pipe && handover && t >= 1 ? "" : "hidden";
            if (dest.style.visibility !== want) dest.style.visibility = want;
        }
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    return {
        stage, from: fromEl, destinations: templates,
        get progress() { return pipe ? pipe.progress : 0; },
        get active() { return active; },
        goTo,
        back() { if (tl) tl.to(0); },
        destroy() {
            if (tl) tl.destroy();
            for (const p of activeRasterPipelines()) {
                if (stage.contains(p.canvas)) p.destroy();
            }
            stage.remove();
        },
    };
}

export { applyMorphNodes };

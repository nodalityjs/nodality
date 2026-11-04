/*!
 * nodality v1.4.2
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * view-transition.js — shader transitions for single-page route changes,
 * with the View Transitions API's calling convention.
 *
 * A router that already does
 *
 *     document.startViewTransition(() => render(route));
 *
 * swaps one call and keeps everything else, including its CSS:
 *
 *     import { nodalityTransition } from "nodality/view-transition";
 *     nodalityTransition(() => render(route), { effect: "t-fluid" });
 *
 * Elements are paired by `view-transition-name`, exactly as the platform
 * pairs them, and each pair is morphed by a raster transition: the old
 * element is frozen before the update, the new one after it, and the
 * pipeline interpolates between their rects while the effect chain runs
 * over both stills.
 *
 * WHY NOT ON TOP OF THE PLATFORM'S TRANSITION. The browser renders a view
 * transition as `::view-transition-old/new` snapshots in its own top
 * layer. CSS can move, fade and filter those, but no shader can draw them
 * and nothing on the page can paint above them while the transition runs.
 * So this does the platform's job itself — freeze, update, pair, animate —
 * and hands the platform back the cases where there is nothing to add:
 * reduced motion (no effect is allowed), and no WebGL (no effect is
 * possible). There the native transition runs if the browser has one.
 *
 * Unlike the native transition, only NAMED elements animate. Everything
 * else changes at once; the native one also cross-fades the page root.
 */

import { applyRasterPipeline } from "./raster-ops.js";
import { preset } from "./raster-presets.js";
import { progressTimeline, prefersReducedMotion } from "./transition.js";
import { captureStill } from "./morph-node.js";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** The name an element transitions under, or null. */
function nameOf(el) {
    const own = el.style && el.style.viewTransitionName;
    if (own && own !== "none") return own;
    const attr = el.getAttribute && el.getAttribute("data-view-transition-name");
    if (attr) return attr;
    const cs = getComputedStyle(el);
    const css = cs.viewTransitionName || cs.getPropertyValue("view-transition-name");
    return css && css !== "none" && css !== "auto" ? css.trim() : null;
}

/**
 * Every named, visible element under `root`, by name. A duplicate name
 * is an error in the platform API (the transition is skipped); here the
 * first one wins and the rest are reported, so a page still advances.
 */
function collect(root) {
    const found = new Map();
    for (const el of root.querySelectorAll("*")) {
        const name = nameOf(el);
        if (!name) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (found.has(name)) {
            console.warn(`[nodality] view transition: two elements are named "${name}" — ` +
                "only the first animates.");
            continue;
        }
        found.set(name, el);
    }
    return found;
}

/** A box in viewport coordinates, the space the overlay is drawn in. */
const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
};

function webglAvailable() {
    try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
        return false;
    }
}

const chainFor = (effect) => {
    if (!effect) return [];
    if (Array.isArray(effect)) return effect;
    try { return preset(effect) || []; } catch (e) { return []; }
};

/** New images have no box until they decode, and the rect must be final. */
async function settleImages(els) {
    const imgs = els.flatMap((el) => [...el.querySelectorAll("img")]);
    await Promise.all(imgs.map((im) => (im.complete && im.naturalWidth) ? null
        : (typeof im.decode === "function" ? im.decode().catch(() => {}) : null)));
}

/**
 * Run `update` as a shader transition.
 *
 * @param {() => (void|Promise<void>)} update renders the next route
 * @param {object} [opts]
 * @param {string|object[]} [opts.effect="t-fluid"] preset name or node array
 * @param {number} [opts.duration=800] ms
 * @param {string} [opts.fade="opaque"] how the two stills combine; see the
 *   pipeline's `fade` ("opaque", "dissolve", "morph")
 * @param {number[]} [opts.crossfade=[0.05, 0.45]] the slice of progress in
 *   which the old content hands over to the new; the shapes still travel
 *   the whole duration
 * @param {Element} [opts.root=document.body] where named elements are looked for
 * @returns {{ updateCallbackDone: Promise<void>, ready: Promise<void>,
 *             finished: Promise<void>, skipTransition(): void }}
 *   the same shape as the platform's ViewTransition
 */
function nodalityTransition(update, opts = {}) {
    const root = opts.root || document.body;

    // Nothing to add: let the platform do it, or just update.
    if (prefersReducedMotion() || !webglAvailable()) {
        if (typeof document.startViewTransition === "function") {
            return document.startViewTransition(update);
        }
        const done = Promise.resolve().then(update);
        return { updateCallbackDone: done, ready: done, finished: done, skipTransition() {} };
    }

    let skip = null;
    let skipped = false;
    const hidden = [];
    let resolveUpdate, resolveReady;
    const updateCallbackDone = new Promise((r) => { resolveUpdate = r; });
    const ready = new Promise((r) => { resolveReady = r; });

    const finished = (async () => {
        // 1. Freeze the old side. Captures are async, so the update waits
        //    for them; that is the same order the platform uses.
        const before = collect(root);
        const olds = new Map();
        // The old element's partner is not known yet, so it is rasterised
        // as if it may grow to fill the viewport: the stills are vector
        // until this point, and a small name drawn into a full-screen box
        // from a 1x capture is the pixelation this avoids.
        const reach = (rect) => Math.min(4, Math.max(1,
            window.innerWidth / Math.max(rect.w, 1)));
        await Promise.all([...before].map(async ([name, el]) => {
            const rect = boxOf(el);
            try {
                olds.set(name, { rect, image: await captureStill(el, rect.w, rect.h, reach(rect)) });
            } catch (e) {
                console.warn(`[nodality] view transition: could not capture "${name}".`, e);
            }
        }));

        // The overlay holds the old stills while the DOM changes under it,
        // so there is no frame where the old element has gone and the
        // transition has not yet begun.
        const overlay = document.createElement("div");
        overlay.setAttribute("data-nodality-view-transition", "");
        overlay.setAttribute("aria-hidden", "true");
        overlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483000;";
        const stills = new Map();
        for (const [name, o] of olds) {
            const img = o.image;
            img.style.cssText = `position:absolute;left:${o.rect.x}px;top:${o.rect.y}px;` +
                `width:${o.rect.w}px;height:${o.rect.h}px;`;
            overlay.appendChild(img);
            stills.set(name, img);
        }
        document.body.appendChild(overlay);

        // 2. Update.
        try {
            await update();
        } finally {
            resolveUpdate();
        }
        await nextFrame();

        // 3. Pair by name and freeze the new side.
        const after = collect(root);
        const pairs = [];
        for (const [name, el] of after) {
            if (olds.has(name)) pairs.push({ name, el, old: olds.get(name) });
        }
        await settleImages(pairs.map((p) => p.el));
        // Hidden while the transition owns the pixels; it still lays out,
        // so it measures and captures.
        for (const p of pairs) {
            p.el.style.visibility = "hidden";
            hidden.push(p.el);
        }
        await Promise.all(pairs.map(async (p) => {
            p.rect = boxOf(p.el);
            p.image = await captureStill(p.el, p.rect.w, p.rect.h);
        }));

        // An old element with no partner fades out; a new one with no
        // partner is simply there, as with the native transition's
        // unpaired groups.
        for (const [name, img] of stills) {
            if (pairs.some((p) => p.name === name)) continue;
            img.style.transition = `opacity ${Math.round((opts.duration || 800) / 2)}ms ease-out`;
            requestAnimationFrame(() => { img.style.opacity = "0"; });
        }

        // 4. One pipeline per pair, all on one timeline.
        const pipes = [];
        for (const p of pairs) {
            const host = document.createElement("div");
            host.style.cssText = "position:absolute;inset:0;";
            overlay.appendChild(host);
            const pipe = applyRasterPipeline(host, chainFor(opts.effect || "t-fluid"), {
                transition: {
                    oldImage: p.old.image, newImage: p.image,
                    oldRect: p.old.rect, oldTo: p.rect,
                    newRect: p.rect, newFrom: p.old.rect,
                    fade: opts.fade || "opaque",
                    // Each capture at its own aspect ratio, and the old
                    // content handed over early — see buildFragmentShader.
                    fit: "width",
                    crossfade: opts.crossfade || [0.05, 0.45],
                },
            });
            if (pipe) pipes.push(pipe);
        }
        const group = {
            progress: 0,
            setProgress(t) {
                for (const pipe of pipes) pipe.setProgress(t);
                group.progress = Math.min(1, Math.max(0, t));
                return group.progress;
            },
        };
        group.setProgress(0);
        await nextFrame();
        // The pipelines are presenting the old side now; the stills under
        // them can go.
        for (const p of pairs) {
            const img = stills.get(p.name);
            if (img) img.remove();
        }
        resolveReady();

        const tl = progressTimeline(group, { duration: opts.duration || 800 });
        skip = () => tl.set(1);
        if (skipped) skip();
        await tl.to(1);

        // 5. Hand the screen back to the real elements.
        for (const p of pairs) p.el.style.visibility = "";
        await nextFrame();
        tl.destroy();
        for (const pipe of pipes) pipe.destroy();
        overlay.remove();
    })();

    // A failure mid-transition must not leave the page frozen under an
    // overlay or with its new elements hidden.
    finished.catch((e) => {
        console.warn("[nodality] view transition failed:", e);
        document.querySelectorAll("[data-nodality-view-transition]").forEach((o) => o.remove());
        for (const el of hidden) el.style.visibility = "";
        resolveUpdate();
        resolveReady();
    });

    return {
        updateCallbackDone,
        ready,
        finished: finished.catch(() => {}),
        skipTransition() {
            skipped = true;
            if (skip) skip();
        },
    };
}

export { nodalityTransition };

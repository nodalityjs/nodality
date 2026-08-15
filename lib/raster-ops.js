/*!
 * nodality v1.1.6
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

// raster-ops.js — Houdini-like raster operation pipeline for Nodality.
//
// A second op category next to the CSS-level ops in designer.js
// ("blast", "gradient", ...): raster ops compile the *rendered page*
// into a WebGL texture and run an ordered chain of GPU stages over it,
// driven by the same plain-data `nodes` syntax:
//
//   let nodes = [
//     { op: "hexalize", size: 26 },
//     { op: "offset",  by: "mouse", strength: 22, radius: 280 },
//     { op: "duotone", by: "mouse", colors: ["#104B87", "#E8FF00"], radius: 200 },
//   ];
//
// Texture backends (capture of the live DOM):
//   snapshot (default) — XMLSerializer -> SVG foreignObject -> Image ->
//     texture. Works in every browser. Nodality output is inline-styled,
//     so fidelity is high. Static: recaptured on resize (or via
//     handle.refresh()). External images / webfonts do not load inside
//     the SVG image context — system fonts and data: URIs only.
//   live (the DEFAULT where it applies; opt OUT with `live: false` on any
//     node) — the emerging HTML-in-Canvas API (WICG, Chrome origin trial):
//     the mount subtree moves inside the effect <canvas layoutsubtree> and
//     is uploaded per frame with gl.texElementImage2D(), staying
//     interactive and live. Falls back to snapshot when the API is absent,
//     and again if no paint event arrives within 1500ms.
//
//     "Where it applies" = any chain that is not PURE overlay. A
//     pure-overlay chain (blobs alone) restructures nothing, so there is
//     no live subtree to sample and it stays on snapshot. See `wantLive`
//     in applyRasterPipeline, which is the authority:
//         !pureOverlay && !nodes.some(n => n.live === false)
//     (This said "opt-in: any raster node carries `live: true`" until
//     2026-08-12. It had been the opposite of the code for some time —
//     `live: true` is not read anywhere.)
//
// Safety: this module touches nothing at import time, so it is inert
// under jsdom prerender (nodality/ssg). applyRasterPipeline() returns
// null (never throws) when WebGL / DOM / motion are unavailable.

// ── Op registry ──────────────────────────────────────────────────────
// Each op contributes GLSL to one stage of a fixed frame skeleton:
//   warp     — displace the coordinate space itself (warped) e.g. offset;
//              runs BEFORE the cell stage so grids/edges move WITH the
//              content instead of staying a fixed screen-space lattice
//   cell     — redefine the sampling cell (center, edge)     e.g. hexalize
//   displace — move only the sample position (sampleP)
//   color    — transform the sampled colour (col)            e.g. duotone
// Ops execute in nodes-array order within their stage. Uniforms are
// namespaced per node index so the same op can appear twice.

// Same "did you mean" matching the element mapper and morph use, so a
// mistyped stage reads like a mistyped element type. Pure module, no DOM
// — importing it keeps this file inert at import (phase P1).
import { didYouMean } from "./suggest.js";

const MAX_BLOBS = 12;

// The unit vocabulary doc.params draws on. Not enforcement — nothing
// converts by unit — but it is what lets the inspector label a control
// and pick a sane step, and a closed list means "pixels" vs "px" vs "PX"
// cannot drift across 15 ops.
const RASTER_UNITS = [
    "px",       // a length in CSS pixels; the op scales it by dpr itself
    "ratio",    // 0..1, or a multiplier — never scaled by dpr
    "deg",      // degrees, converted to radians at upload
    "count",    // an integer quantity of things
    "color",    // "#rrggbb"
    "name",     // an identifier: a field name, a driver, a blend mode
    "point",    // [x, y], fractions of the element box
    "range",    // [lo, hi], a remap
    "bool",     // present/absent toggle
    "seconds",  // a duration or a rate per second
];

// ── Drivers ──────────────────────────────────────────────────────────
// What steers a reactive op. Previously "react to the pointer" was
// hardcoded into offset and duotone; a driver makes the input a value in
// the node data, so the same op can be aimed at different signals:
//
//   { op: "offset", by: "mouse" }    { op: "offset", by: "scroll" }
//
// Each driver returns a focus point in device pixels plus an amount in
// 0..1 that the op scales its effect by. Ops read them as u<i>_dpos and
// u<i>_damt; the pipeline evaluates and uploads them once per frame.
const DRIVERS = {
    // Centre of the element at full strength. The default for ops that
    // need a focus point but were not given a `by:` -- without it their
    // dpos/damt would never be uploaded and would read as zero.
    static: (c) => ({ x: c.w * 0.5, y: c.h * 0.5, amt: 1 }),
    mouse: (c) => ({ x: c.mouseX, y: c.mouseY, amt: 1 }),
    // Same focus as mouse, but faded in and out with the hover state, so
    // the effect resolves away when the pointer leaves.
    hover: (c) => ({ x: c.mouseX, y: c.mouseY, amt: c.hover }),
    // A band that travels up the element as it crosses the viewport.
    scroll: (c) => ({ x: c.w * 0.5, y: c.h * c.scroll, amt: 1 }),
    // Hands-free: the focus drifts on a Lissajous path.
    time: (c) => ({
        x: c.w * (0.5 + 0.34 * Math.cos(c.t * 0.6)),
        y: c.h * (0.5 + 0.34 * Math.sin(c.t * 0.8)),
        amt: 1,
    }),
};
const DRIVER_NAMES = Object.keys(DRIVERS);

const REGISTRY = {
    hexalize: {
        doc: {
            summary: "Hexagonal cell grid. Snaps sampling to a hex lattice and "
                + "draws cell borders; with `lift`, cells near the driver swell "
                + "toward the viewer and their content magnifies to match.",
            params: {
                size: { default: 24, unit: "px", summary: "lattice pitch — the width of one cell" },
                lift: {
                    default: 0, unit: "ratio", structural: true,
                    summary: "how much bigger a cell gets at the focus: 0.3 renders the "
                        + "nearest hexagons at 1.3x. 0 compiles the cheap path entirely away, "
                        + "so crossing zero rebuilds.",
                },
                radius: { default: 200, unit: "px", summary: "falloff distance around the driver focus" },
            },
        },
        // `lift` at 0 compiles the cheap path; non-zero compiles the
        // seven-neighbour probe. Only crossing zero needs a new shader.
        structuralOnToggle: ["lift"],
        stage: "cell",
        decl: (p) => `
            uniform float ${p}size;
            uniform float ${p}lift;
            uniform float ${p}radius;
            uniform vec2 ${p}dpos;
            uniform float ${p}damt;`,
        code: (p, node) => {
            // Without `lift` this is the original cheap path: find the
            // owning cell, draw its border, done.
            if (!node.lift) {
                return `
        {
            vec2 hp = warped / ${p}size;
            vec2 hr = vec2(1.0, 1.7320508), hh = hr * 0.5;
            vec2 ha = mod(hp, hr) - hh, hb = mod(hp - hh, hr) - hh;
            vec2 gv = dot(ha, ha) < dot(hb, hb) ? ha : hb;
            center = (hp - gv) * ${p}size;
            gv = abs(gv);
            edge = max(edge, smoothstep(0.44, 0.5,
                max(dot(gv, normalize(vec2(1.0, 1.7320508))), gv.x)));
        }`;
            }

            // With `lift`, cells near the pointer come TOWARD the viewer.
            //
            // A grown hexagon covers ground outside its own lattice cell,
            // so a fragment can no longer assume it belongs to the cell it
            // sits in — the neighbour may have swollen over it. Testing
            // only the owning cell is what made the first two attempts
            // fail: the border simply left the cell and vanished, because
            // nothing ever drew the part that hung over its neighbours.
            //
            // So each fragment tests its own cell AND the six around it,
            // and takes the most-enlarged hexagon that covers it. Largest
            // scale wins, which is the same as "nearest to the viewer" —
            // that is what makes them overlap correctly instead of
            // fighting. Six neighbours is enough for any scale under 2x.
            const NB = [
                [1, 0], [-1, 0],
                [0.5, 0.8660254], [-0.5, 0.8660254],
                [0.5, -0.8660254], [-0.5, -0.8660254],
            ];
            const probe = (cx, cy) => `
            {
                vec2 c = ${p}c0 + vec2(${cx.toFixed(7)}, ${cy.toFixed(7)});
                float f = 1.0 - smoothstep(0.0, ${p}radius,
                                           length(c * ${p}size - ${p}dpos));
                f *= ${p}damt;
                float s = 1.0 + ${p}lift * f;
                vec2 q = hp - c;
                float hd = max(dot(abs(q), ${p}AX), abs(q).x);
                // Covered by this cell's grown hexagon, and nearer than
                // whatever we have so far.
                if (hd <= 0.5 * s && s > ${p}bestS) {
                    ${p}bestS = s; ${p}bestC = c; ${p}bestF = f;
                }
            }`;
            return `
        {
            vec2 hp = warped / ${p}size;
            vec2 hr = vec2(1.0, 1.7320508), hh = hr * 0.5;
            vec2 ha = mod(hp, hr) - hh, hb = mod(hp - hh, hr) - hh;
            vec2 gv = dot(ha, ha) < dot(hb, hb) ? ha : hb;
            vec2 ${p}AX = normalize(vec2(1.0, 1.7320508));
            vec2 ${p}c0 = hp - gv;
            // Seed with the owning cell. Its own hexagon always covers the
            // fragment at any scale >= 1, so there is always a winner.
            vec2 ${p}bestC = ${p}c0;
            float ${p}bestF = (1.0 - smoothstep(0.0, ${p}radius,
                length(${p}c0 * ${p}size - ${p}dpos))) * ${p}damt;
            float ${p}bestS = 1.0 + ${p}lift * ${p}bestF;
${NB.map(([x, y]) => probe(x, y)).join("")}
            center = ${p}bestC * ${p}size;
            // Divide by the winner's scale: the border test then reaches
            // 0.5 further out (a bigger hexagon) and the sample moves in
            // toward the centre (its content magnified to match), both by
            // the same factor, so proportions are preserved exactly.
            gv = (hp - ${p}bestC) / max(${p}bestS, 1e-3);
            warped = center + gv * ${p}size;
            gv = abs(gv);
            // Border strength follows the SAME falloff as the scale, so a
            // cell that has not been raised draws no border at all. Away
            // from the pointer bestF is 0, which means scale 1, sampling
            // untouched and edge 0 — bit-identical to the source image, so
            // nothing reveals that an effect is attached until the pointer
            // arrives. Pair with by:"hover" for a fully flush resting
            // state; by:"mouse" holds amt at 1 and so keeps a permanent
            // hotspot wherever the pointer last was.
            edge = max(edge, smoothstep(0.44, 0.5,
                max(dot(gv, ${p}AX), gv.x)) * ${p}bestF);
        }`;
        },
        uniforms: (node, dpr) => ({
            size: ["1f", (node.size || 24) * dpr],
            // How much bigger a cell gets at the pointer, as a fraction:
            // 0.3 means the nearest hexagons render at 1.3x. NOT scaled by
            // dpr — it is a ratio, not a length. 0 disables the whole
            // branch, so callers that never ask for it compile to exactly
            // the shader they compiled to before.
            lift: ["1f", node.lift != null ? node.lift : 0],
            radius: ["1f", (node.radius || 200) * dpr],
        }),
        // Without `lift` the cheap path never writes `warped` — it only
        // sets center/edge — so the coordinate is unchanged. WITH lift it
        // probes seven neighbours to find which grown hexagon covers the
        // fragment, and mirroring that on the CPU would be a second
        // implementation of the subtlest code here. Returns null instead,
        // which routes the query to the GPU readback.
        map: (pt, node) => (node.lift ? null : pt),
    },

    offset: {
        doc: {
            summary: "Pushes the coordinate space away from the driver focus. Warp "
                + "stage, so cell grids and borders move WITH the content instead of "
                + "staying a fixed screen-space lattice.",
            params: {
                strength: { default: 20, unit: "px", summary: "how far the space is pushed at full amount" },
                radius: { default: 260, unit: "px", summary: "falloff distance around the focus" },
            },
        },
        // Warp-stage: displaces the coordinate space before the cell
        // grid is computed, so tiles — content AND borders — move
        // together away from the pointer. (The old displace-stage
        // version shifted only the texture lookup, which left grid
        // edges frozen in screen space.)
        stage: "warp",
        // Steered by the pointer unless the node says otherwise, which is
        // what this op did before drivers existed.
        defaultDriver: "mouse",
        decl: (p) => `uniform float ${p}strength; uniform float ${p}radius;
            uniform vec2 ${p}dpos; uniform float ${p}damt;`,
        code: (p) => `
        {
            float d = length(warped - ${p}dpos);
            float fall = 1.0 - smoothstep(0.0, ${p}radius, d);
            vec2 dir = d > 0.5 ? (warped - ${p}dpos) / d : vec2(0.0);
            warped -= dir * ${p}strength * fall * ${p}damt;
        }`,
        uniforms: (node, dpr) => ({
            strength: ["1f", (node.strength || 20) * dpr],
            radius: ["1f", (node.radius || 260) * dpr],
        }),
        // Phase I2. The CPU twin of code() above, so a hit-test costs no
        // GPU sync. Checked against the readback rather than trusted —
        // see the property test in raster-probe.spec.js.
        map: (pt, node, ctx) => {
            const strength = (node.strength || 20) * ctx.dpr;
            const radius = (node.radius || 260) * ctx.dpr;
            const vx = pt[0] - ctx.dpos[0], vy = pt[1] - ctx.dpos[1];
            const d = Math.hypot(vx, vy);
            const fall = 1 - smoothstep(0, radius, d);
            if (!(d > 0.5)) return pt;
            const k = (strength * fall * ctx.damt) / d;
            return [pt[0] - vx * k, pt[1] - vy * k];
        },
    },

    // Curl-noise flow: the coordinate space drifts along a divergence-free
    // vector field, so content slides as if carried by a current. Warp
    // stage, which buys two things for free — it is maskable (STAGE_VARS
    // snapshots `warped`) and it composes with every cell and colour op,
    // because those run downstream of it.
    //
    //   { op: "flow", strength: 18, scale: 120 }        // whole element
    //   { op: "flow", by: "mouse", radius: 320 }        // a current at the pointer
    //   { op: "flow", by: "time", speed: 0.4 }          // hands-free drift
    //
    // Divergence-free BY CONSTRUCTION: the field is the curl of a scalar
    // potential ψ, and curl of a gradient-free scalar has zero divergence.
    // That is what makes it read as a fluid without a pressure solve —
    // `stir` pays for a full Stable-Fluids projection to get a field that
    // also responds to input; this one is free and static-by-seed.
    //
    // Without `by:` the current fills the element. With a driver, strength
    // falls off around the focus (the `duotone`/`halftone` convention), so
    // the effect resolves away from the pointer instead of being global.
    flow: {
        doc: {
            summary: "Curl-noise current. The coordinate space drifts along a "
                + "divergence-free field, so content slides as if carried by water. "
                + "Divergence-free means the flow never piles up or tears.",
            params: {
                strength: { default: 18, unit: "px", summary: "how far the current carries the space" },
                scale: { default: 120, unit: "px", summary: "size of one eddy — small is turbulent, large is a slow drift" },
                speed: { default: 0.25, unit: "seconds", summary: "how fast the field evolves; 0 freezes it" },
                seed: { default: 0, unit: "count", summary: "picks a different field of the same character" },
                radius: {
                    default: 320, unit: "px",
                    summary: "falloff around the focus. Only used when `by` names a driver; "
                        + "without one the current covers the whole element.",
                },
            },
        },
        structural: ["by"],
        stage: "warp",
        decl: (p) => `
            uniform float ${p}scale;
            uniform float ${p}strength;
            uniform float ${p}speed;
            uniform float ${p}seed;
            uniform float ${p}radius;
            uniform vec2 ${p}dpos;
            uniform float ${p}damt;
            // Polynomial bit-mixing hash, deliberately NOT the usual
            // fract(sin(dot(...))). Trig-based hashes disagree across GPU
            // vendors — sin's precision at large arguments is not
            // specified — so the same seed would render a different field
            // on different hardware. This one is multiply/fract only, so
            // the field is at least stable per-device. (Determinism rule,
            // MORPH-IMPL-SPEC §2.9.5a.)
            float ${p}h(vec2 v) {
                vec3 q = fract(vec3(v.xyx) * 0.1031 + ${p}seed);
                q += dot(q, q.yzx + 33.33);
                return fract((q.x + q.y) * q.z);
            }
            float ${p}n(vec2 v) {
                vec2 i = floor(v), f = v - i;
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(${p}h(i), ${p}h(i + vec2(1.0, 0.0)), f.x),
                           mix(${p}h(i + vec2(0.0, 1.0)), ${p}h(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            // The potential. Two octaves: enough structure to read as a
            // current without the cost of a full fBm.
            float ${p}psi(vec2 v) {
                return ${p}n(v) * 0.65 + ${p}n(v * 2.3 + 11.0) * 0.35;
            }`,
        code: (p, node) => `
        {
            float sc = max(${p}scale, 1.0);
            vec2 drift = vec2(0.0, u_time * ${p}speed);${node.by ? `
            float fall = 1.0 - smoothstep(0.0, ${p}radius, length(warped - ${p}dpos));
            float amt = ${p}strength * fall * ${p}damt;` : `
            float amt = ${p}strength;`}
            // Three fixed Euler steps along curl(psi). Fixed count, not
            // adaptive: the step budget is a compile-time property so the
            // shader cost cannot vary with the content.
            for (int i = 0; i < 3; i++) {
                vec2 q = warped / sc + drift;
                float e = 0.35;
                float dy = ${p}psi(q + vec2(0.0, e)) - ${p}psi(q - vec2(0.0, e));
                float dx = ${p}psi(q + vec2(e, 0.0)) - ${p}psi(q - vec2(e, 0.0));
                // curl of a 2D scalar potential = (dpsi/dy, -dpsi/dx)
                warped += vec2(dy, -dx) / (2.0 * e) * amt * 0.3333;
            }
        }`,
        uniforms: (node, dpr) => ({
            // Feature size of the current, in px. Larger = broader, slower
            // -turning eddies.
            scale: ["1f", (node.scale != null ? node.scale : 120) * dpr],
            // Displacement in px. Scaled by dpr: it is a length.
            strength: ["1f", (node.strength != null ? node.strength : 18) * dpr],
            speed: ["1f", node.speed != null ? node.speed : 0.25],
            // NOT dpr-scaled — it selects a field, it is not a length.
            seed: ["1f", node.seed != null ? node.seed : 0],
            radius: ["1f", (node.radius != null ? node.radius : 320) * dpr],
        }),
    },

    duotone: {
        doc: {
            summary: "Maps luminance onto a two-colour ramp. With `by`, the mapping "
                + "is confined to a spot around the driver focus and the rest of the "
                + "element keeps its own colour.",
            params: {
                colors: {
                    default: ["#104B87", "#E8FF00"], unit: "color",
                    summary: "[shadow, highlight] — the two ends of the ramp",
                },
                radius: { default: 220, unit: "px", summary: "spot size when `by` names a driver" },
            },
        },
        structural: ["by"],
        stage: "color",
        decl: (p) => `uniform vec3 ${p}a; uniform vec3 ${p}b; uniform float ${p}radius;
            uniform vec2 ${p}dpos; uniform float ${p}damt;`,
        code: (p, node) => `
        {
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            vec3 duo = mix(${p}a, ${p}b, lum);
            ${node.by
                ? `float mask = (1.0 - smoothstep(${p}radius * 0.35, ${p}radius,
                       length(center - ${p}dpos))) * ${p}damt;`
                : `float mask = 1.0;`}
            col = mix(col, duo, mask);
        }`,
        uniforms: (node, dpr) => {
            const cols = node.colors || ["#104B87", "#E8FF00"];
            return {
                a: ["3fv", hexToRgb(cols[0])],
                b: ["3fv", hexToRgb(cols[1])],
                radius: ["1f", (node.radius || 220) * dpr],
            };
        },
    },

    // Styles the cell seams produced by the cell stage (hexalize et al)
    // as a separate BORDER LAYER (edgeCol / edgeCov) rather than mixing
    // into the content. The final composite draws the element's content
    // (the text) OVER this layer, so borders sit below the glyphs:
    // e.g. { op: "edges", color: "#FFFFFF" } gives white borders under
    // the text. When present it also replaces the default seam darkening.
    edges: {
        doc: {
            summary: "Draws the cell borders a cell-stage op produced. On its own it "
                + "shows nothing — it colours `edge`, which only hexalize (or another "
                + "cell op) writes.",
            params: {
                color: { default: "#FFFFFF", unit: "color", summary: "border colour" },
                strength: { default: 1.0, unit: "ratio", summary: "border opacity" },
            },
        },
        stage: "color",
        decl: (p) => `uniform vec3 ${p}color; uniform float ${p}strength;`,
        code: (p) => `
        {
            edgeCol = ${p}color;
            edgeCov = max(edgeCov, edge * ${p}strength);
        }`,
        uniforms: (node) => ({
            color: ["3fv", hexToRgb(node.color || "#FFFFFF")],
            strength: ["1f", node.strength != null ? node.strength : 1.0],
        }),
    },

    // Stirred liquid: the content swirls as if it were paint being
    // stirred with a spoon. Unlike every other op here this one is
    // STATEFUL — it owns a low-res vector field (a ping-pong pair of
    // render targets) that evolves frame to frame; the main pass just
    // samples the finished field. See the `field` descriptor below and
    // the field-simulation block in applyRasterPipeline().
    //
    // Formulation: the classic GPU Stable-Fluids pipeline (Stam 1999;
    // Harris, GPU Gems 2003) — splat, curl, vorticity confinement,
    // divergence, a Jacobi pressure solve, gradient subtraction, then
    // semi-Lagrangian advection of velocity and dye. See the provenance
    // note on the `stir` field descriptor below for the citations and
    // for what this op inherits from existing implementations.
    //
    // An earlier version of this comment claimed the op was a single
    // pass with no pressure projection. It never was — the solver has
    // always run the full projection, which is what makes the flow roll
    // into persistent vortices rather than smear.
    //
    //   { op: "stir", strength: 26, curl: 2.4, decay: 0.985 }
    //
    // The swirliness knob is `curl` (vorticity confinement). An earlier
    // version of this line said `swirl`, which the solver never reads — it
    // is accepted silently and leaves curl at its default.
    // Halftone: the print dot screen. Tone is carried by dot AREA on a
    // rotated grid rather than by intensity, the way offset lithography
    // reproduces a continuous-tone image with a single ink.
    //
    //   { op: "halftone", size: 6, angle: 15, ink: "#0B1B2B" }
    //
    // With a driver the screen coarsens toward the focus, like holding a
    // loupe over the sheet.
    halftone: {
        doc: {
            summary: "Print halftone: the image is redrawn as a grid of ink dots on "
                + "paper, dot size following local luminance.",
            params: {
                size: { default: 6, unit: "px", summary: "dot pitch" },
                angle: { default: 15, unit: "deg", summary: "screen angle of the dot grid" },
                ink: { default: "#0B1B2B", unit: "color", summary: "dot colour" },
                paper: { default: "#FFFFFF", unit: "color", summary: "background colour" },
                softness: { default: 0.08, unit: "ratio", summary: "dot edge softness — 0 is a hard stencil" },
                amount: { default: 1, unit: "ratio", summary: "blend back toward the un-screened image; 0 is identity. Keyframe it to 0 at both ends of a transition so the shader hands over to the real element without a pop." },
                radius: { default: 220, unit: "px", summary: "spot size when `by` names a driver" },
            },
        },
        structural: ["by"],
        stage: "color",
        decl: (p) => `
            uniform float ${p}size;
            uniform float ${p}amount;
            uniform float ${p}angle;
            uniform vec3 ${p}ink;
            uniform vec3 ${p}paper;
            uniform float ${p}soft;
            uniform float ${p}radius;
            uniform vec2 ${p}dpos;
            uniform float ${p}damt;`,
        code: (p, node) => `
        {
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            float sz = ${p}size;${node.by ? `
            float fd = 1.0 - smoothstep(0.0, ${p}radius, length(frag - ${p}dpos));
            sz *= 1.0 + fd * ${p}damt * 1.8;` : ``}
            // Screen angle: rotating the grid is what stops the dots
            // reading as a horizontal/vertical texture.
            float ca = cos(${p}angle), sa = sin(${p}angle);
            vec2 rp = vec2(ca * frag.x - sa * frag.y,
                           sa * frag.x + ca * frag.y) / max(sz, 1.0);
            vec2 cell = fract(rp) - 0.5;
            // Dot radius from tone: darker tone prints a bigger dot.
            // sqrt because ink coverage goes as area, not radius.
            float rr = sqrt(clamp(1.0 - lum, 0.0, 1.0)) * 0.55;
            float dm = smoothstep(rr, rr - ${p}soft, length(cell));
            col = mix(col, mix(${p}paper, ${p}ink, dm), clamp(${p}amount, 0.0, 1.0));
        }`,
        uniforms: (node, dpr) => ({
            size: ["1f", (node.size || 6) * dpr],
            amount: ["1f", node.amount != null ? node.amount : 1],
            angle: ["1f", ((node.angle != null ? node.angle : 15) * Math.PI) / 180],
            ink: ["3fv", hexToRgb(node.ink || "#0B1B2B")],
            paper: ["3fv", hexToRgb(node.paper || "#FFFFFF")],
            soft: ["1f", node.softness != null ? node.softness : 0.08],
            radius: ["1f", (node.radius || 220) * dpr],
        }),
    },

    // Ordered dither: quantise the image to a few levels per channel and
    // break the resulting banding with a Bayer threshold matrix, the way
    // an indexed-colour display fakes shades it cannot address.
    //
    //   { op: "dither", levels: 6 }                 // gentle, keeps colour
    //   { op: "dither", levels: 3, amount: 0.7 }    // stronger posterise
    //   { op: "dither", mono: true, ink: "#0B1B2B" } // 1-bit, ink on paper
    //
    // Unlike `halftone`, which replaces the picture with ink coverage on
    // paper, this keeps the original hues and only coarsens them — so it
    // reads as texture over a photograph rather than as a print process.
    //
    // Stateless, so it renders on the snapshot backend. That matters:
    // `stir` needs the HTML-in-Canvas live backend and silently does
    // nothing without the origin trial, whereas this runs everywhere.
    //
    // `by` coarsens the pattern toward the driver focus, as halftone does.
    dither: {
        doc: {
            summary: "Ordered (Bayer) dithering to a small palette — the look of an "
                + "8-bit display, and the one op that gets sharper as the element gets "
                + "smaller.",
            params: {
                size: { default: 1, unit: "px", summary: "size of one dither cell; 1 is per-pixel" },
                levels: { default: 6, unit: "count", summary: "quantisation steps per channel" },
                amount: { default: 1, unit: "ratio", summary: "blend back toward the undithered image" },
                mono: {
                    default: false, unit: "bool", structural: true,
                    summary: "quantise luminance to ink/paper instead of per-channel colour. "
                        + "A different shader, so toggling rebuilds.",
                },
                ink: { default: "#0B1B2B", unit: "color", summary: "dark end, mono only" },
                paper: { default: "#FFFFFF", unit: "color", summary: "light end, mono only" },
                radius: { default: 220, unit: "px", summary: "spot size when `by` names a driver" },
            },
        },
        structural: ["by", "mono"],
        stage: "color",
        decl: (p) => `
            uniform float ${p}levels;
            uniform float ${p}size;
            uniform float ${p}amount;
            uniform vec3 ${p}ink;
            uniform vec3 ${p}paper;
            uniform vec2 ${p}dpos;
            uniform float ${p}damt;
            uniform float ${p}radius;
            // Bayer matrices by recursive bit-interleave rather than a
            // 64-entry table: WebGL1 has no constant array indexing, and
            // the nesting is exactly the recursive definition of the
            // ordered-dither matrix.
            float ${p}b2(vec2 a) {
                a = floor(a);
                return fract(a.x * 0.5 + a.y * a.y * 0.75);
            }
            float ${p}b4(vec2 a) { return ${p}b2(0.5 * a) * 0.25 + ${p}b2(a); }
            float ${p}b8(vec2 a) { return ${p}b4(0.5 * a) * 0.25 + ${p}b2(a); }`,
        code: (p, node) => `
        {
            float sz = max(${p}size, 1e-3);${node.by ? `
            float fd = 1.0 - smoothstep(0.0, ${p}radius, length(frag - ${p}dpos));
            sz *= 1.0 + fd * ${p}damt * 1.8;` : ``}
            // Centre the threshold on zero so dithering does not lift or
            // crush the overall exposure, only redistributes it.
            float t = ${p}b8(frag / sz) - 0.5;
            float lv = max(${p}levels, 1.0);
            ${node.mono ? `
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            float q = step(0.5, lum + t);
            vec3 dq = mix(${p}ink, ${p}paper, q);` : `
            // Per channel: scale to level index, offset by the threshold,
            // round, scale back. The +t before rounding is what turns a
            // hard band edge into an interleaved pattern of the two
            // neighbouring levels.
            vec3 dq = floor(col * lv + 0.5 + t) / lv;`}
            col = mix(col, clamp(dq, 0.0, 1.0), clamp(${p}amount, 0.0, 1.0));
        }`,
        uniforms: (node, dpr) => ({
            levels: ["1f", node.levels != null ? node.levels : 6],
            size: ["1f", (node.size != null ? node.size : 1) * dpr],
            amount: ["1f", node.amount != null ? node.amount : 1],
            ink: ["3fv", hexToRgb(node.ink || "#0B1B2B")],
            paper: ["3fv", hexToRgb(node.paper || "#FFFFFF")],
            radius: ["1f", (node.radius || 220) * dpr],
        }),
    },

    // Chromatic aberration: the only op that uses the displace stage. It
    // does not move the sample position itself, it sets `chroma`, the
    // per-channel split the sampler applies - red and blue are fetched
    // either side of green along the radial direction, the way a simple
    // lens disperses wavelengths toward its edges.
    //
    //   { op: "aberration", amount: 6 }            // radial, lens-like
    //   { op: "aberration", amount: 14, by: "mouse" }  // focused at the pointer
    aberration: {
        // Displace stage, but it only spreads the per-channel taps
        // (`chroma`) — the primary sample position is untouched. Declared
        // so a hit-test can skip it rather than give up on the CPU path;
        // a unit test checks this against the op's own source.
        movesCoords: false,
        doc: {
            summary: "Chromatic aberration: the three colour channels are sampled "
                + "at slightly different offsets, like a cheap lens.",
            params: {
                amount: { default: 6, unit: "px", summary: "channel separation" },
                radius: { default: 240, unit: "px", summary: "falloff around the focus when `by` names a driver" },
            },
        },
        structural: ["by"],
        stage: "displace",
        chroma: true,
        decl: (p) => `
            uniform float ${p}amount;
            uniform float ${p}radius;
            uniform vec2 ${p}dpos;
            uniform float ${p}damt;`,
        code: (p, node) => `
        {
            vec2 ctr = ${node.by ? `${p}dpos` : `u_res * 0.5`};
            vec2 dv = sampleP - ctr;
            float dl = length(dv);
            vec2 dir = dl > 0.5 ? dv / dl : vec2(0.0);
            ${node.by
                ? `float amt = ${p}amount * ${p}damt *
                       (1.0 - smoothstep(0.0, ${p}radius, dl));`
                : `float amt = ${p}amount * (dl / max(length(u_res) * 0.5, 1.0));`}
            chroma += dir * amt;
        }`,
        uniforms: (node, dpr) => ({
            amount: ["1f", (node.amount != null ? node.amount : 6) * dpr],
            radius: ["1f", (node.radius || 240) * dpr],
        }),
    },

    // ── Field producers ──────────────────────────────────────────────
    // These draw nothing. They write a scalar field that LATER ops read
    // via `masked:`, which is the whole of the node-to-node data flow:
    //
    //   { op: "mask",  from: "radial", as: "centre", radius: 300 },
    //   { op: "stir",  masked: "centre" },      // fluid only in the middle
    //   { op: "halftone" },                     // screen everywhere
    //
    // The masking wrapper is generic, so an op does not know or care
    // that it is being constrained — every op, including ones written
    // before fields existed, can be masked.

    // Geometric / content masks.
    mask: {
        doc: {
            summary: "Writes a scalar FIELD for later ops to read — draws nothing "
                + "itself. Give a downstream op `masked: \"name\"` and it applies only "
                + "where this field is high. This is how any op becomes local without "
                + "knowing anything about masking.",
            params: {
                as: {
                    default: "mask", unit: "name", structural: true,
                    summary: "name of the field written. Consumers name it in `masked:`.",
                },
                from: {
                    default: "radial", unit: "name", structural: true,
                    summary: "field shape — compiled in, so changing it rebuilds",
                },
                at: {
                    default: [0.5, 0.5], unit: "point", structural: true,
                    summary: "centre as a fraction of the element box; survives resizes",
                },
                radius: { default: 260, unit: "px", summary: "field radius" },
                invert: { default: false, unit: "bool", summary: "swap inside and outside" },
                remap: { default: [0, 1], unit: "range", summary: "rescale the field's output range" },
            },
        },
        structural: ["as", "from", "at"],
        stage: "field",
        producesField: true,
        defaultDriver: "static",
        decl: (p) => `
            uniform vec2 ${p}dpos;
            uniform float ${p}damt;
            uniform float ${p}radius;
            uniform vec2 ${p}at;
            uniform vec2 ${p}remap;
            uniform float ${p}invert;`,
        code: (p, node) => {
            const src = node.from || "radial";
            // Where a radial mask sits. `at:` is fractional (0..1 of the
            // element box) so it survives resizes; without it the focus
            // comes from the driver, which defaults to the centre.
            const ctr = node.at ? `(${p}at * u_res)` : `${p}dpos`;
            const raw = src === "vertical"
                ? `frag.y / max(u_res.y, 1.0)`
                : src === "horizontal"
                    ? `frag.x / max(u_res.x, 1.0)`
                    : /* radial, and the default */
                    `1.0 - smoothstep(0.0, ${p}radius, length(frag - ${ctr}))`;
            return `
        {
            float m = ${raw};
            m = clamp((m - ${p}remap.x) / max(${p}remap.y - ${p}remap.x, 1e-4), 0.0, 1.0);
            m = mix(m, 1.0 - m, ${p}invert);
            ${fieldVar(node.as || "mask")} *= m * ${p}damt;
        }`;
        },
        uniforms: (node, dpr) => ({
            radius: ["1f", (node.radius != null ? node.radius : 260) * dpr],
            at: ["2fv", node.at || [0.5, 0.5]],
            remap: ["2fv", node.remap || [0, 1]],
            invert: ["1f", node.invert ? 1 : 0],
        }),
    },

    // Animated value noise as a field. The Houdini move: make an
    // attribute, then reference it downstream.
    //
    //   { op: "noise", as: "turbulence", scale: 3, speed: 0.4 },
    //   { op: "offset", masked: "turbulence", strength: 30 },
    noise: {
        doc: {
            summary: "Writes an animated noise FIELD. Same contract as `mask` — it "
                + "draws nothing; downstream ops read it via `masked:`. Use it to make "
                + "any other op flicker, breathe or crawl.",
            params: {
                as: {
                    default: "mask", unit: "name", structural: true,
                    summary: "name of the field written",
                },
                scale: { default: 3, unit: "ratio", summary: "noise frequency across the element" },
                speed: { default: 0.3, unit: "seconds", summary: "how fast it evolves; 0 freezes it" },
                amount: { default: 1, unit: "ratio", summary: "blend between flat 1.0 and full noise" },
                remap: { default: [0, 1], unit: "range", summary: "rescale the field's output range" },
            },
        },
        structural: ["as"],
        stage: "field",
        producesField: true,
        decl: (p) => `
            uniform float ${p}scale;
            uniform float ${p}speed;
            uniform vec2 ${p}remap;
            uniform float ${p}amp;
            float ${p}h(vec2 v) {
                return fract(sin(dot(v, vec2(41.113, 289.717))) * 43758.545);
            }
            float ${p}n(vec2 v) {
                vec2 i = floor(v), f = v - i;
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(${p}h(i), ${p}h(i + vec2(1.0, 0.0)), f.x),
                           mix(${p}h(i + vec2(0.0, 1.0)), ${p}h(i + vec2(1.0, 1.0)), f.x), f.y);
            }`,
        code: (p, node) => `
        {
            vec2 np = frag / max(u_res.y, 1.0) * ${p}scale;
            // Two octaves: enough structure to read as turbulence
            // without the cost of a full fBm.
            float n = ${p}n(np + u_time * ${p}speed) * 0.65 +
                      ${p}n(np * 2.7 - u_time * ${p}speed * 0.6) * 0.35;
            n = clamp((n - ${p}remap.x) / max(${p}remap.y - ${p}remap.x, 1e-4), 0.0, 1.0);
            ${fieldVar(node.as || "mask")} *= mix(1.0, n, ${p}amp);
        }`,
        uniforms: (node) => ({
            scale: ["1f", node.scale != null ? node.scale : 3],
            speed: ["1f", node.speed != null ? node.speed : 0.3],
            remap: ["2fv", node.remap || [0, 1]],
            amp: ["1f", node.amount != null ? node.amount : 1],
        }),
    },

    // Copy to points. The content is re-sampled at a set of points, each
    // stamp scaled and rotated, and composited into the overlay layer so
    // the copies sit above the original rather than replacing it.
    //
    //   { op: "copy", count: 6, radius: 120, scale: 0.55, rotate: 0.3 }
    //   { op: "copy", points: [[0.2, 0.5], [0.8, 0.5]], scale: 0.4 }
    //
    // With `count`, the points are a ring around the driver focus, so
    // `by: "mouse"` drags the whole instance set around. With explicit
    // `points`, positions are fractional (0..1 of the element box) and
    // survive resizes.
    //
    // Single pass, so the stamp count is fixed at compile time and the
    // loop is unrolled: `count` is a structural parameter, not something
    // to animate. Copies sample the ORIGINAL texture, not the result of
    // earlier colour ops, so a copy of a halftoned element is a copy of
    // the unhalftoned source with the screen applied over it.
    copy: {
        // Phase I4. Draws N stamps of the ORIGINAL texture over the
        // result, so one screen point genuinely shows several sources and
        // `sourceAt` can only report the primary sample. There is no
        // correct single answer here, only a documented one.
        multiSample: true,
        doc: {
            summary: "Stamps extra copies of the element over itself. Copies sample "
                + "the ORIGINAL texture, not the result of earlier colour ops, so a copy "
                + "of a halftoned element is a copy of the unhalftoned source.",
            params: {
                count: {
                    default: 5, unit: "count", structural: true,
                    summary: "stamps arranged in a ring around the focus. The loop is "
                        + "unrolled at compile time, so this rebuilds — not something to animate.",
                },
                points: {
                    default: null, unit: "point", structural: true,
                    summary: "explicit [[x,y], ...] in fractions of the element box, instead "
                        + "of a ring. Survives resizes. Overrides `count`.",
                },
                radius: { default: 110, unit: "px", summary: "ring radius when using `count`" },
                scale: { default: 0.5, unit: "ratio", summary: "size of each copy" },
                rotate: { default: 0, unit: "deg", summary: "rotation applied per copy" },
                fade: { default: 1, unit: "ratio", summary: "opacity falloff across the set" },
                amount: { default: 1, unit: "ratio", summary: "overall blend of the copies over the original" },
            },
        },
        // `count`/`points` unroll the stamp loop at compile time.
        structural: ["count", "points"],
        stage: "color",
        defaultDriver: "static",
        decl: (p) => `
            uniform vec2 ${p}dpos;
            uniform float ${p}damt;
            uniform float ${p}radius;
            uniform float ${p}scale;
            uniform float ${p}rotate;
            uniform float ${p}fade;
            uniform float ${p}amount;`,
        code: (p, node) => {
            const explicit = Array.isArray(node.points) && node.points.length > 0;
            const n = explicit
                ? node.points.length
                : Math.max(1, Math.min(24, Math.round(node.count || 5)));
            let body = "";
            for (let k = 0; k < n; k++) {
                // Where this stamp is centred.
                const centre = explicit
                    ? `vec2(${(+node.points[k][0]).toFixed(5)}, ${(+node.points[k][1]).toFixed(5)}) * u_res`
                    : (() => {
                        const a = (k / n) * Math.PI * 2;
                        return `${p}dpos + vec2(${Math.cos(a).toFixed(5)}, ` +
                            `${Math.sin(a).toFixed(5)}) * ${p}radius`;
                    })();
                body += `
        {
            float ang = ${p}rotate * ${(k + 1).toFixed(1)};
            float cs = cos(ang), sn = sin(ang);
            // Inverse transform: to draw a stamp scaled by s about a
            // centre c, fetch from the source at (frag - c) / s.
            vec2 d = mat2(cs, -sn, sn, cs) * (frag - (${centre}));
            vec2 q = d / max(${p}scale, 1e-3) + u_res * 0.5;
            vec2 quv = vec2(q.x / u_res.x, 1.0 - q.y / u_res.y);
            vec2 inside = step(vec2(0.0), quv) * step(quv, vec2(1.0));
            vec4 s = texture2D(u_tex, clamp(quv, 0.0, 1.0));
            float w = s.a * inside.x * inside.y * ${p}amount * ${p}damt
                      * pow(${p}fade, ${k.toFixed(1)});
            // Straight-alpha OVER, newest stamp on top.
            float na = w + ovA * (1.0 - w);
            ovCol = (s.rgb * w + ovCol * ovA * (1.0 - w)) / max(na, 1e-4);
            ovA = na;
        }`;
            }
            return body;
        },
        uniforms: (node, dpr) => ({
            radius: ["1f", (node.radius != null ? node.radius : 110) * dpr],
            scale: ["1f", node.scale != null ? node.scale : 0.5],
            rotate: ["1f", node.rotate != null ? node.rotate : 0],
            fade: ["1f", node.fade != null ? node.fade : 1],
            amount: ["1f", node.amount != null ? node.amount : 1],
        }),
    },

    // Merge two sub-chains and blend the results.
    //
    //   { op: "merge", mode: "screen", mix: 1.0,
    //     a: [ { op: "halftone" } ],
    //     b: [ { op: "duotone", colors: [...] } ] }
    //
    // Both branches start from the same state and neither sees the
    // other's output — that is the difference between a merge and a
    // chain. `mix` fades the whole merge back toward branch A, so
    // `mix: 0` is A alone and `mix: 1` is the full blend.
    //
    // The shader work is emitted inline, so a merge costs no extra pass,
    // no extra framebuffer and no second capture of the DOM. It cannot,
    // for the same reason, give the branches different source content.
    merge: {
        doc: {
            summary: "Runs two sub-chains over the same source and blends the "
                + "results. The only op that takes other ops as arguments — everything "
                + "else composes by sequence, this composes in parallel.",
            params: {
                a: { default: null, summary: "first branch: an array of nodes", structural: true },
                b: { default: null, summary: "second branch: an array of nodes", structural: true },
                mode: {
                    default: "over", unit: "name", structural: true,
                    summary: "how the branches combine: over, add, screen, multiply, "
                        + "difference, lighten. Compiled in, so it rebuilds.",
                },
                mix: { default: 1, unit: "ratio", summary: "how far to blend b into a" },
            },
        },
        structural: ["mode", "a", "b"],
        // Never routed through the normal stage path — emitMerge()
        // handles it — but it still needs decl/uniforms so its `mix`
        // gets declared and uploaded like any other op's.
        stage: "color",
        decl: (p) => `uniform float ${p}mix;`,
        code: () => "",
        uniforms: (node) => ({ mix: ["1f", node.mix != null ? node.mix : 1] }),
    },

    // Echo: temporal accumulation. Each frame is blended into a
    // persistent full-resolution buffer, so content that CHANGES leaves a
    // fading trail behind it — typing smears, a counter ticking over
    // leaves a comet, a scrolling list ghosts.
    //
    // This is the one op that cannot work on the snapshot backend. A
    // snapshot is a single frozen image, so accumulating it converges to
    // that same still frame and nothing moves; it needs the live
    // HTML-in-Canvas capture, where the texture is re-uploaded from the
    // real DOM on every paint. Run it with the origin trial off and you
    // correctly see nothing happen.
    //
    //   { op: "echo", decay: 0.92, strength: 0.85 }
    //
    // The trail is written into the BORDER layer, which the frame
    // skeleton composites underneath the content, so the ghosts sit
    // behind the live text rather than veiling it.
    echo: {
        doc: {
            summary: "Temporal accumulation — a fading trail of what CHANGED. Typing "
                + "smears, a ticking counter leaves a comet. The one op that does nothing "
                + "on the snapshot backend, because a frozen image has no motion to record.",
            params: {
                strength: { default: 0.85, unit: "ratio", summary: "opacity of the trail" },
                decay: { default: 0.92, unit: "ratio", summary: "per-second persistence — higher is a longer tail" },
                tint: { default: "#7FD4FF", unit: "color", summary: "colour pushed into the trail" },
                tintAmount: { default: 0.5, unit: "ratio", summary: "how far the trail is tinted" },
            },
        },
        stage: "color",
        decl: (p) => `
            uniform sampler2D ${p}hist;
            uniform float ${p}strength;
            uniform vec3 ${p}tint;
            uniform float ${p}tintAmt;`,
        code: (p) => `
        {
            // Sampled in screen space: the trail records where things
            // WERE, which is not where a warp op would fetch them from.
            vec2 huv = vec2(frag.x / u_res.x, 1.0 - frag.y / u_res.y);
            vec4 h = texture2D(${p}hist, clamp(huv, 0.001, 0.999));
            float ha = clamp(h.a * ${p}strength, 0.0, 1.0);
            vec3 hc = mix(h.rgb, ${p}tint, ${p}tintAmt);
            // Straight-alpha OVER into the border layer so an edges op
            // in the same chain still composites correctly.
            float na = ha + edgeCov * (1.0 - ha);
            edgeCol = (hc * ha + edgeCol * edgeCov * (1.0 - ha)) / max(na, 1e-4);
            edgeCov = na;
        }`,
        uniforms: (node) => ({
            strength: ["1f", node.strength != null ? node.strength : 0.85],
            tint: ["3fv", hexToRgb(node.tint || "#7FD4FF")],
            tintAmt: ["1f", node.tint ? (node.tintAmount != null ? node.tintAmount : 0.5) : 0.0],
        }),
        solver: {
            // Full canvas resolution: a trail wants to be as sharp as the
            // content it is trailing, not a coarse simulation grid.
            resolutions: (node, w, h) => ({ frame: [w, h] }),
            targets: { history: { double: true, res: "frame", fmt: "rgba", smooth: true } },
            samplers: { hist: "history" },
            programs: {
                // out = max(content, history * decay)
                //
                // max rather than a mix: the brightest thing that has
                // passed through a pixel is what persists, so trails read
                // as light left behind instead of a muddy average. decay
                // is per-frame and normalised for frame rate.
                accumulate: `
precision highp float;
uniform sampler2D u_content;
uniform sampler2D u_hist;
uniform vec2 u_texel;
uniform float u_decay;
void main() {
    vec2 uv = gl_FragCoord.xy * u_texel;
    vec4 c = texture2D(u_content, uv);
    vec4 h = texture2D(u_hist, uv) * u_decay;
    gl_FragColor = max(c, h);
}`,
            },
            // echo takes no pointer input, so nothing to splat.
            splatColor: () => [0, 0, 0],
            step: (S, node, ctx) => {
                const dt = Math.min(ctx.dt, 1 / 30);
                const decay = Math.pow(node.decay != null ? node.decay : 0.92, dt * 60);
                S.use("accumulate");
                S.f2("u_texel", 1 / S.canvasW, 1 / S.canvasH);
                S.f1("u_decay", decay);
                S.smp("u_content", S.content, 0);
                S.smp("u_hist", S.read("history"), 1);
                S.blit(S.write("history"));
                S.swap("history");
            },
        },
    },

    // Stirred liquid: an incompressible fluid whose velocity field warps
    // the content and whose dye field colours it.
    //
    // Provenance. The solver was written from the published papers, and
    // no code was copied from an existing implementation — the neighbour
    // taps are computed in-fragment from gl_FragCoord rather than passed
    // down as vL/vR/vT/vB varyings, advection samples directly instead of
    // through a hand-rolled bilerp(), and the rainbow hue comes from the
    // stroke direction rather than a random HSV pick. But it is not
    // independent of that lineage either, and two things are inherited
    // rather than derived from the papers:
    //
    //   - The option vocabulary and several defaults (curl, pressure,
    //     pressureIterations, radius, force, intensity, rainbow,
    //     dyeResolution; resolution 128, dyeResolution 512, pressure 0.8)
    //     follow the conventions of Pavel Dobryakov's
    //     WebGL-Fluid-Simulation (MIT) and its many descendants.
    //   - The free-slip boundary handling — four inline conditionals in
    //     the divergence shader that mirror the centre velocity at the
    //     walls — is that codebase's approach. Stam and Harris both use a
    //     separate boundary pass over border geometry instead.
    //
    // Everything below that looks identical to other implementations
    // beyond those two points is identical because the mathematics admits
    // one spelling: (r+l+t+b-d)*0.25 is the Jacobi iteration as printed
    // in GPU Gems 38, and the divergence, curl and confinement kernels
    // are the standard central differences.
    //
    //   J. Stam, "Stable Fluids", SIGGRAPH '99, 121-128 - the
    //     unconditionally stable operator splitting used here: add
    //     forces, advect by a backward particle trace, then project the
    //     velocity onto its divergence-free part via a Poisson solve.
    //   M. Harris, "Fast Fluid Dynamics Simulation on the GPU", GPU Gems
    //     ch. 38 (2003) - mapping each operator onto a fragment program
    //     over ping-ponged textures, Jacobi iterations for the pressure.
    //   R. Fedkiw, J. Stam, H. Jensen, "Visual Simulation of Smoke",
    //     SIGGRAPH '01 - vorticity confinement, which restores the
    //     small-scale swirl that a coarse grid numerically damps away.
    //
    // Per frame: splat -> curl -> confine -> divergence -> pressure
    // (Jacobi) -> subtract gradient -> advect velocity -> advect dye.
    // The projection step is what distinguishes this from a plain
    // velocity-texture smear: enforcing div(v)=0 is what makes the flow
    // roll into persistent vortices instead of piling up and dissipating.
    //
    // Needs WebGL2 with float render targets; without them the op
    // disables itself and the rest of the chain still renders.
    stir: {
        doc: {
            summary: "Stirred liquid: a real fluid simulation the content is dragged "
                + "through. STATEFUL — it owns a ping-pong pair of render targets that "
                + "evolve frame to frame, so it is the most expensive op here.",
            params: {
                strength: { default: 26, unit: "px", summary: "how far the fluid carries the content" },
                force: { default: 1.0, unit: "ratio", summary: "how hard the pointer pushes the fluid" },
                radius: { default: 0.1, unit: "ratio", summary: "splat size, as a fraction of the sim grid" },
                curl: { default: 2.2, unit: "ratio", summary: "vorticity — how much the fluid curls into eddies" },
                decay: { default: 0.985, unit: "ratio", summary: "per-second velocity persistence" },
                pressure: { default: 0.8, unit: "ratio", summary: "pressure retained between frames" },
                pressureIterations: { default: 6, unit: "count", summary: "solver iterations; higher is stiffer and slower" },
                intensity: { default: 1.6, unit: "ratio", summary: "brightness of the dye layer" },
                sheen: { default: 0.15, unit: "ratio", summary: "specular highlight on the surface" },
                tint: { default: "#7FD4FF", unit: "color", summary: "dye colour, unless `rainbow`" },
                rainbow: { default: false, unit: "bool", summary: "cycle dye hue instead of using `tint`" },
                dye: { default: 0.85, unit: "ratio", summary: "how much dye colour reaches the final image" },
                dyeAmount: { default: 0.6, unit: "ratio", summary: "how much dye each splat injects" },
                dyeFade: { default: 0.97, unit: "ratio", summary: "per-second dye persistence" },
                resolution: { default: 128, unit: "count", summary: "velocity grid size, clamped 32..512" },
                dyeResolution: { default: 512, unit: "count", summary: "dye grid size, clamped 64..1024" },
            },
        },
        stage: ["warp", "color"],
        decl: (p) => `
            uniform sampler2D ${p}vel;
            uniform sampler2D ${p}dye;
            uniform float ${p}strength;
            uniform float ${p}dyemix;
            uniform float ${p}intensity;
            uniform float ${p}sheen;
            uniform vec3 ${p}tint;`,
        code: (p, node, stage) => stage === "warp" ? `
        {
            // frag/warped are top-down pixels, the field is bottom-up
            // [0,1]: flip y going in, and flip the y of the vector coming
            // out so the content drags WITH the pointer.
            vec2 fuv = vec2(warped.x / u_res.x, 1.0 - warped.y / u_res.y);
            vec2 v = texture2D(${p}vel, clamp(fuv, 0.001, 0.999)).xy;
            warped += vec2(v.x, -v.y) * ${p}strength;
        }` : `
        {
            // Sampled at the CONTINUOUS warped position, never at the
            // cell centre: a cell op upstream (hexalize) snaps the cell
            // centre to one point per tile, which would quantise the
            // liquid into flat per-hex patches instead of smooth swirls.
            vec2 suv = vec2(warped.x / u_res.x, 1.0 - warped.y / u_res.y);
            vec3 dc = texture2D(${p}dye, clamp(suv, 0.001, 0.999)).rgb;
            float mag = length(dc);
            // Colour is carried IN the dye field and advected with it, so
            // a ribbon keeps its hue while the flow folds it. Deriving
            // colour from the local flow direction instead would make
            // neighbouring pixels jump hue and read as confetti.
            vec3 liquid = mag > 1e-4 ? clamp(dc / mag * 1.25, 0.0, 1.0) : ${p}tint;
            float amt = clamp((1.0 - exp(-mag * ${p}intensity)) * ${p}dyemix, 0.0, 1.0);
            // Straight-alpha OVER so a later overlay op (blobs) still
            // composites correctly on top of the liquid.
            float na = amt + ovA * (1.0 - amt);
            ovCol = (liquid * amt + ovCol * ovA * (1.0 - amt)) / max(na, 1e-4);
            ovA = na;

            // Faint sheen on the content itself where the flow is fast.
            float sp = length(texture2D(${p}vel, clamp(suv, 0.001, 0.999)).xy);
            col = mix(col, ${p}tint, (1.0 - exp(-sp * 0.7)) * ${p}sheen);
        }`,
        uniforms: (node, dpr) => ({
            strength: ["1f", (node.strength != null ? node.strength : 26) * dpr],
            sheen: ["1f", node.sheen != null ? node.sheen : 0.15],
            tint: ["3fv", hexToRgb(node.tint || "#7FD4FF")],
            dyemix: ["1f", node.dye != null ? node.dye : 0.85],
            intensity: ["1f", node.intensity != null ? node.intensity : 1.6],
        }),

        // ── The simulation ────────────────────────────────────────────
        // Declared as data: the pipeline allocates the targets, compiles
        // the programs, and calls step() once per frame.
        solver: {
            resolutions: (node) => ({
                sim: Math.max(32, Math.min(node.resolution || 128, 512)),
                dye: Math.max(64, Math.min(node.dyeResolution || 512, 1024)),
            }),
            // read/write pairs ping-pong; single targets are scratch.
            targets: {
                velocity: { double: true, res: "sim", fmt: "rg", smooth: true },
                dye: { double: true, res: "dye", fmt: "rgba", smooth: true },
                pressure: { double: true, res: "sim", fmt: "r", smooth: false },
                divergence: { double: false, res: "sim", fmt: "r", smooth: false },
                vorticity: { double: false, res: "sim", fmt: "r", smooth: false },
            },
            // Which target each main-pass sampler reads.
            samplers: { vel: "velocity", dye: "dye" },

            programs: {
                // Gaussian source term. Distance is measured as a
                // fraction of the element's LONGER side so the radius
                // means the same thing whatever the element's shape.
                splat: `
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform vec2 u_point;
uniform vec3 u_amount;
uniform float u_radius;
uniform float u_aspect;
void main() {
    vec2 uv = gl_FragCoord.xy * u_texel;
    vec2 d = uv - u_point;
    if (u_aspect >= 1.0) d.y /= u_aspect; else d.x *= u_aspect;
    float g = exp(-dot(d, d) / max(u_radius * u_radius, 1e-6));
    gl_FragColor = vec4(texture2D(u_src, uv).xyz + u_amount * g, 1.0);
}`,

                // Semi-Lagrangian advection (Stam 1999): trace the
                // characteristic backwards and resample. Unconditionally
                // stable for any timestep, which is the whole point.
                advect: `
precision highp float;
uniform sampler2D u_vel;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_diss;
void main() {
    vec2 uv = gl_FragCoord.xy * u_texel;
    vec2 back = uv - texture2D(u_vel, uv).xy * u_dt;
    gl_FragColor = vec4(texture2D(u_src, clamp(back, 0.0, 1.0)).xyz * u_diss, 1.0);
}`,

                // Scalar vorticity of a 2D field: d(vy)/dx - d(vx)/dy.
                curl: `
precision highp float;
uniform sampler2D u_vel;
uniform vec2 u_texel;
void main() {
    vec2 uv = gl_FragCoord.xy * u_texel;
    float r = texture2D(u_vel, uv + vec2(u_texel.x, 0.0)).y;
    float l = texture2D(u_vel, uv - vec2(u_texel.x, 0.0)).y;
    float t = texture2D(u_vel, uv + vec2(0.0, u_texel.y)).x;
    float b = texture2D(u_vel, uv - vec2(0.0, u_texel.y)).x;
    gl_FragColor = vec4(0.5 * ((r - l) - (t - b)), 0.0, 0.0, 1.0);
}`,

                // Vorticity confinement (Fedkiw et al. 2001): push the
                // velocity along N x omega, where N is the unit gradient
                // of |omega|, i.e. toward the centre of each eddy. This
                // feeds energy back into swirl the grid would otherwise
                // smooth out.
                confine: `
precision highp float;
uniform sampler2D u_vel;
uniform sampler2D u_curl;
uniform vec2 u_texel;
uniform float u_eps;
uniform float u_dt;
void main() {
    vec2 uv = gl_FragCoord.xy * u_texel;
    float r = texture2D(u_curl, uv + vec2(u_texel.x, 0.0)).x;
    float l = texture2D(u_curl, uv - vec2(u_texel.x, 0.0)).x;
    float t = texture2D(u_curl, uv + vec2(0.0, u_texel.y)).x;
    float b = texture2D(u_curl, uv - vec2(0.0, u_texel.y)).x;
    float c = texture2D(u_curl, uv).x;
    vec2 grad = 0.5 * vec2(abs(r) - abs(l), abs(t) - abs(b));
    vec2 n = grad / (length(grad) + 1e-5);
    vec2 force = u_eps * c * vec2(n.y, -n.x);
    vec2 v = texture2D(u_vel, uv).xy + force * u_dt;
    gl_FragColor = vec4(clamp(v, -64.0, 64.0), 0.0, 1.0);
}`,

                // div(v). The walls reflect, so the fluid stays in the box.
                divergence: `
precision highp float;
uniform sampler2D u_vel;
uniform vec2 u_texel;
void main() {
    vec2 uv = gl_FragCoord.xy * u_texel;
    float r = texture2D(u_vel, uv + vec2(u_texel.x, 0.0)).x;
    float l = texture2D(u_vel, uv - vec2(u_texel.x, 0.0)).x;
    float t = texture2D(u_vel, uv + vec2(0.0, u_texel.y)).y;
    float b = texture2D(u_vel, uv - vec2(0.0, u_texel.y)).y;
    vec2 c = texture2D(u_vel, uv).xy;
    if (uv.x - u_texel.x < 0.0) l = -c.x;
    if (uv.x + u_texel.x > 1.0) r = -c.x;
    if (uv.y - u_texel.y < 0.0) b = -c.y;
    if (uv.y + u_texel.y > 1.0) t = -c.y;
    gl_FragColor = vec4(0.5 * ((r - l) + (t - b)), 0.0, 0.0, 1.0);
}`,

                // One Jacobi sweep of the Poisson equation lap(p) = div(v)
                // (Harris 2003). Run a handful of these per frame.
                jacobi: `
precision highp float;
uniform sampler2D u_p;
uniform sampler2D u_div;
uniform vec2 u_texel;
void main() {
    vec2 uv = gl_FragCoord.xy * u_texel;
    float r = texture2D(u_p, uv + vec2(u_texel.x, 0.0)).x;
    float l = texture2D(u_p, uv - vec2(u_texel.x, 0.0)).x;
    float t = texture2D(u_p, uv + vec2(0.0, u_texel.y)).x;
    float b = texture2D(u_p, uv - vec2(0.0, u_texel.y)).x;
    float d = texture2D(u_div, uv).x;
    gl_FragColor = vec4((r + l + t + b - d) * 0.25, 0.0, 0.0, 1.0);
}`,

                // v <- v - grad(p): the projection itself. After this the
                // velocity is (discretely) divergence free.
                subtract: `
precision highp float;
uniform sampler2D u_p;
uniform sampler2D u_vel;
uniform vec2 u_texel;
void main() {
    vec2 uv = gl_FragCoord.xy * u_texel;
    float r = texture2D(u_p, uv + vec2(u_texel.x, 0.0)).x;
    float l = texture2D(u_p, uv - vec2(u_texel.x, 0.0)).x;
    float t = texture2D(u_p, uv + vec2(0.0, u_texel.y)).x;
    float b = texture2D(u_p, uv - vec2(0.0, u_texel.y)).x;
    vec2 v = texture2D(u_vel, uv).xy - 0.5 * vec2(r - l, t - b);
    gl_FragColor = vec4(v, 0.0, 1.0);
}`,

                // Scale a target in place (used to carry a fraction of
                // the previous pressure into the next solve).
                decay: `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_value;
void main() {
    gl_FragColor = texture2D(u_tex, gl_FragCoord.xy * u_texel) * u_value;
}`,
            },

            // Colour dropped in by the spoon. With rainbow on, the hue
            // comes from the stroke direction at the moment of injection
            // and is then carried by the dye, so it stays coherent as the
            // flow folds it.
            splatColor: (node, dx, dy) => {
                const amt = node.dyeAmount != null ? node.dyeAmount : 0.6;
                if (!node.rainbow) {
                    const c = hexToRgb(node.tint || "#7FD4FF");
                    return [c[0] * amt, c[1] * amt, c[2] * amt];
                }
                const a = Math.atan2(dy, dx);
                return [
                    (0.5 + 0.5 * Math.cos(a)) * amt,
                    (0.5 + 0.5 * Math.cos(a + 2.0944)) * amt,
                    (0.5 + 0.5 * Math.cos(a + 4.1888)) * amt,
                ];
            },

            step: (S, node, ctx) => {
                const dt = Math.min(ctx.dt, 1 / 30);
                const simT = 1 / S.res.sim;
                const dyeT = 1 / S.res.dye;
                const pow = (base, d) => Math.pow(base, d * 60);

                // 1. Forces: splat momentum and dye at the pointer.
                if (ctx.moving) {
                    const f = node.force != null ? node.force : 1.0;
                    S.use("splat");
                    S.f1("u_radius", node.radius != null ? node.radius : 0.1);
                    S.f1("u_aspect", ctx.aspect);
                    S.f2("u_point", ctx.px, ctx.py);

                    S.f2("u_texel", simT, simT);
                    S.smp("u_src", S.read("velocity"), 0);
                    S.f3("u_amount", ctx.dx * f, ctx.dy * f, 0);
                    S.blit(S.write("velocity"));
                    S.swap("velocity");

                    S.f2("u_texel", dyeT, dyeT);
                    S.smp("u_src", S.read("dye"), 0);
                    S.f3("u_amount", ctx.col[0], ctx.col[1], ctx.col[2]);
                    S.blit(S.write("dye"));
                    S.swap("dye");
                }

                // 2. Vorticity confinement.
                S.use("curl");
                S.f2("u_texel", simT, simT);
                S.smp("u_vel", S.read("velocity"), 0);
                S.blit(S.single("vorticity"));

                S.use("confine");
                S.f2("u_texel", simT, simT);
                S.f1("u_eps", node.curl != null ? node.curl : 2.2);
                S.f1("u_dt", dt);
                S.smp("u_vel", S.read("velocity"), 0);
                S.smp("u_curl", S.single("vorticity"), 1);
                S.blit(S.write("velocity"));
                S.swap("velocity");

                // 3. Projection: divergence -> pressure -> subtract.
                S.use("divergence");
                S.f2("u_texel", simT, simT);
                S.smp("u_vel", S.read("velocity"), 0);
                S.blit(S.single("divergence"));

                S.use("decay");
                S.f2("u_texel", simT, simT);
                S.f1("u_value", pow(node.pressure != null ? node.pressure : 0.8, dt));
                S.smp("u_tex", S.read("pressure"), 0);
                S.blit(S.write("pressure"));
                S.swap("pressure");

                S.use("jacobi");
                S.f2("u_texel", simT, simT);
                S.smp("u_div", S.single("divergence"), 1);
                const iters = Math.max(1, Math.min(node.pressureIterations || 6, 40));
                for (let k = 0; k < iters; k++) {
                    S.smp("u_p", S.read("pressure"), 0);
                    S.blit(S.write("pressure"));
                    S.swap("pressure");
                }

                S.use("subtract");
                S.f2("u_texel", simT, simT);
                S.smp("u_p", S.read("pressure"), 0);
                S.smp("u_vel", S.read("velocity"), 1);
                S.blit(S.write("velocity"));
                S.swap("velocity");

                // 4. Advection: velocity by itself, then dye by velocity.
                S.use("advect");
                S.f1("u_dt", dt);
                S.f2("u_texel", simT, simT);
                S.smp("u_vel", S.read("velocity"), 0);
                S.smp("u_src", S.read("velocity"), 0);
                S.f1("u_diss", pow(node.decay != null ? node.decay : 0.985, dt));
                S.blit(S.write("velocity"));
                S.swap("velocity");

                S.f2("u_texel", dyeT, dyeT);
                S.smp("u_vel", S.read("velocity"), 0);
                S.smp("u_src", S.read("dye"), 1);
                S.f1("u_diss", pow(node.dyeFade != null ? node.dyeFade : 0.97, dt));
                S.blit(S.write("dye"));
                S.swap("dye");
            },
        },
    },

    // Liquid metaballs: a set of moving circles summed into a scalar
    // field; where the field crosses a threshold is "inside" a blob, and
    // neighbouring blobs fuse smoothly (the gooey / liquid look). One
    // blob tracks the pointer; the rest float freely and bounce off the
    // edges. Rendered as a refractive glassy overlay (lens distortion of
    // the content beneath + a rim light + a soft specular glint).
    //
    // Own implementation of the classic metaball technique: the field is
    // Sum(r_i^2 / |p - c_i|^2), and the surface normal is its analytic
    // gradient. init()/tick() run the particle sim on the CPU and feed
    // the positions in as a per-frame uniform array.
    blobs: {
        doc: {
            summary: "Liquid-glass blobs that follow the pointer: a chain of "
                + "metaballs refracting the content behind them, stretching apart on a "
                + "fast flick and relaxing back to a single circle at rest.",
            params: {
                count: {
                    default: 1, unit: "count", structural: true,
                    summary: "independent drifting blobs, on top of the trail chain",
                },
                trail: {
                    default: 7, unit: "count", structural: true,
                    summary: "blobs in the follow-the-leader chain. Unrolled at compile "
                        + "time, so it rebuilds.",
                },
                radius: { default: 46, unit: "px", summary: "blob radius at rest" },
                color: { default: "#EAF4EE", unit: "color", summary: "glass tint" },
                refract: { default: 70, unit: "px", summary: "how far the glass bends what is behind it" },
                rim: { default: 0.6, unit: "ratio", summary: "brightness of the rim light" },
                alpha: { default: 1.0, unit: "ratio", summary: "overall opacity" },
                iridescence: { default: 0.8, unit: "ratio", summary: "colour shift across the rim" },
                dispersion: { default: 1.0, unit: "ratio", summary: "per-channel refraction spread" },
                frost: { default: 0.25, unit: "ratio", summary: "blur of what shows through" },
            },
        },
        // Read by init(), which allocates the particle chain.
        structural: ["count", "trail"],
        stage: "color",
        overlay: true,
        mips: true,
        decl: (p) => `
            uniform vec3 ${p}blobs[${MAX_BLOBS}];
            uniform int ${p}count;
            uniform vec3 ${p}tint;
            uniform float ${p}refract;
            uniform float ${p}rim;
            uniform float ${p}alpha;
            uniform float ${p}irid;
            uniform float ${p}disp;
            uniform float ${p}frost;
            float ${p}hash(vec3 v) {
                return fract(sin(dot(v, vec3(21.9898, 63.233, 41.719))) * 41739.317);
            }
            float ${p}noise(vec3 v) {
                vec3 f = floor(v);
                vec3 r = v - f;
                r = r * r * (3.0 - 2.0 * r);
                float c000 = ${p}hash(f);
                float c100 = ${p}hash(f + vec3(1.0, 0.0, 0.0));
                float c010 = ${p}hash(f + vec3(0.0, 1.0, 0.0));
                float c110 = ${p}hash(f + vec3(1.0, 1.0, 0.0));
                float c001 = ${p}hash(f + vec3(0.0, 0.0, 1.0));
                float c101 = ${p}hash(f + vec3(1.0, 0.0, 1.0));
                float c011 = ${p}hash(f + vec3(0.0, 1.0, 1.0));
                float c111 = ${p}hash(f + vec3(1.0, 1.0, 1.0));
                return mix(
                    mix(mix(c000, c100, r.x), mix(c010, c110, r.x), r.y),
                    mix(mix(c001, c101, r.x), mix(c011, c111, r.x), r.y), r.z);
            }`,
        code: (p) => `
        {
            float field = 0.0;
            vec2 grad = vec2(0.0);
            for (int bi = 0; bi < ${MAX_BLOBS}; bi++) {
                if (bi >= ${p}count) break;
                vec2 bd = frag - ${p}blobs[bi].xy;
                float br = ${p}blobs[bi].z;
                float dd = max(dot(bd, bd), 1.0);
                field += (br * br) / dd;
                grad += (-2.0 * (br * br) / (dd * dd)) * bd;
            }
            float bmask = smoothstep(0.6, 1.0, field);
            if (bmask > 0.003) {
                float gmag = length(grad);
                vec2 g2 = gmag > 1e-6 ? -grad / gmag : vec2(0.0);
                // Pseudo-3D surface normal from the 2D field. For a
                // metaball field (sum of r^2/d^2), 1/sqrt(field) IS the
                // normalized radial position: 0 at the centre, 1 at the
                // surface. That yields a true hemisphere profile — the
                // curvature (and therefore refraction) varies smoothly
                // across the WHOLE disc, not just an edge annulus.
                float s = clamp(inversesqrt(max(field, 1e-4)), 0.0, 1.0);
                vec3 n = normalize(vec3(g2 * s, sqrt(max(1.0 - s * s, 0.004))));
                vec3 rd = vec3(0.0, 0.0, -1.0);

                // Dispersion: refract each channel with a slightly
                // different index (water-glass ~1.33). Near the rim the
                // exit direction flattens (|z| -> 0), so the sampling
                // offsets stretch — producing the smooth concentric
                // colour-fringed bands of a thick lens.
                float ca = 0.03 * ${p}disp;
                vec3 tR = refract(rd, n, 1.0 / (1.33 - ca));
                vec3 tG = refract(rd, n, 1.0 / 1.33);
                vec3 tB = refract(rd, n, 1.0 / (1.33 + ca));
                vec2 oR = tR.xy * (${p}refract / max(abs(tR.z), 0.3));
                vec2 oG = tG.xy * (${p}refract / max(abs(tG.z), 0.3));
                vec2 oB = tB.xy * (${p}refract / max(abs(tB.z), 0.3));

                // Blur grows with how far the ray was bent (mip bias), so
                // strongly-refracted regions smear smoothly instead of
                // showing sharp displaced copies. frost adds a base blur.
                float lod = ${p}frost * 5.0 + log2(1.0 + length(oG) * 0.035);
                vec2 px = 1.0 / u_res;
                vec4 sG = texture2D(u_tex, clamp(uv + oG * px, 0.002, 0.998), lod);
                vec3 refr;
                refr.r = texture2D(u_tex, clamp(uv + oR * px, 0.002, 0.998), lod).r;
                refr.g = sG.g;
                refr.b = texture2D(u_tex, clamp(uv + oB * px, 0.002, 0.998), lod).b;
                // Blend in (approximately) linear light for clean fringes.
                refr = pow(max(refr, 0.0), vec3(2.2));

                vec3 tintLin = pow(${p}tint, vec3(2.2));
                vec3 bodyLin = mix(tintLin * 0.35, refr, sG.a);

                // Glass darkens toward the silhouette (absorption), the
                // opposite of an additive glow ring.
                float edge = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.5);
                bodyLin *= 1.0 - 0.35 * ${p}rim * edge;
                vec3 body = pow(max(bodyLin, 0.0), vec3(1.0 / 2.2));

                // Sparse iridescent glints: two drifting value-noise
                // fields sampled on the reflection direction, one warm
                // one cool, sharpened hard so only sparkles survive.
                vec3 rf = reflect(rd, n);
                float nA = ${p}noise(rf * 2.3 + u_time * 0.5);
                float nB = ${p}noise(rf * 2.3 - u_time * 0.5);
                vec3 glint = pow(max(vec3(0.30, 0.52, 0.86) * nA +
                                     vec3(0.80, 0.56, 0.34) * nB, 0.0), vec3(6.0));
                body += glint * ${p}irid;

                // Small hard specular from a fixed key light.
                vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
                float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
                body += spec * 0.35;

                ovCol = body;
                ovA = max(ovA, bmask * ${p}alpha);
            }
        }`,
        uniforms: (node, dpr) => ({
            tint: ["3fv", hexToRgb(node.color || "#EAF4EE")],
            refract: ["1f", (node.refract != null ? node.refract : 70) * dpr],
            rim: ["1f", node.rim != null ? node.rim : 0.6],
            alpha: ["1f", node.alpha != null ? node.alpha : 1.0],
            irid: ["1f", node.iridescence != null ? node.iridescence : 0.8],
            disp: ["1f", node.dispersion != null ? node.dispersion : 1.0],
            frost: ["1f", node.frost != null ? node.frost : 0.25],
        }),
        // CPU particle sim. The cursor blob is a TRAIL of shrinking
        // spheres laid along recent pointer positions: when the pointer
        // rests they coincide (radii normalized so the union is exactly
        // the base circle), when it moves they spread into a gooey
        // teardrop — the kinetic deformation. Extra blobs float freely.
        init: (node, dpr, w, h) => {
            const R = (node.radius || 46) * dpr;
            const nTrail = Math.max(1, Math.min(node.trail != null ? node.trail : 7, MAX_BLOBS));
            // Two radius profiles per trail slot, blended by how stretched
            // the chain currently is:
            //   idle    — normalized so coincident spheres union to exactly R
            //   moving  — near-full-size spheres, so the spread chain reads
            //             as a fat elastic tube instead of a bead string
            const idleW = [];
            let s2 = 0;
            for (let i = 0; i < nTrail; i++) {
                const wgt = Math.pow(0.86, i);
                idleW.push(wgt);
                s2 += wgt * wgt;
            }
            const norm = Math.sqrt(s2);
            const trailIdleR = idleW.map((wgt) => (R * wgt) / norm);
            const trailMoveR = idleW.map((_, i) => R * 0.85 * Math.pow(0.955, i));

            const rand = (a, b) => a + Math.random() * (b - a);
            const nDrift = Math.max(0, Math.min((node.count || 1) - 1, MAX_BLOBS - nTrail));
            const drifters = [];
            for (let i = 0; i < nDrift; i++) {
                const ang = rand(0, Math.PI * 2);
                const spd = rand(30, 80) * dpr;
                drifters.push({
                    x: rand(R, w - R), y: rand(R, h - R),
                    r: R * rand(0.45, 0.8),
                    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                    phase: rand(0, Math.PI * 2),
                });
            }
            const head = { x: w * 0.5, y: h * 0.55 };
            // The chain: one node per trail sphere, all seeded on the head
            // so it starts as a single collapsed circle. seg is the rest
            // gap the tail relaxes toward the leader over.
            const chain = [];
            for (let i = 0; i < nTrail; i++) chain.push({ x: head.x, y: head.y });
            return {
                head, chain, nTrail, drifters,
                trailIdleR, trailMoveR,
                stretch: 0, seg: R * 0.9,
            };
        },
        tick: (state, ctx) => {
            const dt = Math.min(ctx.dt, 0.05);
            const w = ctx.w, h = ctx.h;
            const k = 1 - Math.exp(-dt * 9);
            state.head.x += (ctx.mouseX - state.head.x) * k;
            state.head.y += (ctx.mouseY - state.head.y) * k;

            // Follow-the-leader: node 0 pins to the head, each following
            // node eases toward the one ahead. At rest the whole chain
            // relaxes onto the head (a single circle); while the pointer
            // moves the tail lags behind and the chain spreads out — that
            // spread is the stretch we measure below.
            const chain = state.chain;
            chain[0].x = state.head.x;
            chain[0].y = state.head.y;
            const follow = 1 - Math.exp(-dt * 16);
            for (let i = 1; i < chain.length; i++) {
                // `b` is a blob in the chain, NOT the raster node — it was
                // called `node` and shadowed the op's own parameter, which
                // reads as this op having x/y params it does not have.
                const lead = chain[i - 1], b = chain[i];
                let dx = lead.x - b.x, dy = lead.y - b.y;
                const d = Math.hypot(dx, dy) || 1e-4;
                // Cap the lag so a fast flick can't tear the tube apart,
                // then ease the remainder — gives an elastic pull.
                const maxLag = state.seg;
                if (d > maxLag) { b.x += dx * (1 - maxLag / d); b.y += dy * (1 - maxLag / d); }
                b.x += (lead.x - b.x) * follow;
                b.y += (lead.y - b.y) * follow;
            }

            // Stretch = how far the tail trails the head, normalised by the
            // chain's natural reach. Smoothed so radii swell/settle softly.
            const tail = chain[chain.length - 1];
            const spread = Math.hypot(tail.x - state.head.x, tail.y - state.head.y);
            const reach = Math.max(1, state.seg * (state.nTrail - 1));
            const target = Math.min(1, spread / reach);
            state.stretch += (target - state.stretch) * (1 - Math.exp(-dt * 8));

            for (const b of state.drifters) {
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
                else if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx); }
                if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
                else if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy); }
                b.phase += dt * 1.6;
            }

            const arr = new Float32Array(MAX_BLOBS * 3);
            const st = state.stretch;
            for (let i = 0; i < state.nTrail; i++) {
                const p = chain[i];
                arr[i * 3] = p.x;
                arr[i * 3 + 1] = p.y;
                // Idle → normalised radii (spheres union to exactly R);
                // stretched → near-full radii so the spread reads as a fat
                // elastic tube rather than a string of shrinking beads.
                arr[i * 3 + 2] = state.trailIdleR[i] + (state.trailMoveR[i] - state.trailIdleR[i]) * st;
            }
            state.drifters.forEach((b, j) => {
                const i = state.nTrail + j;
                arr[i * 3] = b.x;
                arr[i * 3 + 1] = b.y;
                arr[i * 3 + 2] = b.r * (1.0 + 0.12 * Math.sin(b.phase));
            });
            return [
                { name: "blobs", kind: "3fv", value: arr },
                { name: "count", kind: "1i", value: state.nTrail + state.drifters.length },
            ];
        },
    },
};

// GLSL smoothstep, for the CPU coordinate twins (phase I2).
function smoothstep(e0, e1, x) {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1e-6)));
    return t * t * (3 - 2 * t);
}

function hexToRgb(c) {
    return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
}

// Names designer.js uses to route nodes into this pipeline instead of
// the CSS-level op loop. Kept as a live array so registerRasterOp()
// extends routing too.
// `switch` has no REGISTRY entry — it is resolved to a node list before
// the shader is built — but it still has to be routed to elements like
// any other raster node, so it is named here explicitly. Only the switch
// node carries `target:`; the sub-chains inherit whatever it matched.
const RASTER_OP_NAMES = Object.keys(REGISTRY).concat("switch");

/**
 * How an op behaves under hit-testing (phase I4).
 *
 * DERIVED from what the op already declares rather than hand-listed, so
 * the taxonomy cannot drift from the contract the way a maintained table
 * would. The classes, and what each means for `pipeline.sourceAt`:
 *
 *   "neutral"     does not move the sampling coordinate, so the browser's
 *                 own hit-testing was already right (halftone, duotone,
 *                 and aberration, which spreads only the per-channel taps)
 *   "analytic"    declares a CPU twin that always answers, so a hit-test
 *                 costs no GPU sync (offset, and the pixelate example)
 *   "conditional" declares a twin that answers only for some parameters —
 *                 hexalize is identity without `lift` and declines with it
 *   "readback"    moves coordinates with no twin, so every query is an
 *                 exact GPU round trip (flow, stir)
 *   "many-to-one" one screen point maps to several sources; sourceAt
 *                 reports the primary sample (copy)
 *
 * @param {string} op
 * @returns {"neutral"|"analytic"|"conditional"|"readback"|"many-to-one"|"unknown"}
 */
function interactionClass(op) {
    const def = REGISTRY[op];
    if (!def) return "unknown";
    if (def.multiSample) return "many-to-one";
    const stages = Array.isArray(def.stage) ? def.stage : [def.stage];
    const movesStage = stages.some((s) => s === "warp" || s === "cell" || s === "displace");
    if (!movesStage || def.movesCoords === false) return "neutral";
    if (typeof def.map !== "function") return "readback";
    // A twin that can decline for some parameter values is not the same
    // promise as one that always answers, and the difference is exactly
    // what a caller budgeting for GPU syncs needs to know.
    return /return\s+null|\?\s*null|null\s*:/.test(String(def.map)) ? "conditional" : "analytic";
}

// ── Phase T1: keyframed params ───────────────────────────────────────
//
// A param may be given as an array of numbers, sampled over transition
// progress `t`:
//
//     { op: "flow", strength: [0, 40, 0] }   // in, peak, out
//
// The problem this has to solve: plenty of params are LEGITIMATELY
// arrays. `mask.at` is [x, y], `remap` is [lo, hi], `duotone.colors` is
// a pair, `copy.points` is a list, `merge.a` is a sub-chain. Guessing
// from the value alone would break all of them.
//
// H4's `doc.params` already carries the answer: a param whose declared
// unit is a SCALAR quantity, given as two or more numbers, is keyframes.
// Anything else is data. So this is another property bought by the
// declaration an op already makes, and an op with no doc never
// keyframes — which is the safe direction to be wrong in.
const KEYFRAMABLE_UNITS = ["px", "ratio", "deg", "count", "seconds"];

function isKeyframed(op, key, value) {
    if (!Array.isArray(value) || value.length < 2) return false;
    for (const v of value) if (typeof v !== "number" || !Number.isFinite(v)) return false;
    const def = REGISTRY[op];
    const meta = def && def.doc && def.doc.params && def.doc.params[key];
    return !!meta && KEYFRAMABLE_UNITS.includes(meta.unit);
}

/** Piecewise-linear sample of a keyframe array at t in [0, 1]. */
function sampleKeyframes(kf, t) {
    const n = kf.length - 1;
    const x = Math.min(1, Math.max(0, t)) * n;
    const i = Math.min(n - 1, Math.floor(x));
    return kf[i] + (kf[i + 1] - kf[i]) * (x - i);
}

// ── Phase T3: choreography ───────────────────────────────────────────
//
// Two node-level controls, both acting on the LOCAL progress an op's
// keyframes are sampled against. Neither is a new authoring language —
// they reshape t, and everything downstream is unchanged.
//
//   window: [0.2, 0.8]   this op's keyframes span that slice of t, so
//                        several ops in one chain can stagger
//   ease:   "in-out"     easing applied to the local progress
//
// Easing lives here rather than in the timeline because a chain wants
// ops on different curves; the timeline that drives `t` stays linear and
// therefore still scrubbable and reversible (P-1).
const EASINGS = {
    linear: (x) => x,
    in: (x) => x * x * x,
    out: (x) => 1 - Math.pow(1 - x, 3),
    "in-out": (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    // Overshoots past 1 and settles — the classic UI "pop". Keyframes are
    // sampled with clamping, so an overshoot reads as a hold at the end
    // unless the author gives it somewhere to go.
    back: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
};
const EASING_NAMES = Object.keys(EASINGS);

/** An op's own progress: its window, then its easing. */
function localProgress(node, t) {
    let x = Math.min(1, Math.max(0, t));
    const w = node.window;
    if (Array.isArray(w) && w.length === 2 && w[1] !== w[0]) {
        x = Math.min(1, Math.max(0, (x - w[0]) / (w[1] - w[0])));
    }
    const ease = node.ease && EASINGS[node.ease];
    return ease ? ease(x) : x;
}

/**
 * The node as the op should see it at progress `t` — keyframe arrays
 * collapsed to scalars, everything else untouched.
 *
 * Returns the ORIGINAL object when nothing is keyframed, so the common
 * case allocates nothing per frame.
 */
function resolveNode(node, t) {
    let out = null;
    const local = (node.window || node.ease) ? localProgress(node, t) : t;
    for (const key in node) {
        if (!isKeyframed(node.op, key, node[key])) continue;
        out = out || Object.assign({}, node);
        out[key] = sampleKeyframes(node[key], local);
    }
    return out || node;
}

/** Does this node carry any keyframed param? */
function hasKeyframes(node) {
    for (const key in node) if (isKeyframed(node.op, key, node[key])) return true;
    return false;
}

// Extension surface — mirrors the CSS-level operation registry:
// registerRasterOp("pixelate", { stage, decl, code, uniforms }).
//
// This used to be two lines that assigned and returned. Every way of
// getting it wrong therefore succeeded, and surfaced later as a shader
// that failed to compile with no indication of which op wrote the bad
// line — or, worse, as an op that compiled and did nothing, because a
// misspelt `stage` matched no stage and its code was never emitted.
// That is the silently-ignored-key class again, one level up: not a bad
// option on a node, but a bad op in the registry.
//
// Registration is a one-time cost paid at startup, so it validates
// eagerly and throws with the vocabulary listed. Everything here is
// checkable without a GL context, which is why it runs at registration
// rather than at first compile.
function validateRasterOp(name, def) {
    const where = `registerRasterOp("${name}")`;
    if (typeof name !== "string" || !name.trim()) {
        throw new TypeError("[nodality] registerRasterOp needs a non-empty name");
    }
    if (!def || typeof def !== "object") {
        throw new TypeError(`[nodality] ${where}: definition must be an object`);
    }

    // stage — the one field whose typo is invisible at runtime.
    const stages = Array.isArray(def.stage) ? def.stage : [def.stage];
    if (def.stage == null || !stages.length) {
        throw new TypeError(`[nodality] ${where}: missing "stage". ` +
            `Valid stages: ${RASTER_STAGES.join(", ")}.`);
    }
    for (const s of stages) {
        if (typeof s !== "string" || !RASTER_STAGES.includes(s)) {
            throw new TypeError(`[nodality] ${where}: ` +
                didYouMean(s, RASTER_STAGES, "stage"));
        }
    }

    // The two functions that produce GLSL, and the optional one that
    // feeds it. `uniforms` is optional because an op may be entirely
    // compile-time (see `copy`, which unrolls its loop in code()).
    for (const k of ["decl", "code"]) {
        if (typeof def[k] !== "function") {
            throw new TypeError(`[nodality] ${where}: "${k}" must be a function ` +
                `(got ${def[k] === undefined ? "nothing" : typeof def[k]}).`);
        }
    }
    if (def.uniforms != null && typeof def.uniforms !== "function") {
        throw new TypeError(`[nodality] ${where}: "uniforms" must be a function if present.`);
    }
    // Phase I2. `map` is the CPU twin of the op's coordinate arithmetic;
    // `movesCoords: false` says a coordinate-stage op leaves the sampling
    // position alone (aberration only spreads the per-channel taps). Both
    // let a hit-test skip the GPU readback, so a wrong shape here would
    // silently route every query the slow way.
    if (def.map != null && typeof def.map !== "function") {
        throw new TypeError(`[nodality] ${where}: "map" must be a function if present.`);
    }
    if (def.movesCoords != null && typeof def.movesCoords !== "boolean") {
        throw new TypeError(`[nodality] ${where}: "movesCoords" must be a boolean if present.`);
    }

    // Rebuild hints. A name here that is not a real param is not fatal,
    // but the shape being wrong means isStructuralChange() would throw
    // mid-drag, so the array-of-strings part is enforced.
    for (const k of ["structural", "structuralOnToggle"]) {
        if (def[k] == null) continue;
        if (!Array.isArray(def[k]) || def[k].some((s) => typeof s !== "string")) {
            throw new TypeError(`[nodality] ${where}: "${k}" must be an array of param names.`);
        }
    }

    if (def.defaultDriver != null && !DRIVER_NAMES.includes(def.defaultDriver)) {
        throw new TypeError(`[nodality] ${where}: ` +
            didYouMean(def.defaultDriver, DRIVER_NAMES, "driver"));
    }

    // `doc` is optional — a third-party op stays registerable without it,
    // and the inspector falls back to introspection. But a doc that IS
    // supplied has to be the shape every reader assumes, or the panel
    // throws while rendering someone else's op.
    if (def.doc != null) {
        if (typeof def.doc !== "object") {
            throw new TypeError(`[nodality] ${where}: "doc" must be an object.`);
        }
        if (typeof def.doc.summary !== "string" || !def.doc.summary.trim()) {
            throw new TypeError(`[nodality] ${where}: "doc.summary" must be a non-empty string.`);
        }
        const params = def.doc.params;
        if (params != null) {
            if (typeof params !== "object" || Array.isArray(params)) {
                throw new TypeError(`[nodality] ${where}: "doc.params" must be an object ` +
                    `keyed by param name.`);
            }
            for (const [k, v] of Object.entries(params)) {
                if (!v || typeof v !== "object" || Array.isArray(v)) {
                    throw new TypeError(`[nodality] ${where}: doc.params.${k} must be an ` +
                        `object like { default, unit }.`);
                }
                if (v.unit != null && !RASTER_UNITS.includes(v.unit)) {
                    throw new TypeError(`[nodality] ${where}: doc.params.${k}: ` +
                        didYouMean(v.unit, RASTER_UNITS, "unit"));
                }
            }
        }
    }
    return def;
}

function registerRasterOp(name, def) {
    validateRasterOp(name, def);
    // Replacing a built-in is legitimate — overriding `halftone` with your
    // own is a reason this surface exists — but doing it by accident,
    // because two libraries picked the same word, is not. Warn rather than
    // throw: the caller may well mean it, and there is no way to tell.
    if (Object.prototype.hasOwnProperty.call(REGISTRY, name) &&
        typeof console !== "undefined" && console.warn) {
        console.warn(`[nodality] registerRasterOp("${name}") replaces an existing op.`);
    }
    REGISTRY[name] = def;
    if (!RASTER_OP_NAMES.includes(name)) RASTER_OP_NAMES.push(name);
    return def;
}

function isHTMLInCanvasAvailable() {
    if (typeof WebGLRenderingContext === "undefined") return false;
    return "texElementImage2D" in WebGLRenderingContext.prototype;
}

// ── Shader assembly ──────────────────────────────────────────────────

const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

// What each stage is allowed to modify. Masking works by snapshotting
// these before an op runs and lerping back toward the snapshot by the
// mask value, so ANY op can be masked without the op knowing about it.
const STAGE_VARS = {
    warp: ["warped"],
    cell: ["center", "edge"],
    displace: ["sampleP", "chroma"],
    color: ["col", "edgeCol", "edgeCov", "ovCol", "ovA"],
};

// What `stage:` may say. Derived from STAGE_VARS rather than written out
// again, so adding a stage cannot leave the validator rejecting it.
// `field` is the exception that has no stage vars of its own: a field op
// writes a scalar for later ops to read, it does not modify the frame.
//
// Read by validateRasterOp, which is defined above this line but only
// ever RUNS from registerRasterOp — i.e. after this module has finished
// evaluating. Nothing registers an op during our own module eval.
const RASTER_STAGES = ["field", ...Object.keys(STAGE_VARS)];

// Params the PIPELINE reads off every node, whatever the op. An op does
// not declare these and must not document them — they would be fifteen
// identical paragraphs that drift apart on the first edit. Defined once
// here; the inspector merges them in, and API.md documents them once.
const FRAMEWORK_DOC = {
    op: { default: null, unit: "name", summary: "which op this node is" },
    target: {
        default: null, unit: "name",
        summary: "element ids this node applies to, e.g. [\"#hero\"]",
    },
    side: {
        default: null, unit: "name", structural: true,
        summary: "\"old\" or \"new\" — scope this op to ONE half of a morph " +
            "instead of the blended result, so the outgoing and incoming " +
            "states can be art-directed differently. Colour-stage ops only: " +
            "both sides share one sampling coordinate, so a sided warp has " +
            "no meaning. Ignored outside a transition.",
    },
    by: {
        default: "static", unit: "name", structural: true,
        summary: `what steers the effect: ${DRIVER_NAMES.join(", ")}. ` +
            "Compiled in, so changing it rebuilds.",
    },
    masked: {
        default: false, unit: "name",
        summary: "read a field written upstream — true for the default " +
            "\"mask\", or a name. Works for ANY op; the op needs no knowledge of it.",
    },
    live: {
        default: true, unit: "bool",
        summary: "false forces the snapshot backend for this element " +
            "instead of HTML-in-Canvas capture",
    },
    // Phase T3. Both reshape the progress this node's keyframes are
    // sampled against; neither is read by any op.
    window: {
        default: null, unit: "range",
        summary: "[from, to] slice of transition progress this node's " +
            "keyframes span — how ops in one chain stagger",
    },
    ease: {
        default: "linear", unit: "name",
        summary: `easing for this node's local progress: ${EASING_NAMES.join(", ")}`,
    },
    interactive: {
        default: true, unit: "bool",
        summary: "false opts this pipeline out of pointer retargeting",
    },
    hoverAttr: {
        default: false, unit: "bool",
        summary: "mirror hover onto [data-nodality-hover] at the DRAWN " +
            "position; costs the zero-DOM-mutation property, so opt-in",
    },
};

// A node opts into a field with `masked: true` (the default field) or
// `masked: "name"`. Field producers declare `as:` to name what they
// write. This is the whole of the node-to-node data flow: one op writes
// a scalar field, later ops read it.
// No double underscores anywhere: GLSL reserves identifiers
// containing `__` as possible future keywords, and Chrome rejects
// the shader outright rather than warning.
const fieldVar = (name) => `fld_${String(name).replace(/[^A-Za-z0-9_]/g, "")}`;
const maskedField = (node) =>
    node.masked === true ? "mask" : (typeof node.masked === "string" ? node.masked : null);

const glslType = (v) =>
    (v === "edge" || v === "edgeCov" || v === "ovA") ? "float"
        : (v === "col" || v === "edgeCol" || v === "ovCol") ? "vec3"
            : "vec2";

// How `merge` combines its two branches. Applied to the vec3 stage
// variables only; the scalars and coordinates are plainly interpolated,
// because "screen" is meaningless for a displacement.
const BLEND = {
    over: (a, b) => b,
    add: (a, b) => `min(${a} + ${b}, vec3(1.0))`,
    screen: (a, b) => `1.0 - (1.0 - ${a}) * (1.0 - ${b})`,
    multiply: (a, b) => `${a} * ${b}`,
    difference: (a, b) => `abs(${a} - ${b})`,
    lighten: (a, b) => `max(${a}, ${b})`,
    darken: (a, b) => `min(${a}, ${b})`,
};

const emptyBuckets = () =>
    ({ field: "", warp: "", cell: "", displace: "", color: "" });

// Flatten a node tree (merge nodes carry sub-chains) into the linear
// list that owns the uniform slots. Depth-first, parent before children,
// so `u<i>_` prefixes are stable and every consumer — shader emission,
// uniform upload, drivers, solvers — agrees on which node is index i.
// Returns records rather than mutating the caller's node objects.
function flattenRaster(nodes, flat) {
    const recs = [];
    for (const node of (nodes || [])) {
        if (!node || !node.op) continue;
        const rec = { node: node, i: flat.length };
        flat.push(node);
        if (node.op === "merge") {
            rec.a = flattenRaster(node.a, flat);
            rec.b = flattenRaster(node.b, flat);
        }
        recs.push(rec);
    }
    return recs;
}

function emitStages(recs, buckets) {
    for (const rec of recs) {
        const node = rec.node;
        if (node.op === "merge") { emitMerge(rec, buckets); continue; }
        const def = REGISTRY[node.op];
        if (!def) continue;
        const p = `u${rec.i}_`;
        // An op may contribute to more than one stage (stage: ["warp",
        // "color"]) — code() then receives the stage it is emitting for.
        // A plain string stage keeps the original single-snippet form.
        const stages = Array.isArray(def.stage) ? def.stage : [def.stage];
        const mask = maskedField(node);
        stages.forEach((st) => {
            let snippet = def.code(p, node, st) + "\n";
            if (mask && STAGE_VARS[st]) {
                // Generic masking wrapper: no op needs to know it is
                // being masked, which is what lets a field constrain
                // ops written long before fields existed.
                const vars = STAGE_VARS[st];
                const snap = vars.map((v, k) =>
                    `        ${glslType(v)} msv${k} = ${v};`).join("\n");
                const back = vars.map((v, k) =>
                    `        ${v} = mix(msv${k}, ${v}, ${fieldVar(mask)});`).join("\n");
                snippet = `    {\n${snap}\n${snippet}\n${back}\n    }\n`;
            }
            // `field` has no STAGE_VARS entry (it writes named fields,
            // not stage variables), so it is listed explicitly here —
            // anything unrecognised still falls through to colour.
            const bucket = (st === "field" || st === "warp" ||
                st === "cell" || st === "displace") ? st : "color";
            buckets[bucket] += snippet;
        });
    }
}

// merge: run two sub-chains from the same starting state and combine
// them. Still one pass — each branch's stage code is emitted into its
// own scope, the stage variables are rewound between branches, and the
// two results are blended. That is what makes it free: no second
// framebuffer, no second capture of the DOM.
//
// The consequence is that a branch cannot see the other's output, only
// the shared input, which is exactly the semantics you want for a merge
// and not the semantics of a chain.
function emitMerge(rec, buckets) {
    const p = `u${rec.i}_`;
    const blend = BLEND[rec.node.mode] || BLEND.over;
    const A = emptyBuckets(), B = emptyBuckets();
    emitStages(rec.a || [], A);
    emitStages(rec.b || [], B);
    // Fields are shared state, not branch-local: a mask written inside
    // one branch is visible to the other, and to everything after.
    buckets.field += A.field + B.field;
    for (const st of ["warp", "cell", "displace", "color"]) {
        if (!A[st] && !B[st]) continue;
        const vars = STAGE_VARS[st];
        let s = "    {\n";
        vars.forEach((v, k) => { s += `        ${glslType(v)} pre${k} = ${v};\n`; });
        s += A[st];
        vars.forEach((v, k) => { s += `        ${glslType(v)} bra${k} = ${v};\n`; });
        vars.forEach((v, k) => { s += `        ${v} = pre${k};\n`; });
        s += B[st];
        vars.forEach((v, k) => {
            const combined = glslType(v) === "vec3"
                ? blend(`bra${k}`, v)
                : v;
            s += `        ${v} = mix(bra${k}, ${combined}, ${p}mix);\n`;
        });
        s += "    }\n";
        buckets[st] += s;
    }
}

/**
 * @param {boolean} [probe] emit the coordinate-readback variant (phase I1)
 *        instead of the visible one. Identical up to and including the
 *        displace stage; then writes the packed source coordinate rather
 *        than a colour.
 */
function buildFragmentShader(recs, flat, probe, transition) {
    // "opaque" (default) keeps the union solid; "dissolve" is a true
    // cross-dissolve. See nodBlend.
    const fade = (transition && transition.fade) || "opaque";
    let decls = "";

    // Every field any node writes or reads, declared up front at 1.0 so
    // an unmatched reference is a no-op rather than a compile error.
    const fieldNames = new Set();
    flat.forEach((n) => {
        const def = REGISTRY[n.op];
        if (def && def.producesField) fieldNames.add(n.as || "mask");
        const m = maskedField(n);
        if (m) fieldNames.add(m);
    });
    const fieldDecls = [...fieldNames]
        .map((n) => `    float ${fieldVar(n)} = 1.0;`).join("\n");

    flat.forEach((node, i) => {
        const def = REGISTRY[node.op];
        if (def) decls += def.decl(`u${i}_`, node) + "\n";
    });

    // PER-SIDE effects. A node may carry `side: "old" | "new"`, which
    // scopes it to one half of a morph instead of the blended result.
    //
    // Everything else in a transition chain decorates the CROSSFADE — it
    // runs after old and new have already been mixed, so both ends get
    // the same treatment. That cannot express "the outgoing state burns
    // out while the incoming one develops", which is the thing a designer
    // actually reaches for. A sided op runs on its own side's colour
    // BEFORE nodBlend sees it.
    //
    // Colour stage only, and deliberately: warp/displace ops rewrite the
    // sampling coordinate, and there is one coordinate shared by both
    // sides — honouring `side` there would mean two independent
    // coordinate pipelines. A sided warp is rejected loudly rather than
    // silently ignored.
    const sideOf = (rec) => {
        const v = rec && rec.node && rec.node.side;
        if (v !== "old" && v !== "new") return null;
        const def = REGISTRY[rec.node.op];
        const stages = def ? (Array.isArray(def.stage) ? def.stage : [def.stage]) : [];
        if (!stages.every((st) => st === "color")) {
            console.warn(`[nodality] "${rec.node.op}" is a ${stages.join("+")} op, ` +
                `so side:"${v}" cannot apply to it — a sided op must be colour-only, ` +
                `because both sides share one sampling coordinate. Running it on ` +
                `the blended result instead.`);
            return null;
        }
        if (!transition) {
            console.warn(`[nodality] side:"${v}" has no meaning without a ` +
                `transition — there is only one image. Ignoring it.`);
            return null;
        }
        return v;
    };
    const mainRecs = recs.filter((r) => !sideOf(r));
    const oldRecs = recs.filter((r) => sideOf(r) === "old");
    const newRecs = recs.filter((r) => sideOf(r) === "new");

    const buckets = emptyBuckets();
    emitStages(mainRecs, buckets);

    // One scope per side, with the colour stage variables declared local
    // so an op that touches edgeCol/ovA compiles here exactly as it does
    // in main(). `frag` is the sample position, which is what a sided op
    // means by "where am I".
    const sideBlock = (list, src) => {
        if (!list.length) return "";
        const b = emptyBuckets();
        emitStages(list, b);
        if (!b.color) return "";
        const decls = STAGE_VARS.color
            .filter((v) => v !== "col")
            .map((v) => `        ${glslType(v)} ${v} = ${glslType(v) === "vec3"
                ? "vec3(0.0)" : "0.0"};`).join("\n");
        return `    {
        vec2 frag = p;
        vec3 col = ${src}.rgb;
${decls}
${b.color}
        ${src}.rgb = col;
    }
`;
    };
    const oldSideCode = sideBlock(oldRecs, "o");
    const newSideCode = sideBlock(newRecs, "n");
    const { field, warp, cell, displace, color } = buckets;
    const nodes = flat;
    // Compositing, in three layers (all straight-alpha):
    //   1. border layer (edgeCol/edgeCov, from an edges op) UNDER
    //   2. content layer (col over tex.a)                    then
    //   3. overlay layer (ovCol/ovA, from an overlay op e.g. blobs) ON TOP
    // Absent ops leave their contribution at zero, so this reduces to
    // the plain content for every prior combination. The default seam
    // darkening only applies when a cell op runs without an edges op.
    const hasEdges = nodes.some((n) => n.op === "edges");
    const defaultSeam = hasEdges ? "" : "    col *= 1.0 - edge * 0.55;";
    // Per-channel resampling costs two extra fetches, so it is only
    // emitted when a displace-stage op actually asks for dispersion.
    const hasChroma = nodes.some((n) => (REGISTRY[n.op] || {}).chroma);
    // In transition mode the per-channel taps must see BOTH captures —
    // sampling u_tex alone would drop the old element out of the red and
    // blue channels for the whole morph.
    const chromaFetch = !hasChroma ? "" : (transition ? `
    vec2 cdev = vec2(chroma.x, chroma.y);
    col.r = nodSampleAt(sampleP + cdev).r;
    col.b = nodSampleAt(sampleP - cdev).b;` : `
    vec2 cpx = vec2(chroma.x, -chroma.y) / u_res;
    col.r = texture2D(u_tex, clamp(uv + cpx, 0.001, 0.999)).r;
    col.b = texture2D(u_tex, clamp(uv - cpx, 0.001, 0.999)).b;`);
    // Phase I1. The PROBE variant is the same shader with a different last
    // line: instead of compositing a colour it writes the source
    // coordinate the fragment sampled from. Everything between `main()`
    // and the tail is byte-identical to the visible pass, which is the
    // whole point — a hit-test that recomputed the coordinate its own way
    // could disagree with what is actually drawn, and that disagreement
    // would be invisible.
    //
    // In probe mode the fragment coordinate is SUPPLIED rather than
    // derived: `u_probe` names the pixel being asked about, so a 1x1
    // framebuffer with a plain viewport can stand in for any pixel of the
    // full-size render. No full-resolution attachment is allocated, and
    // no negative-origin viewport is needed — an earlier attempt offset
    // the viewport instead and rasterised nothing, which readback
    // reported as a confident (0, 0).
    const probeDecl = probe ? "uniform vec2 u_probe;\n" : "";
    const fragCoord = probe ? "u_probe + vec2(0.5)" : "gl_FragCoord.xy";
    // Two bytes per axis: hi in one channel, lo in the next, so a 4000px
    // element resolves to about 0.06px. Decoded in sourceAt().
    const probeTail = `
    vec2 q = clamp(sampleP / u_res, 0.0, 1.0) * 255.0;
    vec2 hi = floor(q);
    vec2 lo = floor(fract(q) * 255.0);
    gl_FragColor = vec4(hi.x, lo.x, hi.y, lo.y) / 255.0;
}`;

    return `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_t;          // phase T1: transition progress, 0..1

// Op uniforms are declared HERE, above the transition helpers, because a
// per-side op's code is emitted inside nodSampleAt. GLSL requires
// declaration before use, and with the declarations further down every
// sided op failed to compile with "'u0_amount' : undeclared identifier".
${probeDecl}${decls}
${transition ? `
// ── phase T2: transition mode ──────────────────────────────────────
// Two captures instead of one. u_tex is the NEW element, u_old the
// frozen OLD one, and u_box is the content box they are both drawn
// into — lerped from the old rect to the new rect by u_t. So geometry
// (the box) and pixels (the effect chain) stay separate problems, which
// is the split View Transitions also makes and the one that keeps this
// maintainable.
uniform sampler2D u_old;
${transition && transition.newImage ? "uniform sampler2D u_newimg;" : ""}
// Phase T2, gap 2. TWO boxes, not one. With a single shared box the
// only expressible motion is "both sides march together", so the classic
// "old slides out while new slides in" was impossible. Each capture now
// interpolates in its own rect, which keeps per-side motion in the
// GEOMETRY tier (P-3) instead of needing per-side op scoping.
uniform vec4 u_boxOld;      // x, y, w, h — device px, top-down
uniform vec4 u_boxNew;

// sRGB <-> linear. A naive crossfade in gamma space dips visibly in
// brightness at mid-fade on photographic content; this is the classic
// artifact and it is why the mix below is not just mix().
vec3 nodToLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 nodToSRGB(vec3 c)   { return pow(c, vec3(1.0 / 2.2)); }

// Premultiplied, so anti-aliased edges over transparency do not pick up
// a dark halo as the two sides cross.
vec4 nodBlend(vec4 a, vec4 b, float t, float d) {
    vec3 pa = nodToLinear(a.rgb) * a.a;
    vec3 pb = nodToLinear(b.rgb) * b.a;
${fade === "morph" ? `
    // MORPH — a per-pixel CHOICE, not a mix. d is a stable hash of the
    // output pixel, so each pixel flips from old to new at its own point
    // in t. At any instant almost every pixel is showing exactly ONE
    // side, and the two contents are never both legible at once.
    //
    // A uniform crossfade cannot do this: at t=0.5 it is by definition
    // 50% of each, which reads as a double exposure the moment the two
    // states differ much — a wide nav bar and a small card, say.
    float k = smoothstep(d - 0.12, d + 0.12, t);
    vec3 pm = pa * (1.0 - k) + pb * k;
    float al = a.a * (1.0 - k) + b.a * k;` : fade === "dissolve" ? `
    // DISSOLVE — a true cross-dissolve: alpha lerps between the two.
    // Correct, and the right choice when one side really should fade to
    // nothing. Wrong for a shape morph, because any region covered by
    // only ONE side is translucent for the whole transition and the
    // morph reads as "everything is disappearing".
    vec3 pm = mix(pa, pb, t);
    float al = mix(a.a, b.a, t);` : `
    // OPAQUE (default) — the colour crosses over without the shape
    // thinning out. The coverage-weighted lerp already gives that for
    // free, and it is worth seeing why:
    //
    //   both sides cover   a.a = b.a = 1  ->  w = 1 at every t. Solid
    //                                         throughout. No mid-fade.
    //   only the old       b.a = 0        ->  w = 1-t. Releases.
    //   only the new       a.a = 0        ->  w = t.   Arrives.
    //
    // So one expression covers the union case AND each side's release,
    // linearly, with no curve to pop against.
    vec3 pm = pa * (1.0 - t) + pb * t;
    float al = a.a * (1.0 - t) + b.a * t;` }
    return vec4(nodToSRGB(pm / max(al, 1e-4)), al);
}

// EVERY fetch in transition mode goes through here. A displace-stage op
// that sampled u_tex directly — aberration does exactly that for its
// per-channel taps — would show fringes from the new capture only, with
// the old one silently absent from those channels.
// Takes a position in DEVICE PX (sampleP space), not uv, because the two
// captures no longer share a uv. Each is mapped through its own box and
// masked to it, then blended.
vec2 nodBoxUV(vec4 box, vec2 p) {
    return vec2((p.x - box.x) / max(box.z, 1.0),
                1.0 - (p.y - box.y) / max(box.w, 1.0));
}
float nodInBox(vec2 uv) {
    return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
}
vec4 nodSampleAt(vec2 p) {
    vec2 uo = nodBoxUV(u_boxOld, p);
    vec2 un = nodBoxUV(u_boxNew, p);
    vec4 o = texture2D(u_old, clamp(uo, 0.001, 0.999));
    // With newImage the new side is a capture of the ELEMENT, so both
    // sides can travel between their own rects and converge into one
    // shape. Without it the new side is the HOST capture, which can only
    // be mapped 1:1 — the destination then sits at its final place from
    // t=0 while the old shrinks toward it, and the result reads as two
    // things on screen at once rather than one thing morphing.
    vec4 n = texture2D(${transition && transition.newImage ? "u_newimg" : "u_tex"},
                       clamp(un, 0.001, 0.999));
    o.a *= nodInBox(uo);
    n.a *= nodInBox(un);
${oldSideCode}${newSideCode}
    // The threshold each pixel flips at. Mostly a COHERENT ramp down the
    // box with a little grain on top — pure white noise chooses correctly
    // (never two legible images at once) but reads as television static
    // rather than as one thing becoming another. The ramp makes it a
    // wipe; the grain keeps the edge from looking like a ruler.
    float grain = fract(sin(dot(floor(p / 3.0), vec2(12.9898, 78.233))) * 43758.5453);
    float ramp = clamp(un.y, 0.0, 1.0);
    float d = ramp * 0.82 + grain * 0.18;
    return nodBlend(o, n, u_t, d);
}` : ""}
void main() {
    vec2 fc = ${fragCoord};
    vec2 frag = vec2(fc.x, u_res.y - fc.y);
${fieldDecls}
${field}
    vec2 warped = frag;
${warp}
    vec2 center = warped;
    float edge = 0.0;
${cell}
    vec2 sampleP = warped;
    vec2 chroma = vec2(0.0);
${displace}${probe ? probeTail : `
${transition ? `
    // uv stays defined, as the NEW box's, for ops that reference it.
    vec2 uv = nodBoxUV(u_boxNew, sampleP);
    vec4 tex = nodSampleAt(sampleP);` : `
    vec2 uv = vec2(sampleP.x / u_res.x, 1.0 - sampleP.y / u_res.y);
    vec4 tex = texture2D(u_tex, clamp(uv, 0.001, 0.999));`}
    vec3 col = tex.rgb;${chromaFetch}
    vec3 edgeCol = vec3(1.0);
    float edgeCov = 0.0;
    vec3 ovCol = vec3(0.0);
    float ovA = 0.0;
${color}
${defaultSeam}
    // content OVER border
    float baseA = tex.a + edgeCov * (1.0 - tex.a);
    vec3 baseRGB = (col * tex.a + edgeCol * edgeCov * (1.0 - tex.a)) / max(baseA, 1e-4);
    // overlay OVER (content+border)
    float outA = ovA + baseA * (1.0 - ovA);
    vec3 outRGB = (ovCol * ovA + baseRGB * baseA * (1.0 - ovA)) / max(outA, 1e-4);
    gl_FragColor = vec4(outRGB, outA);
}`}`;
}

// ── Snapshot backend: DOM subtree -> SVG foreignObject -> texture ────

// Viewport-relative CSS inside a foreignObject resolves against the SVG
// element's own size, not the browser viewport — so `font-size: calc(
// 1.625rem + 5.075vw)` renders at a different size in the snapshot than
// it does on the page. The glyphs then sit somewhere the DOM text does
// not, which is what makes the selection highlight look offset.
//
// Freeze those declarations to the pixel values the element actually
// computes, on a clone, so the snapshot matches the live layout.
const VIEWPORT_UNIT = /\d(?:vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh)\b/i;

// Inheritable text properties. A foreignObject rendered from a data: URI
// carries NO page stylesheet, and a clone carries only inline styles — so
// anything a rule or an ancestor supplied is gone. Nodality's own
// components style inline and survive; hand-written markup styled by CSS
// captures as default black serif on transparent, which is what made the
// demo panels render dark text on a dark panel.
//
// Frozen onto the clone only where an element's computed value DIFFERS
// from its parent's, so inheritance still does the work and the
// serialized string does not balloon on a large subtree.
const INHERITED = [
    "color", "font-family", "font-size", "font-weight", "font-style",
    "line-height", "letter-spacing", "text-align", "text-transform",
    "text-decoration-color", "white-space", "word-break",
];

// Painted, NON-inherited properties — see part 3 of freezeStyles. Layout
// properties are deliberately absent: freezing width or padding would
// relayout the clone and move the glyphs off the real text.
const PAINTED = [
    "background-color", "background-image", "background-size",
    "background-position", "background-repeat", "background-clip",
    "border-radius", "box-shadow", "opacity", "outline-color",
];

// Initial values, skipped so a page of plain elements does not gain ten
// no-op declarations per node.
const PAINT_INITIAL = new Set([
    "none", "rgba(0, 0, 0, 0)", "transparent", "0px", "auto", "1",
    "repeat", "0% 0%", "border-box", "0% 0% / auto repeat scroll padding-box border-box",
]);

function freezeStyles(original, clone) {
    const origs = [original, ...original.querySelectorAll("*")];
    const clones = [clone, ...clone.querySelectorAll("*")];
    for (let i = 0; i < origs.length && i < clones.length; i++) {
        const inline = clones[i].style;
        if (!inline) continue;

        // 1. Viewport units resolve against the SVG's own size inside a
        //    foreignObject, not the browser viewport, so `calc(1.6rem +
        //    5vw)` renders at a different size than it does on the page.
        //    The glyphs then sit somewhere the DOM text does not, which
        //    is what makes a selection highlight look offset.
        if (inline.length > 0) {
            let computed = null;
            // Iterate a snapshot of the names: writing to style mutates the list.
            for (const prop of Array.from(inline)) {
                if (!VIEWPORT_UNIT.test(inline.getPropertyValue(prop))) continue;
                computed = computed || window.getComputedStyle(origs[i]);
                const px = computed.getPropertyValue(prop);
                if (px) inline.setProperty(prop, px, inline.getPropertyPriority(prop));
            }
        }

        // 2. Inherited text styling, which the clone would otherwise lose.
        const cs = window.getComputedStyle(origs[i]);
        const parent = origs[i].parentElement;
        const ps = i === 0 || !parent ? null : window.getComputedStyle(parent);
        for (const prop of INHERITED) {
            const v = cs.getPropertyValue(prop);
            if (!v) continue;
            // The root always states its value — there is no ancestor
            // inside the foreignObject to inherit from.
            if (ps && ps.getPropertyValue(prop) === v) continue;
            if (inline.getPropertyValue(prop)) continue;   // caller was explicit
            inline.setProperty(prop, v);
        }

        // 3. Painted, NON-inherited properties. Inheritance cannot rescue
        //    these: `.card { background: #e8eef5 }` is simply absent from
        //    the clone, so the element captures fully transparent.
        //
        //    The symptom is easy to misread. In a transition the two
        //    captures crossfade against each other, and with backgrounds
        //    missing both sides are transparent everywhere except their
        //    glyphs — so the morph looks like it fades away toward the
        //    middle and "disappears", when every pixel is exactly where
        //    it belongs and merely has nothing opaque behind it.
        //
        //    Restricted to properties that do not affect LAYOUT. Freezing
        //    width, padding or border-width would relayout the clone and
        //    move the glyphs away from where the real text sits — the
        //    very bug this function was written to prevent.
        for (const prop of PAINTED) {
            if (inline.getPropertyValue(prop)) continue;   // caller was explicit
            const v = cs.getPropertyValue(prop);
            // Skip initial values, or every node gains a handful of
            // no-op declarations and the serialized string balloons.
            if (!v || PAINT_INITIAL.has(v)) continue;
            inline.setProperty(prop, v);
        }
    }
    return clone;
}

/**
 * The single <img> a host renders, if that is all it is.
 *
 * A foreignObject rendered from a data: URI never fetches subresources, so
 * any <img> inside the serialized subtree comes back blank — a photo host
 * would capture as fully transparent. When the host is just an image we can
 * skip serialization entirely and upload that image as the texture, which
 * is both correct and considerably cheaper.
 *
 * Only same-origin, already-decoded images qualify: a cross-origin one
 * would taint the canvas and break the readback the pipeline depends on.
 */
function soleImageOf(el) {
    if (!el) return null;
    let img = null;
    if (el.tagName === "IMG") {
        img = el;
    } else if (el.children) {
        // Ignore the pipeline's own canvas: by the time a capture runs it has
        // already been appended to the host, so a strict one-child test never
        // matches and a wrapped photo falls back to the foreignObject path —
        // which cannot fetch the image and captures blank.
        const content = Array.prototype.filter.call(
            el.children, (n) => !n.hasAttribute || !n.hasAttribute("data-nodality-raster"));
        if (content.length === 1 && content[0].tagName === "IMG") img = content[0];
    }
    if (!img || !img.complete || !img.naturalWidth) return null;
    try {
        // Relative and same-origin absolute srcs both resolve clean here.
        if (new URL(img.currentSrc || img.src, location.href).origin !== location.origin) {
            return null;
        }
    } catch (e) {
        return null;
    }
    return img;
}

/**
 * Draw `img` into an offscreen canvas at the host's box, honouring the
 * element's own `object-fit` / `object-position`.
 *
 * The pipeline samples its texture as `fragCoord / u_res`, i.e. stretched
 * across the whole quad. That is right for a DOM snapshot, which is captured
 * at the canvas aspect — but the direct-image path uploads the source at its
 * NATURAL aspect, so any host whose box is a different shape rendered the
 * photo distorted, and `object-fit: cover` no longer had any say because the
 * image was no longer being laid out by CSS at all.
 *
 * Baking the fit in here keeps it out of the shader and means the texture
 * always arrives pre-cropped to the box the quad expects.
 */
function fitImageToBox(img, w, h, dpr) {
    const cw = Math.max(1, Math.round(w * dpr));
    const ch = Math.max(1, Math.round(h * dpr));
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return img;

    let fit = "fill", pos = "50% 50%";
    if (typeof getComputedStyle === "function") {
        const cs = getComputedStyle(img);
        fit = cs.objectFit || "fill";
        pos = cs.objectPosition || "50% 50%";
    }
    // `fill` is the CSS default and matches the old stretch behaviour, so
    // leave those callers on the cheap path.
    if (fit === "fill") return img;

    const sx = cw / iw, sy = ch / ih;
    const scale = fit === "cover" ? Math.max(sx, sy)
        : fit === "contain" ? Math.min(sx, sy)
        : fit === "none" ? 1
        : fit === "scale-down" ? Math.min(1, Math.min(sx, sy))
        : Math.max(sx, sy);

    const dw = iw * scale, dh = ih * scale;
    // object-position: percentages position the overflow, so 0% pins the
    // near edge and 100% the far edge.
    const parts = String(pos).trim().split(/\s+/);
    const frac = (v, i) => {
        if (v == null) return 0.5;
        if (v.endsWith("%")) return parseFloat(v) / 100;
        if (v === "left" || v === "top") return 0;
        if (v === "right" || v === "bottom") return 1;
        if (v === "center") return 0.5;
        const px = parseFloat(v);
        return isNaN(px) ? 0.5 : px / (i === 0 ? Math.max(cw - dw, 1) : Math.max(ch - dh, 1));
    };
    const fx = frac(parts[0], 0);
    const fy = frac(parts.length > 1 ? parts[1] : parts[0], 1);

    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    const ctx = c.getContext("2d");
    if (!ctx) return img;
    ctx.drawImage(img, (cw - dw) * fx, (ch - dh) * fy, dw, dh);
    return c;
}

function snapshotToImage(el, w, h, dpr) {
    const direct = soleImageOf(el);
    if (direct) return Promise.resolve(fitImageToBox(direct, w, h, dpr));

    return new Promise((resolve, reject) => {
        const serialized = new XMLSerializer()
            .serializeToString(freezeStyles(el, el.cloneNode(true)));
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w * dpr}" height="${h * dpr}" viewBox="0 0 ${w} ${h}">` +
            `<foreignObject width="100%" height="100%">` +
            `<div xmlns="http://www.w3.org/1999/xhtml">${serialized}</div>` +
            `</foreignObject></svg>`;
        // createElement, NOT `new Image()` — this library exports a
        // component named `Image`, and consumers publish the exports onto
        // globalThis. Where they do, the DOM constructor is gone and this
        // promise never settles: the snapshot backend hangs with no error.
        const img = document.createElement("img");
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
}

// ── switch: pick a sub-chain by condition ────────────────────────────
//
//   { op: "switch",
//     when: "(max-width: 700px)",     // or "coarse", "fine", "no-hover"
//     use:  [ { op: "halftone" } ],   // taken when the test passes
//     else: [ { op: "stir" }, ... ] } // taken when it does not
//
// This is a build-time node, not a shader op: it produces a node list,
// which is then compiled like any other. Sub-chains nest, so a switch
// may contain a switch.
//
// Evaluated ONCE, when the pipeline attaches. It is meant for choices
// that are properties of the device — a cheap chain on a phone, a heavy
// one on a desktop — not for anything that should change as the window
// is dragged: switching mid-session would need a new shader program,
// and the pipeline compiles exactly one.
const SWITCH_ALIASES = {
    coarse: "(pointer: coarse)",
    fine: "(pointer: fine)",
    hover: "(hover: hover)",
    "no-hover": "(hover: none)",
    "reduced-motion": "(prefers-reduced-motion: reduce)",
    dark: "(prefers-color-scheme: dark)",
    light: "(prefers-color-scheme: light)",
};

function switchTest(when) {
    if (typeof when === "function") {
        try { return !!when(); } catch (e) { return false; }
    }
    if (typeof when === "boolean") return when;
    if (typeof when !== "string" || when === "") return false;
    const q = SWITCH_ALIASES[when] || when;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    try { return window.matchMedia(q).matches; } catch (e) { return false; }
}

function resolveSwitches(nodes, depth) {
    if (!Array.isArray(nodes)) return [];
    // Cheap cycle guard: sub-chains are plain data and could be shared
    // by reference, so a self-referential list would otherwise hang.
    if ((depth || 0) > 8) return [];
    const out = [];
    for (const node of nodes) {
        if (!node || node.op !== "switch") { out.push(node); continue; }
        const branch = switchTest(node.when) ? node.use : node.else;
        // A branch may legitimately be empty — that is how you say
        // "do nothing on small screens".
        for (const sub of resolveSwitches(branch || [], (depth || 0) + 1)) out.push(sub);
    }
    return out;
}

// ── Replaced / void hosts ────────────────────────────────────────────
//
// Elements that cannot contain rendered children. Appending the pipeline
// canvas to one of these puts it in the DOM but never paints it, so the
// effect appears to attach and then does nothing at all.
const VOID_RASTER_HOSTS = new Set([
    "IMG", "VIDEO", "CANVAS", "IFRAME", "INPUT", "EMBED", "OBJECT",
    "TEXTAREA", "SELECT", "BR", "HR", "AREA", "SOURCE", "TRACK", "WBR",
]);

// Styles that describe the element's CONTENT rather than its box, and so
// must stay on the element when its box moves to the wrapper.
const CONTENT_STYLES = [
    "objectFit", "objectPosition", "borderRadius", "imageRendering", "filter",
];

/**
 * Put `el` inside a container that can host the pipeline canvas.
 *
 * The wrapper takes over the element's authored inline box — position,
 * insets, size, margins — so layout is unchanged, and the element is reset
 * to fill it. Inline styles are moved rather than computed values copied:
 * copying computed width/height would freeze a fluid element at whatever
 * pixel size it happened to have at attach time.
 *
 * @returns {HTMLElement|null} the wrapper, or null if `el` has no parent.
 */
function wrapReplacedHost(el) {
    if (!el.parentNode) return null;

    const keep = {};
    for (const k of CONTENT_STYLES) {
        if (el.style[k]) keep[k] = el.style[k];
    }

    const wrap = document.createElement("div");
    wrap.setAttribute("data-nodality-raster-host", el.tagName.toLowerCase());
    wrap.style.cssText = el.style.cssText;

    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);

    // The wrapper is now the box; the element fills it.
    el.removeAttribute("style");
    Object.assign(el.style, keep);
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";

    // The canvas is positioned against the wrapper, so it needs to be a
    // containing block.
    const pos = typeof getComputedStyle === "function"
        ? getComputedStyle(wrap).position
        : "static";
    if (pos === "static") wrap.style.position = "relative";
    if (!wrap.style.width) wrap.style.width = "100%";
    if (!wrap.style.height) wrap.style.height = "100%";

    return wrap;
}

// ── Pipeline runner ──────────────────────────────────────────────────

// Fired on `document` whenever a pipeline param changes through setParam,
// so any UI showing that data — the inspector, a code preview, an editor —
// stays in step without polling or knowing about the others.
//   detail: { pipeline, el, index, key, value, prev, how }
// `how` is "uniform" or "rebuild", the same value setParam returns.
const RASTER_PARAM_EVENT = "nodality:raster-param";

// ── Live pipelines (phase H3) ────────────────────────────────────────
// Every attached pipeline, so a dev tool can find what is running without
// the page having to hand it over. A Set, not a WeakSet: enumerating is
// the entire point, and destroy() removes deterministically.
const ACTIVE = new Set();

/** Every raster pipeline currently attached, in attach order. */
function activeRasterPipelines() {
    return [...ACTIVE];
}

// Params that are compiled into the shader rather than uploaded as a
// uniform, per op. Measured from which of code()/uniforms() reads them —
// see the table in HOUDINI-DECISIONS. `masked`, `op` and `live` are
// structural for every op: they change the emitted code or the backend.
const ALWAYS_STRUCTURAL = ["op", "masked", "live"];

/**
 * Does changing `key` on an op of this type require a new shader?
 *
 * Unknown keys rebuild. That is deliberately the pessimistic default: a
 * missed structural param renders the wrong thing with no error, while an
 * unnecessary rebuild only costs a frame.
 */
function isStructuralChange(op, key, next, prev) {
    if (ALWAYS_STRUCTURAL.includes(key)) return true;
    const def = REGISTRY[op];
    if (!def) return true;
    if ((def.structural || []).includes(key)) return true;
    // A param that only branches the shader when it crosses zero —
    // hexalize's `lift` picks the cheap path at 0 and the seven-neighbour
    // probe otherwise, so 0 -> 0.3 needs a rebuild but 0.3 -> 0.5 does not.
    if ((def.structuralOnToggle || []).includes(key)) return !next !== !prev;
    // Known uniform? Then it is live.
    if (def.uniforms) {
        try { if (key in def.uniforms(Object.assign({ op }, { [key]: next }), 1)) return false; }
        catch (e) { /* fall through to the pessimistic default */ }
    }
    return true;
}

/**
 * @param {HTMLElement} el
 * @param {Array} rasterNodes
 * @param {object} [opts]
 * @param {object} [opts.transition] phase T2 — run in transition mode.
 *   `{ oldImage, oldRect, newRect }` where oldImage is an already
 *   captured Image/canvas of the OLD element (it has to be captured
 *   before the DOM swap, because by the time the morph runs that subtree
 *   is gone), and the rects are CSS px relative to `el`.
 */
// One stylesheet for the whole library: while a host's ink is hidden, a
// selection inside it paints its glyphs in the colour they had before the
// canvas took over. Unselected text stays transparent (the canvas is
// drawing it), so what the user sees is exactly the selected run appearing
// in place — rather than a blank rectangle over an invisible one.
let selectionStyleAdded = false;
function ensureSelectionStyle() {
    if (selectionStyleAdded || typeof document === "undefined") return;
    selectionStyleAdded = true;
    const s = document.createElement("style");
    s.setAttribute("data-nodality", "selection");
    s.textContent =
        "[data-nodality-ink]::selection,[data-nodality-ink] *::selection{" +
        "color:var(--nod-ink);-webkit-text-fill-color:var(--nod-ink)}" +
        "[data-nodality-ink]::-moz-selection,[data-nodality-ink] *::-moz-selection{" +
        "color:var(--nod-ink);-webkit-text-fill-color:var(--nod-ink)}";
    (document.head || document.documentElement).appendChild(s);
}

function applyRasterPipeline(el, rasterNodes, opts) {
    // Kept before flattening: rebuild() needs the tree, not the flat list.
    const sourceNodes = rasterNodes;
    const transition = (opts && opts.transition) || null;
    // Hard guards — every early-out is silent by design so that jsdom
    // prerender, old browsers and reduced-motion users get the plain
    // page untouched.
    if (!el || typeof document === "undefined" || typeof window === "undefined") return null;
    // An empty chain is nothing to do — EXCEPT in transition mode, where
    // the crossfade between the two captures IS the effect and ops are
    // only decoration on top of it.
    if ((!rasterNodes || rasterNodes.length === 0) && !transition) return null;
    if (!rasterNodes) rasterNodes = [];
    // Flatten any switch nodes down to the chain this device actually
    // gets, before anything reads the list.
    if (rasterNodes.some((n) => n && n.op === "switch")) {
        rasterNodes = resolveSwitches(rasterNodes, 0);
        if (rasterNodes.length === 0 && !transition) return null;
    }
    // Flatten merge sub-chains into the linear list that owns the
    // uniform slots. `tree` keeps the branch structure for the shader
    // emitter; `flat` is what every other loop iterates, so a node
    // nested inside a merge gets its uniforms, driver and solver set up
    // exactly like a top-level one.
    const flatNodes = [];
    const rasterTree = flattenRaster(rasterNodes, flatNodes);
    rasterNodes = flatNodes;
    if (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

    // The pipeline hosts its canvas as a child of the target. Replaced and
    // void elements cannot take children — appending to an <img> puts the
    // canvas in the tree but never renders it, so the effect silently does
    // nothing. Wrap such a target in a container and host there instead.
    if (VOID_RASTER_HOSTS.has(el.tagName)) {
        const existing =
            el.parentElement &&
            el.parentElement.hasAttribute &&
            el.parentElement.hasAttribute("data-nodality-raster-host")
                ? el.parentElement
                : null;
        el = existing || wrapReplacedHost(el);
        if (!el) return null;
    }

    // One pipeline per host element (set() chains can fire more than
    // once across codegen instances; only the mounted one matters).
    if (el.querySelector && el.querySelector(":scope > canvas[data-nodality-raster]")) return null;

    // Content-box measurement: some elements (fluid-sized Text) keep a
    // collapsed layout box while their glyphs overflow it, so fall back
    // to scroll dimensions when the rect is degenerate.
    //
    // The fallback is per-axis and only for a genuinely collapsed box. It
    // used to be an unconditional max(rect, scroll), which cannot shrink:
    // the canvas is a CHILD of the measured element, so once it has been
    // sized up its own width holds scrollWidth at the old value, the max
    // never comes down, and a host that is animating smaller (a hero
    // collapsing as you scroll back up) leaves the canvas stuck wide.
    const measure = () => {
        const r = el.getBoundingClientRect();
        return {
            width: r.width >= 2 ? r.width : (el.scrollWidth || 0),
            height: r.height >= 2 ? r.height : (el.scrollHeight || 0),
        };
    };
    const rect = measure();
    if (rect.width < 2 || rect.height < 2) return null;

    // Render resolution. The cap exists because every op runs per output
    // pixel, so cost is quadratic in it — but capping at 2 also means a 3x
    // phone or a scaled 4K desktop renders the effect at LOWER density than
    // the text beside it, and the canvas reads as soft next to real DOM.
    // Default to the display's own density up to 3, and let a caller that
    // knows its budget say otherwise.
    const dpr = Math.max(1, Math.min(
        opts && opts.resolution ? opts.resolution : (window.devicePixelRatio || 1), 3));
    const isOverlay = rasterNodes.some((n) => (REGISTRY[n.op] || {}).overlay);
    // Stacking: a pipeline may mix in-place ops (hexalize/offset/duotone/
    // edges) with an overlay op (blobs). The single shader composites them
    // in one pass, but the HOST visibility differs — only a PURELY overlay
    // chain leaves the host visible (the lens refracts untouched content).
    // The moment an in-place op joins, the canvas fully carries the look,
    // so the host must be hidden or the original content ghosts through.
    // `.every()` on an EMPTY array is vacuously true, which used to be
    // unreachable — a chain with no ops returned null long before here.
    // Transition mode made it reachable, and an empty transition chain
    // was classified a pure overlay: the canvas composited over untouched
    // DOM instead of replacing it, so the same chain rendered differently
    // with and without a zero-strength op in it.
    const pureOverlay = rasterNodes.length > 0 && !transition &&
        rasterNodes.every((n) => (REGISTRY[n.op] || {}).overlay);
    // Live-first (HTML-in-Canvas). The live backend captures content that
    // lives INSIDE the canvas (texElementImage2D over the restructured
    // subtree) — the same model canvasUI's bubble uses: content in the
    // canvas, the lens drawn over that live capture. So live is viable
    // whenever the host is hidden and its content moves into the canvas,
    // i.e. every chain EXCEPT a pure-overlay one (blobs alone floating
    // over untouched DOM — nothing is restructured, so there is no live
    // subtree to sample; that case stays snapshot). A combined chain
    // (blobs + hexalize/offset/…) hides the host and therefore runs live,
    // lens included. Opt out per pipeline with `live: false` on any node.
    // A TRANSITION never wants the live backend, and the reason is not a
    // preference — it is that live costs interactivity and buys nothing
    // here.
    //
    // Buys nothing: a morph samples u_old and u_newimg, two frozen
    // captures. The live upload of the host is never read (see
    // nodSampleAt), so restructuring the DOM into the canvas produces a
    // texture nobody looks at.
    //
    // Costs interactivity: the live path MOVES the host's children into
    // the canvas, where they become canvas fallback content — present in
    // the accessibility tree but not hit-testable the way ordinary DOM
    // is. Every control inside the morphed element then stops responding
    // to the pointer, which is what "the back button is not clickable"
    // is. It only reproduces on a browser with the HTML-in-Canvas API,
    // so a snapshot-only run says everything is fine.
    //
    // `transition.live: true` overrides this deliberately, for comparing
    // the two backends side by side. Expect the morph to LOOK the same and
    // stop responding to the pointer — that is the trade being shown.
    const forceLive = !!(transition && transition.live === true);
    const wantLive = !pureOverlay && (!transition || forceLive) &&
        !rasterNodes.some((n) => n.live === false);
    const apiAvailable =
        (typeof WebGL2RenderingContext !== "undefined" &&
            "texElementImage2D" in WebGL2RenderingContext.prototype) ||
        (typeof WebGLRenderingContext !== "undefined" &&
            "texElementImage2D" in WebGLRenderingContext.prototype);
    let live = wantLive && apiAvailable;
    if (wantLive && !live) {
        console.info("[nodality] HTML-in-Canvas API not available - raster ops fall back to snapshot capture.");
    }

    const canvas = document.createElement("canvas");
    // layoutsubtree must be present before context creation so the
    // browser prepares the canvas for laid-out children (origin trial).
    if (live) canvas.setAttribute("layoutsubtree", "");
    const ctxOpts = { alpha: true, premultipliedAlpha: false };
    // WebGL2-first everywhere: NPOT mipmaps (offset-scaled blur for the
    // glassy ops) and texElementImage2D both need it; WebGL1 remains as
    // a sharp-rendering fallback (mip blur simply disables).
    const gl = canvas.getContext("webgl2", ctxOpts) ||
        canvas.getContext("webgl", ctxOpts);
    if (!gl) return null;
    const isGL2 = (typeof WebGL2RenderingContext !== "undefined") &&
        (gl instanceof WebGL2RenderingContext);
    const needMips = isGL2 && rasterNodes.some((n) => (REGISTRY[n.op] || {}).mips);
    if (live && !("texElementImage2D" in gl)) {
        console.info("[nodality] texElementImage2D missing on the created context - snapshot fallback.");
        canvas.removeAttribute("layoutsubtree");
        live = false;
    }

    // Overlay the effect canvas on the host element. The real DOM stays
    // in place underneath (accessibility tree, selection, focus), the
    // canvas is purely visual and lets pointer events through.
    const cs = window.getComputedStyle(el);
    if (cs.position === "static") el.style.position = "relative";
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.setAttribute("data-nodality-raster", live ? "live" : "snapshot");
    console.info("[nodality] raster backend:", live ? "html-in-canvas (live)" : "snapshot");

    // In live mode the canvas fills the host's CONTENT box, not its border
    // box (it is a child of the host). Filled in below when live attaches.
    const liveBox = { width: rect.width, height: rect.height };
    let sourceEl = el; // element uploaded as the texture in live mode
    if (live) {
        // HTML-in-Canvas: the subtree becomes canvas children (wrapped in
        // a single div we can pass to texElementImage2D) so it keeps
        // layout, interactivity and its accessibility-tree presence while
        // the canvas paints it (WICG proposal; Chrome origin trial behind
        // chrome://flags/#canvas-draw-element). layoutsubtree was already
        // set before context creation above.
        const wrap = document.createElement("div");
        // The wrapper MUST fill the canvas box. Left to itself it
        // shrink-wraps its content — a headline wraps to the text width,
        // not the element width — and texElementImage2D then captures
        // that narrower box while the shader maps the texture across the
        // whole canvas. Everything comes out stretched horizontally by
        // canvasWidth/contentWidth, so the drawn glyphs no longer sit
        // where the DOM text does and selection lands on the wrong
        // characters.
        //
        // The wrapper must also CARRY THE HOST'S OWN LAYOUT. Hardcoding
        // `display:block` here silently dropped it: a host centring its
        // child with `align: "center"` (display:flex, flex-direction:
        // column, align-items:center) handed that child to a block
        // wrapper, so the child fell back to the left edge of the box.
        // On a 212px CTA host holding a ~164px pill that reads as ~24px
        // off centre — visible only in live mode, because in snapshot
        // mode the children never leave the host.
        const hostCS = getComputedStyle(el);
        const hostIsFlex = hostCS.display === "flex" || hostCS.display === "inline-flex";
        // GRID too, and for a sharper reason than flex.
        //
        // Dropping a flex host's layout misplaced its children; dropping a
        // GRID host's layout changes the box SIZE. Columns collapse, the
        // children stack vertically, and they overflow the fixed-height
        // wrapper — at which point measure()'s scrollHeight fallback (the
        // host's own rect is collapsed in live mode) starts counting the
        // overflowing canvas, which is a child of the thing being measured.
        // Canvas grows -> host grows -> ResizeObserver -> repeat. A
        // 98px-tall two-column panel reached 4014px before this line.
        const hostIsGrid = hostCS.display === "grid" || hostCS.display === "inline-grid";

        // The canvas is a CHILD of the host, so it lives in the host's
        // CONTENT box — but `rect` is the border box. Sizing the canvas to
        // `rect` therefore overflows by the padding on both axes and makes
        // the host padding taller than it started, every time. Measure the
        // content box once, here, and use it for both the canvas and the
        // subtree; the host keeps its own padding and nothing is applied
        // twice.
        const px = (v) => parseFloat(v) || 0;
        const padX = px(hostCS.paddingLeft) + px(hostCS.paddingRight);
        const padY = px(hostCS.paddingTop) + px(hostCS.paddingBottom);
        liveBox.width = Math.max(2, rect.width - padX);
        liveBox.height = Math.max(2, rect.height - padY);

        wrap.style.cssText =
            `display:${hostIsFlex || hostIsGrid ? hostCS.display : "block"};` +
            `width:${liveBox.width}px;height:${liveBox.height}px;`;
        if (hostIsGrid) {
            wrap.style.gridTemplateColumns = hostCS.gridTemplateColumns;
            wrap.style.gridTemplateRows = hostCS.gridTemplateRows;
            wrap.style.gridTemplateAreas = hostCS.gridTemplateAreas;
            wrap.style.gap = hostCS.gap;
            wrap.style.alignItems = hostCS.alignItems;
            wrap.style.justifyItems = hostCS.justifyItems;
        }
        if (hostIsFlex) {
            wrap.style.flexDirection  = hostCS.flexDirection;
            wrap.style.alignItems     = hostCS.alignItems;
            wrap.style.justifyContent = hostCS.justifyContent;
            wrap.style.gap            = hostCS.gap;
        }
        while (el.firstChild) wrap.appendChild(el.firstChild);
        canvas.appendChild(wrap);
        sourceEl = wrap;
        // The host collapses once its children move into the canvas, so
        // the canvas itself carries the box in normal flow (not overlay).
        canvas.style.cssText =
            `display:block;width:${liveBox.width}px;height:${liveBox.height}px;`;
    } else {
        // Snapshot mode: purely visual overlay.
        canvas.style.cssText =
            "position:absolute;top:0;left:0;" +
            `width:${rect.width}px;height:${rect.height}px;` +
            "pointer-events:none;z-index:2147483000;";
        if (pureOverlay) {
            // The real content is still visible underneath and keeps its
            // own semantics, so the canvas is pure decoration.
            canvas.setAttribute("aria-hidden", "true");
        } else {
            // In-place: the host gets hidden below, which would take its
            // text out of the accessibility tree, out of find-in-page and
            // out of innerText. Carry the label onto the canvas so the
            // element is still announced rather than silently vanishing.
            canvas.setAttribute("role", "img");
            const label = (el.textContent || "").replace(/\s+/g, " ").trim();
            if (label) canvas.setAttribute("aria-label", label.slice(0, 300));
        }
    }
    el.appendChild(canvas);

    // Compile the pipeline.
    const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error("[nodality] raster shader: " + gl.getShaderInfoLog(s));
        }
        return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER,
        buildFragmentShader(rasterTree, rasterNodes, false, transition)));
    // Pin "a" to location 0 so a field-simulation program (which shares
    // this vertex buffer and attribute array) can be swapped in without
    // respecifying the pointer.
    gl.bindAttribLocation(prog, 0, "a");
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);

    const setUniform = (loc, kind, value) => {
        if (kind === "1f") gl.uniform1f(loc, value);
        else if (kind === "1i") gl.uniform1i(loc, value);
        else if (kind === "2fv") gl.uniform2fv(loc, value);
        else if (kind === "3fv") gl.uniform3fv(loc, value);
    };

    // Static uniforms from the node data. Uploaded once per PROGRAM
    // rather than once per pipeline: phase I1's probe is a second program
    // running the same chain, and without these its op uniforms would all
    // read 0 — a `size` of 0 divides to infinity and the whole coordinate
    // computation becomes NaN, which readback reports as a confident 0.
    // Phase T1. Transition progress. Static uniforms are resolved AT this
    // value, so a keyframed param is correct from the first frame rather
    // than jumping once something scrubs.
    let progress = 0;
    const keyframed = rasterNodes
        .map((node, i) => ({ node, i }))
        .filter(({ node }) => hasKeyframes(node));

    const applyStaticUniforms = (Uq, only) => {
        rasterNodes.forEach((node, i) => {
            if (only && !only.has(i)) return;
            const def = REGISTRY[node.op];
            if (!def || !def.uniforms) return;
            const us = def.uniforms(resolveNode(node, progress), dpr);
            for (const key in us) {
                setUniform(Uq(`u${i}_${key}`), us[key][0], us[key][1]);
            }
        });
    };
    applyStaticUniforms(U);

    // Re-upload only the keyframed nodes. Cheap enough to run per frame
    // while a transition is scrubbing, and a no-op for every chain that
    // has no keyframes — which is all of them until someone opts in.
    const kfIndices = new Set(keyframed.map((k) => k.i));
    const uploadKeyframes = () => {
        if (!keyframed.length) return;
        gl.useProgram(prog);
        applyStaticUniforms(U, kfIndices);
        if (probe && !probe.broken) {
            gl.useProgram(probe.prog);
            applyStaticUniforms(probe.U, kfIndices);
            gl.useProgram(prog);
        }
    };

    // Ops with a CPU simulation (e.g. blobs) get per-frame state and
    // feed dynamic uniforms each draw (see the render loop below).
    const dynamicOps = [];
    rasterNodes.forEach((node, i) => {
        const def = REGISTRY[node.op];
        if (def && typeof def.init === "function") {
            dynamicOps.push({ i, def, state: def.init(node, dpr, canvas.width, canvas.height) });
        }
    });
    let lastFrame = (typeof performance !== "undefined") ? performance.now() : 0;

    // ── Fluid solvers (ops with a `solver` descriptor, e.g. stir) ─────
    // An op may declare a set of render targets and fragment programs
    // plus a step() that sequences the passes. The pipeline allocates
    // everything here, runs step() once per frame, and binds the named
    // result textures into the main composite pass.
    //
    // Float render targets are required (velocity and pressure are
    // signed and need range well outside [0,1]). Without them the op
    // disables itself rather than rendering something wrong.
    const solverOps = [];
    const makeSolver = (node, i) => {
        const def = REGISTRY[node.op];
        if (!isGL2 || !gl.getExtension("EXT_color_buffer_float")) {
            console.info("[nodality] '" + node.op +
                "' needs WebGL2 float render targets - op skipped.");
            return null;
        }
        gl.getExtension("OES_texture_float_linear");
        // Canvas dimensions are passed through so a target can be
        // full-resolution (echo's history) rather than a fixed grid.
        const res = def.solver.resolutions(node, canvas.width, canvas.height);
        const FMT = {
            r: [gl.R16F, gl.RED],
            rg: [gl.RG16F, gl.RG],
            rgba: [gl.RGBA16F, gl.RGBA],
        };

        const made = [];
        const mkTarget = (w, h, fmt, smooth) => {
            const [internal, format] = FMT[fmt];
            const t = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, t);
            const flt = smooth ? gl.LINEAR : gl.NEAREST;
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0,
                format, gl.HALF_FLOAT, null);
            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D, t, 0);
            const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
            gl.viewport(0, 0, w, h);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            const rec = { tex: t, fbo, w, h, ok };
            made.push(rec);
            return rec;
        };

        const targets = {};
        let allOk = true;
        for (const name in def.solver.targets) {
            const spec = def.solver.targets[name];
            const dim = res[spec.res];
            const [tw, th] = Array.isArray(dim) ? dim : [dim, dim];
            if (spec.double) {
                targets[name] = {
                    a: mkTarget(tw, th, spec.fmt, spec.smooth),
                    b: mkTarget(tw, th, spec.fmt, spec.smooth),
                };
                allOk = allOk && targets[name].a.ok && targets[name].b.ok;
            } else {
                targets[name] = { a: mkTarget(tw, th, spec.fmt, spec.smooth) };
                allOk = allOk && targets[name].a.ok;
            }
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const cleanup = () => made.forEach((t) => {
            gl.deleteFramebuffer(t.fbo);
            gl.deleteTexture(t.tex);
        });

        if (!allOk) {
            console.info("[nodality] '" + node.op +
                "' float targets incomplete - op skipped.");
            cleanup();
            return null;
        }

        const progs = {};
        try {
            for (const name in def.solver.programs) {
                const pr = gl.createProgram();
                gl.attachShader(pr, compile(gl.VERTEX_SHADER, VS));
                gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, def.solver.programs[name]));
                gl.bindAttribLocation(pr, 0, "a");
                gl.linkProgram(pr);
                if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
                    throw new Error(name + ": " + gl.getProgramInfoLog(pr));
                }
                progs[name] = { prog: pr, loc: {} };
            }
        } catch (e) {
            console.warn("[nodality] '" + node.op + "' solver programs failed:", e);
            cleanup();
            for (const n in progs) gl.deleteProgram(progs[n].prog);
            return null;
        }

        gl.useProgram(prog);
        return {
            i, node, def, res, targets, progs, cleanup,
            prevX: 0.5, prevY: 0.5, primed: false,
        };
    };
    rasterNodes.forEach((node, i) => {
        const def = REGISTRY[node.op];
        if (!def || !def.solver) return;
        const s = makeSolver(node, i);
        if (s) solverOps.push(s);
    });

    // One frame of a solver. `S` is the small API the op's step() drives.
    const stepSolver = (s, dt) => {
        let cur = null;
        const S = {
            res: s.res,
            use(name) {
                cur = s.progs[name];
                gl.useProgram(cur.prog);
            },
            u(name) {
                if (!(name in cur.loc)) cur.loc[name] = gl.getUniformLocation(cur.prog, name);
                return cur.loc[name];
            },
            f1(n, v) { gl.uniform1f(S.u(n), v); },
            f2(n, x, y) { gl.uniform2f(S.u(n), x, y); },
            f3(n, x, y, z) { gl.uniform3f(S.u(n), x, y, z); },
            smp(n, target, unit) {
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, target.tex);
                gl.uniform1i(S.u(n), unit);
            },
            read: (name) => s.targets[name].a,
            write: (name) => s.targets[name].b,
            single: (name) => s.targets[name].a,
            // The captured page content, as a bindable target. echo
            // accumulates from it; stir never touches it.
            content: { tex },
            canvasW: canvas.width,
            canvasH: canvas.height,
            swap(name) {
                const t = s.targets[name];
                const tmp = t.a; t.a = t.b; t.b = tmp;
            },
            blit(target) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
                gl.viewport(0, 0, target.w, target.h);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            },
        };

        // Pointer in field space (bottom-up [0,1]) and the velocity it
        // picked up since the previous frame - the spoon.
        const px = mouse[0] / canvas.width;
        const py = 1 - mouse[1] / canvas.height;
        let dx = 0, dy = 0;
        // Only a real pointer event counts as motion. `mouse` is stored in
        // canvas pixels, so this normalised position also shifts whenever the
        // canvas itself resizes or moves — an element being animated (a
        // scroll-driven hero expanding) would otherwise inject phantom
        // velocity every frame and stir itself with the pointer sitting
        // still, or with the pointer nowhere near it.
        if (s.primed && pointerMoved) {
            dx = (px - s.prevX) / Math.max(dt, 1e-3);
            dy = (py - s.prevY) / Math.max(dt, 1e-3);
        }
        // Re-baseline regardless, so the frame after a resize does not
        // measure its delta against a position from a different geometry.
        s.prevX = px; s.prevY = py; s.primed = true;
        const moving = pointerMoved && Math.abs(dx) + Math.abs(dy) > 1e-3;

        s.def.solver.step(S, s.node, {
            dt, px, py, dx, dy, moving,
            aspect: canvas.width / Math.max(canvas.height, 1),
            col: s.def.solver.splatColor(s.node, dx, dy),
        });
    };

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
        needMips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Regenerate the mip chain after every content upload so the
    // offset-scaled blur (texture2D bias) has levels to sample.
    const finishUpload = () => { if (needMips) gl.generateMipmap(gl.TEXTURE_2D); };

    let textureReady = false;

    // Phase T2. The frozen capture of the element being transitioned
    // FROM. Uploaded once — it is a still by definition, which is also
    // why transitions need no live-capture support and therefore work in
    // every browser that has WebGL, not just those in the origin trial.
    let oldTex = null;
    let newTex = null;
    // NOTE: the new element's ink is NOT hidden here. An earlier attempt
    // did it on the next animation frame and raced the capture — the
    // texture was taken from an already-transparent subtree, so the new
    // side of every morph was blank. The existing post-capture path
    // (`if (!pureOverlay) hideHostInk()`) runs at the right moment, and
    // transition mode is never pureOverlay; setProgress governs it from
    // then on.
    if (transition && transition.oldImage) {
        oldTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, oldTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE, transition.oldImage);
        } catch (e) {
            console.warn("[nodality] transition: old capture upload failed:", e);
            gl.deleteTexture(oldTex);
            oldTex = null;
        }
    }
    if (transition && transition.newImage) {
        newTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, newTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE, transition.newImage);
        } catch (e) {
            console.warn("[nodality] transition: new capture upload failed:", e);
            gl.deleteTexture(newTex);
            newTex = null;
        }
    }
    let destroyed = false;
    let mode = live ? "live" : "snapshot";

    // For an overlay effect whose content is (or contains) a same-origin
    // image, upload that image straight into the texture. This bypasses
    // the foreignObject snapshot (which can't rasterise <img>) and gives
    // the lens a real photo to refract — the glassy, distorting look.
    const contentImg = () => {
        const im = (el.tagName === "IMG") ? el
            : (el.querySelector ? el.querySelector("img") : null);
        return (im && im.complete && im.naturalWidth > 0) ? im : null;
    };
    let imgListenerBound = false;

    // Snapshot the host's children (excluding our own canvas). Once the
    // texture is live, the host's own painting is hidden via the
    // visibility trick (the canvas child re-shows itself) so transparent
    // hosts — e.g. a bare headline — don't ghost-double under the effect.
    // Keeping the host selectable.
    // --------------------------------------------------------------
    // The host must NOT be visibility:hidden. Hidden text cannot be
    // selected, so dragging over the effect either selects nothing or
    // catches neighbouring content — which is what makes the highlight
    // look offset and unreliable. Instead the host stays in the flow
    // with its ink made transparent, and the canvas is painted BEHIND
    // it. The glyphs are invisible but still hit-testable, and the
    // browser paints the selection highlight above the canvas, aligned
    // with the real text, because that is where the text actually is.
    const INK = {
        "color": "transparent",
        "-webkit-text-fill-color": "transparent",
        "-webkit-text-stroke-color": "transparent",
        "background-color": "transparent",
        "background-image": "none",
        "border-color": "transparent",
        "box-shadow": "none",
        "text-shadow": "none",
    };
    const REPLACED = "img,svg,video,picture,iframe";
    let inkSaved = null;

    const hideHostInk = () => {
        if (inkSaved) return;
        ensureSelectionStyle();
        inkSaved = [];
        el.setAttribute("data-nodality-ink", "");
        const nodes = [el, ...el.querySelectorAll("*")]
            .filter((n) => n !== canvas && n.tagName !== "CANVAS");
        // Selection has to stay LEGIBLE while the ink is transparent. The
        // host is deliberately still selectable (see above), but with
        // color:transparent a drag paints the selection rectangle over
        // invisible glyphs — a blank block that hides the effect instead
        // of highlighting anything. Stash each node's real colour so the
        // ::selection rule can repaint just the selected run.
        //
        // Read EVERY colour before writing ANY, in two passes. Colour is
        // inherited, so transparentising a parent inside a single loop
        // makes each later child read back the already-hidden value —
        // which stores transparent as the "real" colour and restores
        // nothing.
        const realInk = nodes.map((n) => getComputedStyle(n).color);
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const saved = { op: node.style.getPropertyValue("opacity"),
                ink: node.style.getPropertyValue("--nod-ink") };
            for (const p in INK) saved[p] = node.style.getPropertyValue(p);
            inkSaved.push([node, saved]);
            node.style.setProperty("--nod-ink", realInk[i]);
            for (const p in INK) node.style.setProperty(p, INK[p], "important");
            // Replaced content has no "ink" property to neutralise.
            if (node !== el && node.matches && node.matches(REPLACED)) {
                node.style.setProperty("opacity", "0", "important");
            }
        }
        // Contain the negative-z canvas so it stays behind this element's
        // text but never slips behind an ancestor's background.
        el.style.isolation = "isolate";
        canvas.style.zIndex = "-1";
    };

    const showHostInk = () => {
        el.style.visibility = "";
        el.removeAttribute("data-nodality-ink");
        if (!inkSaved) return;
        for (const [node, saved] of inkSaved) {
            for (const p in INK) {
                if (saved[p]) node.style.setProperty(p, saved[p]);
                else node.style.removeProperty(p);
            }
            if (saved.op) node.style.setProperty("opacity", saved.op);
            else node.style.removeProperty("opacity");
            if (saved.ink) node.style.setProperty("--nod-ink", saved.ink);
            else node.style.removeProperty("--nod-ink");
        }
        inkSaved = null;
        el.style.isolation = "";
        canvas.style.zIndex = "";
    };

    // Phase T2. WHO presents: the canvas while a transition is running,
    // the real DOM once it completes. They are alternatives, never both.
    //
    // This has to be one function called from everywhere, because the
    // snapshot path hides ink on EVERY capture completion — and a capture
    // can land long after the transition has finished (a resize, a late
    // image load, a refresh()). When that happened after t reached 1 the
    // ink was hidden again while the canvas was already down, and the
    // element vanished. It only reproduced on a real browser: headless
    // finishes its single capture before anything can scrub.
    //
    // Returns true when it took ownership, so callers know to stand down.
    // Re-asserted EVERY FRAME rather than only on the events that change
    // it, because at least three other subsystems write the same state
    // for their own reasons and the last writer wins:
    //
    //   - snapshotCapture() calls showHostInk() before serialising, so
    //     the capture sees real ink rather than the transparent version;
    //   - its completion hides the ink again;
    //   - the live -> snapshot fallback rewrites canvas.style.cssText
    //     wholesale, discarding `visibility: hidden` along with it.
    //
    // Any of those can land after a transition completes and leave the
    // element hidden behind an already-hidden canvas, which is exactly
    // the "it disappears at t=1" report. Ordering fixes kept missing a
    // path; a cheap idempotent re-assert cannot. Two property reads per
    // frame, and only in transition mode.
    const syncTransitionView = () => {
        if (!transition) return false;
        const done = progress >= 1;
        // Standing the canvas down at t=1 assumes it OVERLAYS the content,
        // so hiding it reveals the real element underneath. That is true
        // of the snapshot backend, but the live backend MOVES the
        // element's children into the canvas (canvas.appendChild(wrap)) —
        // there the canvas is where the content lives, and hiding it hides
        // the very thing being handed over to.
        //
        // The test is `sourceEl !== el`, not `mode === "live"`. A live
        // pipeline only restructures when it actually needs the live
        // upload; a transition draws from the two frozen captures instead,
        // so it stays an overlay even on a live-capable browser. Keying
        // off the mode suppressed ink suppression on every such browser.
        const hostsContent = sourceEl !== el;
        // A morph owns the screen strictly BETWEEN its endpoints. At t=1
        // the new element takes over; opting in with `standDownAtStart`
        // makes t=0 symmetric, so the OLD element presents there — real,
        // clickable, selectable — instead of a picture of itself. Opt-in
        // because the library cannot supply the old element: it belongs to
        // the caller, who must put it back. Without it, t=0 keeps showing
        // the old capture, which is the right default for a morph that is
        // about to run.
        const atStart = transition.standDownAtStart && progress <= 0;
        const wantVis = (done || atStart) && !hostsContent ? "hidden" : "visible";
        if (canvas.style.visibility !== wantVis) canvas.style.visibility = wantVis;
        if (done) {
            if (inkSaved) showHostInk();
        } else if (!inkSaved) {
            hideHostInk();
        }
        return true;
    };

    const snapshotCapture = () => {
        // Overlay + image content: use the image directly as the texture.
        if (isOverlay) {
            const im = contentImg();
            if (im) {
                try {
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
                    finishUpload();
                    textureReady = true;
                    return Promise.resolve();
                } catch (e) {
                    // Cross-origin taint -> fall through to snapshot.
                }
            } else if (!imgListenerBound) {
                // Image not decoded yet: recapture once it loads.
                const im2 = (el.tagName === "IMG") ? el : (el.querySelector && el.querySelector("img"));
                if (im2) {
                    imgListenerBound = true;
                    im2.addEventListener("load", () => { if (!destroyed) snapshotCapture(); }, { once: true });
                }
            }
        }
        canvas.style.display = "none";
        showHostInk();
        const p = snapshotToImage(el, rect.width, rect.height, dpr)
            .then((img) => {
                if (destroyed) return;
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                finishUpload();
                textureReady = true;
                // A pure-overlay chain leaves the host alone; the lens
                // floats over untouched content. Otherwise the canvas
                // carries the look and the host's own ink is suppressed.
                // In transition mode progress decides this, not the
                // capture — see syncTransitionView.
                if (!syncTransitionView()) {
                    if (!pureOverlay) hideHostInk();
                    canvas.style.visibility = "visible";
                }
            })
            .catch((e) => {
                showHostInk();
                console.warn("[nodality] raster snapshot failed:", e);
            });
        canvas.style.display = "";
        return p;
    };

    // Live uploads are driven by the canvas `paint` event, per the
    // HTML-in-Canvas origin trial: it fires whenever the nested subtree
    // renders or redraws. Uploading outside of it yields an empty
    // (fully transparent) texture — which looks like a blank box.
    //
    // The trial's texElementImage2D signature has drifted across Chrome
    // builds (the element parameter has moved as the arg list shrank),
    // so the working call form is discovered at runtime — guided by the
    // function's declared arity — and cached after the first success.
    let liveForm = -1;
    const onPaint = () => {
        if (destroyed || mode !== "live") return;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // Confirmed signature in Chrome 148+ (origin trial):
        //   texElementImage2D(target, internalformat, element)
        // where internalformat must be a *sized* WebGL2 format
        // (RGBA8 / SRGB8_ALPHA8 / RGBA16F / RGBA32F) — not gl.RGBA.
        const RGBA8 = gl.RGBA8 || 0x8058;
        const forms = [
            [gl.TEXTURE_2D, RGBA8, sourceEl],                                 // 0 confirmed Chrome 148+
            [gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceEl], // 1 explainer/blog form
            [gl.TEXTURE_2D, 0, RGBA8, sourceEl],                              // 2 (target, level, internalformat, element)
            [gl.TEXTURE_2D, 0, sourceEl],                                     // 3 (target, level, element)
        ];
        let order;
        if (liveForm >= 0) {
            order = [liveForm];
        } else {
            order = [0, 1, 2, 3];
            const byArity = { 3: 0, 6: 1, 4: 2 }[gl.texElementImage2D.length];
            if (byArity != null) {
                order.splice(order.indexOf(byArity), 1);
                order.unshift(byArity);
            }
        }
        const errs = [];
        for (const i of order) {
            try {
                gl.texElementImage2D.apply(gl, forms[i]);
                finishUpload();
                if (liveForm < 0) {
                    liveForm = i;
                    console.info("[nodality] texElementImage2D signature discovered: form",
                        i, "(declared arity " + gl.texElementImage2D.length + ")");
                }
                textureReady = true;
                return;
            } catch (e) {
                errs.push("form" + i + " -> " + (e && e.name ? e.name : "?") + ": " +
                    (e && e.message ? e.message : e));
            }
        }
        fallbackToSnapshot("texElementImage2D rejected all known signatures (arity " +
            gl.texElementImage2D.length + "): " + errs.join(" | "));
    };

    // If the live path misbehaves (API surface drift, paint event never
    // firing), never leave a blank box behind: undo the restructuring
    // and continue with the portable snapshot backend.
    const fallbackToSnapshot = (reason) => {
        if (destroyed || mode !== "live") return;
        mode = "snapshot";
        console.warn("[nodality] live raster backend failed (" + reason + ") - falling back to snapshot.");
        canvas.removeEventListener("paint", onPaint);
        while (sourceEl.firstChild) el.appendChild(sourceEl.firstChild);
        if (sourceEl.parentNode === canvas) canvas.removeChild(sourceEl);
        canvas.removeAttribute("layoutsubtree");
        canvas.style.cssText =
            "position:absolute;top:0;left:0;" +
            `width:${rect.width}px;height:${rect.height}px;` +
            "pointer-events:none;z-index:2147483000;";
        canvas.setAttribute("aria-hidden", "true");
        canvas.setAttribute("data-nodality-raster", "snapshot-fallback");
        snapshotCapture();
    };

    if (live) {
        canvas.addEventListener("paint", onPaint);
        setTimeout(() => {
            if (!destroyed && mode === "live" && !textureReady) {
                fallbackToSnapshot("no paint event within 1500ms");
            }
        }, 1500);
    }

    // Pointer -> u_mouse (listen on the host so the overlay stays
    // pointer-events: none).
    let mouse = [canvas.width * 0.5, canvas.height * 0.5];
    // Set by a real pointer event, cleared once the solvers have consumed
    // it. Stateful ops splat only while this is true, so nothing is stirred
    // by the element resizing or scrolling under a stationary pointer.
    let pointerMoved = false;
    const onMove = (e) => {
        const r = canvas.getBoundingClientRect();
        const pt = e.touches ? e.touches[0] : e;
        const next = [(pt.clientX - r.left) * dpr, (pt.clientY - r.top) * dpr];
        // Guard against move events that report the same position.
        if (next[0] !== mouse[0] || next[1] !== mouse[1]) pointerMoved = true;
        mouse = next;
    };
    el.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });

    // Driver inputs beyond the pointer. hoverTarget flips on enter/leave
    // and `hover` eases toward it, so a hover-driven op resolves away
    // smoothly instead of snapping off.
    let hoverTarget = 0, hover = 0;
    const onEnter = () => { hoverTarget = 1; };
    const onLeave = () => { hoverTarget = 0; };
    el.addEventListener("mouseenter", onEnter, { passive: true });
    el.addEventListener("mouseleave", onLeave, { passive: true });

    // Which nodes need a driver evaluated, and with what.
    const driverNodes = [];
    rasterNodes.forEach((node, i) => {
        const def = REGISTRY[node.op] || {};
        const name = node.by || def.defaultDriver;
        if (name && DRIVERS[name]) driverNodes.push({ i, fn: DRIVERS[name] });
        else if (node.by) {
            console.warn("[nodality] unknown driver '" + node.by + "' on op '" +
                node.op + "' - known drivers: " + DRIVER_NAMES.join(", "));
        }
    });

    // How far the element has travelled across the viewport, 0..1.
    const scrollProgress = () => {
        if (typeof window === "undefined") return 0.5;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        return Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
    };

    // Render loop — paused while off-screen.
    let raf = 0;
    // The last frame's uniform values, so the phase-I1 probe pass can
    // reproduce that exact frame on the probe program. Null until the
    // first draw — sourceAt() reports "not ready" rather than guessing.
    let lastSnap = null;

    /** Write a frame snapshot to whichever program `Uq` resolves against. */
    const applyUniforms = (Uq, s) => {
        gl.uniform2f(Uq("u_res"), s.res[0], s.res[1]);
        gl.uniform2f(Uq("u_mouse"), s.mouse[0], s.mouse[1]);
        gl.uniform1f(Uq("u_time"), s.time);
        gl.uniform1f(Uq("u_t"), s.t);
        for (const d of s.drivers) {
            gl.uniform2f(Uq(`u${d.i}_dpos`), d.x, d.y);
            gl.uniform1f(Uq(`u${d.i}_damt`), d.amt);
        }
        for (const d of s.dyn) {
            for (const u of d.ups) setUniform(Uq(`u${d.i}_${u.name}`), u.kind, u.value);
        }
        // Content on unit 0, then each solver's named result textures
        // (velocity, dye, ...) on units above it.
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(Uq("u_tex"), 0);
        let unit = 1;
        if (transition && oldTex) {
            // Phase T2. The frozen old capture, and the box both sides
            // are drawn into — lerped by progress, in device px.
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, oldTex);
            gl.uniform1i(Uq("u_old"), unit);
            unit++;
            // Each side interpolates in its own rect. `oldTo` is where
            // the outgoing element travels to (default: the new rect, so
            // they converge), `newFrom` where the incoming one starts
            // from (default: the old rect). Supplying both is how you get
            // "old exits left while new enters from the right".
            const t = s.t;
            const lerpBox = (from, to) => [
                (from.x + (to.x - from.x) * t) * dpr,
                (from.y + (to.y - from.y) * t) * dpr,
                (from.w + (to.w - from.w) * t) * dpr,
                (from.h + (to.h - from.h) * t) * dpr,
            ];
            const oldBox = lerpBox(transition.oldRect,
                transition.oldTo || transition.newRect);
            const newBox = lerpBox(transition.newFrom || transition.oldRect,
                transition.newRect);
            gl.uniform4f(Uq("u_boxOld"), oldBox[0], oldBox[1], oldBox[2], oldBox[3]);
            gl.uniform4f(Uq("u_boxNew"), newBox[0], newBox[1], newBox[2], newBox[3]);
            if (newTex) {
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, newTex);
                gl.uniform1i(Uq("u_newimg"), unit);
                unit++;
            }
        }
        for (const so of solverOps) {
            const smps = so.def.solver.samplers;
            for (const key in smps) {
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, so.targets[smps[key]].a.tex);
                gl.uniform1i(Uq(`u${so.i}_${key}`), unit);
                unit++;
            }
        }
        gl.activeTexture(gl.TEXTURE0); // texture uploads assume unit 0
    };

    // ── Phase I1: coordinate readback ────────────────────────────────
    //
    // The overlay canvas is pointer-events:none and the DOM underneath
    // stays where layout put it, so once a warp displaces content, a link
    // is clickable where it is NOT drawn. Fixing that needs one fact:
    // given a screen point, which source pixel is shown there?
    //
    // The shader already computes it — output pixel -> sampleP -> fetch.
    // So rather than reimplement each op's arithmetic on the CPU (which
    // could silently disagree with what is drawn, and is impossible for
    // `stir`, a fluid sim with no closed form), run the SAME chain and
    // read the answer back.
    //
    // Cost is one draw of a single fragment plus a 1-pixel readPixels.
    // Built on first use, so a page that never hit-tests pays nothing.
    let probe = null;
    const buildProbe = () => {
        if (probe) return probe;
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER,
            buildFragmentShader(rasterTree, rasterNodes, true, transition)));
        gl.bindAttribLocation(p, 0, "a");
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            console.warn("[nodality] probe program failed:", gl.getProgramInfoLog(p));
            gl.deleteProgram(p);
            probe = { broken: true };
            return probe;
        }
        // One pixel is the entire render target: the viewport is offset so
        // that the queried pixel is the only one rasterised.
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (st !== gl.FRAMEBUFFER_COMPLETE) {
            console.warn("[nodality] probe framebuffer incomplete:", st);
            gl.deleteProgram(p); gl.deleteFramebuffer(fbo); gl.deleteTexture(t);
            probe = { broken: true };
            return probe;
        }
        const cache = {};
        const Up = (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n)));
        // The chain's static op uniforms, on this program too.
        gl.useProgram(p);
        applyStaticUniforms(Up);
        gl.useProgram(prog);
        probe = { prog: p, fbo, tex: t, px: new Uint8Array(4), U: Up };
        return probe;
    };

    /**
     * Which source pixel is drawn at this point on screen?
     *
     * @param {number} clientX viewport coordinate, as on a PointerEvent
     * @param {number} clientY
     * @returns {{x: number, y: number} | null} the point in CLIENT
     *   coordinates that the content visible at (clientX, clientY) came
     *   from — feed it straight to document.elementFromPoint(). Null if
     *   nothing has been drawn yet, the point is outside the canvas, or
     *   the probe could not be built.
     *
     * Caveat, documented rather than hidden: `copy` draws several stamps,
     * so one screen point genuinely maps to several sources. This returns
     * the primary sample. Phase I4 classifies that case.
     */
    // ── Phase I2: the CPU path ───────────────────────────────────────
    //
    // A GPU readback is a pipeline sync, which is fine per click and too
    // expensive per pointermove. An op may declare `map` — the same
    // coordinate arithmetic its GLSL does, in JS — and a chain whose
    // coordinate-moving ops all declare one is answered without touching
    // the GPU.
    //
    // The duplication is safe only because I1 exists to check it: the
    // property test asserts twin and readback agree across the parameter
    // space. A twin that drifts from its shader is caught, not trusted.
    //
    // Bails to null — meaning "ask the GPU" — for anything it cannot do
    // faithfully:
    //   - an op in a coordinate stage with no `map` and no explicit
    //     `movesCoords: false` (flow, stir)
    //   - a `map` that declines (hexalize with lift)
    //   - any MASKED op, because its effect is lerped by a field this
    //     path does not evaluate
    const COORD_STAGES = ["warp", "cell", "displace"];
    const cpuSourceAt = (px, py) => {
        if (!lastSnap) return null;
        const byIndex = {};
        for (const d of lastSnap.drivers) byIndex[d.i] = d;
        let pt = [px, py];
        for (const stage of COORD_STAGES) {
            for (let i = 0; i < rasterNodes.length; i++) {
                const node = rasterNodes[i];
                const def = REGISTRY[node.op];
                if (!def) continue;
                const stages = Array.isArray(def.stage) ? def.stage : [def.stage];
                if (!stages.includes(stage)) continue;
                if (maskedField(node)) return null;
                if (typeof def.map !== "function") {
                    if (def.movesCoords === false) continue;
                    return null;
                }
                const d = byIndex[i];
                const out = def.map(pt, node, {
                    res: lastSnap.res,
                    dpr,
                    dpos: d ? [d.x, d.y] : [lastSnap.res[0] / 2, lastSnap.res[1] / 2],
                    damt: d ? d.amt : 1,
                    time: lastSnap.time,
                    mouse: lastSnap.mouse,
                });
                if (!out) return null;
                pt = out;
            }
        }
        return pt;
    };

    /**
     * @param {object} [opts]
     * @param {boolean} [opts.gpu] force the readback path, skipping any
     *        declared CPU twin. This is the oracle the twins are checked
     *        against — a `map` that drifted from its shader would
     *        otherwise be undetectable, since both paths would be asked
     *        the same question and only one of them consulted.
     */
    const sourceAt = (clientX, clientY, opts) => {
        if (destroyed || !lastSnap || !textureReady) return null;

        const rect = canvas.getBoundingClientRect();
        if (rect.width && rect.height && !(opts && opts.gpu)) {
            // Try the CPU path first — same answer, no pipeline sync.
            const sxc = canvas.width / rect.width, syc = canvas.height / rect.height;
            const dx = (clientX - rect.left) * sxc, dy = (clientY - rect.top) * syc;
            if (dx >= 0 && dy >= 0 && dx < canvas.width && dy < canvas.height) {
                // The SAME pixel-centre convention the readback uses: floor
                // to a pixel, then take its centre. Without this the two
                // paths ask about points up to half a pixel apart, which is
                // invisible for most ops and enormous for `offset` near its
                // focus, where dir = (warped - dpos)/d is a singularity.
                const fx = Math.floor(dx);
                const fy = Math.floor(canvas.height - dy);
                const cpu = cpuSourceAt(fx + 0.5, canvas.height - fy - 0.5);
                if (cpu) {
                    return {
                        x: rect.left + Math.min(Math.max(cpu[0], 0), canvas.width) / sxc,
                        y: rect.top + Math.min(Math.max(cpu[1], 0), canvas.height) / syc,
                    };
                }
            }
        }

        const pr = buildProbe();
        if (pr.broken) return null;

        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        // Client -> canvas device pixels. The canvas may be scaled by CSS,
        // so go through the rect rather than assuming dpr.
        const sx = canvas.width / r.width, sy = canvas.height / r.height;
        const px = (clientX - r.left) * sx;
        const py = (clientY - r.top) * sy;
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;

        // gl_FragCoord is bottom-up; `py` is top-down.
        const fx = Math.floor(px);
        const fy = Math.floor(canvas.height - py);

        gl.bindFramebuffer(gl.FRAMEBUFFER, pr.fbo);
        gl.useProgram(pr.prog);
        // The whole target is one pixel; the shader reads the coordinate
        // it is standing in for from u_probe rather than gl_FragCoord.
        gl.viewport(0, 0, 1, 1);
        gl.uniform2f(pr.U("u_probe"), fx, fy);
        applyUniforms(pr.U, lastSnap);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pr.px);

        // Restore what draw() expects to find.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(prog);
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Two bytes per axis, as packed in the probe tail.
        const b = pr.px;
        const qx = (b[0] + b[1] / 255) / 255;
        const qy = (b[2] + b[3] / 255) / 255;
        // Device px (top-down) -> client coordinates.
        return {
            x: r.left + (qx * canvas.width) / sx,
            y: r.top + (qy * canvas.height) / sy,
        };
    };

    // ── Phase I3: event retargeting ──────────────────────────────────
    //
    // With I1 able to say where a pixel came from, the fix is mechanical:
    // catch pointer events on the host in the CAPTURE phase (before they
    // reach the element the browser picked), ask where the content under
    // the cursor actually lives, and re-dispatch there.
    //
    // Honest boundary, stated because it cannot be fixed from here: CSS
    // `:hover` and `:active` are computed by the browser from the real
    // pointer position over the real box. A synthetic MouseEvent does not
    // move them. So JS handlers retarget correctly and CSS pseudo-classes
    // still follow the undisplaced layout. Retargeting those would mean
    // moving the DOM, which is the one thing this library promises not to
    // do. Focus and keyboard were never wrong — they never went through
    // coordinates.
    const RETARGET = "__nodalityRetargeted";
    // Opt out per pipeline, like `live: false`. An effect used as pure
    // decoration should not pay for a GPU readback per click.
    const interactive = !rasterNodes.some((n) => n.interactive === false);

    // Phase I3c. CSS :hover is computed by the browser from the real
    // pointer over the real box, and a synthetic MouseEvent does not move
    // it — so on a displaced element the wrong thing lights up. It CAN be
    // mirrored: track the hovered ancestor chain at the SOURCE position
    // and mark it with an attribute the page can style.
    //
    //   { op: "flow", hoverAttr: true }   →  [data-nodality-hover]
    //
    // OPT-IN, and this is the reason: writing that attribute is a DOM
    // mutation, and this library's headline property is that an effect
    // never touches the host subtree — asserted with a MutationObserver
    // in the e2e suite. Turning it on trades that property for hover
    // fidelity, so it must be the page's decision, not a default. Page
    // authors also have to write `[data-nodality-hover]` rather than
    // `:hover`, which is a real cost.
    const HOVER_ATTR = "data-nodality-hover";
    const hoverMirror = rasterNodes.some((n) => n.hoverAttr === true);
    let hoverChain = [];
    const setHoverChain = (target) => {
        const next = [];
        for (let n = target; n && n !== el.parentNode; n = n.parentElement) next.push(n);
        const keep = new Set(next);
        for (const n of hoverChain) if (!keep.has(n)) n.removeAttribute(HOVER_ATTR);
        for (const n of next) if (!n.hasAttribute(HOVER_ATTR)) n.setAttribute(HOVER_ATTR, "");
        hoverChain = next;
    };

    /** Build an event of the same kind, at corrected coordinates. */
    const cloneAt = (e, x, y) => {
        const Ctor = (typeof PointerEvent !== "undefined" && e instanceof PointerEvent)
            ? PointerEvent
            : MouseEvent;
        const ev = new Ctor(e.type, {
            bubbles: true, cancelable: e.cancelable, composed: true,
            view: e.view || (typeof window !== "undefined" ? window : null),
            detail: e.detail,
            clientX: x, clientY: y,
            // Keep screen coords consistent with the shift we applied.
            screenX: e.screenX + (x - e.clientX),
            screenY: e.screenY + (y - e.clientY),
            ctrlKey: e.ctrlKey, altKey: e.altKey,
            shiftKey: e.shiftKey, metaKey: e.metaKey,
            button: e.button, buttons: e.buttons,
            relatedTarget: e.relatedTarget,
            // Ignored by MouseEvent, meaningful for PointerEvent.
            pointerId: e.pointerId, pointerType: e.pointerType,
            isPrimary: e.isPrimary, pressure: e.pressure,
        });
        ev[RETARGET] = true;
        return ev;
    };

    // A GPU readback per pointermove would be one sync per frame. Moves
    // are throttled to one probe per animation frame; clicks are rare and
    // always probed. Phase I2 removes the sync for ops that can declare
    // their coordinate math on the CPU.
    let lastMoveProbe = 0;

    /**
     * Hit-test the canvas-hosted subtree by hand.
     *
     * `document.elementFromPoint` cannot see content the LIVE backend
     * hosts. To be uploaded as a texture the content has to live inside
     * the <canvas>, where it is canvas fallback content: laid out, but
     * never painted into the page. The browser's hit test therefore walks
     * straight past it and lands on the canvas itself, which is why every
     * control inside a live pipeline used to be dead.
     *
     * The boxes are real, though — a back button inside a live morph
     * reports its true 88x28 rect — so they can be tested directly. That
     * is the whole trick: layout is available, only painting and hit
     * testing are not, and hit testing is the part we can replace.
     *
     * Deepest match wins, which is what the browser does: a <span> inside
     * a <button> resolves to the span, and the dispatched event then
     * bubbles to the button exactly as a real click would. Among siblings
     * the last match wins, which approximates paint order for the
     * ordinary, non-z-indexed case.
     */
    const hostedElementAt = (x, y) => {
        let found = null;
        const walk = (node) => {
            for (const child of node.children) {
                const r = child.getBoundingClientRect();
                if (!r.width || !r.height) continue;
                if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
                found = child;
                walk(child);
            }
        };
        walk(sourceEl);
        return found;
    };

    const onRetarget = (e) => {
        if (!interactive || destroyed || e[RETARGET]) return;
        if (e.type === "pointermove" || e.type === "mousemove") {
            const t = (typeof performance !== "undefined") ? performance.now() : 0;
            if (t - lastMoveProbe < 12) return;
            lastMoveProbe = t;
        }
        const s = sourceAt(e.clientX, e.clientY);
        if (!s) return;
        // Where the content lives inside the canvas there is no native hit
        // testing to defer to, displaced or not — so this shortcut has to
        // be skipped. It is why a live morph stayed dead even after it
        // settled: at rest the shader presents 1:1, the displacement is
        // zero, and every event took this early return.
        const hosted = sourceEl !== el;
        // Nothing moved here: let the browser's own hit-testing stand.
        if (!hosted &&
            Math.abs(s.x - e.clientX) < 0.5 && Math.abs(s.y - e.clientY) < 0.5) return;

        // Returns null when the source lands outside the VIEWPORT — an
        // element scrolled half off-screen whose displacement pushes the
        // source past the edge. Declining is the right answer there: the
        // native hit stands, rather than dispatching somewhere wrong.
        const target = hosted
            ? hostedElementAt(s.x, s.y)
            : typeof document.elementFromPoint === "function"
            ? document.elementFromPoint(s.x, s.y)
            : null;
        // Only ever redirect INTO our own subtree. A displacement that
        // resolves outside the host is a bug or an edge case, and
        // dispatching into unrelated page content would be worse than
        // doing nothing.
        if (!target || target === e.target || !el.contains(target)) return;

        // Hover, if the page opted in. Done for moves as well as clicks,
        // since that is when hover state changes.
        if (hoverMirror) setHoverChain(target);

        // Phase I3b. Focus follows the pointer to the element that was
        // actually clicked. Without this, clicking a displaced link moves
        // focus to whatever sits under the cursor in the undisplaced
        // layout — so the picture, the click and the focus ring disagree.
        // Only on activating events: a pointermove must not steal focus.
        if (e.type === "pointerdown" || e.type === "mousedown" || e.type === "click") {
            const focusable = target.closest &&
                target.closest("a, button, input, select, textarea, [tabindex]");
            if (focusable && typeof focusable.focus === "function") {
                focusable.focus({ preventScroll: true });
            }
        }

        // Stop the original in the capture phase so the element the
        // browser picked never sees it, then deliver the corrected one.
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        target.dispatchEvent(cloneAt(e, s.x, s.y));
    };

    const RETARGET_EVENTS = ["pointerdown", "pointerup", "pointermove", "click",
        "dblclick", "contextmenu", "mousedown", "mouseup"];
    // Leaving the element must clear the mirrored hover, or it sticks.
    const onRetargetLeave = () => { if (hoverMirror) setHoverChain(null); };
    if (interactive) {
        for (const t of RETARGET_EVENTS) el.addEventListener(t, onRetarget, true);
        el.addEventListener("pointerleave", onRetargetLeave, true);
    }

    let visible = true;
    const draw = () => {
        if (destroyed) return;
        // Self-healing: whatever else touched the ink or the canvas since
        // the last frame, progress is the authority.
        syncTransitionView();
        if (visible && textureReady) {
            const now = (typeof performance !== "undefined") ? performance.now() : lastFrame + 16;
            const dt = Math.max(0, (now - lastFrame) / 1000);

            // 1. Advance stateful fluid solvers into their own off-screen
            //    targets (this rebinds framebuffer/program/textures).
            for (const s of solverOps) stepSolver(s, dt);
            // Consumed for this frame: a splat needs a fresh pointer event,
            // not merely a pointer position that happens to differ because
            // the canvas moved or resized beneath it.
            pointerMoved = false;

            // 2. Composite pass, back on the visible framebuffer.
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.useProgram(prog);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            // Everything the frame needs, computed ONCE, then written to
            // a program. Split this way for phase I1: the probe pass has
            // to reproduce this frame on a different program, and both
            // the hover easing above and `tick()` below MUTATE — running
            // them again for a hit-test would advance every animation by
            // an extra step per pointer event.
            const snap = {
                res: [canvas.width, canvas.height],
                mouse: [mouse[0], mouse[1]],
                time: now / 1000,
                t: progress,
                drivers: [],
                dyn: [],
            };
            if (driverNodes.length > 0) {
                hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 8));
                const dctx = {
                    mouseX: mouse[0], mouseY: mouse[1],
                    w: canvas.width, h: canvas.height,
                    t: now / 1000, hover, scroll: scrollProgress(),
                };
                for (const d of driverNodes) {
                    const v = d.fn(dctx);
                    snap.drivers.push({ i: d.i, x: v.x, y: v.y, amt: v.amt });
                }
            }
            if (dynamicOps.length > 0) {
                const ctx = { w: canvas.width, h: canvas.height, mouseX: mouse[0], mouseY: mouse[1], dt: dt, t: now / 1000 };
                for (const d of dynamicOps) {
                    snap.dyn.push({ i: d.i, ups: d.def.tick(d.state, ctx) });
                }
            }
            lastSnap = snap;
            applyUniforms(U, snap);
            lastFrame = now;
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        raf = requestAnimationFrame(draw);
    };

    let io = null;
    if (typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
        io.observe(el);
    }

    let ro = null;
    let resizeTimer = 0;
    // Re-measure the host and capture again. Shared by the
    // ResizeObserver, the window-resize fallback and the font-loading
    // recapture, so all three agree on what "resize the canvas" means.
    const remeasureAndCapture = () => {
        if (destroyed) return;
        const m = measure();
        if (m.width < 2 || m.height < 2) return;
        const bw = Math.round(m.width * dpr);
        const bh = Math.round(m.height * dpr);
        rect.width = m.width;
        rect.height = m.height;
        canvas.style.width = m.width + "px";
        canvas.style.height = m.height + "px";
        // Re-allocating the buffer clears it, so skip when it already matches
        // — syncCanvasBox may have kept the CSS box in step without needing a
        // new buffer at all.
        const bufferStale = canvas.width !== bw || canvas.height !== bh;
        if (bufferStale) {
            canvas.width = bw;
            canvas.height = bh;
        }
        if (mode === "snapshot") {
            snapshotCapture();
        } else if (bufferStale) {
            // Live mode re-uploads from the DOM every paint, so it needs no
            // recapture — only a fresh upload at the new buffer size.
            onPaint();
        }
    };

    // Match the canvas box to the host immediately, without recapturing.
    // Re-uploading the texture is the expensive half and stays debounced;
    // resizing the element is cheap and must not be, because a host that is
    // being animated (a scroll-driven hero expanding every frame) would
    // otherwise render up to a debounce-interval behind its own layout —
    // the canvas visibly trailing the content it is drawn over.
    // CSS size only. Assigning canvas.width/height re-allocates the drawing
    // buffer and CLEARS it, so doing that per frame while an element is being
    // animated makes the whole effect flash on every scroll step. The buffer
    // is left to the debounced recapture below; stretching the existing one
    // for a few frames costs a little sharpness and nothing else.
    const syncCanvasBox = () => {
        if (destroyed) return;
        const m = measure();
        if (m.width < 2 || m.height < 2) return;
        if (Math.round(m.width) === Math.round(rect.width) &&
            Math.round(m.height) === Math.round(rect.height)) return;
        rect.width = m.width;
        rect.height = m.height;
        canvas.style.width = m.width + "px";
        canvas.style.height = m.height + "px";
    };

    if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => {
            // SNAPSHOT ONLY. In live mode the host's children have moved
            // inside the canvas, so the canvas is the host's only in-flow
            // child and the host's height is padding + canvas + padding.
            // Measuring the host to size the canvas is therefore circular:
            // every observation adds the padding back, resizes the canvas,
            // and re-triggers this observer. A 98px two-column panel walked
            // to ~4000px on load, growing by its own padding each pass.
            //
            // The live path is handled by onWinResize, which measures the
            // SUBTREE inside the canvas rather than the host — the one
            // measurement that is not downstream of the value being set.
            //
            // Guarded on the current mode rather than by not observing at
            // all, so a mid-session fallbackToSnapshot re-enables it with
            // no re-observation.
            if (mode === "live") return;
            syncCanvasBox();
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(remeasureAndCapture, 150);
        });
        ro.observe(el);
    }

    // Window-resize handling for both modes. This backs up the
    // ResizeObserver above: RO callbacks ride the rendering frame loop
    // and stall in backgrounded tabs, while the resize event always
    // fires. Snapshot mode re-measures the host and recaptures. Live
    // mode is RO-blind anyway (the host is collapsed; its children live
    // inside the canvas): widen the canvas to the host's flow width,
    // let the subtree reflow, then fit the height and re-upload.
    let winResizeTimer = 0;
    const onWinResize = () => {
        clearTimeout(winResizeTimer);
        winResizeTimer = setTimeout(() => {
            if (destroyed) return;
            if (mode === "snapshot") { remeasureAndCapture(); return; }
            const w = el.clientWidth ||
                (el.parentElement && el.parentElement.clientWidth) || rect.width;
            canvas.style.width = w + "px";
            setTimeout(() => {
                if (destroyed || mode !== "live") return;
                const h = Math.max(2, Math.round(sourceEl.getBoundingClientRect().height)) || rect.height;
                rect.width = w;
                rect.height = h;
                canvas.style.height = h + "px";
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
                onPaint(); // fresh upload at the new size
            }, 50);
        }, 150);
    };
    if (typeof window !== "undefined") {
        window.addEventListener("resize", onWinResize);
    }

    if (mode === "live") {
        // Texture arrives via the paint event; start drawing right away.
        raf = requestAnimationFrame(draw);
    } else {
        snapshotCapture().then(() => { raf = requestAnimationFrame(draw); });
        // A web font that arrives after the first capture changes glyph
        // metrics, and therefore line breaking: the snapshot would keep
        // whatever the fallback font wrapped to while the DOM underneath
        // reflows to something else. The element box does not necessarily
        // change, so the ResizeObserver never fires and the mismatch
        // persists until an unrelated resize. Capture once more when the
        // fonts settle.
        if (typeof document !== "undefined" && document.fonts &&
            typeof document.fonts.ready === "object") {
            Promise.resolve(document.fonts.ready)
                .then(remeasureAndCapture)
                .catch(() => {});
        }
    }

    // A param change is DATA changing, and more than one thing may be
    // showing that data: the inspector panel, a code preview, a future node
    // editor. Whoever writes a value cannot know who else is displaying it,
    // so setParam announces rather than expecting callers to coordinate.
    //
    // A DOM CustomEvent rather than a subscriber list: consumers come and
    // go with the page, listeners unregister themselves, and nothing has to
    // hold a reference to a pipeline that may be rebuilt out from under it.
    const announce = (index, key, value, prev, how) => {
        if (typeof CustomEvent !== "function" || typeof document === "undefined") return;
        document.dispatchEvent(new CustomEvent(RASTER_PARAM_EVENT, {
            detail: { pipeline: handle, el, index, key, value, prev, how },
        }));
    };

    // ── Live introspection (phase H3) ─────────────────────────────────
    // A param is LIVE if the op reads it in uniforms() — changing it is a
    // uniform upload. It is STRUCTURAL if the op reads it in code(),
    // because that value is compiled into the GLSL and the only way to
    // change it is to build a new shader. See `structural` on each
    // registry entry; anything unrecognised rebuilds, which is the safe
    // direction to be wrong in.
    const handle = {
        canvas,
        // The FLATTENED node list — the one that owns the uniform slots,
        // so index i here is the `u<i>_` prefix in the shader and what an
        // inspector must show. Nodes nested in a `merge` appear inline.
        nodes: rasterNodes,
        get backend() { return mode; },

        // Phase I1. Where the content visible at a screen point came
        // from, in client coordinates — the input to hit-testing through
        // a displacement. Defined below, next to the probe program.
        sourceAt: (clientX, clientY, opts) => sourceAt(clientX, clientY, opts),

        // Phase T1. Transition progress. `t` is an INPUT, not a timer —
        // a timeline is one driver of it, scroll scrub and a test are
        // others. Everything downstream is a pure function of it, which
        // is what makes transitions deterministic to test and
        // interruptible for free.
        get progress() { return progress; },
        setProgress(t) {
            const next = Math.min(1, Math.max(0, Number(t) || 0));
            if (next === progress) return progress;
            progress = next;
            uploadKeyframes();
            // Phase T2, gap 1. The real NEW element is still in the tree
            // under the canvas, so without this it is visible at t=0 —
            // the morph would show the destination behind its own start
            // frame. Suppress its ink for the duration and release at
            // completion, which is also the moment the DOM becomes the
            // truth again: selection, hover and video resume on the real
            // element rather than on a picture of it.
            //
            // Driven off `progress` rather than a lifecycle callback, so
            // it stays a pure function of t (P-1) and a scrub backwards
            // out of 1 re-hides correctly.
            syncTransitionView();
            return progress;
        },

        /**
         * Change one param of one node, live where possible.
         * Returns "uniform" | "rebuild" | false (unknown node).
         */
        setParam(i, key, value) {
            const node = rasterNodes[i];
            if (!node || destroyed) return false;
            const prev = node[key];
            node[key] = value;

            if (isStructuralChange(node.op, key, value, prev)) {
                handle.rebuild();
                announce(i, key, value, prev, "rebuild");
                return "rebuild";
            }
            const def = REGISTRY[node.op];
            if (def && def.uniforms) {
                const us = def.uniforms(node, dpr);
                gl.useProgram(prog);
                for (const k in us) setUniform(U(`u${i}_${k}`), us[k][0], us[k][1]);
                // The phase-I1 probe is a SECOND program running the same
                // chain, so it needs the new value too. Without this it
                // keeps answering with the parameters it was built with —
                // and since the inspector drives setParam on every drag,
                // hit-testing would silently drift away from the picture
                // the moment anyone tuned anything.
                if (probe && !probe.broken) {
                    gl.useProgram(probe.prog);
                    for (const k in us) setUniform(probe.U(`u${i}_${k}`), us[k][0], us[k][1]);
                    gl.useProgram(prog);
                }
            }
            announce(i, key, value, prev, "uniform");
            return "uniform";
        },

        /**
         * Tear down and re-apply from the (mutated) node tree. Needed for
         * anything baked into the shader. `sourceNodes` is the ORIGINAL
         * tree, merge sub-chains and all — flattening loses that nesting,
         * and rebuilding from the flat list would silently promote a
         * merge branch to a top-level op.
         */
        rebuild() {
            if (destroyed) return null;
            const host = el;
            handle.destroy();
            return applyRasterPipeline(host, sourceNodes);
        },
    };
    ACTIVE.add(handle);
    return Object.assign(handle, {
        refresh: () => (mode === "live" ? onPaint() : snapshotCapture()),
        destroy() {
            ACTIVE.delete(handle);
            destroyed = true;
            cancelAnimationFrame(raf);
            clearTimeout(resizeTimer);
            clearTimeout(winResizeTimer);
            if (io) io.disconnect();
            if (ro) ro.disconnect();
            if (typeof window !== "undefined") window.removeEventListener("resize", onWinResize);
            el.removeEventListener("mousemove", onMove);
            el.removeEventListener("touchmove", onMove);
            // Phase I3 listeners are registered in the capture phase, so
            // they must be removed with the same flag or they leak.
            for (const t of RETARGET_EVENTS) el.removeEventListener(t, onRetarget, true);
            el.removeEventListener("pointerleave", onRetargetLeave, true);
            setHoverChain(null);   // never leave the attribute behind
            el.removeEventListener("mouseenter", onEnter);
            el.removeEventListener("mouseleave", onLeave);
            canvas.removeEventListener("paint", onPaint);
            for (const s of solverOps) {
                s.cleanup();
                for (const n in s.progs) gl.deleteProgram(s.progs[n].prog);
            }
            solverOps.length = 0;
            // The probe pass owns a program, a 1x1 texture and an FBO —
            // only allocated if something hit-tested.
            if (probe && !probe.broken) {
                gl.deleteProgram(probe.prog);
                gl.deleteFramebuffer(probe.fbo);
                gl.deleteTexture(probe.tex);
            }
            probe = null;
            if (oldTex) { gl.deleteTexture(oldTex); oldTex = null; }
            if (newTex) { gl.deleteTexture(newTex); newTex = null; }
            while (sourceEl !== el && sourceEl.firstChild) el.appendChild(sourceEl.firstChild);
            showHostInk();
            el.style.visibility = "";
            canvas.remove();
        },
    });
}

export {
    applyRasterPipeline, registerRasterOp, RASTER_OP_NAMES,
    isHTMLInCanvasAvailable, DRIVER_NAMES,
    // Phase H3. The registry is already effectively public — registerRasterOp
    // mutates it — and a dev tool needs to read an op's stage and params to
    // show them. `isStructuralChange` is exported so the inspector can label
    // a control "rebuilds" before the user drags it, rather than after.
    activeRasterPipelines, isStructuralChange, REGISTRY, RASTER_PARAM_EVENT,
    // Phase H4. The op contract, as data: the vocabularies a third-party
    // op is checked against, and the shared params every op inherits from
    // the pipeline rather than declaring itself.
    RASTER_STAGES, RASTER_UNITS, FRAMEWORK_DOC, validateRasterOp,
    // Phase T1. Keyframed params, resolved against the units an op
    // already declares.
    isKeyframed, sampleKeyframes, resolveNode,
    // Phase T3. Choreography: per-node windows and easing over progress.
    EASINGS, EASING_NAMES, localProgress,
    // Phase I4. How each op behaves under hit-testing, derived from its
    // own declarations.
    interactionClass,
    // Exported so which branch a `switch` takes can be asserted directly
    // rather than inferred from pixels.
    resolveSwitches,
};

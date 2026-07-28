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
//   live (opt-in: any raster node carries `live: true`) — the emerging
//     HTML-in-Canvas API (WICG, Chrome origin trial): the mount subtree
//     moves inside the effect <canvas layoutsubtree> and is uploaded per
//     frame with gl.texElementImage2D(), staying interactive and live.
//     Falls back to snapshot when the API is absent.
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

const MAX_BLOBS = 12;

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
        stage: "cell",
        decl: (p) => `uniform float ${p}size;`,
        code: (p) => `
        {
            vec2 hp = warped / ${p}size;
            vec2 hr = vec2(1.0, 1.7320508), hh = hr * 0.5;
            vec2 ha = mod(hp, hr) - hh, hb = mod(hp - hh, hr) - hh;
            vec2 gv = dot(ha, ha) < dot(hb, hb) ? ha : hb;
            center = (hp - gv) * ${p}size;
            gv = abs(gv);
            edge = max(edge, smoothstep(0.44, 0.5,
                max(dot(gv, normalize(vec2(1.0, 1.7320508))), gv.x)));
        }`,
        uniforms: (node, dpr) => ({ size: ["1f", (node.size || 24) * dpr] }),
    },

    offset: {
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
    },

    duotone: {
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
    // Formulation (deliberately not the usual Stable-Fluids solver):
    // the classic GPU fluid pipeline is advect + vorticity confinement +
    // a divergence/pressure Jacobi solve (Stam 1999; Harris, GPU Gems
    // 2003) — roughly ten passes. This op instead advects momentum along
    // its own flow (semi-Lagrangian backtrace, the one genuinely
    // universal piece) and then ROTATES each momentum vector by the
    // local curl angle. Rotation preserves magnitude, so eddies keep
    // spinning instead of being pushed around, and because it cannot
    // inject divergence energy the field stays stable with no pressure
    // projection at all — the whole simulation is a single pass.
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
        stage: "color",
        decl: (p) => `
            uniform float ${p}size;
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
            col = mix(${p}paper, ${p}ink, dm);
        }`,
        uniforms: (node, dpr) => ({
            size: ["1f", (node.size || 6) * dpr],
            angle: ["1f", ((node.angle != null ? node.angle : 15) * Math.PI) / 180],
            ink: ["3fv", hexToRgb(node.ink || "#0B1B2B")],
            paper: ["3fv", hexToRgb(node.paper || "#FFFFFF")],
            soft: ["1f", node.softness != null ? node.softness : 0.08],
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
    // Implemented from the published algorithm, not from any particular
    // existing codebase:
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
                const lead = chain[i - 1], node = chain[i];
                let dx = lead.x - node.x, dy = lead.y - node.y;
                const d = Math.hypot(dx, dy) || 1e-4;
                // Cap the lag so a fast flick can't tear the tube apart,
                // then ease the remainder — gives an elastic pull.
                const maxLag = state.seg;
                if (d > maxLag) { node.x += dx * (1 - maxLag / d); node.y += dy * (1 - maxLag / d); }
                node.x += (lead.x - node.x) * follow;
                node.y += (lead.y - node.y) * follow;
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

// Extension surface — mirrors the CSS-level operation registry:
// registerRasterOp("pixelate", { stage, decl, code, uniforms }).
function registerRasterOp(name, def) {
    REGISTRY[name] = def;
    if (!RASTER_OP_NAMES.includes(name)) RASTER_OP_NAMES.push(name);
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

function buildFragmentShader(recs, flat) {
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

    const buckets = emptyBuckets();
    emitStages(recs, buckets);
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
    const chromaFetch = hasChroma ? `
    vec2 cpx = vec2(chroma.x, -chroma.y) / u_res;
    col.r = texture2D(u_tex, clamp(uv + cpx, 0.001, 0.999)).r;
    col.b = texture2D(u_tex, clamp(uv - cpx, 0.001, 0.999)).b;` : "";
    return `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_time;
${decls}
void main() {
    vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
${fieldDecls}
${field}
    vec2 warped = frag;
${warp}
    vec2 center = warped;
    float edge = 0.0;
${cell}
    vec2 sampleP = warped;
    vec2 chroma = vec2(0.0);
${displace}
    vec2 uv = vec2(sampleP.x / u_res.x, 1.0 - sampleP.y / u_res.y);
    vec4 tex = texture2D(u_tex, clamp(uv, 0.001, 0.999));
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
}`;
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

function freezeViewportUnits(original, clone) {
    const origs = [original, ...original.querySelectorAll("*")];
    const clones = [clone, ...clone.querySelectorAll("*")];
    for (let i = 0; i < origs.length && i < clones.length; i++) {
        const inline = clones[i].style;
        if (!inline || inline.length === 0) continue;
        let computed = null;
        // Iterate a snapshot of the names: writing to style mutates the list.
        for (const prop of Array.from(inline)) {
            if (!VIEWPORT_UNIT.test(inline.getPropertyValue(prop))) continue;
            computed = computed || window.getComputedStyle(origs[i]);
            const px = computed.getPropertyValue(prop);
            if (px) inline.setProperty(prop, px, inline.getPropertyPriority(prop));
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
    const img = el.tagName === "IMG"
        ? el
        : (el.children && el.children.length === 1 && el.children[0].tagName === "IMG"
            ? el.children[0]
            : null);
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

function snapshotToImage(el, w, h, dpr) {
    const direct = soleImageOf(el);
    if (direct) return Promise.resolve(direct);

    return new Promise((resolve, reject) => {
        const serialized = new XMLSerializer()
            .serializeToString(freezeViewportUnits(el, el.cloneNode(true)));
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w * dpr}" height="${h * dpr}" viewBox="0 0 ${w} ${h}">` +
            `<foreignObject width="100%" height="100%">` +
            `<div xmlns="http://www.w3.org/1999/xhtml">${serialized}</div>` +
            `</foreignObject></svg>`;
        const img = new Image();
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

function applyRasterPipeline(el, rasterNodes) {
    // Hard guards — every early-out is silent by design so that jsdom
    // prerender, old browsers and reduced-motion users get the plain
    // page untouched.
    if (!el || typeof document === "undefined" || typeof window === "undefined") return null;
    if (!rasterNodes || rasterNodes.length === 0) return null;
    // Flatten any switch nodes down to the chain this device actually
    // gets, before anything reads the list.
    if (rasterNodes.some((n) => n && n.op === "switch")) {
        rasterNodes = resolveSwitches(rasterNodes, 0);
        if (rasterNodes.length === 0) return null;
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
    const measure = () => {
        const r = el.getBoundingClientRect();
        return {
            width: Math.max(r.width, el.scrollWidth || 0),
            height: Math.max(r.height, el.scrollHeight || 0),
        };
    };
    const rect = measure();
    if (rect.width < 2 || rect.height < 2) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isOverlay = rasterNodes.some((n) => (REGISTRY[n.op] || {}).overlay);
    // Stacking: a pipeline may mix in-place ops (hexalize/offset/duotone/
    // edges) with an overlay op (blobs). The single shader composites them
    // in one pass, but the HOST visibility differs — only a PURELY overlay
    // chain leaves the host visible (the lens refracts untouched content).
    // The moment an in-place op joins, the canvas fully carries the look,
    // so the host must be hidden or the original content ghosts through.
    const pureOverlay = rasterNodes.every((n) => (REGISTRY[n.op] || {}).overlay);
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
    const wantLive = !pureOverlay && !rasterNodes.some((n) => n.live === false);
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
        wrap.style.cssText =
            `display:block;width:${rect.width}px;height:${rect.height}px;`;
        while (el.firstChild) wrap.appendChild(el.firstChild);
        canvas.appendChild(wrap);
        sourceEl = wrap;
        // The host collapses once its children move into the canvas, so
        // the canvas itself carries the box in normal flow (not overlay).
        canvas.style.cssText =
            `display:block;width:${rect.width}px;height:${rect.height}px;`;
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
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, buildFragmentShader(rasterTree, rasterNodes)));
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

    // Static uniforms from the node data.
    rasterNodes.forEach((node, i) => {
        const def = REGISTRY[node.op];
        if (!def || !def.uniforms) return;
        const us = def.uniforms(node, dpr);
        for (const key in us) {
            setUniform(U(`u${i}_${key}`), us[key][0], us[key][1]);
        }
    });

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
        inkSaved = [];
        for (const node of [el, ...el.querySelectorAll("*")]) {
            if (node === canvas || node.tagName === "CANVAS") continue;
            const saved = { op: node.style.getPropertyValue("opacity") };
            for (const p in INK) saved[p] = node.style.getPropertyValue(p);
            inkSaved.push([node, saved]);
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
        if (!inkSaved) return;
        for (const [node, saved] of inkSaved) {
            for (const p in INK) {
                if (saved[p]) node.style.setProperty(p, saved[p]);
                else node.style.removeProperty(p);
            }
            if (saved.op) node.style.setProperty("opacity", saved.op);
            else node.style.removeProperty("opacity");
        }
        inkSaved = null;
        el.style.isolation = "";
        canvas.style.zIndex = "";
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
                if (!pureOverlay) hideHostInk();
                canvas.style.visibility = "visible";
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
    let visible = true;
    const draw = () => {
        if (destroyed) return;
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
            gl.uniform2f(U("u_res"), canvas.width, canvas.height);
            gl.uniform2f(U("u_mouse"), mouse[0], mouse[1]);
            gl.uniform1f(U("u_time"), now / 1000);
            // Evaluate each reactive op's driver and upload its focus.
            if (driverNodes.length > 0) {
                hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 8));
                const dctx = {
                    mouseX: mouse[0], mouseY: mouse[1],
                    w: canvas.width, h: canvas.height,
                    t: now / 1000, hover, scroll: scrollProgress(),
                };
                for (const d of driverNodes) {
                    const v = d.fn(dctx);
                    gl.uniform2f(U(`u${d.i}_dpos`), v.x, v.y);
                    gl.uniform1f(U(`u${d.i}_damt`), v.amt);
                }
            }
            // Advance and upload per-frame CPU simulations.
            if (dynamicOps.length > 0) {
                const ctx = { w: canvas.width, h: canvas.height, mouseX: mouse[0], mouseY: mouse[1], dt: dt, t: now / 1000 };
                for (const d of dynamicOps) {
                    const ups = d.def.tick(d.state, ctx);
                    for (const u of ups) setUniform(U(`u${d.i}_${u.name}`), u.kind, u.value);
                }
            }
            // Content on unit 0, then each solver's named result
            // textures (velocity, dye, ...) on units above it.
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.uniform1i(U("u_tex"), 0);
            let unit = 1;
            for (const s of solverOps) {
                const smps = s.def.solver.samplers;
                for (const key in smps) {
                    gl.activeTexture(gl.TEXTURE0 + unit);
                    gl.bindTexture(gl.TEXTURE_2D, s.targets[smps[key]].a.tex);
                    gl.uniform1i(U(`u${s.i}_${key}`), unit);
                    unit++;
                }
            }
            gl.activeTexture(gl.TEXTURE0); // texture uploads assume unit 0
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

    return {
        canvas,
        refresh: () => (mode === "live" ? onPaint() : snapshotCapture()),
        destroy() {
            destroyed = true;
            cancelAnimationFrame(raf);
            clearTimeout(resizeTimer);
            clearTimeout(winResizeTimer);
            if (io) io.disconnect();
            if (ro) ro.disconnect();
            if (typeof window !== "undefined") window.removeEventListener("resize", onWinResize);
            el.removeEventListener("mousemove", onMove);
            el.removeEventListener("touchmove", onMove);
            el.removeEventListener("mouseenter", onEnter);
            el.removeEventListener("mouseleave", onLeave);
            canvas.removeEventListener("paint", onPaint);
            for (const s of solverOps) {
                s.cleanup();
                for (const n in s.progs) gl.deleteProgram(s.progs[n].prog);
            }
            solverOps.length = 0;
            while (sourceEl !== el && sourceEl.firstChild) el.appendChild(sourceEl.firstChild);
            showHostInk();
            el.style.visibility = "";
            canvas.remove();
        },
    };
}

export {
    applyRasterPipeline, registerRasterOp, RASTER_OP_NAMES,
    isHTMLInCanvasAvailable, DRIVER_NAMES,
    // Exported so which branch a `switch` takes can be asserted directly
    // rather than inferred from pixels.
    resolveSwitches,
};

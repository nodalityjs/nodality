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
        decl: (p) => `uniform float ${p}strength; uniform float ${p}radius;`,
        code: (p) => `
        {
            float d = length(warped - u_mouse);
            float fall = 1.0 - smoothstep(0.0, ${p}radius, d);
            vec2 dir = d > 0.5 ? (warped - u_mouse) / d : vec2(0.0);
            warped -= dir * ${p}strength * fall;
        }`,
        uniforms: (node, dpr) => ({
            strength: ["1f", (node.strength || 20) * dpr],
            radius: ["1f", (node.radius || 260) * dpr],
        }),
    },

    duotone: {
        stage: "color",
        decl: (p) => `uniform vec3 ${p}a; uniform vec3 ${p}b; uniform float ${p}radius;`,
        code: (p, node) => `
        {
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            vec3 duo = mix(${p}a, ${p}b, lum);
            ${node.by === "mouse"
                ? `float mask = 1.0 - smoothstep(${p}radius * 0.35, ${p}radius, length(center - u_mouse));`
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
    //   { op: "stir", strength: 26, swirl: 2.4, decay: 0.985 }
    stir: {
        // Warp: swirl the coordinate space (so a cell op downstream tiles
        // the ALREADY-stirred content). Color: a faint moving sheen.
        stage: ["warp", "color"],
        decl: (p) => `
            uniform sampler2D ${p}field;
            uniform float ${p}strength;
            uniform float ${p}sheen;
            uniform vec3 ${p}tint;
            uniform float ${p}enc;
            uniform float ${p}range;
            vec2 ${p}flow(vec2 uvp) {
                vec4 t = texture2D(${p}field, clamp(uvp, 0.001, 0.999));
                return ${p}enc > 0.5 ? (t.xy * 2.0 - 1.0) * ${p}range : t.xy;
            }`,
        code: (p, node, stage) => stage === "warp" ? `
        {
            // frag/warped are top-down pixels; the field is bottom-up
            // [0,1] — flip y going in, and flip the y of the vector
            // coming out so content drags WITH the pointer.
            vec2 fuv = vec2(warped.x / u_res.x, 1.0 - warped.y / u_res.y);
            vec2 m = ${p}flow(fuv);
            warped += vec2(m.x, -m.y) * ${p}strength;
        }` : `
        {
            // Moving liquid catches light: brighten toward the tint
            // where the flow is fast. Sampled at the cell centre so it
            // stays flat per tile when a cell op runs upstream.
            vec2 suv = vec2(center.x / u_res.x, 1.0 - center.y / u_res.y);
            float sm = length(${p}flow(suv));
            col = mix(col, ${p}tint, (1.0 - exp(-sm * 5.0)) * ${p}sheen);
        }`,
        uniforms: (node, dpr) => ({
            strength: ["1f", (node.strength != null ? node.strength : 26) * dpr],
            sheen: ["1f", node.sheen != null ? node.sheen : 0.25],
            tint: ["3fv", hexToRgb(node.tint || "#BFE9FF")],
        }),
        // Stateful simulation. The pipeline creates the ping-pong pair,
        // compiles this fragment source, and feeds s_point / s_impulse /
        // s_dt every frame; everything else comes from `uniforms` here.
        field: {
            frag: () => `
precision highp float;
uniform sampler2D s_field;
uniform vec2 s_texel;
uniform float s_dt;
uniform float s_decay;
uniform float s_swirl;
uniform float s_advect;
uniform vec2 s_point;
uniform vec2 s_impulse;
uniform float s_radius;
uniform float s_aspect;
uniform float s_idle;
uniform float s_time;
uniform float s_enc;
uniform float s_range;

vec2 rd(vec2 uvp) {
    vec4 t = texture2D(s_field, clamp(uvp, 0.0, 1.0));
    return s_enc > 0.5 ? (t.xy * 2.0 - 1.0) * s_range : t.xy;
}

void main() {
    vec2 uv = gl_FragCoord.xy * s_texel;
    vec2 m = rd(uv);

    // 1. Semi-Lagrangian backtrace: momentum rides its own flow.
    vec2 a = rd(uv - m * s_advect * s_dt);

    // 2. Curl of the field, normalised so the swirl setting is
    //    resolution independent (central differences over two texels).
    float r = rd(uv + vec2(s_texel.x, 0.0)).y;
    float l = rd(uv - vec2(s_texel.x, 0.0)).y;
    float t = rd(uv + vec2(0.0, s_texel.y)).x;
    float b = rd(uv - vec2(0.0, s_texel.y)).x;
    float curl = ((r - l) - (t - b)) * 0.5 / s_texel.y;

    // 3. Rotate momentum by the local curl angle. Norm preserving, so
    //    eddies spin and survive rather than smearing out — this is
    //    what replaces vorticity confinement + pressure projection.
    float th = curl * s_swirl * s_dt;
    float cs = cos(th), sn = sin(th);
    a = mat2(cs, sn, -sn, cs) * a;

    // 4. Viscous decay (frame-rate independent).
    a *= pow(s_decay, s_dt * 60.0);

    // 5. The spoon: a gaussian impulse of pointer velocity.
    vec2 d = uv - s_point;
    d.x *= s_aspect;
    a += s_impulse * exp(-dot(d, d) / max(s_radius * s_radius, 1e-6));

    // 6. Optional hands-free stir: a source orbiting the centre.
    if (s_idle > 0.0) {
        float ia = s_time * 0.6;
        vec2 ic = vec2(0.5 + 0.22 * cos(ia), 0.5 + 0.22 * sin(ia));
        vec2 id = uv - ic;
        id.x *= s_aspect;
        a += vec2(-sin(ia), cos(ia)) * s_idle *
             exp(-dot(id, id) / max(s_radius * s_radius, 1e-6)) * s_dt * 60.0;
    }

    // Keep the field inside the encodable range.
    float mg = length(a);
    if (mg > s_range) a *= s_range / mg;

    gl_FragColor = s_enc > 0.5
        ? vec4(a / s_range * 0.5 + 0.5, 0.0, 1.0)
        : vec4(a, 0.0, 1.0);
}`,
            uniforms: (node) => ({
                s_decay: ["1f", node.decay != null ? node.decay : 0.985],
                s_swirl: ["1f", node.swirl != null ? node.swirl : 2.4],
                s_advect: ["1f", node.advect != null ? node.advect : 0.35],
                s_radius: ["1f", node.radius != null ? node.radius : 0.10],
                s_idle: ["1f", node.idle != null ? node.idle : 0.0],
            }),
            force: (node) => (node.force != null ? node.force : 1.0),
            resolution: (node) => Math.max(32, Math.min(node.resolution || 192, 512)),
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
const RASTER_OP_NAMES = Object.keys(REGISTRY);

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

function buildFragmentShader(nodes) {
    let decls = "", warp = "", cell = "", displace = "", color = "";
    nodes.forEach((node, i) => {
        const def = REGISTRY[node.op];
        if (!def) return;
        const p = `u${i}_`;
        decls += def.decl(p, node) + "\n";
        // An op may contribute to more than one stage (stage: ["warp",
        // "color"]) — code() then receives the stage it is emitting for.
        // A plain string stage keeps the original single-snippet form.
        const stages = Array.isArray(def.stage) ? def.stage : [def.stage];
        stages.forEach((st) => {
            const snippet = def.code(p, node, st) + "\n";
            if (st === "warp") warp += snippet;
            else if (st === "cell") cell += snippet;
            else if (st === "displace") displace += snippet;
            else color += snippet;
        });
    });
    // Compositing, in three layers (all straight-alpha):
    //   1. border layer (edgeCol/edgeCov, from an edges op) UNDER
    //   2. content layer (col over tex.a)                    then
    //   3. overlay layer (ovCol/ovA, from an overlay op e.g. blobs) ON TOP
    // Absent ops leave their contribution at zero, so this reduces to
    // the plain content for every prior combination. The default seam
    // darkening only applies when a cell op runs without an edges op.
    const hasEdges = nodes.some((n) => n.op === "edges");
    const defaultSeam = hasEdges ? "" : "    col *= 1.0 - edge * 0.55;";
    return `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_time;
${decls}
void main() {
    vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
    vec2 warped = frag;
${warp}
    vec2 center = warped;
    float edge = 0.0;
${cell}
    vec2 sampleP = warped;
${displace}
    vec2 uv = vec2(sampleP.x / u_res.x, 1.0 - sampleP.y / u_res.y);
    vec4 tex = texture2D(u_tex, clamp(uv, 0.001, 0.999));
    vec3 col = tex.rgb;
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

function snapshotToImage(el, w, h, dpr) {
    return new Promise((resolve, reject) => {
        const serialized = new XMLSerializer().serializeToString(el);
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

// ── Pipeline runner ──────────────────────────────────────────────────

function applyRasterPipeline(el, rasterNodes) {
    // Hard guards — every early-out is silent by design so that jsdom
    // prerender, old browsers and reduced-motion users get the plain
    // page untouched.
    if (!el || typeof document === "undefined" || typeof window === "undefined") return null;
    if (!rasterNodes || rasterNodes.length === 0) return null;
    if (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

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
        while (el.firstChild) wrap.appendChild(el.firstChild);
        canvas.appendChild(wrap);
        sourceEl = wrap;
        // The host collapses once its children move into the canvas, so
        // the canvas itself carries the box in normal flow (not overlay).
        canvas.style.cssText =
            `display:block;width:${rect.width}px;height:${rect.height}px;`;
    } else {
        // Snapshot mode: purely visual overlay; the real DOM stays put
        // underneath for accessibility, selection and events.
        canvas.style.cssText =
            "position:absolute;top:0;left:0;" +
            `width:${rect.width}px;height:${rect.height}px;` +
            "pointer-events:none;z-index:2147483000;";
        canvas.setAttribute("aria-hidden", "true");
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
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, buildFragmentShader(rasterNodes)));
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

    // ── Field simulations (ops with a `field` descriptor, e.g. stir) ──
    // Each owns a ping-pong pair of low-res targets holding a vector
    // field that is advanced by its own program every frame and then
    // sampled by the main pass. Half-float targets when the platform
    // can render to them; otherwise the vectors are range-encoded into
    // ordinary RGBA8, so the op still runs on WebGL1.
    const fieldOps = [];
    const makeField = (node, i) => {
        const def = REGISTRY[node.op];
        const res = def.field.resolution(node);
        const RANGE = 2.0;
        const canFloat = isGL2 && !!gl.getExtension("EXT_color_buffer_float");

        const mkPair = (enc) => {
            const targets = [];
            for (let k = 0; k < 2; k++) {
                const t = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, t);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                if (enc) {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, res, res, 0,
                        gl.RGBA, gl.UNSIGNED_BYTE, null);
                } else {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, res, res, 0,
                        gl.RGBA, gl.HALF_FLOAT, null);
                }
                const f = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, f);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                    gl.TEXTURE_2D, t, 0);
                if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                    targets.forEach((x) => { gl.deleteTexture(x.tex); gl.deleteFramebuffer(x.fbo); });
                    gl.deleteTexture(t);
                    gl.deleteFramebuffer(f);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                    return null;
                }
                // Zero field == the encoded midpoint in the 8-bit path.
                gl.viewport(0, 0, res, res);
                gl.clearColor(enc ? 0.5 : 0, enc ? 0.5 : 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                targets.push({ tex: t, fbo: f });
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            return targets;
        };

        let enc = canFloat ? 0 : 1;
        let pair = canFloat ? mkPair(0) : null;
        if (!pair) { enc = 1; pair = mkPair(1); }
        if (!pair) return null;

        let simProg;
        try {
            simProg = gl.createProgram();
            gl.attachShader(simProg, compile(gl.VERTEX_SHADER, VS));
            gl.attachShader(simProg, compile(gl.FRAGMENT_SHADER, def.field.frag(node)));
            gl.bindAttribLocation(simProg, 0, "a");
            gl.linkProgram(simProg);
            if (!gl.getProgramParameter(simProg, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(simProg));
            }
        } catch (e) {
            console.warn("[nodality] raster field sim unavailable for '" + node.op + "':", e);
            pair.forEach((x) => { gl.deleteTexture(x.tex); gl.deleteFramebuffer(x.fbo); });
            return null;
        }

        // Static sim uniforms (set once).
        gl.useProgram(simProg);
        const SU = (n) => gl.getUniformLocation(simProg, n);
        const statics = def.field.uniforms(node);
        for (const key in statics) setUniform(SU(key), statics[key][0], statics[key][1]);
        gl.uniform2f(SU("s_texel"), 1 / res, 1 / res);
        gl.uniform1f(SU("s_enc"), enc);
        gl.uniform1f(SU("s_range"), RANGE);

        // The main pass needs to know how to decode what it samples.
        gl.useProgram(prog);
        gl.uniform1f(U(`u${i}_enc`), enc);
        gl.uniform1f(U(`u${i}_range`), RANGE);

        return {
            i, res, prog: simProg, SU,
            src: pair[0], dst: pair[1],
            force: def.field.force(node),
            prevX: 0.5, prevY: 0.5, primed: false,
        };
    };
    rasterNodes.forEach((node, i) => {
        const def = REGISTRY[node.op];
        if (!def || !def.field) return;
        const f = makeField(node, i);
        if (f) fieldOps.push(f);
    });

    // Advance one field by a frame, ping-ponging its targets.
    const stepField = (f, dt, now) => {
        gl.useProgram(f.prog);
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.dst.fbo);
        gl.viewport(0, 0, f.res, f.res);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, f.src.tex);
        gl.uniform1i(f.SU("s_field"), 0);

        // Pointer position in field space (bottom-up [0,1]) and the
        // velocity it picked up since the previous frame — the spoon.
        const px = mouse[0] / canvas.width;
        const py = 1 - mouse[1] / canvas.height;
        let ix = 0, iy = 0;
        if (f.primed) {
            ix = (px - f.prevX) * 60 * f.force;
            iy = (py - f.prevY) * 60 * f.force;
        }
        f.prevX = px; f.prevY = py; f.primed = true;

        gl.uniform2f(f.SU("s_point"), px, py);
        gl.uniform2f(f.SU("s_impulse"), ix, iy);
        gl.uniform1f(f.SU("s_dt"), Math.min(dt, 1 / 30));
        gl.uniform1f(f.SU("s_aspect"), canvas.width / Math.max(canvas.height, 1));
        gl.uniform1f(f.SU("s_time"), now / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        const swap = f.src; f.src = f.dst; f.dst = swap;
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
        const prevVisibility = el.style.visibility;
        el.style.visibility = "";
        const p = snapshotToImage(el, rect.width, rect.height, dpr)
            .then((img) => {
                if (destroyed) return;
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                finishUpload();
                textureReady = true;
                // In-place transforms hide the host (the canvas replaces
                // its look). A pure-overlay chain keeps it visible so the
                // real content shows through the bubble; a mixed chain
                // (in-place + overlay) hides it — the canvas carries all.
                el.style.visibility = pureOverlay ? "" : "hidden";
                canvas.style.visibility = "visible";
            })
            .catch((e) => {
                el.style.visibility = prevVisibility;
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
    const onMove = (e) => {
        const r = canvas.getBoundingClientRect();
        const pt = e.touches ? e.touches[0] : e;
        mouse = [(pt.clientX - r.left) * dpr, (pt.clientY - r.top) * dpr];
    };
    el.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });

    // Render loop — paused while off-screen.
    let raf = 0;
    let visible = true;
    const draw = () => {
        if (destroyed) return;
        if (visible && textureReady) {
            const now = (typeof performance !== "undefined") ? performance.now() : lastFrame + 16;
            const dt = Math.max(0, (now - lastFrame) / 1000);

            // 1. Advance stateful field simulations into their own
            //    off-screen targets (this rebinds framebuffer/program).
            for (const f of fieldOps) stepField(f, dt, now);

            // 2. Composite pass, back on the visible framebuffer.
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.useProgram(prog);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(U("u_res"), canvas.width, canvas.height);
            gl.uniform2f(U("u_mouse"), mouse[0], mouse[1]);
            gl.uniform1f(U("u_time"), now / 1000);
            // Advance and upload per-frame CPU simulations.
            if (dynamicOps.length > 0) {
                const ctx = { w: canvas.width, h: canvas.height, mouseX: mouse[0], mouseY: mouse[1], dt: dt, t: now / 1000 };
                for (const d of dynamicOps) {
                    const ups = d.def.tick(d.state, ctx);
                    for (const u of ups) setUniform(U(`u${d.i}_${u.name}`), u.kind, u.value);
                }
            }
            // Content on unit 0, each simulated field on its own unit.
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.uniform1i(U("u_tex"), 0);
            fieldOps.forEach((f, k) => {
                gl.activeTexture(gl.TEXTURE0 + 1 + k);
                gl.bindTexture(gl.TEXTURE_2D, f.src.tex);
                gl.uniform1i(U(`u${f.i}_field`), 1 + k);
            });
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
    if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (destroyed || mode !== "snapshot") return;
                const m = measure();
                rect.width = m.width;
                rect.height = m.height;
                canvas.width = Math.round(m.width * dpr);
                canvas.height = Math.round(m.height * dpr);
                canvas.style.width = m.width + "px";
                canvas.style.height = m.height + "px";
                snapshotCapture();
            }, 150);
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
            if (mode === "snapshot") {
                const m = measure();
                rect.width = m.width;
                rect.height = m.height;
                canvas.width = Math.round(m.width * dpr);
                canvas.height = Math.round(m.height * dpr);
                canvas.style.width = m.width + "px";
                canvas.style.height = m.height + "px";
                snapshotCapture();
                return;
            }
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
            canvas.removeEventListener("paint", onPaint);
            for (const f of fieldOps) {
                [f.src, f.dst].forEach((t) => {
                    gl.deleteFramebuffer(t.fbo);
                    gl.deleteTexture(t.tex);
                });
                gl.deleteProgram(f.prog);
            }
            fieldOps.length = 0;
            while (sourceEl !== el && sourceEl.firstChild) el.appendChild(sourceEl.firstChild);
            el.style.visibility = "";
            canvas.remove();
        },
    };
}

export { applyRasterPipeline, registerRasterOp, RASTER_OP_NAMES, isHTMLInCanvasAvailable };

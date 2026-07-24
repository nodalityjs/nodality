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
        decls += def.decl(p) + "\n";
        const snippet = def.code(p, node) + "\n";
        if (def.stage === "warp") warp += snippet;
        else if (def.stage === "cell") cell += snippet;
        else if (def.stage === "displace") displace += snippet;
        else color += snippet;
    });
    // When an edges op is present it emits a border layer (edgeCol /
    // edgeCov) and the content (text) is composited OVER it, so borders
    // sit below the glyphs. Otherwise cells get the default subtle
    // darkening so the tiling still reads.
    const hasEdges = nodes.some((n) => n.op === "edges");
    const finalBlock = hasEdges
        ? `    // text (col, tex.a) OVER border (edgeCol, edgeCov): straight alpha
    float outA = tex.a + edgeCov * (1.0 - tex.a);
    vec3 outRGB = (col * tex.a + edgeCol * edgeCov * (1.0 - tex.a)) / max(outA, 1e-4);
    gl_FragColor = vec4(outRGB, outA);`
        : `    col *= 1.0 - edge * 0.55;
    gl_FragColor = vec4(col, tex.a);`;
    return `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_mouse;
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
${color}
${finalBlock}
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
    const wantLive = rasterNodes.some((n) => n.live === true);
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
    // The origin trial wires texElementImage2D primarily on WebGL2 —
    // prefer it in live mode, fall back to WebGL1 (same GLSL either way).
    const gl = (live && canvas.getContext("webgl2", ctxOpts)) ||
        canvas.getContext("webgl", ctxOpts);
    if (!gl) return null;
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
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);

    // Static uniforms from the node data.
    rasterNodes.forEach((node, i) => {
        const def = REGISTRY[node.op];
        if (!def || !def.uniforms) return;
        const us = def.uniforms(node, dpr);
        for (const key in us) {
            const [kind, value] = us[key];
            const loc = U(`u${i}_${key}`);
            if (kind === "1f") gl.uniform1f(loc, value);
            else if (kind === "2fv") gl.uniform2fv(loc, value);
            else if (kind === "3fv") gl.uniform3fv(loc, value);
        }
    });

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    let textureReady = false;
    let destroyed = false;
    let mode = live ? "live" : "snapshot";

    // Snapshot the host's children (excluding our own canvas). Once the
    // texture is live, the host's own painting is hidden via the
    // visibility trick (the canvas child re-shows itself) so transparent
    // hosts — e.g. a bare headline — don't ghost-double under the effect.
    const snapshotCapture = () => {
        canvas.style.display = "none";
        const prevVisibility = el.style.visibility;
        el.style.visibility = "";
        const p = snapshotToImage(el, rect.width, rect.height, dpr)
            .then((img) => {
                if (destroyed) return;
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                textureReady = true;
                el.style.visibility = "hidden";
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
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(U("u_res"), canvas.width, canvas.height);
            gl.uniform2f(U("u_mouse"), mouse[0], mouse[1]);
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
            while (sourceEl !== el && sourceEl.firstChild) el.appendChild(sourceEl.firstChild);
            el.style.visibility = "";
            canvas.remove();
        },
    };
}

export { applyRasterPipeline, registerRasterOp, RASTER_OP_NAMES, isHTMLInCanvasAvailable };

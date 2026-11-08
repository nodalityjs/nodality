/*!
 * nodality v1.4.3
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * dev-inspector.js — the in-page half of `nodality dev`.
 *
 * Served by the dev server only; never imported, never bundled, never in a
 * built page. It lets a person point at what they mean and leaves the
 * meaning in two files an agent reads (see lib/dev-state.js):
 *
 *   S        select: click an element → .nodality/current.json
 *   C        comment: click an element, or drag across several, and type a
 *            note → .nodality/comments.json
 *   Esc      off: the page behaves as a page again (the starting state)
 *
 * It finds elements by their `id`, which every Nodality element renders, and
 * reads the (E, N) pair the Designer registers in __NODALITY_DEV__.pages to
 * report which nodes target the pick and which width ranges are in force.
 * Everything it draws lives in one shadow root, so page styles cannot reach
 * it and it never edits the page's own nodes.
 */
(function () {
    if (typeof window === "undefined" || window.__NODALITY_INSPECTOR__) return;
    window.__NODALITY_INSPECTOR__ = true;
    const DEV = (window.__NODALITY_DEV__ = window.__NODALITY_DEV__ || { pages: [], annotate: true });
    const API = "/__nodality";
    const PAGE = location.pathname;

    // ── the pair: id → spec, node indexes, ranges ──────────────────────
    let index = new Map();
    const bare = (s) => (typeof s === "string" ? s.replace(/^#/, "") : null);
    function names(v, out) {
        if (typeof v === "string") out.push(bare(v));
        else if (Array.isArray(v)) v.forEach((x) => names(x, out));
        else if (v && typeof v === "object") Object.values(v).forEach((x) => names(x, out));
        return out;
    }
    function walk(list, visit) {
        for (const el of Array.isArray(list) ? list : []) {
            if (Array.isArray(el)) { walk(el, visit); continue; }
            if (!el || typeof el !== "object") continue;
            if (typeof el.id === "string") visit(el);
            walk(el.children, visit);
            if (Array.isArray(el.items)) walk(el.items, visit);
        }
    }
    function rebuild() {
        index = new Map();
        for (const pg of DEV.pages) {
            walk(pg.elements, (el) => { if (!index.has(el.id)) index.set(el.id, { spec: el, nodes: [], ranges: [] }); });
            (pg.nodes || []).forEach((n, i) => {
                if (!n || typeof n !== "object") return;
                const hit = names([n.target, n.from, n.to], []);
                if (Array.isArray(n.chain)) n.chain.forEach((e) => names([e && e.from, e && e.to], hit));
                for (const id of new Set(hit)) {
                    const rec = index.get(id);
                    if (!rec) continue;
                    rec.nodes.push(i);
                    if (Array.isArray(n.range)) rec.ranges.push({ node: i, range: n.range });
                }
            });
        }
    }
    window.addEventListener("nodality:rendered", () => { rebuild(); drawPins(); });

    // ── shadow UI ──────────────────────────────────────────────────────
    const host = document.createElement("div");
    host.setAttribute("data-nodality", "dev-inspector");
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{all:initial}
      *{box-sizing:border-box;font:12px/1.4 -apple-system,system-ui,sans-serif}
      .box{position:fixed;border:1.5px solid #378ADD;border-radius:3px;display:none;pointer-events:none}
      .box.sel{border:2px solid #185FA5;background:rgba(55,138,221,.08)}
      .lab{position:absolute;top:-20px;left:-2px;background:#185FA5;color:#fff;padding:1px 6px;border-radius:3px;white-space:nowrap;font:11px ui-monospace,Menlo,monospace}
      .drag{position:fixed;border:1.5px dashed #BA7517;background:rgba(239,159,39,.08);display:none}
      .pin{position:fixed;width:18px;height:18px;border-radius:50%;background:#FAC775;color:#633806;border:1px solid #BA7517;display:flex;align-items:center;justify-content:center;font-size:11px;pointer-events:auto;cursor:default}
      .bar{position:fixed;right:12px;bottom:12px;background:#fff;color:#2C2C2A;border:1px solid #D3D1C7;border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:6px;pointer-events:auto;min-width:220px}
      .row{display:flex;gap:6px;align-items:center}
      button{border:1px solid #D3D1C7;background:#fff;color:#2C2C2A;border-radius:6px;padding:3px 8px;cursor:pointer}
      button.on{background:#E6F1FB;color:#0C447C;border-color:#378ADD}
      .st{color:#5F5E5A;margin-left:auto;font-size:11px}
      input{flex:1;border:1px solid #B4B2A9;border-radius:6px;padding:4px 6px;min-width:0}
      .err{color:#A32D2D;font-size:11px}
      .note{display:none}
    </style>
    <div class="box" id="hover"><span class="lab"></span></div>
    <div class="box sel" id="sel"><span class="lab"></span></div>
    <div class="drag" id="drag"></div>
    <div id="pins"></div>
    <div class="bar">
      <div class="row"><button id="bS">Select (S)</button><button id="bC">Comment (C)</button><span class="st" id="st"></span></div>
      <div class="row note" id="noteRow"><input id="note" maxlength="2000" placeholder="what should change here?"><button id="add">Add</button></div>
      <div class="err" id="err"></div>
    </div>`;
    const $ = (id) => root.getElementById(id);
    const mount = () => { if (!host.isConnected) document.body.appendChild(host); };
    if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

    let mode = "off";
    let pending = null;          // { target: [ids], rect } awaiting a note
    function setMode(m) {
        mode = mode === m ? "off" : m;
        $("bS").classList.toggle("on", mode === "select");
        $("bC").classList.toggle("on", mode === "comment");
        if (mode !== "comment") { pending = null; $("noteRow").style.display = "none"; }
        $("hover").style.display = "none";
        status();
    }
    function status(msg) {
        $("st").textContent = msg || `${mode === "off" ? "off" : mode} · ${innerWidth}px`;
    }
    $("bS").onclick = () => setMode("select");
    $("bC").onclick = () => setMode("comment");
    status();

    // ── finding what was pointed at ─────────────────────────────────────
    const ours = (e) => e.composedPath && e.composedPath().includes(host);
    // An element is addressable by an id from the pair (or any id, on a page
    // with no pair), or — on a page written with the imperative layer — by the
    // line that created it (data-nod-src, set in dev by the component base).
    const idOk = (n) => n.id && n !== host && (index.size === 0 || index.has(n.id));
    const srcOf = (n) => (n.getAttribute && n.getAttribute("data-nod-src")) || null;
    function known(node) {
        for (let n = node; n && n !== document.documentElement; n = n.parentElement) {
            if (idOk(n) || srcOf(n)) return n;
        }
        return null;
    }
    function label(node) {
        const rec = idOk(node) ? index.get(node.id) : null;
        const kind = (rec && rec.spec.type) || node.tagName.toLowerCase();
        if (idOk(node)) return `#${node.id} · ${kind}`;
        return `${srcOf(node).replace(/:\d+$/, "")} · ${kind}`;
    }
    function place(box, node) {
        const r = node.getBoundingClientRect();
        Object.assign(box.style, { display: "block", left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" });
        box.querySelector(".lab").textContent = label(node);
    }
    function describe(nodes) {
        const first = nodes[0];
        const rec = (idOk(first) && index.get(first.id)) || { spec: {}, nodes: [], ranges: [] };
        const w = innerWidth;
        return {
            ids: nodes.filter(idOk).map((n) => n.id),
            src: srcOf(first),
            type: rec.spec.type || null,
            tag: first.tagName.toLowerCase(),
            text: (first.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
            nodesTargeting: rec.nodes,
            activeRanges: rec.ranges.filter(({ range: [a, b] }) => w >= (a ?? 0) && w <= (b ?? Infinity)),
        };
    }
    const post = (path, body) => fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => r.json()).catch(() => ({ ok: false }));
    const viewport = () => ({ width: innerWidth, height: innerHeight });

    // ── select ─────────────────────────────────────────────────────────
    let selected = null;
    function select(node) {
        selected = node;
        place($("sel"), node);
        post("/current", { page: PAGE, viewport: viewport(), selection: describe([node]) })
            .then((r) => status(r.ok ? `picked ${label(node).split(" · ")[0]}` : "could not save the pick"));
    }

    // ── comment: click one element, or drag across several ─────────────
    let drag = null;
    let skipClick = false;     // the click a finished drag also fires
    function askNote(target, rect, src) {
        pending = { target, rect, src: src || null };
        $("noteRow").style.display = "flex";
        $("err").textContent = "";
        $("note").value = "";
        $("note").focus();
        status(`note on ${target.length ? target.map((t) => "#" + t).join(", ") : String(src).replace(/:\d+$/, "")}`);
    }
    function addNote() {
        const note = $("note").value.trim();
        if (!note) { $("err").textContent = "Write a note first."; return; }
        post("/comments", { page: PAGE, viewport: viewport(), target: pending.target, rect: pending.rect, src: pending.src, note })
            .then((r) => {
                if (!r.ok) { $("err").textContent = "The note was not saved."; return; }
                pending = null;
                $("noteRow").style.display = "none";
                status("note saved");
                loadPins();
            });
    }
    $("add").onclick = addNote;
    $("note").addEventListener("keydown", (e) => { if (e.key === "Enter") addNote(); e.stopPropagation(); });
    $("note").addEventListener("input", () => { $("err").textContent = ""; });

    // ── pins ───────────────────────────────────────────────────────────
    let pins = [];
    function loadPins() {
        fetch(`${API}/comments?page=${encodeURIComponent(PAGE)}`).then((r) => r.json())
            .then((list) => { pins = (Array.isArray(list) ? list : []).filter((c) => c.status === "open"); drawPins(); })
            .catch(() => {});
    }
    function drawPins() {
        const box = $("pins");
        box.textContent = "";
        pins.forEach((c, i) => {
            const node = c.target.length ? document.getElementById(c.target[0])
                : c.source ? [...document.querySelectorAll("[data-nod-src]")].find((n) => srcOf(n).startsWith(`${c.source.file}:${c.source.line}:`)) : null;
            if (!node) return;
            const r = node.getBoundingClientRect();
            const p = document.createElement("div");
            p.className = "pin";
            p.textContent = String(i + 1);
            p.title = c.note;
            p.style.left = r.right - 9 + "px";
            p.style.top = r.top - 9 + "px";
            box.appendChild(p);
        });
    }
    let raf = 0;
    const redraw = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { drawPins(); if (selected && selected.isConnected) place($("sel"), selected); status(); });
    };
    addEventListener("scroll", redraw, true);
    addEventListener("resize", redraw);

    // ── events: capture phase, so the page never sees an inspector click ──
    document.addEventListener("mousemove", (e) => {
        if (mode === "off" || ours(e)) return;
        if (drag) {
            const x = Math.min(drag.x, e.clientX), y = Math.min(drag.y, e.clientY);
            const w = Math.abs(e.clientX - drag.x), h = Math.abs(e.clientY - drag.y);
            if (w + h > 6) { drag.moved = true; Object.assign($("drag").style, { display: "block", left: x + "px", top: y + "px", width: w + "px", height: h + "px" }); }
            return;
        }
        const node = known(e.target);
        if (node) place($("hover"), node); else $("hover").style.display = "none";
    }, true);
    document.addEventListener("mousedown", (e) => {
        if (mode !== "comment" || ours(e)) return;
        e.preventDefault();
        drag = { x: e.clientX, y: e.clientY, moved: false };
    }, true);
    document.addEventListener("mouseup", (e) => {
        if (!drag) return;
        const d = drag; drag = null;
        $("drag").style.display = "none";
        if (!d.moved) return;
        skipClick = true;
        const box = { l: Math.min(d.x, e.clientX), t: Math.min(d.y, e.clientY), r: Math.max(d.x, e.clientX), b: Math.max(d.y, e.clientY) };
        const inside = [...document.querySelectorAll("[id], [data-nod-src]")].filter((n) => {
            if (n === host || !(idOk(n) || srcOf(n))) return false;
            const r = n.getBoundingClientRect();
            return r.width > 0 && r.left >= box.l && r.right <= box.r && r.top >= box.t && r.bottom <= box.b;
        });
        const outer = inside.filter((n) => !inside.some((m) => m !== n && m.contains(n)));
        if (!outer.length) { status("nothing addressable inside that area"); return; }
        askNote(outer.filter(idOk).map((n) => n.id), { x: box.l + scrollX, y: box.t + scrollY, w: box.r - box.l, h: box.b - box.t }, srcOf(outer[0]));
    }, true);
    document.addEventListener("click", (e) => {
        if (mode === "off" || ours(e)) return;
        e.preventDefault();
        e.stopPropagation();
        if (skipClick) { skipClick = false; return; }
        const node = known(e.target);
        if (!node) { status("nothing addressable here: no id, no source line"); return; }
        if (mode === "select") select(node);
        else askNote(idOk(node) ? [node.id] : [], null, srcOf(node));
    }, true);
    document.addEventListener("keydown", (e) => {
        if (ours(e)) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "s" || e.key === "S") setMode("select");
        else if (e.key === "c" || e.key === "C") setMode("comment");
        else if (e.key === "Escape" && mode !== "off") setMode(mode);
    }, true);

    // ── reload when the site changes; report the page on arrival ───────
    try {
        const es = new EventSource(`${API}/events`);
        es.addEventListener("reload", () => location.reload());
    } catch { /* no live reload; everything else still works */ }
    rebuild();
    addEventListener("load", () => {
        rebuild();
        loadPins();
        post("/current", { page: PAGE, viewport: viewport(), selection: null });
    });
})();

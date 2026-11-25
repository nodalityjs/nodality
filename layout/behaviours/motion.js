/*!
 * nodality v1.5.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import { afterLoader } from "../../lib/loader.js";
import { seenAtHandover } from "../../lib/handover.js";

// ── Universal motion options ─────────────────────────────────────────
//
// `reveal`, `scrub`, `pin`, `count` and `fit` work on EVERY element type,
// because Animator's set() wrapper hands each component's options to
// applyBehaviours() after the component's own set() ran (the same place `id`
// and `loop` are applied). Putting them on the base class rather than in
// thirty-odd components is the lesson of `id`: seventeen components forgot it.
//
// Three rules shape everything below.
//
// 1. Content is never left invisible. A hidden start state (reveal, count) is
//    applied ONLY when the motion that undoes it will certainly run: a
//    window, IntersectionObserver, Web Animations, and no
//    `prefers-reduced-motion: reduce`. Headless (jsdom, the prerender) every
//    option is a no-op and the page renders exactly as without it.
//
// 2. Nothing measures layout while set() runs. The component's root
//    (`component.res`) is usually not in the document yet, so measuring
//    work waits until it is connected — the pattern `rasterize()` uses.
//
// 3. Everything attached goes through component._on / component._track, so
//    Animator.destroy() (and Des.destroy()) releases it. A component whose
//    set() runs again first tears down what the previous set() attached,
//    so options never stack.
//
// A component is built twice on its way to the page (the mapper's instance
// and, for legacy types, the one the generated code builds). The unmounted
// twin only ever holds paused animations on a detached node and observers
// that never fire; destroy() releases them with the rest.

const DEFAULT_EASE = "cubic-bezier(.2,.7,.2,1)";

const win = () => (typeof window !== "undefined" ? window : null);

/**
 * True while layout/prerender.js builds the page. Its shims make
 * IntersectionObserver and Element.animate look present, but nothing will
 * ever play an entrance in the saved HTML — so every hidden start state, a
 * count's "0", a scrub's first frame and fit's nowrap are left out, and the
 * HTML holds the final, visible state. The browser applies them on hydration.
 */
export function isPrerendering() {
	const w = win();
	return !!(w && w.__NODALITY_PRERENDER__);
}

/**
 * The element a component renders. Nearly every component keeps it in
 * `res`; the form groups (RadioGroup, FilePickera) keep it in `el` and
 * leave `res` empty, which made every option here a silent no-op on them.
 */
function rootOf(component) {
	const r = component && component.res;
	if (r && r.nodeType === 1) return r;
	const e = component && component.el;
	return e && e.nodeType === 1 ? e : null;
}

/** True when the visitor asked for reduced motion. No matchMedia → false. */
export function prefersReducedMotion() {
	const w = win();
	if (!w || typeof w.matchMedia !== "function") return false;
	try { return !!w.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

/**
 * Can an entrance (reveal, count) run on this element? All three are needed
 * to undo a hidden start state; lacking any one, the hidden state is never
 * applied — the content simply shows.
 */
function canEnter(el) {
	const w = win();
	if (isPrerendering()) return false;
	return !!(w && el && typeof w.IntersectionObserver === "function"
		&& typeof el.animate === "function" && !prefersReducedMotion());
}

const num = (v, d) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? d : Number(v));
const len = (v) => (typeof v === "number" ? `${v}px` : String(v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Microtask — after the current synchronous build, before the next paint. */
const soon = (fn) => Promise.resolve().then(fn);

/**
 * Run `fn` once the element is in the document. Polled with setTimeout, not
 * requestAnimationFrame, which stalls in background tabs (see rasterize()).
 * Gives up quietly after ~4 s: an element that never mounts (the mapper's
 * twin) has nothing to measure.
 */
function whenConnected(el, live, fn) {
	let tries = 0, timer = null;
	const go = () => {
		if (!live.on) return;
		if (el.isConnected) { fn(); return; }
		if (typeof setTimeout !== "undefined" && ++tries < 80) timer = setTimeout(go, tries === 1 ? 0 : 50);
	};
	// First look in a microtask: Des mounts in the same task that ran set(),
	// so this usually lands before the first paint, with no visible jump.
	soon(go);
	live.add(() => timer && clearTimeout(timer));
}

/** One rAF per burst of events, never a running loop. */
function frameThrottle(fn) {
	const w = win();
	let queued = false;
	return () => {
		if (queued) return;
		if (!w || typeof w.requestAnimationFrame !== "function") { fn(); return; }
		queued = true;
		w.requestAnimationFrame(() => { queued = false; fn(); });
	};
}

/**
 * Is the element in the viewport of a TOP-LEVEL document? rootMargin (used to
 * catch elements the user scrolled past, below) is ignored by the browser in
 * a cross-origin iframe, so there a scroll check backs it up.
 */
function inIframe() {
	const w = win();
	try { return !!w && w.self !== w.top; } catch (e) { return true; }
}

// The observer root reaches up 99999px above the viewport. An element the
// visitor jumped past — an anchor link, the End key, a restored scroll
// position — then still "intersects", and is shown at once instead of
// waiting hidden for a scroll back up that may never come. Its bottom edge is
// the real viewport's, so the threshold still means "this much of the
// element has risen above the bottom of the screen".
const ROOT_MARGIN = "99999px 0px 0px 0px";

/**
 * Watch an element enter the viewport. `onEnter(animate)` gets false when the
 * element is already above the viewport (no point animating offscreen) or
 * clipped sideways while vertically in view (a horizontal scroller would
 * otherwise keep it hidden forever). `onLeave` fires when it drops back below
 * the viewport, for `once: false`.
 */
function watchEntry(component, el, live, { threshold, once, onEnter, onLeave }) {
	const w = win();
	let shown = false;
	const t = Math.min(1, Math.max(0, threshold));
	const vh = () => w.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
	const io = new w.IntersectionObserver((entries) => {
		for (const entry of entries) {
			const r = entry.boundingClientRect;
			const empty = !r || (!r.width && !r.height);
			if (!shown) {
				if (empty) continue; // not laid out yet (or display:none)
				const above = r.bottom <= 0;
				const clipped = !entry.isIntersecting && r.top < vh() && r.bottom > 0;
				const enough = entry.isIntersecting && entry.intersectionRatio >= t - 1e-6;
				if (above || clipped || enough) {
					shown = true;
					// Under a loading curtain the entrance waits for it to lift.
					const animate = !(above || clipped);
					afterLoader(() => onEnter(animate));
					if (once) stop();
				}
			} else if (!once && !entry.isIntersecting && !empty && r.top >= vh()) {
				shown = false;
				onLeave && onLeave();
			}
		}
	}, { rootMargin: ROOT_MARGIN, threshold: t > 0 ? [0, t] : [0] });
	io.observe(el);
	const stop = () => io.disconnect();
	live.add(stop);
	component._track(stop);

	if (inIframe()) {
		const check = frameThrottle(() => {
			if (shown || !el.isConnected) return;
			const r = el.getBoundingClientRect();
			if (r.bottom <= 0 && (r.width || r.height)) { shown = true; onEnter(false); if (once) stop(); }
		});
		listen(component, live, w, "scroll", check, { passive: true });
	}
}

/** addEventListener through component._on, removable again on re-set. */
function listen(component, live, target, type, fn, opts) {
	if (!target || typeof target.addEventListener !== "function") return;
	component._on(target, type, fn, opts);
	live.add(() => target.removeEventListener(type, fn, opts));
}

// ── reveal ───────────────────────────────────────────────────────────

/** Visually hidden but read by assistive technology. */
function srOnly(node) {
	Object.assign(node.style, {
		position: "absolute", width: "1px", height: "1px", margin: "-1px", padding: "0",
		border: "0", overflow: "hidden", clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap",
	});
	return node;
}

/** Text nodes under `el` that carry something other than whitespace. */
function textNodes(el) {
	const out = [];
	const doc = el.ownerDocument;
	if (!doc || typeof doc.createTreeWalker !== "function") return out;
	const SHOW_TEXT = 4;
	const walker = doc.createTreeWalker(el, SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const p = n.parentNode && n.parentNode.nodeName;
		if (p === "SCRIPT" || p === "STYLE") continue;
		if (/\S/.test(n.data)) out.push(n);
	}
	return out;
}

/**
 * Wrap every word in a span, in place. The words and the whitespace between
 * them are the original characters, so `textContent` is unchanged and a
 * screen reader reads the same sentence; no copy, no aria-label. The spans
 * are inline-block because `translate` does not apply to inline boxes.
 * Returns the word spans and a function that puts the original text nodes
 * back.
 */
function splitWords(el) {
	const doc = el.ownerDocument;
	const words = [], records = [];
	for (const node of textNodes(el)) {
		const parts = node.data.split(/(\s+)/);
		const inserted = [];
		const frag = doc.createDocumentFragment();
		for (const part of parts) {
			if (!part) continue;
			let piece;
			if (/^\s+$/.test(part)) piece = doc.createTextNode(part);
			else {
				piece = doc.createElement("span");
				piece.style.display = "inline-block";
				piece.textContent = part;
				words.push(piece);
			}
			inserted.push(piece);
			frag.appendChild(piece);
		}
		node.parentNode.replaceChild(frag, node);
		records.push({ node, inserted });
	}
	const restore = () => {
		for (const { node, inserted } of records) {
			const first = inserted[0];
			if (!first || !first.parentNode) continue;
			first.parentNode.insertBefore(node, first);
			for (const n of inserted) n.parentNode && n.parentNode.removeChild(n);
		}
		records.length = 0;
	};
	return { words, restore };
}

/** Group word spans by the line they were laid out on. */
function lineIndexes(words) {
	let line = -1, lineTop = -Infinity;
	return words.map((w) => {
		const r = w.getBoundingClientRect();
		if (r.top > lineTop + Math.max(1, r.height / 2)) { line++; lineTop = r.top; }
		return Math.max(0, line);
	});
}

function applyReveal(component, spec, obj, live) {
	const el = rootOf(component);
	if (!canEnter(el)) return;
	const o = spec && typeof spec === "object" ? spec : {};
	const by = o.by === "word" || o.by === "line" ? o.by : null;
	const duration = num(o.duration, 700);
	const delay = num(o.delay, 0);
	const easing = o.easing || DEFAULT_EASE;
	const stagger = num(o.stagger, by === "line" ? 120 : by === "word" ? 40 : 0);
	const once = o.once !== false;

	// The start frame only. Its end is left implicit (offset 0, no closing
	// frame), so the element animates to its OWN opacity and position — a
	// page's `opacity: 0.6` stays 0.6. `translate` and `scale` are the
	// individual transform properties, so a `transform` the element already
	// has is composed with, not overwritten (image.reveal does the same).
	const start = { opacity: String(num(o.opacity, 0)), translate: `${len(o.x ?? 0)} ${len(o.y ?? 24)}`, offset: 0 };
	if (o.scale !== undefined && o.scale !== null) start.scale = String(o.scale);

	let targets = null, split = null, holds = [];
	const hold = () => {
		// Paused at 0 with backwards fill: the start frame, held until play.
		holds = targets.map((t) => {
			const a = t.animate([start], { duration, easing, fill: "backwards" });
			a.pause();
			return a;
		});
	};
	const release = () => { for (const a of holds) { try { a.cancel(); } catch (e) { /* gone */ } } holds = []; };
	live.add(release);

	const enter = (animate) => {
		release();
		if (!animate) { finish(); return; }
		const order = by === "line" ? lineIndexes(targets) : targets.map((_, i) => i);
		const anims = targets.map((t, i) => t.animate([start], { duration, easing, delay: delay + order[i] * stagger, fill: "backwards" }));
		holds = anims;
		const done = anims.length && anims[anims.length - 1].finished;
		if (once && done && typeof done.then === "function") done.then(finish, () => {});
	};
	// Word spans are taken out again once the words are in, so the DOM after
	// the entrance is the DOM the page built. Not while a `count` is still
	// rewriting a number inside one of them.
	const finish = () => { if (once && split && !obj.count) { split.restore(); split = null; } };
	live.add(() => { if (split) { split.restore(); split = null; } });

	soon(() => {
		if (!live.on) return;
		// Already on screen in the prerendered copy: leave it as it is.
		if (seenAtHandover(el)) return;
		if (by) {
			split = splitWords(el);
			targets = split.words;
		} else if (stagger > 0) {
			targets = Array.from(el.children);
		} else {
			targets = [el];
		}
		if (!targets.length) return;
		hold();
		watchEntry(component, el, live, {
			threshold: num(o.threshold, 0.15), once,
			onEnter: enter,
			onLeave: () => { release(); hold(); },
		});
	});
}

// ── count ────────────────────────────────────────────────────────────

// The first number in the text: "1,200", "99.5", "15" of "15×", the first 7
// of "7/7/7". Three-digit groups after a separator are read as thousands
// ("1.200" is twelve hundred); give `to` where that guess is wrong.
const NUMBER = /\d{1,3}(?:([,.   ])\d{3})+(?:([.,])(\d+))?|\d+(?:([.,])(\d+))?/;

function parseNumber(m) {
	const s = m[0];
	const group = m[1] || null;
	const dec = m[2] || m[4] || null;
	const decimals = (m[3] || m[5] || "").length;
	let digits = s;
	if (group) digits = digits.split(group).join("");
	if (dec) digits = digits.replace(dec, ".");
	return { value: parseFloat(digits), group, dec: dec || ".", decimals };
}

/** Format like the original: same separators, same number of decimals. */
function formatLike(v, fmt, decimals, locale) {
	if (locale) {
		try {
			return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: !!fmt.group }).format(v);
		} catch (e) { /* fall through */ }
	}
	const fixed = Math.abs(v).toFixed(decimals);
	let [int, frac] = fixed.split(".");
	if (fmt.group) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, fmt.group);
	return (v < 0 ? "-" : "") + int + (frac ? fmt.dec + frac : "");
}

function applyCount(component, spec, live) {
	const el = rootOf(component);
	const w = win();
	if (!canEnter(el) || typeof w.requestAnimationFrame !== "function") return;
	const o = spec && typeof spec === "object" ? spec : {};

	soon(() => {
		if (!live.on) return;
		// Already on screen in the prerendered copy: the final figure stays.
		if (seenAtHandover(el)) return;
		const node = textNodes(el).find((n) => NUMBER.test(n.data));
		if (!node) return; // nothing to count: leave the text alone
		const m = node.data.match(NUMBER);
		const fmt = parseNumber(m);
		const to = num(o.to, fmt.value);
		const from = num(o.from, 0);
		const decimals = o.decimals !== undefined ? num(o.decimals, fmt.decimals) : fmt.decimals;
		const duration = num(o.duration, 1200);
		const locale = o.locale || null;
		if (!isFinite(to)) return;

		// The text node is split around the number. The counting copy is
		// aria-hidden and a visually hidden span carries the FINAL number, so
		// a screen reader reads the real figure throughout. At the end the
		// original text node goes back, so the text ends byte-identical.
		const doc = el.ownerDocument;
		const before = doc.createTextNode(node.data.slice(0, m.index));
		const after = doc.createTextNode(node.data.slice(m.index + m[0].length));
		const box = doc.createElement("span");
		const shown = doc.createElement("span");
		shown.setAttribute("aria-hidden", "true");
		const real = srOnly(doc.createElement("span"));
		real.textContent = m[0];
		box.append(shown, real);
		shown.textContent = formatLike(from, fmt, decimals, locale);
		const parent = node.parentNode;
		parent.insertBefore(before, node);
		parent.insertBefore(box, node);
		parent.insertBefore(after, node);
		parent.removeChild(node);

		let raf = 0, restored = false;
		const restore = () => {
			if (restored) return;
			restored = true;
			if (raf && typeof w.cancelAnimationFrame === "function") w.cancelAnimationFrame(raf);
			if (box.parentNode) {
				box.parentNode.insertBefore(node, before.parentNode === box.parentNode ? before : box);
				for (const n of [before, box, after]) n.parentNode && n.parentNode.removeChild(n);
			}
		};
		live.add(restore);

		const ease = (t) => 1 - Math.pow(1 - t, 3);
		const enter = (animate) => {
			if (!animate || duration <= 0) { restore(); return; }
			let t0 = null;
			const step = (now) => {
				if (restored) return;
				if (t0 === null) t0 = now;
				const t = Math.min(1, (now - t0) / duration);
				shown.textContent = formatLike(from + (to - from) * ease(t), fmt, decimals, locale);
				if (t < 1) raf = w.requestAnimationFrame(step);
				else restore();
			};
			raf = w.requestAnimationFrame(step);
		};
		watchEntry(component, el, live, { threshold: num(o.threshold, 0.15), once: true, onEnter: enter });
	});
}

// ── pin ──────────────────────────────────────────────────────────────

/** A CSS length in px, for the units a pin is written in. */
function toPx(v, el) {
	const w = win();
	if (typeof v === "number") return v;
	const m = String(v).trim().match(/^(-?[\d.]+)\s*([a-z%]*)$/i);
	if (!m) return 0;
	const n = parseFloat(m[1]);
	const u = m[2].toLowerCase();
	const vh = (w && w.innerHeight) || 0, vw = (w && w.innerWidth) || 0;
	const fs = (node) => { try { return parseFloat(w.getComputedStyle(node).fontSize) || 16; } catch (e) { return 16; } };
	switch (u) {
		case "": case "px": return n;
		case "vh": case "svh": case "lvh": case "dvh": return n * vh / 100;
		case "vw": case "svw": case "lvw": case "dvw": return n * vw / 100;
		case "rem": return n * fs(document.documentElement);
		case "em": return n * fs(el);
		default: return 0;
	}
}

/**
 * Sticky to the top, followed by an empty spacer as tall as the pin. Sticky
 * keeps the element inside its parent, and the spacer is in-flow content of
 * that parent, so the element stays stuck for exactly that much extra
 * scroll — no scroll listener, no transform, nothing for the main thread to
 * do, and it keeps working from prerendered HTML with no script at all.
 *
 * Why not a bottom margin on the element (the obvious approach, and the
 * first one tried): sticky confines the element's MARGIN box to the parent,
 * so its own margin never leaves it any room to travel. Checked in Chrome —
 * the element simply scrolled away.
 *
 * The spacer goes in once the element is in the document (its parent is
 * unknown before), is aria-hidden, and is removed again on re-set and on
 * destroy(). Pinning is NOT motion — the content holds still while the page
 * scrolls — so it applies under reduced motion too.
 */
function applyPin(component, pin, live) {
	const el = rootOf(component);
	if (!el || !el.style) return;
	const L = len(pin);
	const s = el.style;
	const prev = { position: s.position, top: s.top };
	s.position = "sticky";
	if (!s.top) s.top = "0px";
	component._pinLength = L;
	live.add(() => {
		Object.assign(s, prev);
		component._pinLength = null;
	});

	whenConnected(el, live, () => {
		const parent = el.parentNode;
		if (!parent) return;
		const spacer = el.ownerDocument.createElement("div");
		spacer.setAttribute("aria-hidden", "true");
		spacer.setAttribute("data-nod-pin-spacer", "");
		spacer.style.height = L;
		spacer.style.pointerEvents = "none";
		parent.insertBefore(spacer, el.nextSibling);
		live.add(() => spacer.parentNode && spacer.parentNode.removeChild(spacer));
		component._track(() => spacer.parentNode && spacer.parentNode.removeChild(spacer));
	});
}

/**
 * `pin` as written: a length ("80vh"), one {length, media} or an ARRAY of
 * them, the first whose media matches winning. A pin that only makes sense
 * at some sizes (a sideways track on a desktop, never on a phone) or only
 * with motion (`prefers-reduced-motion: no-preference`) is a variant with a
 * media query. When the match changes the pin and its spacer come and go;
 * where nothing matches the element is simply not pinned. No matchMedia
 * (the prerender) → only a variant without `media` applies.
 */
function pinVariants(pin) {
	if (typeof pin === "string" || typeof pin === "number") return null;
	if (Array.isArray(pin)) return pin.filter((v) => v && typeof v === "object");
	if (pin && typeof pin === "object") return [pin];
	return null;
}

function applyPinVariants(component, pin, live) {
	const variants = pinVariants(pin);
	if (!variants) { applyPin(component, pin, live); return; }
	const w = win();
	let sub = null;
	const start = () => {
		if (sub) { sub(); sub = null; }
		const v = pickVariant(variants);
		const L = v && (v.length ?? v.pin);
		if (L === undefined || L === null || L === "" || L === false) return;
		const offs = [];
		const local = { on: true, add: (fn) => offs.push(fn) };
		applyPin(component, L, local);
		sub = () => {
			local.on = false;
			while (offs.length) { try { offs.pop()(); } catch (e) { /* keep draining */ } }
		};
	};
	start();
	live.add(() => { if (sub) { sub(); sub = null; } });
	if (!w || typeof w.matchMedia !== "function") return;
	for (const v of variants) {
		if (!v.media) continue;
		let mql;
		try { mql = w.matchMedia(v.media); } catch (e) { continue; }
		if (mql && typeof mql.addEventListener === "function") listen(component, live, mql, "change", start);
		else if (mql && typeof mql.addListener === "function") {
			mql.addListener(start);
			const off = () => mql.removeListener(start);
			live.add(off);
			component._track(off);
		}
	}
}

// ── scrub ────────────────────────────────────────────────────────────

const RANGES = ["enter", "full", "top", "exit", "page", "pin"];

/** Scroll offset (window.scrollY) at which a named range point is reached. */
function rangePoint(name, g, isEnd) {
	switch (name) {
		case "enter": return g.top - g.vh;
		case "full": return g.h <= g.vh ? g.top + g.h - g.vh : g.top;
		case "top": return g.top;
		case "exit": return g.top + g.pin + g.h;
		case "page": return isEnd ? g.max : 0;
		case "pin": return isEnd ? g.top + g.pin : g.top;
		default: return isEnd ? g.top + g.pin + g.h : g.top - g.vh;
	}
}

/** Keyframes in array form, whichever form they were written in. */
function framesOf(kf) {
	if (Array.isArray(kf)) return kf.filter((k) => k && typeof k === "object");
	if (kf && typeof kf === "object") {
		// Property-indexed: {opacity: [0, 1]} → [{opacity: 0}, {opacity: 1}].
		const n = Math.max(0, ...Object.values(kf).map((v) => (Array.isArray(v) ? v.length : 1)));
		return Array.from({ length: n }, (_, i) => {
			const f = {};
			for (const k in kf) f[k] = Array.isArray(kf[k]) ? kf[k][Math.min(i, kf[k].length - 1)] : kf[k];
			return f;
		});
	}
	return [];
}

const NOT_CSS = new Set(["offset", "easing", "composite"]);

/** Write a keyframe as inline style: the end state, without animating. */
export function writeFrame(el, frame) {
	if (!el || !el.style || !frame) return;
	for (const k in frame) {
		if (NOT_CSS.has(k)) continue;
		const v = frame[k] == null ? "" : String(frame[k]);
		if (k.startsWith("--")) el.style.setProperty(k, v);
		else el.style[k] = v;
	}
}

function emitProgress(component, p) {
	if (component._scrubProgress === p) return;
	component._scrubProgress = p;
	const el = rootOf(component);
	if (el && el.style && typeof el.style.setProperty === "function") el.style.setProperty("--progress", p.toFixed(4));
	for (const fn of component._scrubSubs || []) {
		try { fn(p); } catch (e) { console.warn("nodality: onScrubProgress listener threw", e); }
	}
}

function pickVariant(scrub) {
	if (!Array.isArray(scrub)) return scrub;
	const w = win();
	for (const v of scrub) {
		if (!v || typeof v !== "object") continue;
		if (!v.media) return v;
		try { if (w && typeof w.matchMedia === "function" && w.matchMedia(v.media).matches) return v; } catch (e) { /* bad query */ }
	}
	return null;
}

/**
 * The box whose scroll drives a scrub: the nearest ancestor that actually
 * scrolls vertically (overflow-y auto/scroll AND content taller than it), or
 * null for the window. Only a box that scrolls counts — `overflow-x: auto`
 * alone computes overflow-y to auto too, and a horizontal scroller must not
 * capture a scrub that the page's own scroll should drive.
 */
export function scrubSourceOf(el) {
	const w = win();
	let p = el && el.parentElement;
	while (p && p !== document.body && p !== document.documentElement) {
		let cs = null;
		try { cs = w.getComputedStyle(p); } catch (e) { return null; }
		const oy = cs && cs.overflowY;
		if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
		p = p.parentElement;
	}
	return null;
}

function applyScrub(component, scrub, live, elementSource) {
	const el = rootOf(component);
	const w = win();
	if (!el || !w || typeof el.animate !== "function") return; // headless: natural state
	if (isPrerendering()) return; // the natural state, not a first frame nothing will move

	// Reduced motion: the END state, once, and no listeners. A scrub usually
	// lands its content where it should be read (faded in, in place), so the
	// end is the state worth showing still.
	if (prefersReducedMotion()) {
		const v = pickVariant(scrub);
		const frames = v ? framesOf(v.keyframes) : [];
		if (frames.length) writeFrame(el, frames[frames.length - 1]);
		if (v) emitProgress(component, 1);
		return;
	}

	const D = 1000;
	// A top-level `scrubSource` next to an array of variants applies to all of them.
	const sourceMode = elementSource ?? (!Array.isArray(scrub) && scrub ? scrub.scrubSource : undefined);
	let sub = null; // the running variant's own teardown
	const start = () => {
		if (sub) { sub(); sub = null; }
		const v = pickVariant(scrub);
		if (!v) return;
		const frames = framesOf(v.keyframes);
		const from = RANGES.includes(v.from) ? v.from : "enter";
		const to = RANGES.includes(v.to) ? v.to : "exit";
		let anim = null;
		if (frames.length >= 1) {
			anim = el.animate(frames, { duration: D, easing: v.easing || "linear", fill: "both" });
			anim.pause();
		}
		const offs = [];
		const useAuto = (v.scrubSource ?? sourceMode) !== "window";
		let source = null; // the scrolling ancestor, or null for the window
		const offSource = [];
		const pickSource = () => {
			const next = useAuto && el.isConnected ? scrubSourceOf(el) : null;
			if (next === source) return;
			for (const f of offSource.splice(0)) { try { f(); } catch (e) { /* gone */ } }
			source = next;
			if (source) {
				const s0 = source;
				s0.addEventListener("scroll", onScroll, { passive: true });
				offSource.push(() => s0.removeEventListener("scroll", onScroll, { passive: true }));
			}
		};
		offs.push(() => { for (const f of offSource.splice(0)) { try { f(); } catch (e) { /* gone */ } } source = null; });
		// Scroll position, viewport height and scroll range of the source.
		const frameOf = () => {
			if (source) {
				const r = source.getBoundingClientRect();
				return { sy: source.scrollTop || 0, vh: source.clientHeight || 0, originTop: r.top + (source.clientTop || 0),
					max: Math.max(0, (source.scrollHeight || 0) - (source.clientHeight || 0)) };
			}
			const vh = w.innerHeight || 0;
			const doc = document.documentElement;
			return { sy: w.scrollY || w.pageYOffset || 0, vh, originTop: 0, max: Math.max(0, (doc ? doc.scrollHeight : 0) - vh) };
		};
		let pinnedTop = null;
		const measurePinned = () => {
			// A stuck element's rect is where it is stuck, not where it sits
			// in the flow. Measure the flow position once per layout change
			// (resize, content above it growing), never per scroll frame.
			const s = el.style.position;
			el.style.position = "relative";
			const f = frameOf();
			pinnedTop = el.getBoundingClientRect().top - f.originTop + f.sy;
			el.style.position = s;
		};
		const update = () => {
			if (!el.isConnected) return;
			const f = frameOf();
			const sy = f.sy;
			const vh = f.vh;
			const pin = component._pinLength ? toPx(component._pinLength, el) : 0;
			const rect = el.getBoundingClientRect();
			if (pin && pinnedTop === null) measurePinned();
			const g = {
				top: pin ? pinnedTop : rect.top - f.originTop + sy, h: rect.height, vh, pin,
				max: f.max,
			};
			const a = rangePoint(from, g, false), b = rangePoint(to, g, true);
			const p = b > a ? clamp01((sy - a) / (b - a)) : (sy >= b ? 1 : 0);
			if (anim) anim.currentTime = p * D;
			emitProgress(component, p);
		};
		const onScroll = frameThrottle(update);
		const onLayout = frameThrottle(() => { pickSource(); if (component._pinLength && el.isConnected) measurePinned(); update(); });
		const local = { on: true, add: (fn) => offs.push(fn) };
		listen(component, local, w, "scroll", onScroll, { passive: true });
		listen(component, local, w, "resize", onLayout);
		if (typeof w.ResizeObserver === "function" && document.body) {
			const ro = new w.ResizeObserver(onLayout);
			ro.observe(document.body);
			offs.push(() => ro.disconnect());
			component._track(() => ro.disconnect());
		}
		whenConnected(el, local, onLayout);
		sub = () => {
			local.on = false;
			for (const f of offs.splice(0)) { try { f(); } catch (e) { /* gone */ } }
			if (anim) { try { anim.cancel(); } catch (e) { /* gone */ } }
		};
	};
	start();
	live.add(() => { if (sub) { sub(); sub = null; } });

	// Variants are re-chosen when a query starts or stops matching.
	if (Array.isArray(scrub) && typeof w.matchMedia === "function") {
		for (const v of scrub) {
			if (!v || !v.media) continue;
			let mql;
			try { mql = w.matchMedia(v.media); } catch (e) { continue; }
			if (mql && typeof mql.addEventListener === "function") listen(component, live, mql, "change", start);
			else if (mql && typeof mql.addListener === "function") {
				mql.addListener(start);
				const off = () => mql.removeListener(start);
				live.add(off);
				component._track(off);
			}
		}
	}
}

// ── slice ────────────────────────────────────────────────────────────

/**
 * Letters cut into horizontal slices that slide apart, driven by scroll: the
 * slices come together as the text scrolls in, the letters hold whole while
 * it is read, and they break apart again, letter by letter in a shuffled
 * order, as it scrolls away.
 *
 * Each letter keeps its real character in the flow (transparent: it sizes
 * the box, is what a screen reader reads, what selection copies and what
 * innerText returns). The visible slices are aria-hidden spans whose glyph
 * is CSS generated content (`attr(data-nod-slice)`), so they add no text to
 * the page. Words are wrapped whole (nowrap), so a line never breaks inside
 * one. Spans the page put in the text — a highlighted phrase — are kept: the
 * letters are split inside them.
 *
 * The progress comes from a progress-only scrub over {from, to}, or from the
 * element's own `scrub` when it has one. Headless (the prerender) and under
 * reduced motion nothing is split: the text is plain and whole.
 */
let sliceStyleAdded = false;
function addSliceStyle(doc) {
	if (sliceStyleAdded || !doc || !doc.head) return;
	sliceStyleAdded = true;
	const st = doc.createElement("style");
	st.setAttribute("data-nod-slice-style", "");
	// The two outer slices are the letter box's own ::before / ::after, so
	// they are not elements: innerText does not see them (an absolutely
	// placed element is a block box, and innerText would put every letter
	// on its own line). `/ ""` is empty alternative text, so a screen reader
	// does not read the generated glyph either; the first `content` is the
	// fallback for a browser without that syntax.
	st.textContent = [
		"[data-nod-ch]{position:relative;display:inline-block}",
		"[data-nod-ch]::before,[data-nod-ch]::after{content:attr(data-nod-ch);content:attr(data-nod-ch) / \"\";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none}",
		"[data-nod-ch]::before{clip-path:var(--nod-c0);transform:var(--nod-s0,none)}",
		"[data-nod-ch]::after{clip-path:var(--nod-c1);transform:var(--nod-s1,none)}",
	].join("");
	doc.head.appendChild(st);
}

/** A small seeded PRNG, so a page shuffles the same way on every visit. */
function seeded(seed) {
	let a = (Number(seed) || 1) >>> 0;
	return () => {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Each letter becomes <span data-nod-ch="P"><span>P</span></span>. The inner
 * span is the real character. With 2 slices it is transparent (it sizes the
 * box and is the text) and the slices are ::before (top) and ::after
 * (bottom); with 3 it is also the visible middle slice. The outer slices
 * reach 0.45em past the box, so accents and descenders are not cut.
 */
function splitSlices(el, slices) {
	const doc = el.ownerDocument;
	const letters = [], records = [];
	const third = (100 / 3).toFixed(3);
	const clipTop = slices === 3 ? `inset(-0.45em -0.2em ${(200 / 3).toFixed(3)}% -0.2em)` : "inset(-0.45em -0.2em 50% -0.2em)";
	const clipBottom = slices === 3 ? `inset(${(200 / 3).toFixed(3)}% -0.2em -0.45em -0.2em)` : "inset(50% -0.2em -0.45em -0.2em)";
	for (const node of textNodes(el)) {
		if (node.parentNode && node.parentNode.closest && node.parentNode.closest("[data-nod-ch]")) continue;
		const frag = doc.createDocumentFragment();
		const inserted = [];
		for (const part of node.data.split(/(\s+)/)) {
			if (!part) continue;
			if (/^\s+$/.test(part)) { const t = doc.createTextNode(part); inserted.push(t); frag.appendChild(t); continue; }
			const word = doc.createElement("span");
			word.style.display = "inline-block";
			word.style.whiteSpace = "nowrap";
			for (const ch of Array.from(part)) {
				const box = doc.createElement("span");
				box.setAttribute("data-nod-ch", ch);
				// The box clips what leaves it, so a slice slid away is gone.
				box.style.clipPath = "inset(-0.45em -0.2em)";
				box.style.setProperty("--nod-c0", clipTop);
				box.style.setProperty("--nod-c1", clipBottom);
				const real = doc.createElement("span");
				real.textContent = ch;
				if (slices === 3) {
					real.style.display = "inline-block";
					real.style.clipPath = `inset(${third}% -0.2em ${third}% -0.2em)`;
				} else real.style.color = "transparent";
				box.appendChild(real);
				const i = letters.length;
				letters.push({ box, real, mid: i % 2 ? 1 : -1, last: null });
				word.appendChild(box);
			}
			inserted.push(word);
			frag.appendChild(word);
		}
		node.parentNode.replaceChild(frag, node);
		records.push({ node, inserted });
	}
	const restore = () => {
		for (const { node, inserted } of records) {
			const first = inserted[0];
			if (!first || !first.parentNode) continue;
			first.parentNode.insertBefore(node, first);
			for (const n of inserted) n.parentNode && n.parentNode.removeChild(n);
		}
		records.length = 0;
	};
	return { letters, restore };
}

function applySlice(component, spec, obj, live) {
	const el = rootOf(component);
	const w = win();
	// The same gate as scrub: no Web Animations means no browser to scroll.
	if (!el || !w || typeof el.animate !== "function" || isPrerendering() || prefersReducedMotion()) return;
	const o = spec && typeof spec === "object" ? spec : {};
	const slices = Math.round(num(o.slices, 2)) === 3 ? 3 : 2;
	const assemble = clamp01(num(o.assemble, 0.3));
	const scatter = clamp01(num(o.scatter, 0.72));
	const stagger = Math.min(0.95, clamp01(num(o.stagger, 0.6)));
	const distance = num(o.distance, 1.5); // in letter heights
	const order = o.order === "start" || o.order === "end" || o.order === "center" ? o.order : "random";

	// Progress: the element's own scrub when it has one, else a progress-only
	// scrub over this option's range.
	if (!obj.scrub) {
		applyScrub(component, { from: o.from || "enter", to: o.to || "exit" }, live, o.scrubSource ?? obj.scrubSource);
	}

	let split = null, ranks = [], lastP = null;
	const outCubic = (t) => 1 - Math.pow(1 - t, 3);
	const inCubic = (t) => t * t * t;
	const draw = (p) => {
		if (!split) return;
		lastP = p;
		const n = split.letters.length;
		const span = 1 - stagger;
		split.letters.forEach((L, i) => {
			const start = n > 1 ? (ranks[i] / (n - 1)) * stagger : 0;
			const local = (q) => clamp01((q - start) / span);
			let off = 0;
			if (assemble > 0 && p < assemble) off = 1 - outCubic(local(p / assemble));
			else if (scatter < 1 && p > scatter) off = inCubic(local((p - scatter) / (1 - scatter)));
			const d = (off * distance * 100).toFixed(2);
			const key = off <= 0.0005 ? "" : d;
			if (L.last === key) return;
			L.last = key;
			if (!key) {
				L.box.style.removeProperty("--nod-s0");
				L.box.style.removeProperty("--nod-s1");
				if (slices === 3) L.real.style.transform = "";
				return;
			}
			L.box.style.setProperty("--nod-s0", `translateY(-${d}%)`);
			L.box.style.setProperty("--nod-s1", `translateY(${d}%)`);
			if (slices === 3) L.real.style.transform = `translateY(${L.mid < 0 ? "-" : ""}${d}%)`;
		});
	};

	const unsub = component.onScrubProgress((p) => draw(p));
	live.add(unsub);

	whenConnected(el, live, () => {
		// After this task: node ops (a highlighted span) run after set().
		const t = setTimeout(() => {
			if (!live.on) return;
			addSliceStyle(el.ownerDocument);
			split = splitSlices(el, slices);
			const n = split.letters.length;
			const idx = split.letters.map((_, i) => i);
			if (order === "random") {
				const rnd = seeded(o.seed ?? 7);
				for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
			} else if (order === "end") idx.reverse();
			else if (order === "center") idx.sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
			ranks = new Array(n);
			idx.forEach((letter, rank) => { ranks[letter] = rank; });
			draw(typeof component._scrubProgress === "number" ? component._scrubProgress : (lastP ?? 0));
		}, 0);
		live.add(() => clearTimeout(t));
	});
	live.add(() => { if (split) { split.restore(); split = null; } });
}

// ── fit ──────────────────────────────────────────────────────────────

/**
 * Font size that makes the text exactly fill the element's width on one
 * line. The text's own width comes from a Range over its contents (the box
 * is as wide as its container either way); the size is solved in a couple
 * of proportional steps, because letter-spacing in px does not scale.
 */
function applyFit(component, live) {
	const el = rootOf(component);
	const w = win();
	if (!el || !w || typeof document === "undefined" || typeof document.createRange !== "function") return;
	// Not at prerender: there is no width to fit to, and nowrap baked into the
	// HTML would push a long heading off a phone screen until the script runs.
	if (isPrerendering()) return;
	const prevWS = el.style.whiteSpace, prevFS = el.style.fontSize;
	el.style.whiteSpace = "nowrap";
	live.add(() => { el.style.whiteSpace = prevWS; el.style.fontSize = prevFS; });

	let lastW = -1;
	const fit = (force) => {
		if (!live.on || !el.isConnected) return;
		const cs = w.getComputedStyle(el);
		const avail = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
		if (avail <= 0 || (!force && avail === lastW)) return;
		lastW = avail;
		const range = document.createRange();
		range.selectNodeContents(el);
		if (typeof range.getBoundingClientRect !== "function") return;
		for (let i = 0; i < 3; i++) {
			const textW = range.getBoundingClientRect().width;
			const size = parseFloat(w.getComputedStyle(el).fontSize);
			if (!textW || !size) return;
			if (Math.abs(textW - avail) < 0.5) break;
			el.style.fontSize = `${Math.floor(size * (avail / textW) * 100) / 100}px`;
		}
	};
	whenConnected(el, live, () => fit(true));
	if (typeof w.ResizeObserver === "function") {
		// Only a change of WIDTH re-fits: the fit itself changes the height,
		// which would otherwise call straight back in.
		const ro = new w.ResizeObserver(() => fit(false));
		ro.observe(el);
		live.add(() => ro.disconnect());
		component._track(() => ro.disconnect());
	} else {
		listen(component, live, w, "resize", () => fit(false));
	}
	const fonts = document.fonts;
	if (fonts) {
		if (fonts.ready && typeof fonts.ready.then === "function") fonts.ready.then(() => fit(true), () => {});
		listen(component, live, fonts, "loadingdone", () => fit(true));
	}
}

// ── entry point ──────────────────────────────────────────────────────

/**
 * Apply the motion options on `obj` to `component`. Called by applyBehaviours
 * after every set(); a set() without any of these options only tears down
 * what an earlier set() attached.
 */
export function applyMotion(component, obj) {
	if (!component || !obj || typeof obj !== "object") return;

	if (typeof component._motionOff === "function") component._motionOff();
	component._motionOff = null;

	// A subscription point for whatever wants the scrub's progress — a 3D
	// `model` turning its camera, for one. Defined on every component (not
	// enumerable, so nothing that walks a component sees it) and kept across
	// re-sets; the listeners hear every scrub this component runs.
	if (typeof component.onScrubProgress !== "function") {
		Object.defineProperty(component, "onScrubProgress", {
			configurable: true, enumerable: false, writable: true,
			value(fn) {
				if (typeof fn !== "function") return () => {};
				const subs = this._scrubSubs || (this._scrubSubs = []);
				subs.push(fn);
				if (typeof this._scrubProgress === "number") fn(this._scrubProgress);
				return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
			},
		});
	}

	//@ reveal {object-or-bool}: Entrance when the element scrolls into view: {y: 24, x: 0, opacity: 0, scale, duration: 700, delay: 0, easing, stagger: ms, by: "word"|"line", once: true, threshold: 0.15}. `stagger` brings the element's CHILDREN in one after another; `by` (text) brings its words or lines in. Ends at the element's own opacity and position. Elements already scrolled past show at once, and so does what was on screen in the prerendered copy when the live page takes over. Nothing is hidden for reduced-motion visitors or where it cannot run (the prerender). On `img`, `reveal` is the image's own mask reveal instead.
	const reveal = obj.reveal;
	//@ scrub {object-or-array}: Scroll-linked animation: {keyframes: [{…css}, {…css}], from: "enter", to: "exit", easing: "linear"}. The keyframes play as the page scrolls between two points — "enter" (element top at viewport bottom), "full" (fully in view), "top" (top at viewport top), "exit" (bottom at viewport top), "page" (the whole document), "pin" (the `pin` length). Also sets `--progress` (0–1) on the element. An ARRAY of {media: "(min-width: 768px)", …} picks the first whose media matches. Reduced motion shows the last keyframe.
	const scrub = obj.scrub;
	//@ scrubSource: What scroll drives `scrub` — "auto" or "window". "auto" (default): the nearest ancestor that actually scrolls vertically, when the element sits in one (a scrolling panel, a modal), else the window. "window": always the page's own scroll. With a scrolling ancestor the range points ("enter", "exit", "page", …) are measured against that box instead of the viewport. Also accepted inside the scrub object or a variant.
	//@ pin {css-length-or-array}: Keep the element stuck to the top of the viewport for this much extra scroll, e.g. "80vh". Also {length: "200vh", media: "(min-width: 900px)"} or an ARRAY of those — the first whose media matches wins, and nothing matching means no pin (a sideways track on desktop only, or only with `prefers-reduced-motion: no-preference`) — position: sticky, followed by an empty aria-hidden spacer of that height. Sticks within its PARENT: it stays stuck until the parent ends, so siblings after it scroll past underneath it — pin the last child of a wrap. An ancestor with overflow other than visible, or a stretching flex row, stops it sticking. Applies under reduced motion too (pinning is not motion).
	const pin = obj.pin;
	//@ count {object-or-bool}: Count the first number in the text up when it scrolls into view: `true`, or {from: 0, to, duration: 1200, decimals, locale}. Only the first number moves; the text ends exactly as written and screen readers get the final figure throughout. Reduced motion shows the final text.
	const count = obj.count;
	//@ fit {bool}: Scale the font so the text fills the element's width on one line; re-fits on resize and when web fonts load.
	const fit = obj.fit;
	//@ slice {object-or-bool}: Letters cut into horizontal slices that slide apart with the scroll: they come together as the text scrolls in, hold whole while it is read, and break apart letter by letter as it scrolls away. `true`, or {slices: 2 (or 3), from: "enter", to: "exit", assemble: 0.3, scatter: 0.72, stagger: 0.6, order: "random"|"start"|"end"|"center", seed, distance: 1.5}. `assemble` is the share of the range spent coming together (0: starts whole), `scatter` where breaking apart begins (1: never). Uses the element's own `scrub` range when it has one. The real text stays in the page for screen readers, selection and innerText; the slices are the letter's own ::before/::after (with empty alt text), not elements. Nothing is split at prerender or under reduced motion. Do not combine with `reveal` by word or line on the same element.
	const slice = obj.slice;

	if (!reveal && !scrub && !pin && !count && !fit && !slice) return;
	if (!rootOf(component)) return;

	const offs = [];
	const live = { on: true, add: (fn) => offs.push(fn) };
	component._motionOff = () => {
		live.on = false;
		while (offs.length) { try { offs.pop()(); } catch (e) { /* keep draining */ } }
	};
	if (!component._motionTracked) {
		component._motionTracked = true;
		component._track(() => { if (typeof component._motionOff === "function") component._motionOff(); });
	}

	if (pin) applyPinVariants(component, pin, live);
	if (scrub && (Array.isArray(scrub) || typeof scrub === "object")) applyScrub(component, scrub, live, obj.scrubSource);
	// `img` reveals through its own mask (Image.reveal) — any component with
	// a reveal of its own owns the option, and `mask` always means that one.
	if (reveal && typeof component.reveal !== "function" && !(typeof reveal === "object" && "mask" in reveal)) {
		applyReveal(component, reveal, obj, live);
	}
	if (count) applyCount(component, count, live);
	if (fit) applyFit(component, live);
	if (slice) applySlice(component, slice, obj, live);
}

/**
 * The design-node `animation` op under reduced motion. Called by chainReact
 * before it would animate; returns true when it handled the op, so chainReact
 * skips the animated path.
 *
 * - fireAt ("inview" or a px offset): the END state — the last keyframe of
 *   keyframesOpen — straight away, with no observer and no scroll listener.
 * - no fireAt (opened and closed by events, e.g. a side bar's links): the
 *   same open/closed states on the same events, but switched instantly.
 */
export function settleAnimationOp(component, animation) {
	const op = animation && animation.op;
	if (!op || !component || !component.res || !prefersReducedMotion()) return false;
	const el = component.res;
	const last = (kf) => { const f = framesOf(kf); return f.length ? f[f.length - 1] : null; };
	const show = (frame) => {
		if (!frame) return;
		if (component._settled && typeof component._settled.cancel === "function") component._settled.cancel();
		component._settled = null;
		if (typeof el.animate === "function") {
			// Two identical frames: a held state, through the same mechanism
			// (an animation's fill) the animated path ends in.
			const f = Object.fromEntries(Object.entries(frame).filter(([k]) => !NOT_CSS.has(k)));
			component._settled = el.animate([f, f], { duration: 0, fill: "forwards" });
		} else writeFrame(el, frame);
	};
	if (op.fireAt) { show(last(op.keyframesOpen)); return true; }

	show(last(op.keyframesClose));
	if (!component._settleWired) {
		component._settleWired = true;
		const w = win();
		const open = () => show(last(op.keyframesOpen));
		const close = () => show(last(op.keyframesClose));
		component._on(w, "sidebar:open", open);
		component._on(w, "sidebar:closed", close);
		if (component.openTag && component.closeTag) {
			component._on(w, component.openTag, open);
			component._on(w, component.closeTag, close);
		}
	}
	return true;
}

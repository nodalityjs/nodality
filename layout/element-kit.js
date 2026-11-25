/*!
 * nodality v1.5.9
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

// element-kit.js — the few things model, disclosure, tabs, scroller and
// marquee all need, kept in one place so the five do not grow five slightly
// different copies (the fate of every helper this library has duplicated).
//
// Deliberately NOT imported by lib/element-mapper.js: the schema generator
// scans the files the mapper imports for `obj.<name>` reads, and the design-op
// plumbing below reads `obj.stroke`, `obj.filtera`… which are the mapper's
// bookkeeping, not options an author writes. Living here keeps them out of
// the five types' advertised vocabulary.

import { toObjectSource } from "../lib/codegen.js";

/** True where the visitor asked for less motion. False headless. */
export function reducedMotion() {
	try {
		return typeof window !== "undefined" && typeof window.matchMedia === "function"
			&& !!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch (e) { return false; }
}

/**
 * Is `node` laid out right to left? The computed `direction` where the engine
 * has one, else the nearest `dir` attribute (jsdom computes no inherited
 * direction). Read when it matters — at a key press, at a scroll — not once at
 * build time, because the node is usually not in the page yet when it is built
 * and a page may switch direction.
 */
export function isRTL(node) {
	if (!node || node.nodeType !== 1) return false;
	try {
		const w = node.ownerDocument && node.ownerDocument.defaultView;
		const cs = w && typeof w.getComputedStyle === "function" ? w.getComputedStyle(node) : null;
		if (cs && cs.direction === "rtl") return true;
	} catch (e) { /* detached in an old engine */ }
	const holder = typeof node.closest === "function" ? node.closest("[dir]") : null;
	const dir = holder ? String(holder.getAttribute("dir")).toLowerCase() : "";
	return dir === "rtl";
}

/** Does a media query match right now? An absent query always matches. */
export function mediaMatches(query) {
	if (!query) return true;
	try {
		return typeof window !== "undefined" && typeof window.matchMedia === "function"
			&& !!window.matchMedia(query).matches;
	} catch (e) { return false; }
}

/**
 * The DOM node a child component renders to. Components disagree about what
 * `render()` returns without a selector (most return `res`, a few return
 * `this`), so ask for the node by every name the mapper itself knows.
 */
export function nodeOf(child) {
	if (!child) return null;
	if (typeof Node !== "undefined" && child instanceof Node) return child;
	if (child.nodeType) return child;
	let out = typeof child.render === "function" ? child.render() : null;
	if (out && !out.nodeType) out = out.res || out.formElement || out.el || out.container || null;
	if (!out) out = child.res || child.formElement || child.el || child.container || null;
	return out && out.nodeType ? out : null;
}

/** A child's emitted source, as one string. */
export function codeOf(child, indent = 0) {
	if (!child || typeof child.toCode !== "function") return "";
	const c = child.toCode(indent);
	return Array.isArray(c) ? c.flat(Infinity).join("") : String(c);
}

/** Options as source, minus what codegen cannot (or should not) write. */
export function optionsSource(obj) {
	const clean = {};
	for (const k of Object.keys(obj || {})) {
		const v = obj[k];
		if (v == null || typeof v === "function") continue;
		clean[k] = v;
	}
	return toObjectSource(clean, 4);
}

/** Apply a {camelCaseProperty: value} object to an element's inline style. */
export function applyStyle(node, style) {
	if (!node || !style || typeof style !== "object") return;
	for (const k of Object.keys(style)) {
		const v = style[k];
		if (v == null) continue;
		if (k.startsWith("--")) node.style.setProperty(k, String(v));
		else node.style[k] = typeof v === "number" && v !== 0 && /^(width|height|gap|padding|margin|top|left|right|bottom|fontSize|borderRadius)/.test(k) ? `${v}px` : v;
	}
}

/** Undo applyStyle for the keys of `style`, so a second style can replace it. */
export function clearStyle(node, style) {
	if (!node || !style || typeof style !== "object") return;
	for (const k of Object.keys(style)) {
		if (k.startsWith("--")) node.style.removeProperty(k);
		else node.style[k] = "";
	}
}

/** A CSS length: a bare number is pixels, a string is used verbatim. */
export const cssLength = (v) => (typeof v === "number" ? `${v}px` : v == null ? v : String(v));

// Per-page counter for derived ids (tab ↔ panel wiring). Deterministic: the
// same page builds the same ids in the same order, so a prerender is
// byte-identical between builds.
let seq = 0;
/** An id base for derived ids: the element's own id when it has one. */
export function idBase(prefix, id) {
	if (id != null && id !== "") return String(id).replace(/^#/, "");
	seq += 1;
	return `nod-${prefix}-${seq}`;
}

/**
 * Design nodes (gradient, shadow, blast, filter, animation, transform…), the
 * way Wrapper and UList apply them: the mapper hands over what `filtero`
 * found, and Animator.chainReact applies it per range. Copied from those two
 * rather than reinvented, so a design node means the same thing on the new
 * types as on `wrap`.
 */
export function applyDesignOps(comp, obj) {
	if (!obj) return;
	const animTransform = obj.transform && typeof obj.transform === "object" ? obj.transform : undefined;
	const ft = [obj.stroke, obj.gradient, obj.animation, obj.backgroundOp, obj.marginOp,
		obj.shadowOp, obj.filtera, animTransform].filter((f) => f && f.op && typeof f.op === "object");
	if (!ft.length) return;
	// chainReact reads the shadow node as `this.options.shadow` — on every
	// resize, not only now — so it has to live there. The mapper passes it as
	// `shadowOp` because `model` has an option of its own called `shadow`;
	// that option has been read by the time this runs.
	if (obj.shadowOp) comp.options = { ...comp.options, shadow: obj.shadowOp };
	if (obj.gradient && obj.gradient.op) {
		comp.globalGradient = obj.gradient.op.gradient;
		if (obj.gradient.op.direction === "radial") comp.globalGradient = "radial-gradient(circle at center, orange, green)";
	}
	if (obj.stroke && obj.stroke.op && typeof comp.setAny === "function") {
		comp.setAny({ globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}` });
	}
	const arr = ft.map((f) => ({ range: f.range, log: f.op.name, target: f.target, op: f.op }));
	const keep = [];
	if (obj.borderObj) keep.push("border");
	if (obj.background) keep.push("background");
	if (obj.mar) keep.push("margin");
	if (obj.animation) keep.push("animation");
	if (animTransform) keep.push("transform");
	if (obj.gradient) keep.push("gradient");
	comp.chainReact(arr, obj.id, keep);
}

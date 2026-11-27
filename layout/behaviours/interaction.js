/*!
 * nodality v1.5.10
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

// interaction.js — the interaction and accessibility options every element
// accepts: hover/focus, group hover, aria/role/tabIndex/lang/title, copy to
// clipboard, scroll spy and hide-on-scroll.
//
// Why a behaviour module rather than code in each component: until now `hover`
// worked only on the dozen components that happen to run commonMethods, and
// only for the mouse. A keyboard user never saw a hover state anywhere, and
// a page could not name an element for a screen reader at all without DOM
// patching, which the house rules forbid. Animator calls applyInteraction()
// after EVERY subclass's set() (see the wrapped set in animator.js), so one
// implementation reaches all thirty-odd components, including the ones whose
// own set() reads nothing but its own keys.
//
// Contract:
//   • A page that uses none of these options is untouched: the first thing
//     applyInteraction does is return when no option is present, so the
//     rendered HTML stays byte-identical.
//   • Everything attached to the page goes through component._track, so
//     component.destroy() (and Des.destroy()) releases it and restores the
//     inline styles it changed.
//   • Safe headless: no IntersectionObserver, no clipboard, no matchMedia —
//     each feature degrades to doing nothing rather than throwing.
//   • set() may run more than once on a component; each run replaces the
//     previous run's behaviour instead of stacking a second copy.

const KEYS = ["hover", "focus", "group", "groupHover", "aria", "role", "tabIndex",
	"lang", "title", "copy", "spy", "hideOnScroll"];

// ── allowlists for semantic tags (used by Wrapper `as`, Text `tag`) ──────
// Kept here so the two lists live beside the rest of the accessibility
// vocabulary, and so the warning text is written once.

/** Block-level containers a `wrap` may render as, via `as`. */
export const WRAP_TAGS = ["section", "article", "aside", "header", "footer", "main", "nav",
	"figure", "figcaption", "blockquote", "ul", "ol", "li", "dl", "dt", "dd", "address",
	"time", "details", "summary"];

/** Tags a text element may render as, via `tag`, beside h1–h6 and p. */
export const TEXT_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "figcaption",
	"li", "dt", "dd", "cite", "time", "small", "strong", "em", "span", "q", "address", "label"];

/**
 * Re-create `component.res` as another tag, keeping its attributes (inline
 * style included) and children. Returns true if it swapped. Property-based
 * handlers (onmouseover…) do not survive a swap, so callers swap BEFORE they
 * attach anything — Wrapper does it first thing in set().
 */
export function swapTag(component, tag, allowed, what) {
	const want = String(tag == null ? "" : tag).trim().toLowerCase();
	const node = component && component.res;
	if (!node || !want) return false;
	if (!allowed.includes(want)) {
		console.warn(`[nodality] ${what}: "${tag}" is not one of ${allowed.join(", ")}; rendering ${node.tagName.toLowerCase()}.`);
		return false;
	}
	if (node.tagName.toLowerCase() === want) return false;
	const swapped = document.createElement(want);
	for (const a of Array.from(node.attributes)) swapped.setAttribute(a.name, a.value);
	while (node.firstChild) swapped.appendChild(node.firstChild);
	if (node.parentNode) node.parentNode.replaceChild(swapped, node);
	component.res = swapped;
	return true;
}

// ── small helpers ────────────────────────────────────────────────────────

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);

function reducedMotion() {
	try {
		return typeof window !== "undefined" && typeof window.matchMedia === "function"
			&& !!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch (e) { return false; }
}

// A focus that came from the keyboard. Mouse focus already has the hover
// state, and showing it again after the pointer leaves would look stuck.
function focusVisible(target) {
	try { return !!(target && target.matches && target.matches(":focus-visible")); }
	catch (e) { return true; } // an engine without :focus-visible: show it
}

// Nodality's own names for CSS properties, as the rest of the library uses
// them. A local copy rather than an import of STYLE_OPTIONS: animator.js
// imports this module, and the cycle is not worth three aliases.
const ALIAS = { exact: "fontSize", radius: "borderRadius", weight: "fontWeight", font: "fontFamily" };
const PX = new Set(["borderRadius", "width", "height", "maxWidth", "maxHeight", "minWidth",
	"minHeight", "top", "left", "right", "bottom", "gap", "fontSize", "padding", "margin"]);

const kebab = (k) => k.startsWith("--") ? k : k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

/** {…css in Nodality names} → {cssKey: value}, dropping what is not CSS. */
function normalise(styles, skip) {
	const out = {};
	if (!isObj(styles)) return out;
	for (const raw of Object.keys(styles)) {
		if (raw === "animation" || (skip && skip.has(raw))) continue;
		const key = ALIAS[raw] || raw;
		let v = styles[raw];
		// hover() has always taken `border: {width, color}`; keep that shape.
		if (key === "border" && isObj(v)) v = `${v.width ?? 1}px solid ${v.color ?? "currentColor"}`;
		if (typeof v === "number" && v !== 0 && PX.has(key)) v = `${v}px`;
		if (v == null || typeof v === "object") continue;
		out[key] = v;
	}
	return out;
}

const readStyle = (el, k) => k.startsWith("--") ? el.style.getPropertyValue(k) : (el.style[k] ?? "");
function writeStyle(el, k, v) {
	if (k.startsWith("--")) {
		if (v === "" || v == null) el.style.removeProperty(k); else el.style.setProperty(k, String(v));
	} else {
		el.style[k] = v == null ? "" : v;
	}
}

/**
 * A layer of temporary inline styles on one element. `set(desired)` makes the
 * element carry exactly `desired` on top of what it had, remembering each
 * property's original value the first time it is touched and writing it back
 * when the property leaves the set. That is what "restores the original
 * inline styles" means when hover and focus overlap and end in either order.
 */
function styleLayer(el) {
	const saved = new Map();
	return {
		set(desired) {
			for (const k of [...saved.keys()]) {
				if (!(k in desired)) { writeStyle(el, k, saved.get(k)); saved.delete(k); }
			}
			for (const k of Object.keys(desired)) {
				if (!saved.has(k)) saved.set(k, readStyle(el, k));
				writeStyle(el, k, desired[k]);
			}
		},
		clear() { this.set({}); },
	};
}

// Under prefers-reduced-motion a state change is applied in one step: the
// transition is switched off, the styles written, the change flushed with a
// layout read, and the transition put back for whatever else uses it.
function instantly(el, fn) {
	if (!reducedMotion()) return fn();
	const t = el.style.transition;
	el.style.transition = "none";
	try { fn(); } finally {
		void el.offsetWidth;
		el.style.transition = t;
	}
}

/** `animation: 0.2` (seconds, the old hover form) or "0.2s ease". */
function timingOf(v) {
	if (typeof v === "number" && v > 0) return `${v}s ease`;
	if (typeof v === "string" && v.trim()) return v.trim();
	return null;
}

function transitionFor(keys, timing) {
	return keys.filter((k) => !k.startsWith("--")).map((k) => `${kebab(k)} ${timing}`).join(", ");
}

// ── the entry point ──────────────────────────────────────────────────────

/**
 * Apply the interaction/accessibility options in `obj` to the component's
 * rendered root. Called by Animator after each set(); safe to call directly.
 */
export function applyInteraction(component, obj) {
	if (!component || !isObj(obj)) return;
	// Byte-identical rendering for every page that does not use these.
	let any = false;
	for (const k of KEYS) if (obj[k] != null && obj[k] !== false) { any = true; break; }
	if (!any && !component._ix) return;
	if (typeof document === "undefined") return;

	// Another set() on the same component: undo the previous run first, so a
	// second set({hover}) replaces the first instead of stacking listeners.
	if (component._ix) teardown(component._ix);
	if (!any) return;

	const el = component.res || component.formElement || component.el;
	// Components that build their box later (Switcher builds it in render())
	// have nothing to act on yet; the options that matter for them are
	// forwarded to the views they contain by their mappers.
	if (!el || typeof el.setAttribute !== "function") return;

	const ix = component._ix || (component._ix = { offs: [] });
	if (!ix.tracked && typeof component._track === "function") {
		ix.tracked = true;
		component._track(() => teardown(ix));
	}
	const on = (target, type, fn, opts) => {
		if (!target || typeof target.addEventListener !== "function") return;
		target.addEventListener(type, fn, opts);
		ix.offs.push(() => target.removeEventListener(type, fn, opts));
	};

	applyAttributes(el, obj);

	//@ hover {object}: Styles applied while the pointer is over the element AND while it (or something inside it) has keyboard focus, e.g. {background: "#111", color: "#fff", animation: "0.2s ease"}. Any CSS property in camelCase; `animation` is the transition timing. The original inline styles come back on leave. Instant under prefers-reduced-motion.
	//@ focus {object}: Styles for keyboard focus (focus-visible, on the element or inside it), when they should differ from `hover`. Same shape as hover.
	//@ transition: CSS transition, verbatim — also what hover/focus/groupHover changes animate with when they give no `animation` timing.
	if (isObj(obj.hover) || isObj(obj.focus)) setupHover(component, el, obj.hover, obj.focus, obj.transition, ix, on);

	//@ group: Make this element a hover group: descendants with `groupHover` change while the group is hovered or holds keyboard focus.
	if (obj.group) setupGroup(el, ix, on);
	//@ groupHover {object}: Styles this element takes while its nearest `group: true` ancestor is hovered or holds keyboard focus, e.g. {color: "#b83a0b", transform: "translateX(4px)"}. Same shape as hover.
	if (isObj(obj.groupHover)) setupGroupMember(el, obj.groupHover, obj.transition, ix);

	//@ copy: Copy this text to the clipboard on click, Enter or Space (`true` copies the element's own text). The element becomes a keyboard-operable button and shows `copied` for 1.5 s, announced politely to screen readers.
	//@ copied: The confirmation shown after `copy` — default "Copied".
	if (obj.copy != null && obj.copy !== false) setupCopy(el, obj.copy, obj.copied, ix, on);

	//@ spy: Scroll spy: the in-page links inside this element (href="#id") are marked aria-current="true" and styled while their section is the one in view — the section that crosses the reading line, 30% down the view below `offset` (see spy.line). `true`, or {activeStyle: {…css}, offset: px, line: 0.3}. Default style: underline. Links to <body>/<html>, or to an element that contains the link (e.g. `#top` on <body id="top">), are never treated as sections.
	if (obj.spy) setupSpy(el, obj.spy, ix, on);

	//@ hideOnScroll: Slide this element out of view while the page scrolls down and back as soon as it scrolls up. Only for an element that is (or sits in) a position: fixed or sticky box; never moves under prefers-reduced-motion.
	if (obj.hideOnScroll) setupHideOnScroll(el, ix, on);
}

function teardown(ix) {
	const offs = ix.offs.splice(0);
	// Reverse order: later setup steps may depend on earlier ones.
	for (let i = offs.length - 1; i >= 0; i--) {
		try { offs[i](); } catch (e) { /* keep draining */ }
	}
}

// ── 3. accessibility attributes ──────────────────────────────────────────

// aria-* attribute names are lowercase letters only (aria-describedby, not
// aria-described-by), so `describedBy`, `describedby` and "aria-describedby"
// all name the same attribute and anything else is not one.
function ariaName(key) {
	const k = String(key).replace(/^aria-/i, "").toLowerCase();
	return /^[a-z]+$/.test(k) ? `aria-${k}` : null;
}

function attrValue(v) {
	if (Array.isArray(v)) return v.map(String).join(" ");
	return String(v);
}

function applyAttributes(el, obj) {
	//@ aria {object}: ARIA attributes, e.g. {label: "Close", hidden: true, current: "page", live: "polite", describedBy: "note"} → aria-label="Close", aria-hidden="true", … Booleans become "true"/"false", arrays of ids are space-joined, null removes the attribute.
	if (isObj(obj.aria)) {
		for (const key of Object.keys(obj.aria)) {
			const name = ariaName(key), v = obj.aria[key];
			if (!name) { console.warn(`[nodality] aria: "${key}" is not an ARIA attribute name.`); continue; }
			if (v == null) { el.removeAttribute(name); continue; }
			if (typeof v === "object" && !Array.isArray(v)) { console.warn(`[nodality] aria.${key}: an object is not an attribute value.`); continue; }
			// setAttribute stores the value as text and the serializer escapes
			// it, so page text cannot break out of the attribute.
			el.setAttribute(name, attrValue(v));
		}
	}
	//@ role {text}: ARIA role, e.g. "note", "region", "button". Prefer a semantic tag (`as`, `tag`) where one exists.
	if (obj.role != null && String(obj.role).trim()) el.setAttribute("role", String(obj.role).trim());
	//@ tabIndex {count}: Tab order: 0 puts the element in the natural order, -1 makes it focusable from script only. Positive values reorder the page and are best avoided.
	if (obj.tabIndex != null) {
		const n = Number(obj.tabIndex);
		if (Number.isInteger(n)) el.setAttribute("tabindex", String(n));
		else console.warn(`[nodality] tabIndex: ${JSON.stringify(obj.tabIndex)} is not a whole number.`);
	}
	//@ lang {text}: Language of this element's content, e.g. "cs" — so a screen reader switches pronunciation for a quote or a name in another language.
	if (obj.lang != null && String(obj.lang).trim()) el.setAttribute("lang", String(obj.lang).trim());
	//@ title {text}: Advisory tooltip (the title attribute). Not applied where `title` is already the element's visible label (dropdown, form fields) — a tooltip repeating the label adds noise.
	if (obj.title != null && String(obj.title) !== "") {
		const t = String(obj.title);
		const labelled = (el.matches && el.matches("input,select,textarea,label"))
			|| (el.querySelector && el.querySelector("input,select,textarea,label"))
			|| (el.textContent || "").includes(t);
		if (!labelled && !el.hasAttribute("title")) el.setAttribute("title", t);
	}
}

// ── 1. hover and focus ───────────────────────────────────────────────────

// The keys Animator.hover() applies itself on the components that run
// commonMethods. On those, hover() keeps doing exactly what it did; this
// module only adds the rest of the CSS and the keyboard path.
const LEGACY_KEYS = new Set(["color", "background", "border", "scale", "transform", "boxShadow"]);

function setupHover(c, el, hover, focus, transition, ix, on) {
	hover = isObj(hover) ? hover : null;
	focus = isObj(focus) ? focus : null;

	// hover() ran on THIS node (a Text whose `tag` swapped its node after
	// hover() ran has lost the handlers, and gets the full treatment here).
	const legacy = hover && c._legacyHover === el && typeof el.onmouseover === "function"
		? { over: el.onmouseover, out: el.onmouseout } : null;

	const hoverCss = hover ? normalise(hover, legacy ? LEGACY_KEYS : null) : {};
	const focusCss = focus ? normalise(focus) : null;
	const layer = styleLayer(el);
	let hovered = false, focused = false, legacyOn = false;

	if (legacy) {
		// Take over hover()'s mouseover/mouseout so mouse and keyboard share
		// one state: leaving with the pointer must not clear the styles while
		// the element still has focus. The originals are put back on teardown.
		el.onmouseover = null;
		el.onmouseout = null;
		ix.offs.push(() => {
			if (legacyOn && typeof legacy.out === "function") legacy.out();
			legacyOn = false;
			el.onmouseover = legacy.over;
			el.onmouseout = legacy.out;
		});
	}

	// Transition. hover() already installed one on the legacy path when
	// `animation` was given; the extra properties are added to its list so
	// they ease too. Otherwise one is built from `animation`, unless the
	// element already carries a transition (the `transition` option).
	const timing = timingOf(hover && hover.animation) || timingOf(focus && focus.animation);
	const prevTransition = el.style.transition;
	const prevTP = el.style.transitionProperty;
	const extra = [...new Set([...Object.keys(hoverCss), ...Object.keys(focusCss || {})])];
	if (legacy && el.style.transitionProperty && extra.length) {
		el.style.transitionProperty = [el.style.transitionProperty, ...extra.map(kebab)].join(", ");
	} else if (!legacy) {
		if (!el.style.transition && typeof transition === "string" && transition.trim()) el.style.transition = transition;
		else if (!el.style.transition && timing && extra.length) el.style.transition = transitionFor(extra, timing);
	}
	ix.offs.push(() => {
		layer.clear();
		el.style.transition = prevTransition;
		if (prevTP) el.style.transitionProperty = prevTP;
	});

	const update = () => instantly(el, () => {
		const viaHover = !!hover && (hovered || (focused && !focusCss));
		if (legacy) {
			if (viaHover && !legacyOn) { legacyOn = true; legacy.over(); }
			else if (!viaHover && legacyOn) { legacyOn = false; if (typeof legacy.out === "function") legacy.out(); }
		}
		const desired = {};
		if (viaHover) Object.assign(desired, hoverCss);
		if (focused && focusCss) Object.assign(desired, focusCss);
		layer.set(desired);
	});

	on(el, "mouseenter", () => { hovered = true; update(); });
	on(el, "mouseleave", () => { hovered = false; update(); });
	on(el, "focusin", (e) => { focused = focusVisible(e.target); update(); });
	on(el, "focusout", (e) => {
		if (e.relatedTarget && el.contains(e.relatedTarget)) return; // focus moved inside
		focused = false; update();
	});
}

// ── 2. group hover ───────────────────────────────────────────────────────

// The group cannot know its members when it is built — children are added
// after set() — so members register on their own node and the group finds
// them when it changes state. A member answers to its NEAREST group only, so
// groups nest.
function nearestGroup(node) {
	let p = node.parentElement;
	while (p && !p.__nodGroup) p = p.parentElement;
	return p;
}

function setupGroup(el, ix, on) {
	el.__nodGroup = true;
	let hovered = false, focused = false, active = false;
	const update = () => {
		const want = hovered || focused;
		if (want === active) return;
		active = want;
		for (const node of el.querySelectorAll("*")) {
			if (node.__nodGroupMember && nearestGroup(node) === el) node.__nodGroupMember.set(active);
		}
	};
	on(el, "mouseenter", () => { hovered = true; update(); });
	on(el, "mouseleave", () => { hovered = false; update(); });
	on(el, "focusin", (e) => { focused = focusVisible(e.target); update(); });
	on(el, "focusout", (e) => {
		if (e.relatedTarget && el.contains(e.relatedTarget)) return;
		focused = false; update();
	});
	ix.offs.push(() => {
		hovered = focused = false; update();
		delete el.__nodGroup;
	});
}

function setupGroupMember(el, groupHover, transition, ix) {
	const css = normalise(groupHover);
	const layer = styleLayer(el);
	const prevTransition = el.style.transition;
	const timing = timingOf(groupHover.animation);
	if (!el.style.transition && typeof transition === "string" && transition.trim()) el.style.transition = transition;
	else if (!el.style.transition && timing) el.style.transition = transitionFor(Object.keys(css), timing);
	el.__nodGroupMember = { set: (active) => instantly(el, () => layer.set(active ? css : {})) };
	ix.offs.push(() => {
		layer.clear();
		el.style.transition = prevTransition;
		delete el.__nodGroupMember;
	});
}

// ── 6. copy to clipboard ─────────────────────────────────────────────────

// Elements the browser already makes focusable and operable by keyboard.
const NATIVE_CONTROL = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/;

function fallbackCopy(text) {
	// execCommand needs a selection in the document; a throwaway textarea is
	// the standard way to give it one. Off-screen and read-only so neither a
	// sighted user nor a phone keyboard ever sees it.
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.setAttribute("readonly", "");
	ta.style.position = "fixed";
	ta.style.top = "-1000px";
	ta.style.opacity = "0";
	document.body.appendChild(ta);
	let ok = false;
	try { ta.select(); ok = !!(document.execCommand && document.execCommand("copy")); } catch (e) { ok = false; }
	ta.remove();
	return ok;
}

function writeClipboard(text) {
	try {
		const nav = typeof navigator !== "undefined" ? navigator : null;
		if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
			return nav.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
		}
	} catch (e) { /* fall through */ }
	return Promise.resolve(fallbackCopy(text));
}

function liveRegion() {
	// Visually hidden, but read: the standard clip pattern. Outside the
	// element, because text inside a role=button becomes part of its name.
	const r = document.createElement("span");
	r.setAttribute("aria-live", "polite");
	r.setAttribute("role", "status");
	Object.assign(r.style, { position: "absolute", width: "1px", height: "1px", overflow: "hidden",
		clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap", margin: "-1px", padding: "0", border: "0" });
	document.body.appendChild(r);
	return r;
}

function setupCopy(el, value, copied, ix, on) {
	// Prerender (layout/prerender.js): a role=button that does nothing until
	// the script runs is worse than plain text. The page's hydration rebuilds
	// the element and adds the control then.
	if (typeof window !== "undefined" && window.__NODALITY_PRERENDER__) return;
	const label = copied != null && String(copied) !== "" ? String(copied) : "Copied";
	const native = NATIVE_CONTROL.test(el.tagName);
	const added = [];
	if (!native) {
		if (!el.hasAttribute("role")) { el.setAttribute("role", "button"); added.push("role"); }
		if (!el.hasAttribute("tabindex")) { el.setAttribute("tabindex", "0"); added.push("tabindex"); }
	}
	const prevCursor = el.style.cursor;
	if (!el.style.cursor) el.style.cursor = "pointer";

	let timer = null, restore = null, region = null;
	const finish = () => {
		if (timer) clearTimeout(timer);
		timer = null;
		if (restore) { const r = restore; restore = null; r(); }
	};

	const show = () => {
		finish();
		const onlyText = el.children.length === 0;
		if (onlyText) {
			// In place: the label replaces the text, and the box keeps its
			// width so the line it sits on does not jump.
			const text = el.textContent;
			const prevMin = el.style.minWidth;
			const w = el.getBoundingClientRect ? el.getBoundingClientRect().width : 0;
			if (w > 0 && !prevMin) el.style.minWidth = `${w}px`;
			el.textContent = label;
			restore = () => { el.textContent = text; el.style.minWidth = prevMin; };
		} else {
			// Content with structure (an icon, a nested element) is kept and
			// covered, rather than destroyed and rebuilt.
			const prevPos = el.style.position;
			let pos = "";
			try { pos = getComputedStyle(el).position; } catch (e) { /* headless */ }
			if (!pos || pos === "static") el.style.position = "relative";
			const badge = document.createElement("span");
			badge.setAttribute("aria-hidden", "true");
			badge.textContent = label;
			Object.assign(badge.style, { position: "absolute", inset: "0", display: "flex", alignItems: "center",
				justifyContent: "center", background: "inherit", borderRadius: "inherit" });
			el.appendChild(badge);
			restore = () => { badge.remove(); el.style.position = prevPos; };
		}
		if (!region) region = liveRegion();
		region.textContent = "";
		// A new text node in a cleared region is what screen readers announce;
		// writing the same text twice in one task is not announced again.
		setTimeout(() => { if (region) region.textContent = label; }, 30);
		timer = setTimeout(finish, 1500);
	};

	const run = () => {
		const text = value === true ? (restore ? "" : (el.textContent || "").trim()) : String(value);
		if (!text) return;
		writeClipboard(text).then((ok) => {
			if (ok) show(); else console.warn("[nodality] copy: the browser refused clipboard access.");
		});
	};

	on(el, "click", (e) => {
		// A copy link copies; following it as well would leave the page.
		if (el.tagName === "A") e.preventDefault();
		run();
	});
	if (!native) {
		on(el, "keydown", (e) => {
			if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
				e.preventDefault(); // Space would scroll the page
				run();
			}
		});
	}
	ix.offs.push(() => {
		finish();
		if (region) { region.remove(); region = null; }
		for (const a of added) el.removeAttribute(a);
		el.style.cursor = prevCursor;
	});
}

// ── 7. scroll spy ────────────────────────────────────────────────────────

const SPY_DEFAULT = { textDecoration: "underline", textUnderlineOffset: "0.3em" };

// The box a target scrolls in: the nearest ancestor that scrolls, or null for
// the document. A section inside a horizontal scroller is only "in view"
// relative to that scroller, so it is observed against it.
function scrollRootOf(node) {
	let p = node.parentElement;
	while (p && p !== document.body && p !== document.documentElement) {
		let cs = null;
		try { cs = getComputedStyle(p); } catch (e) { return null; }
		const scrolls = (v) => v === "auto" || v === "scroll";
		if (scrolls(cs.overflowX) || scrolls(cs.overflowY)) {
			return { root: p, horizontal: scrolls(cs.overflowX) && !scrolls(cs.overflowY) };
		}
		p = p.parentElement;
	}
	return null;
}

function targetOf(link) {
	const href = link.getAttribute("href") || "";
	if (href.length < 2) return null;
	let id = href.slice(1);
	try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
	return document.getElementById(id);
}

// A link can never be "in" the section it sits inside of: `#top` on
// <body id="top">, or a section that contains the nav itself, would be in view
// on every scroll position and keep that link lit while no other could be.
function spyTargetOf(link, spyRoot) {
	// Opted out (a nav's actions): never marked.
	if (typeof link.closest === "function" && link.closest('[data-nod-spy="off"]')) return null;
	const t = targetOf(link);
	if (!t) return null;
	if (t === document.body || t === document.documentElement) return null;
	if (typeof t.contains === "function" && (t.contains(link) || t.contains(spyRoot))) return null;
	return t;
}

function setupSpy(el, cfg, ix, on) {
	const IO = typeof window !== "undefined" && window.IntersectionObserver;
	if (typeof IO !== "function") return; // the prerender, old engines
	const opts = isObj(cfg) ? cfg : {};
	const style = normalise(isObj(opts.activeStyle) ? opts.activeStyle : SPY_DEFAULT);
	const offset = Number.parseFloat(opts.offset) || 0;
	//@ spy.line {ratio}: Where the reading line sits, as a fraction of the visible height below `offset` (default 0.3). The active link is the one whose section crosses that line; none is lit above the first section, and in a gap between sections the last one stays lit only for a short way (a quarter of the view), so a section the nav does not list lights nothing.
	const ratio = Number.isFinite(Number(opts.line)) && opts.line !== null && opts.line !== "" ? Math.min(1, Math.max(0, Number(opts.line))) : 0.3;
	const GAP = 0.25;

	let links = [], observers = [], groups = [], timer = null, tries = 0, active = null, frame = null;
	const layers = new Map();
	const marked = new Set();

	//@ spy.center {bool}: Keep the active link centred in its own scrolling row — a long row of years or chapters that scrolls sideways follows what the page is showing, however the page was moved (arrows, a swipe, the trackpad).
	const center = opts.center === true;
	const centre = (a) => {
		let box = a.parentElement;
		while (box && box !== el.parentElement) {
			let cs = null;
			try { cs = getComputedStyle(box); } catch (e) { return; }
			if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && box.scrollWidth > box.clientWidth) break;
			box = box.parentElement;
		}
		if (!box || box === el.parentElement || typeof box.scrollBy !== "function") return;
		const r = a.getBoundingClientRect(), b = box.getBoundingClientRect();
		const delta = (r.left + r.width / 2) - (b.left + b.width / 2);
		if (Math.abs(delta) < 1) return;
		const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		box.scrollBy({ left: delta, behavior: reduce ? "auto" : "smooth" });
	};
	const mark = (target) => {
		if (target === active) return;
		active = target;
		for (const a of links) {
			const lit = target !== null && spyTargetOf(a, el) === target;
			if (!layers.has(a)) layers.set(a, styleLayer(a));
			if (lit) { a.setAttribute("aria-current", "true"); marked.add(a); }
			else if (marked.has(a)) { a.removeAttribute("aria-current"); marked.delete(a); }
			instantly(a, () => layers.get(a).set(lit ? style : {}));
			if (lit && center) centre(a);
		}
	};

	// One group of targets per scroll box. The section that crosses the
	// reading line wins (the innermost one, when sections nest); between two
	// sections the one just passed stays lit for a short gap; above the first
	// section, or past a gap, nothing is lit.
	const pickIn = (g) => {
		let box;
		if (g.root) {
			const r = g.root.getBoundingClientRect();
			box = { start: g.horizontal ? r.left : r.top, size: g.horizontal ? (r.width ?? (r.right - r.left)) : (r.height ?? (r.bottom - r.top)) };
		} else {
			box = { start: 0, size: window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0 };
		}
		// A row that scrolls sideways (a season tape) shows its sections as
		// runs of columns, and a target is only the start of its run: the
		// active one is the last whose start has reached the row's leading
		// edge — the one being read from the left.
		if (g.horizontal) {
			const edge = box.start + Math.min(24, box.size * 0.05);
			let lead = null, first = null;
			for (const t of g.targets) {
				const a = t.getBoundingClientRect().left;
				if (!Number.isFinite(a)) continue;
				if (!first || a < first.a) first = { t, a };
				if (a <= edge && (!lead || a > lead.a)) lead = { t, a };
			}
			return lead ? lead.t : (first ? first.t : null);
		}
		const lead = offset;
		const line = box.start + lead + Math.max(0, box.size - lead) * ratio;
		let hit = null, passed = null;
		for (const t of g.targets) {
			const r = t.getBoundingClientRect();
			const a = g.horizontal ? r.left : r.top;
			const extent = g.horizontal ? (r.width ?? 0) : (r.height ?? 0);
			const b = g.horizontal ? (r.right ?? a + extent) : (r.bottom ?? a + extent);
			if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
			if (a <= line && b > line) {
				if (!hit || a > hit.a || (a === hit.a && b < hit.b)) hit = { t, a, b };
			} else if (b <= line) {
				if (!passed || b > passed.b) passed = { t, a, b };
			}
		}
		if (hit) return hit.t;
		if (passed && line - passed.b <= box.size * GAP) return passed.t;
		return null;
	};

	const decide = () => {
		frame = null;
		let best = null;
		for (const g of groups) {
			const t = pickIn(g);
			// The document's own sections first; a scroll box's only when the
			// page itself has none at the line.
			if (t && (!best || (!g.root && best.root))) best = { t, root: g.root };
		}
		mark(best ? best.t : null);
	};
	const schedule = () => {
		if (frame !== null) return;
		if (typeof window.requestAnimationFrame !== "function") { decide(); return; }
		frame = true; // before the call: a synchronous rAF runs decide() inside it
		const id = window.requestAnimationFrame(decide);
		if (frame !== null) frame = id;
	};

	const start = () => {
		timer = null;
		// Links and targets are looked up late: a container's children are
		// added after its set(), and the sections a nav points at are usually
		// rendered after the nav.
		links = [...el.querySelectorAll('a[href^="#"]')].filter((a) => spyTargetOf(a, el));
		if (!links.length) {
			if (++tries < 40) timer = setTimeout(start, 50);
			return;
		}
		const byRoot = new Map();
		for (const a of links) {
			const t = spyTargetOf(a, el);
			const r = scrollRootOf(t);
			const key = r ? r.root : null;
			if (!byRoot.has(key)) byRoot.set(key, { root: key, horizontal: r ? r.horizontal : false, targets: new Set() });
			byRoot.get(key).targets.add(t);
		}
		groups = [...byRoot.values()];
		for (const { root, horizontal, targets } of groups) {
			// The observer only says WHEN to look again (a section entering
			// or leaving the view); which one is active is decided from the
			// geometry, against the reading line.
			const rootMargin = horizontal ? "0px -50% 0px 0px" : `${-offset}px 0px -50% 0px`;
			let io;
			try {
				io = new IO(() => decide(), { root, rootMargin, threshold: [0, 0.01] });
			} catch (e) { continue; }
			for (const t of targets) io.observe(t);
			observers.push(io);
			if (root) on(root, "scroll", schedule, { passive: true });
		}
		on(window, "scroll", schedule, { passive: true });
		on(window, "resize", schedule);
		decide();
	};
	timer = setTimeout(start, 0);

	ix.offs.push(() => {
		if (timer) clearTimeout(timer);
		if (frame !== null && frame !== true && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
		frame = null;
		for (const io of observers) { try { io.disconnect(); } catch (e) { /* gone */ } }
		observers = [];
		for (const a of marked) a.removeAttribute("aria-current");
		for (const l of layers.values()) l.clear();
		marked.clear(); layers.clear(); groups = [];
		active = null;
	});
}

// ── 8. hide on scroll ────────────────────────────────────────────────────

function setupHideOnScroll(el, ix, on) {
	if (typeof window === "undefined") return;
	let lastY = window.scrollY || 0;
	let hiddenOn = null, prev = null, frame = null, settle = null;

	// The box that actually stays on screen: the element itself or the
	// wrapper a page positioned it with. Nothing fixed or sticky — nothing
	// to hide; a bar in the flow scrolls away by itself.
	const mover = () => {
		let n = el;
		while (n && n.nodeType === 1 && n !== document.body) {
			let pos = "";
			try { pos = getComputedStyle(n).position; } catch (e) { return null; }
			if (pos === "fixed" || pos === "sticky") return n;
			n = n.parentElement;
		}
		return null;
	};

	const show = (now) => {
		if (!hiddenOn) return;
		const n = hiddenOn;
		hiddenOn = null;
		n.style.transform = prev.transform;
		// The transition stays until the slide back has finished, then goes.
		const t = prev.transition;
		if (settle) clearTimeout(settle);
		settle = null;
		if (now === true) n.style.transition = t;
		else settle = setTimeout(() => { settle = null; if (!hiddenOn) n.style.transition = t; }, 300);
	};
	const hide = (n) => {
		if (hiddenOn) return;
		const r = n.getBoundingClientRect();
		prev = { transform: n.style.transform, transition: n.style.transition };
		hiddenOn = n;
		n.style.transition = [prev.transition, "transform 0.25s ease"].filter(Boolean).join(", ");
		n.style.transform = `${prev.transform ? prev.transform + " " : ""}translateY(${-Math.ceil(r.bottom + 2)}px)`;
	};

	const check = () => {
		frame = null;
		const y = window.scrollY || 0;
		const dy = y - lastY;
		if (Math.abs(dy) < 6) return;
		lastY = y;
		if (!el.isConnected || reducedMotion()) return show(true);
		const n = mover();
		if (!n) return show();
		if (dy > 0 && y > n.getBoundingClientRect().height) hide(n); else show();
	};
	on(window, "scroll", () => {
		// One check per frame. `frame` is set BEFORE scheduling: a host whose
		// requestAnimationFrame runs the callback at once (or none at all)
		// must not leave it set and swallow every later scroll.
		if (frame) return;
		frame = true;
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(check); else check();
	}, { passive: true });
	// A keyboard user tabbing into a hidden bar must see where focus went.
	on(el, "focusin", () => show());
	ix.offs.push(() => { show(true); frame = null; });
}

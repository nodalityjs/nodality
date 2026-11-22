/*!
 * nodality v1.5.7
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";
import { nodeOf, codeOf, optionsSource, cssLength, reducedMotion, applyDesignOps, applyStyle } from "./element-kit.js";

// Marquee — an endlessly scrolling row (logos, sponsors, a ticker), as data.
//@ marquee.children: The items of the row, as element specs. Copied as often as the width needs; the copies are hidden from assistive technology and the keyboard.
//
//   { type: "marquee", speed: 40, direction: "left", gap: "3rem",
//     children: [ { type: "img", url: "a.svg", alt: "Alpha" }, … ] }
//
// How the loop is seamless: the children sit in one group, the group is
// followed by as many copies as it takes to cover the visible width, and the
// whole row slides left by exactly one group width before starting over —
// at which point the first copy is where the original was, so the restart is
// invisible. Each group carries the gap as trailing padding, which is what
// makes "one group width" include the space before the next group.
//
// The copies are for the eye only. Each is aria-hidden AND inert, so a screen
// reader reads every item once and the Tab key reaches every link once, in
// the original; ids inside the copies are removed so the page keeps one
// element per id.
//
// Motion is opt-out by the visitor: under prefers-reduced-motion the row is
// static, wraps onto as many lines as it needs, and has no copies at all.
// It also pauses while hovered or while focus is inside it (so a link can be
// read and clicked), and while it is scrolled out of view.
//
// And it can be stopped for good. WCAG 2.2.2 (Pause, Stop, Hide) asks that
// anything moving on its own for more than five seconds have a mechanism to
// pause it — hover and focus pauses only last while the pointer or focus
// stays — so a real <button> sits at the row's inline end once the loop
// runs: Tab reaches it, Enter or Space toggles it, its name says what it
// will do ("Pause" / "Play", translatable). It is overlaid rather than in
// the flow, so it appearing after layout moves nothing. Without motion
// (reduced motion, headless) there is nothing to pause and no button.
//
// The loop needs real widths, so it starts once the row is laid out (a
// ResizeObserver reports it) and restarts when either width changes. Headless
// — prerender, tests — there is no layout, so the row renders static, with
// no copies, and the browser builds the loop when it rebuilds the page.

class Marquee extends Animator {
	constructor() {
		super();
		this.options = {};
		this.children = [];
		this.clones = [];
		this.anim = null;
		this.paused = { hover: false, focus: false, offscreen: false, manual: false };
		this.toggle = null;
		this.setup();
	}

	setup() {
		const root = document.createElement("div");
		root.style.overflow = "hidden";
		// As on the scroller: bounded by the parent even as a flex/grid item,
		// so the max-content track inside cannot widen the page.
		root.style.maxWidth = "100%";
		root.style.minWidth = "0";
		const track = document.createElement("div");
		track.style.display = "flex";
		track.style.width = "max-content";
		const group = document.createElement("div");
		group.style.display = "flex";
		group.style.flex = "none";
		group.style.alignItems = "center";
		track.appendChild(group);
		root.appendChild(track);
		this.res = root;
		this.track = track;
		this.group = group;
		return this;
	}

	getType() { return "LayoutWrapperElement"; }

	set(obj = {}) {
		this.options = obj;
		this.commonMethods(obj);

		//@ marquee.gap {css-length}: Space between items, and between the last item and the first of the next loop. Default "2rem".
		// On the group, not the outer box where commonMethods put it.
		this.res.style.gap = "";
		this.gap = cssLength(obj.gap ?? "2rem");
		this.group.style.gap = this.gap;

		//@ marquee.speed: Pixels per second. Default 40 — slow enough to read.
		const speed = Number(obj.speed);
		this.speed = Number.isFinite(speed) && speed > 0 ? speed : 40;

		//@ marquee.direction: "left" (default) or "right" — which way the row moves.
		this.direction = obj.direction === "right" ? "right" : "left";

		//@ marquee.pauseOnHover: Pause while the pointer is over the row or focus is inside it. Default true; false keeps it moving (focus still pauses it).
		this.pauseOnHover = obj.pauseOnHover !== false;

		// No unit on these three: they only act once the loop runs, which a
		// headless render never reaches, so a declared shape would be probed
		// (params-do-something) and found "inert". Same as speed and direction.
		//@ marquee.controls: A pause / play button at the row's end while it moves (WCAG 2.2.2). Default true; false leaves pausing to hover, focus and pause() from code.
		this.controls = obj.controls !== false;
		//@ marquee.pauseLabel: Accessible name of the button while the row moves. Default "Pause".
		this.pauseLabel = obj.pauseLabel != null && obj.pauseLabel !== "" ? String(obj.pauseLabel) : "Pause";
		//@ marquee.playLabel: Accessible name of the button while the row is paused by it. Default "Play".
		this.playLabel = obj.playLabel != null && obj.playLabel !== "" ? String(obj.playLabel) : "Play";
		//@ marquee.controlsStyle {object}: CSS (camelCase) for the pause / play button, over its defaults, e.g. { background: "#111", color: "#fff" }.
		this.controlsStyle = obj.controlsStyle && typeof obj.controlsStyle === "object" ? obj.controlsStyle : null;

		//@ marquee.label {text}: Accessible name for the row, e.g. "Sponsors". Makes it a named group.
		if (obj.label != null && obj.label !== "") {
			this.res.setAttribute("role", "group");
			this.res.setAttribute("aria-label", String(obj.label));
		}

		applyDesignOps(this, obj);
		return this;
	}

	add(children) {
		this.children = (children || []).filter(Boolean);
		for (const child of this.children) {
			const node = nodeOf(child);
			if (node) { node.style.flex = node.style.flex || "none"; this.group.appendChild(node); }
		}
		this.static = reducedMotion();
		if (this.static) {
			// A plain row that wraps: every item visible, nothing moving.
			this.res.style.overflow = "visible";
			this.track.style.width = "auto";
			this.track.style.flexWrap = "wrap";
			this.group.style.flexWrap = "wrap";
			this.group.style.flex = "1 1 auto";
			return this;
		}
		this.group.style.paddingInlineEnd = this.gap;
		this._start();
		return this;
	}

	_start() {
		if (typeof window === "undefined") return;
		const W = window;
		if (typeof W.ResizeObserver === "function") {
			const ro = new W.ResizeObserver(() => this.measure());
			ro.observe(this.res);
			ro.observe(this.group);
			this._track(() => ro.disconnect());
		} else {
			this._on(W, "resize", () => this.measure());
			const first = setTimeout(() => this.measure(), 0);
			this._track(() => clearTimeout(first));
		}
		if (typeof W.IntersectionObserver === "function") {
			const io = new W.IntersectionObserver((entries) => {
				for (const e of entries) this.paused.offscreen = !e.isIntersecting;
				this._apply();
			});
			io.observe(this.res);
			this._track(() => io.disconnect());
		}
		this._on(this.res, "mouseenter", () => { this.paused.hover = this.pauseOnHover; this._apply(); });
		this._on(this.res, "mouseleave", () => { this.paused.hover = false; this._apply(); });
		this._on(this.res, "focusin", () => { this.paused.focus = true; this._apply(); });
		this._on(this.res, "focusout", (e) => {
			if (e.relatedTarget && this.res.contains(e.relatedTarget)) return;
			this.paused.focus = false; this._apply();
		});
	}

	/**
	 * Read the widths, make enough copies to cover the row, and (re)start the
	 * loop. Called by the ResizeObserver; safe to call any time.
	 */
	measure() {
		if (this._destroyed || this.static) return this;
		const box = (n) => (n && typeof n.getBoundingClientRect === "function" ? n.getBoundingClientRect().width : 0) || 0;
		const groupW = box(this.group);
		const viewW = box(this.res);
		// Not laid out (headless, display:none, not yet connected): no loop.
		if (groupW < 1 || viewW < 1) return this;
		// Copies after the original: enough that one group's worth of travel
		// never shows the end of the row.
		const copies = Math.max(1, Math.ceil(viewW / groupW));
		if (copies === this.clones.length && Math.abs(groupW - (this._groupW || 0)) < 0.5 && this.anim) return this;
		this._groupW = groupW;
		while (this.clones.length < copies) {
			const c = this.group.cloneNode(true);
			c.setAttribute("aria-hidden", "true");
			c.setAttribute("inert", "");
			try { c.inert = true; } catch (e) { /* attribute is enough */ }
			for (const n of c.querySelectorAll("[id]")) n.removeAttribute("id");
			c.removeAttribute("id");
			this.track.appendChild(c);
			this.clones.push(c);
		}
		while (this.clones.length > copies) this.clones.pop().remove();
		this._animate(groupW);
		return this;
	}

	_animate(groupW) {
		const t = this.track;
		if (typeof t.animate !== "function") return;
		// Keep the row where it is across a restart (a resize), rather than
		// snapping it back to the beginning.
		let progress = 0;
		if (this.anim) {
			try {
				const d = this.anim.effect && this.anim.effect.getTiming ? this.anim.effect.getTiming().duration : 0;
				if (d && this.anim.currentTime != null) progress = (this.anim.currentTime % d) / d;
				this.anim.cancel();
			} catch (e) { /* start fresh */ }
		}
		const from = "translateX(0px)", to = `translateX(${-groupW}px)`;
		const frames = this.direction === "right"
			? [{ transform: to }, { transform: from }]
			: [{ transform: from }, { transform: to }];
		const duration = (groupW / this.speed) * 1000;
		this.anim = t.animate(frames, { duration, iterations: Infinity, easing: "linear" });
		try { if (progress && this.anim) this.anim.currentTime = progress * duration; } catch (e) { /* fine */ }
		if (!this._animTracked) {
			this._animTracked = true;
			this._track(() => { try { this.anim && this.anim.cancel(); } catch (e) { /* gone */ } this.anim = null; });
		}
		if (this.anim && this.controls && !this.toggle) this._controls();
		this._apply();
	}

	/**
	 * The pause / play button. Built when the loop first runs, so a row that
	 * never moves has none. It sits outside the track (so it is never
	 * copied) and over the row's inline end (so it takes no room).
	 */
	_controls() {
		const b = document.createElement("button");
		b.setAttribute("type", "button");
		b.setAttribute("data-nodality-marquee-toggle", "");
		if (this.res.id) {
			// The track is what the button controls; give it an id to point at.
			this.track.id = this.track.id || `${this.res.id}-track`;
			b.setAttribute("aria-controls", this.track.id);
		}
		const s = b.style;
		s.position = "absolute";
		s.insetInlineEnd = "0.5em";
		s.top = "50%";
		s.transform = "translateY(-50%)";
		s.zIndex = "1";
		s.display = "inline-flex";
		s.alignItems = "center";
		s.justifyContent = "center";
		s.width = "2.2em";
		s.height = "2.2em";
		s.padding = "0";
		s.font = "inherit";
		s.lineHeight = "1";
		s.borderRadius = "50%";
		s.border = "1px solid currentColor";
		s.background = "rgba(255, 255, 255, 0.85)";
		s.color = "#111";
		s.cursor = "pointer";
		applyStyle(b, this.controlsStyle);
		// The icon is an inline SVG in currentColor: text glyphs for pause
		// (U+23F8, "❚❚") fall back to emoji or tofu depending on the font.
		const NS = "http://www.w3.org/2000/svg";
		const glyph = document.createElementNS(NS, "svg");
		glyph.setAttribute("viewBox", "0 0 16 16");
		glyph.setAttribute("width", "0.9em");
		glyph.setAttribute("height", "0.9em");
		glyph.setAttribute("aria-hidden", "true");
		glyph.setAttribute("focusable", "false");
		const shape = document.createElementNS(NS, "path");
		shape.setAttribute("fill", "currentColor");
		glyph.appendChild(shape);
		b.appendChild(glyph);
		this.toggleGlyph = shape;
		this._on(b, "click", () => (this.paused.manual ? this.play() : this.pause()));
		// The overlay needs a containing block; keep one the page gave.
		if (!this.res.style.position || this.res.style.position === "static") {
			this.res.style.position = "relative";
			this._track(() => { if (this.res.style.position === "relative") this.res.style.position = ""; });
		}
		this.res.appendChild(b);
		this.toggle = b;
		this._track(() => { b.remove(); if (this.toggle === b) this.toggle = null; });
		this._label();
	}

	/** Name and glyph say what pressing the button will do. */
	_label() {
		const b = this.toggle;
		if (!b) return;
		const paused = this.paused.manual;
		b.setAttribute("aria-label", paused ? this.playLabel : this.pauseLabel);
		// Play: a triangle. Pause: two bars.
		this.toggleGlyph.setAttribute("d", paused ? "M4 2.5v11l9.5-5.5z" : "M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z");
	}

	_apply() {
		const a = this.anim;
		if (!a) return;
		const stop = this.paused.hover || this.paused.focus || this.paused.offscreen || this.paused.manual;
		try { stop ? a.pause() : a.play(); } catch (e) { /* not ready */ }
	}

	/** Stop and restart the loop from code; the built-in button calls these too. */
	pause() { this.paused.manual = true; this._apply(); this._label(); return this; }
	play() { this.paused.manual = false; this._apply(); this._label(); return this; }

	destroy() {
		this._destroyed = true;
		return super.destroy();
	}

	toCode(indent = 0) {
		const pad = " ".repeat(indent);
		let code = `${pad}new Marquee().set(${optionsSource(this.options)})`;
		if (this.children.length) {
			code += `\n${pad}  .add([\n${this.children.map((c) => codeOf(c, indent + 4)).join(",\n")}\n${pad}  ])`;
		}
		return [code];
	}

	render(el) {
		if (el) {
			document.querySelector(el)?.appendChild(this.res);
			return this;
		}
		return this.res;
	}
}

export { Marquee };

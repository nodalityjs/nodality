import { Animator } from "./animator.js";
import { nodeOf, codeOf, optionsSource, cssLength, idBase, reducedMotion, applyDesignOps, isRTL } from "./element-kit.js";

// Scroller — a horizontal scroller, as data.
//@ scroller.children: The items, as element specs: one per column, or poured into columns with `flow`. A child spec may carry `breakBefore: true` (flow only) to start a new column.
//
//   { type: "scroller", label: "Races", itemWidth: "min(320px, 85vw)",
//     gap: "16px", snap: "start", controls: true, progress: true,
//     children: [ … ] }
//
// Two layouts:
//
//   columns (default)  one child per column, each `itemWidth` wide, snapping.
//   flow               `flow: { height, columnWidth, gap }`: the children pour
//                      into CSS columns of a fixed height that run on to the
//                      right — the shape for a LONG list (thirty-two seasons
//                      of results) that would otherwise be a very tall page.
//                      Children are never split across columns, and a child
//                      with `breakBefore: true` starts a new one.
//
// Accessibility is not optional here, because a scroller is the one layout a
// keyboard user cannot otherwise move: the scrolling box is focusable
// (tabIndex 0) and named (`label`), the arrow keys page it, Home/End go to the
// ends, and the optional prev/next buttons are real buttons with names that
// report aria-disabled at the ends rather than becoming `disabled` — a
// disabled button drops the focus of the person who just pressed it.
//
// `jump: true` makes in-page links work INTO the scroller: a link to `#id` of
// something inside it brings the scroller into view, scrolls it so the target
// starts at the scroller's start edge, and moves focus there. Without it the
// browser's own fragment navigation only promises "somewhere in view", which
// in a horizontal scroller is often half a column off screen.

// Right to left (dir="rtl" on the page or any ancestor): the track starts at
// its right edge, so everything that means "forward" mirrors — the arrow keys
// (ArrowLeft goes forward), prev/next (and their glyphs), End, the progress bar
// (fills from the right), and `jump` (aligns the target's right edge). The
// browser's scrollLeft is 0 at the start and NEGATIVE going forward there; all
// arithmetic here goes through `_pos()` / `_scrollToPos()`, which speak
// "distance from the start" in either direction. Snap needs nothing: its
// `start` is already the logical start edge.

// One page is a little less than the visible width, so the item at the edge
// stays partly in view and the reader keeps their place.
const PAGE = 0.9;

class Scroller extends Animator {
	constructor() {
		super();
		this.options = {};
		this.children = [];
		this.breaks = [];
		this._raf = 0;
		this.setup();
	}

	setup() {
		const root = document.createElement("div");
		root.style.position = "relative";
		// Never wider than the parent, and allowed to be narrower than its
		// content when it is a flex or grid item (whose min-width is `auto`,
		// i.e. the whole row of children). Without these a scroller in a `1fr`
		// column, or one a `blast` node turns inline-block, grows to fit every
		// child and has nothing left to scroll.
		root.style.maxWidth = "100%";
		root.style.minWidth = "0";
		const track = document.createElement("div");
		track.setAttribute("tabindex", "0");
		track.style.display = "flex";
		track.style.overflowX = "auto";
		track.style.overflowY = "hidden";
		// A sideways swipe at the end must not turn into the browser's
		// back/forward gesture.
		track.style.overscrollBehaviorX = "contain";
		root.appendChild(track);
		this.res = root;
		this.track = track;
		this.box = track;   // where children go: the track, or the flow box
		return this;
	}

	getType() { return "LayoutWrapperElement"; }

	set(obj = {}) {
		this.options = obj;
		this.commonMethods(obj);
		const track = this.track;
		this.base = idBase("scroller", obj.id);
		track.setAttribute("id", `${this.base}-track`);

		//@ scroller.label {text}: Accessible name of the scrolling region, e.g. "Race calendar". The region is focusable, so a screen reader announces this when it gets focus.
		if (obj.label != null && obj.label !== "") {
			track.setAttribute("role", "region");
			track.setAttribute("aria-label", String(obj.label));
		}

		//@ scroller.gap {css-length}: Space between the children (and between flow columns unless `flow.gap` is given). Default "1rem".
		// commonMethods wrote `gap` onto the outer box, where it would space the
		// track from its controls instead of the children from each other.
		this.res.style.gap = "";
		const gap = cssLength(obj.gap ?? "1rem");

		//@ scroller.itemWidth {css-length}: Width of each child in the columns layout, e.g. "min(320px, 85vw)". Without it each child keeps its own width.
		if (obj.itemWidth != null) track.style.setProperty("--nod-item-width", cssLength(obj.itemWidth));

		//@ scroller.snap: Where a child settles after a swipe: "start" (default), "center", or false for free scrolling.
		this.snap = obj.snap === false || obj.snap === "none" ? null : (obj.snap === "center" ? "center" : "start");
		track.style.scrollSnapType = this.snap ? "x mandatory" : "";

		//@ scroller.flow {object}: Flow the children into fixed-height CSS columns that extend sideways: { height, columnWidth, gap }, e.g. { height: "70vh", columnWidth: "280px" }. A child spec with `breakBefore: true` starts a new column.
		if (obj.flow && typeof obj.flow === "object") {
			track.style.display = "block";
			const flow = document.createElement("div");
			flow.style.height = cssLength(obj.flow.height ?? "70vh");
			flow.style.columnWidth = cssLength(obj.flow.columnWidth ?? "280px");
			flow.style.columnGap = cssLength(obj.flow.gap ?? gap);
			// auto, not balance: fill each column to the height and only then
			// start the next, so the list runs on sideways instead of being
			// squeezed into the box's width.
			flow.style.columnFill = "auto";
			flow.style.boxSizing = "border-box";
			track.appendChild(flow);
			this.box = flow;
			this.flow = true;
		} else {
			track.style.gap = gap;
		}

		//@ scroller.controls {bool}: Previous / next buttons under the scroller. They page by one view and report aria-disabled at either end.
		if (obj.controls) this._controls(obj);
		//@ scroller.prevLabel {text}: Accessible name of the previous button. Default "Previous".
		//@ scroller.nextLabel {text}: Accessible name of the next button. Default "Next".

		//@ scroller.progress {bool}: A thin bar under the scroller showing how far along it is.
		if (obj.progress) this._progress();

		//@ scroller.jump: true makes in-page links to anything inside the scroller (`#id`) scroll the page to it, scroll the scroller so the target starts at its start edge (the left edge; the right edge on a right-to-left page), and focus the target.
		this.jump = !!obj.jump;

		applyDesignOps(this, obj);
		return this;
	}

	_controls(obj) {
		const bar = document.createElement("div");
		bar.style.display = "flex";
		bar.style.justifyContent = "flex-end";
		bar.style.gap = "0.5em";
		bar.style.marginTop = "0.5em";
		const make = (label, glyph, dir) => {
			const b = document.createElement("button");
			b.setAttribute("type", "button");
			b.setAttribute("aria-label", label);
			b.setAttribute("aria-controls", `${this.base}-track`);
			b.style.font = "inherit";
			b.style.fontSize = "1.25em";
			b.style.lineHeight = "1";
			b.style.width = "2.2em";
			b.style.height = "2.2em";
			b.style.borderRadius = "50%";
			b.style.border = "1px solid currentColor";
			b.style.background = "transparent";
			b.style.color = "inherit";
			b.style.cursor = "pointer";
			const g = document.createElement("span");
			g.setAttribute("aria-hidden", "true");
			g.textContent = glyph;
			b.appendChild(g);
			this._on(b, "click", () => {
				if (b.getAttribute("aria-disabled") === "true") return;
				this.page(dir);
			});
			bar.appendChild(b);
			return b;
		};
		this.prevButton = make(obj.prevLabel || "Previous", "‹", -1);
		this.nextButton = make(obj.nextLabel || "Next", "›", 1);
		this._glyphsRTL = false;
		this.res.appendChild(bar);
	}

	_progress() {
		const rail = document.createElement("div");
		rail.setAttribute("aria-hidden", "true");
		rail.style.height = "3px";
		rail.style.marginTop = "0.5em";
		rail.style.background = "rgba(127, 127, 127, 0.25)";
		rail.style.overflow = "hidden";
		const bar = document.createElement("div");
		bar.style.height = "100%";
		bar.style.background = "currentColor";
		bar.style.transformOrigin = "0 50%";
		bar.style.transform = "scaleX(0)";
		rail.appendChild(bar);
		this.res.appendChild(rail);
		this.progressBar = bar;
	}

	/**
	 * The children, already built. `breaks[i]` true starts child i in a new
	 * column (flow layout only) — the mapper reads it off the child spec's
	 * `breakBefore`.
	 */
	add(children, breaks = []) {
		this.children = (children || []).filter(Boolean);
		this.breaks = breaks;
		this.children.forEach((child, i) => {
			const node = nodeOf(child);
			if (!node) return;
			if (this.flow) {
				// A child is never split between two columns.
				node.style.breakInside = "avoid";
				if (breaks[i]) node.style.breakBefore = "column";
			} else {
				node.style.flex = "0 0 var(--nod-item-width, auto)";
				node.style.minWidth = "0";
			}
			if (this.snap) node.style.scrollSnapAlign = this.snap;
			this.box.appendChild(node);
		});
		this._wire();
		return this;
	}

	_wire() {
		if (this._wired || typeof window === "undefined") return;
		this._wired = true;
		const track = this.track;

		this._on(track, "keydown", (e) => {
			// Only when the scroller itself has focus: an input inside it keeps
			// its arrow keys.
			if (e.target !== track) return;
			const fwd = this._rtl() ? -1 : 1;
			if (e.key === "ArrowRight" || e.key === "Right") this.page(fwd);
			else if (e.key === "ArrowLeft" || e.key === "Left") this.page(-fwd);
			else if (e.key === "Home") this._scrollToPos(0);
			else if (e.key === "End") this._scrollToPos(track.scrollWidth);
			else return;
			e.preventDefault();
		});

		if (this.prevButton || this.progressBar) {
			this._on(track, "scroll", () => this._schedule(), { passive: true });
			if (typeof window.ResizeObserver === "function") {
				const ro = new window.ResizeObserver(() => this._schedule());
				ro.observe(track);
				this._track(() => ro.disconnect());
			} else {
				this._on(window, "resize", () => this._schedule());
				// No observer to report the first layout: look once it exists.
				const first = setTimeout(() => { if (!this._destroyed && !window.__NODALITY_PRERENDER__) this._update(); }, 0);
				this._track(() => clearTimeout(first));
			}
			// Not at prerender: jsdom has no layout, so both ends "match" and
			// the saved HTML would show two disabled, faded buttons. Left
			// neutral there; hydration measures for real.
			if (!window.__NODALITY_PRERENDER__) this._update();
		}

		if (this.jump) {
			this._on(document, "click", (e) => this._onLinkClick(e));
			this._on(window, "hashchange", () => this._fromHash());
			// A page opened at a fragment inside the scroller. Deferred until
			// the scroller is in the document and laid out.
			const t = setTimeout(() => { if (!this._destroyed) this._fromHash(); }, 0);
			this._track(() => clearTimeout(t));
		}
	}

	_schedule() {
		if (this._raf || this._destroyed) return;
		const raf = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : null;
		if (!raf) { this._update(); return; }
		this._raf = raf(() => { this._raf = 0; if (!this._destroyed) this._update(); }) || 0;
		if (this._raf && !this._rafTracked) {
			this._rafTracked = true;
			this._track(() => { if (this._raf && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(this._raf); this._raf = 0; });
		}
	}

	_rtl() { return isRTL(this.track); }

	/** How far the track is scrolled from its START edge (either direction), ≥ 0. */
	_pos() {
		const x = this.track.scrollLeft || 0;
		return Math.max(0, this._rtl() ? -x : x);
	}

	/** Scroll to `d` px from the start edge. */
	_scrollToPos(d) {
		// The browser clamps to the scroll range itself, in either direction.
		const dist = Math.max(0, d);
		this._scrollTo(this._rtl() && dist ? -dist : dist);
	}

	_update() {
		const t = this.track;
		const max = Math.max(0, (t.scrollWidth || 0) - (t.clientWidth || 0));
		const rtl = this._rtl();
		const x = this._pos();
		if (this.prevButton && rtl !== this._glyphsRTL) {
			// The arrows point the way the content moves: mirrored in RTL.
			this._glyphsRTL = rtl;
			this.prevButton.firstChild.textContent = rtl ? "›" : "‹";
			this.nextButton.firstChild.textContent = rtl ? "‹" : "›";
		}
		if (this.progressBar) {
			const origin = rtl ? "100% 50%" : "0 50%";
			if (this.progressBar.style.transformOrigin !== origin) this.progressBar.style.transformOrigin = origin;
		}
		// One pixel of slack: fractional widths leave scrollLeft a hair short
		// of the end on high-density screens.
		const atStart = x <= 1;
		const atEnd = x >= max - 1;
		if (this.prevButton) {
			this.prevButton.setAttribute("aria-disabled", atStart ? "true" : "false");
			this.prevButton.style.opacity = atStart ? "0.35" : "";
			this.nextButton.setAttribute("aria-disabled", atEnd ? "true" : "false");
			this.nextButton.style.opacity = atEnd ? "0.35" : "";
		}
		if (this.progressBar) {
			const p = max > 0 ? Math.min(1, x / max) : 1;
			this.progressBar.style.transform = `scaleX(${p})`;
			this._progressValue = p;
		}
	}

	_behavior() { return reducedMotion() ? "auto" : "smooth"; }

	_scrollTo(left) {
		const t = this.track;
		if (typeof t.scrollTo === "function") {
			try { t.scrollTo({ left, behavior: this._behavior() }); return; } catch (e) { /* old engines: below */ }
		}
		t.scrollLeft = left;
	}

	/** Page by one view: +1 forward, -1 back. */
	page(dir = 1) {
		const t = this.track;
		const step = (t.clientWidth || 0) * PAGE || 300;
		// `dir` is logical: +1 is forward, which is leftwards right to left.
		this._scrollTo((t.scrollLeft || 0) + dir * step * (this._rtl() ? -1 : 1));
		return this;
	}

	_targetInside(id) {
		if (!id) return null;
		let el = null;
		try { el = document.getElementById(id); } catch (e) { return null; }
		return el && el !== this.track && this.track.contains(el) ? el : null;
	}

	_onLinkClick(e) {
		if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const a = e.target && typeof e.target.closest === "function" ? e.target.closest("a[href]") : null;
		if (!a) return;
		const href = a.getAttribute("href") || "";
		let id = null;
		if (href.startsWith("#")) id = href.slice(1);
		else if (a.hash && a.pathname === window.location.pathname && a.host === window.location.host) id = a.hash.slice(1);
		if (!id) return;
		try { id = decodeURIComponent(id); } catch (err) { /* keep it raw */ }
		const target = this._targetInside(id);
		if (!target) return;
		e.preventDefault();
		this.jumpTo(target);
		// The URL still records the fragment, as a native jump would, without
		// letting the browser perform its own (vertical-only) scroll.
		try { window.history.pushState(null, "", `#${id}`); } catch (err) { /* sandboxed */ }
	}

	_fromHash() {
		const hash = typeof window !== "undefined" && window.location ? window.location.hash : "";
		if (!hash || hash.length < 2) return;
		let id = hash.slice(1);
		try { id = decodeURIComponent(id); } catch (err) { /* raw */ }
		const target = this._targetInside(id);
		if (target) this.jumpTo(target);
	}

	/** Bring `target` (a node inside the scroller) to the scroller's start, and focus it. */
	jumpTo(target) {
		if (!target || !this.track.contains(target)) return this;
		const t = this.track;
		const behavior = this._behavior();
		if (typeof this.res.scrollIntoView === "function") {
			try { this.res.scrollIntoView({ block: "start", inline: "nearest", behavior }); } catch (e) { /* old engines */ }
		}
		if (typeof target.getBoundingClientRect === "function") {
			const tr = target.getBoundingClientRect(), kr = t.getBoundingClientRect();
			if (this._rtl()) {
				// The start edge is the right one: align the target's right edge.
				const left = tr.right - kr.right + (t.scrollLeft || 0);
				this._scrollTo(Math.min(0, left));
			} else {
				const left = tr.left - kr.left + (t.scrollLeft || 0);
				this._scrollTo(Math.max(0, left));
			}
		}
		// Focus follows, as it does for a native fragment jump in most
		// browsers — without a second scroll, which would undo the alignment.
		if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(target.tagName)) {
			target.setAttribute("tabindex", "-1");
		}
		if (typeof target.focus === "function") {
			try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
		}
		return this;
	}

	destroy() {
		this._destroyed = true;
		return super.destroy();
	}

	toCode(indent = 0) {
		const pad = " ".repeat(indent);
		let code = `${pad}new Scroller().set(${optionsSource(this.options)})`;
		if (this.children.length) {
			code += `\n${pad}  .add([\n${this.children.map((c) => codeOf(c, indent + 4)).join(",\n")}\n${pad}  ]` +
				(this.breaks.some(Boolean) ? `, ${JSON.stringify(this.breaks.map(Boolean))})` : ")");
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

export { Scroller };

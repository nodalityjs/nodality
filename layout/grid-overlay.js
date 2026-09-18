/*!
 * nodality v1.3.11
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";
import { toObjectSource } from "../lib/codegen.js";
import { gridGeometry, resolveGridOptions, readoutPosition } from "../lib/grid-geometry.js";

// GridOverlay — a blueprint grid drawn over the page: lines, registration
// marks at the intersections, and small uppercase readouts beside chosen
// intersections.
//
//   new GridOverlay().set({
//     columns: 4, rows: 2, inset: 16, color: "#fff",
//     readouts: [{ id: "angle", col: 1, row: 1, text: "horná časť · 412 mm" }],
//     mobile: { columns: 1, rows: 4 },
//   }).render("#mount");
//
// It is decoration by contract: `aria-hidden`, `pointer-events: none`, and
// nothing in it is focusable. Anything a readout says must also exist as
// real text on the page.
//
// Lines use `currentColor`, so `color` recolours the whole grid, and Theme
// defaults apply when no colour is given.
//
// `position: "fixed"` (default) pins the grid to the viewport so it stays
// while content scrolls under it. `position: "absolute"` fills the nearest
// positioned ancestor instead — give that ancestor `position: relative`.
//
// Geometry comes from lib/grid-geometry.js, which layout components that
// place content on the same grid should share.

const SVG_NS = "http://www.w3.org/2000/svg";

const DEFAULTS = {
	columns: 4,
	rows: 2,
	inset: 16,
	lineWidth: 1,
	lineOpacity: 0.35,
	marks: "square",          // "square" | "cross" | "none"
	markSize: 8,
	position: "fixed",        // "fixed" | "absolute"
	zIndex: 2,
	font: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
	fontSize: 11,
	letterSpacing: "0.04em",
	uppercase: true,
	breakpoint: 768,
	readouts: [],
};

class GridOverlay extends Animator {
	constructor() {
		super();
		this.options = {};
		this.config = null;
		this._readoutEls = new Map();
		this._readoutText = new Map();
		this.setup();
	}

	setup() {
		const host = document.createElement("div");
		host.setAttribute("aria-hidden", "true");
		host.setAttribute("data-nodality", "grid-overlay");
		host.style.pointerEvents = "none";
		host.style.top = "0";
		host.style.right = "0";
		host.style.bottom = "0";
		host.style.left = "0";
		host.style.overflow = "hidden";

		const svg = document.createElementNS(SVG_NS, "svg");
		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		svg.setAttribute("focusable", "false");
		svg.style.display = "block";
		host.appendChild(svg);

		this.res = host;
		this.svg = svg;
		return this;
	}

	set(obj = {}) {
		this.options = obj;

		// Every option is read as a literal `obj.name`: the schema generator
		// discovers a type's parameters from exactly these reads, so a spread
		// or a destructure here would hide them from `get_schema` and make the
		// validator reject valid specs.
		this.config = {
			//@ gridOverlay.columns {count}: Columns, counted as cells (N cells draw N+1 lines). 0 draws no vertical lines. Default 4. Named `columns`, not `cols`: the library's shared `cols` means grid-template-columns verbatim.
			columns: obj.columns ?? DEFAULTS.columns,
			//@ gridOverlay.rows {count}: Rows across the overlay's height, counted as cells. 0 draws no horizontal lines. Default 2.
			rows: obj.rows ?? DEFAULTS.rows,
			//@ gridOverlay.inset {px-number}: Distance of the outermost lines from the edge in px. A number, or {x, y}. Default 16.
			inset: obj.inset ?? DEFAULTS.inset,
			//@ gridOverlay.color {color}: Colour of lines, marks and readouts (drawn with currentColor). Falls back to the Theme text colour.
			color: obj.color,
			//@ gridOverlay.lineWidth {px-number}: Stroke width of the grid lines in px. Default 1.
			lineWidth: obj.lineWidth ?? DEFAULTS.lineWidth,
			//@ gridOverlay.lineOpacity {ratio}: Opacity of the lines only; marks and readouts stay opaque. 0–1, default 0.35.
			lineOpacity: obj.lineOpacity ?? DEFAULTS.lineOpacity,
			//@ gridOverlay.marks {enum(square|cross|none)}: Registration mark at each intersection: "square" (default), "cross" or "none".
			marks: obj.marks ?? DEFAULTS.marks,
			//@ gridOverlay.markSize {px-number}: Size of each registration mark in px. Default 8.
			markSize: obj.markSize ?? DEFAULTS.markSize,
			//@ gridOverlay.position {enum(fixed|absolute)}: "fixed" (default) pins the grid to the viewport; "absolute" fills the nearest positioned ancestor.
			position: obj.position ?? DEFAULTS.position,
			//@ gridOverlay.zIndex {count}: Stacking order of the overlay. Default 2 — keep navigation above it.
			zIndex: obj.zIndex ?? DEFAULTS.zIndex,
			//@ gridOverlay.font {text}: Font family of the readouts. Default a monospace stack.
			font: obj.font ?? DEFAULTS.font,
			//@ gridOverlay.fontSize {px-number}: Readout font size in px. Default 11.
			fontSize: obj.fontSize ?? DEFAULTS.fontSize,
			//@ gridOverlay.letterSpacing {text}: Readout letter spacing, any CSS length. Default "0.04em".
			letterSpacing: obj.letterSpacing ?? DEFAULTS.letterSpacing,
			//@ gridOverlay.uppercase {bool}: Uppercase the readout text. Default true.
			uppercase: obj.uppercase ?? DEFAULTS.uppercase,
			//@ gridOverlay.breakpoint {px-number}: Viewport width in px below which `mobile` applies. Default 768.
			breakpoint: obj.breakpoint ?? DEFAULTS.breakpoint,
			//@ gridOverlay.mobile {object}: Options that replace their desktop values below `breakpoint`, e.g. {columns: 1, rows: 4}.
			mobile: obj.mobile,
			//@ gridOverlay.readouts {array}: Labels beside intersections: [{id, col, row, text, anchor}]. col/row index lines from 0; anchor "br" (default), "bl", "tr" or "tl", flipped automatically when the label would fall outside. Decorative — say the same thing in real page text.
			readouts: obj.readouts ?? DEFAULTS.readouts,
		};

		const c = this.config;
		this.res.style.position = c.position === "absolute" ? "absolute" : "fixed";
		this.res.style.zIndex = String(c.zIndex);
		obj.color && (this.res.style.color = obj.color);
		obj.id && this.res.setAttribute("id", obj.id);

		this._watchSize();
		this.draw();

		//@ gridOverlay.raster {nodes}: Raster op nodes for the overlay, e.g. an offset driven by hover to bend the lines near the cursor.
		obj.raster && this.rasterize(obj.raster);
		return this;
	}

	// Change one readout's text without rebuilding the grid — the path for
	// live values such as a rotation angle.
	readout(id, text) {
		this._readoutText.set(id, text);
		const el = this._readoutEls.get(id);
		if (el) el.textContent = this._format(text);
		return this;
	}

	// The geometry currently drawn, for callers that align content to it.
	geometry() {
		return this._geometry || null;
	}

	draw() {
		if (!this.config) return this;
		const { width, height } = this._measure();
		const c = resolveGridOptions(this.config, this._viewportWidth());
		const g = gridGeometry({
			width, height,
			columns: c.columns, rows: c.rows,
			inset: c.inset, lineWidth: c.lineWidth,
		});
		this._geometry = g;

		const svg = this.svg;
		while (svg.firstChild) svg.removeChild(svg.firstChild);
		this._readoutEls.clear();
		if (!width || !height) return this;

		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

		// Lines run edge to edge; the inset only decides where they sit.
		const lines = this._node("g", {
			stroke: "currentColor",
			"stroke-width": c.lineWidth,
			"stroke-opacity": c.lineOpacity,
			"shape-rendering": "crispEdges",
		});
		for (const x of g.x) lines.appendChild(this._node("line", { x1: x, y1: 0, x2: x, y2: height }));
		for (const y of g.y) lines.appendChild(this._node("line", { x1: 0, y1: y, x2: width, y2: y }));
		svg.appendChild(lines);

		const s = Number(c.markSize) || 0;
		if (s > 0 && c.marks === "square") {
			const marks = this._node("g", { fill: "currentColor", "shape-rendering": "crispEdges" });
			for (const p of g.intersections) {
				marks.appendChild(this._node("rect", { x: p.x - s / 2, y: p.y - s / 2, width: s, height: s }));
			}
			svg.appendChild(marks);
		} else if (s > 0 && c.marks === "cross") {
			const d = g.intersections
				.map((p) => `M${p.x - s / 2} ${p.y}H${p.x + s / 2}M${p.x} ${p.y - s / 2}V${p.y + s / 2}`)
				.join("");
			if (d) {
				svg.appendChild(this._node("path", {
					d, fill: "none", stroke: "currentColor",
					"stroke-width": c.lineWidth, "shape-rendering": "crispEdges",
				}));
			}
		}

		const readouts = Array.isArray(c.readouts) ? c.readouts : [];
		if (readouts.length) {
			const group = this._node("g", {
				fill: "currentColor",
				"font-family": c.font,
				"font-size": c.fontSize,
				"letter-spacing": c.letterSpacing,
			});
			const gap = s / 2 + 6;
			readouts.forEach((r, i) => {
				if (!r) return;
				const point = g.intersections.find((p) => p.col === r.col && p.row === r.row);
				if (!point) return;
				const pos = readoutPosition(point, r.anchor, gap, { width, height });
				const id = r.id != null ? String(r.id) : `readout-${i}`;
				const text = this._node("text", {
					x: pos.x, y: pos.y,
					"text-anchor": pos.textAnchor,
					"dominant-baseline": pos.baseline,
					"data-readout": id,
				});
				text.textContent = this._format(this._readoutText.has(id) ? this._readoutText.get(id) : r.text);
				group.appendChild(text);
				this._readoutEls.set(id, text);
			});
			svg.appendChild(group);
		}
		return this;
	}

	_format(text) {
		const s = text == null ? "" : String(text);
		return this.config && this.config.uppercase === false ? s : s.toUpperCase();
	}

	_node(tag, attrs) {
		const el = document.createElementNS(SVG_NS, tag);
		for (const k in attrs) el.setAttribute(k, String(attrs[k]));
		return el;
	}

	_viewportWidth() {
		return typeof window !== "undefined" && window.innerWidth ? window.innerWidth : Infinity;
	}

	// The host's own box once laid out; the viewport before that. Before
	// render() the element has no box, and under jsdom it never does.
	_measure() {
		const hasWindow = typeof window !== "undefined";
		const width = this.res.clientWidth || (hasWindow ? window.innerWidth : 0) || 0;
		const height = this.res.clientHeight || (hasWindow ? window.innerHeight : 0) || 0;
		return { width, height };
	}

	_watchSize() {
		if (this._watching || typeof window === "undefined") return;
		this._watching = true;
		if (typeof window.ResizeObserver === "function") {
			const ro = new window.ResizeObserver(() => this.draw());
			ro.observe(this.res);
			this._track(() => ro.disconnect());
		} else {
			this._on(window, "resize", () => this.draw());
		}
	}

	toCode() {
		if (this.excludeFromCodeTrue) return [""];
		const cleaned = Object.fromEntries(
			Object.entries(this.options || {}).filter(([, v]) => v != null)
		);
		return [`new GridOverlay().set(${toObjectSource(cleaned, 4)})`];
	}

	excludeFromCode() { this.excludeFromCodeTrue = true; return this; }

	render(selector) {
		if (selector) {
			const parent = document.querySelector(selector);
			if (parent) {
				parent.appendChild(this.res);
				this.draw();
			}
		}
		return this.res;
	}
}

export { GridOverlay };

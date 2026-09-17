/*!
 * nodality v1.3.9
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

// grid-geometry.js — the arithmetic behind GridOverlay.
//
// One pure function turns a box size and a grid description into the pixel
// position of every line and every intersection. It lives apart from the
// component for two reasons:
//
//   • It is testable in bare Node. No DOM, no window, nothing at import.
//   • Anything that must land ON the grid needs the same numbers. The
//     overlay draws the lines; a layout component that places content in
//     the cells has to agree with it to the pixel, and two copies of this
//     maths would drift.
//
// Conventions
//   columns / rows  count CELLS, not lines. N cells → N+1 lines. 0 → no
//                on that axis (and therefore no intersections).
//   inset        distance of the outermost lines from the box edge, in px.
//                A number applies to both axes; { x, y } sets them apart.
//   lineWidth    used only to snap positions so 1px lines land on a pixel
//                boundary and stay sharp instead of smearing over two.

const clampCount = (n) => {
	const v = Math.floor(Number(n));
	return Number.isFinite(v) && v > 0 ? v : 0;
};

const toInset = (inset) => {
	if (inset && typeof inset === "object") {
		return { x: Math.max(0, Number(inset.x) || 0), y: Math.max(0, Number(inset.y) || 0) };
	}
	const v = Math.max(0, Number(inset) || 0);
	return { x: v, y: v };
};

// Odd stroke widths centre on a half pixel; even ones on a whole pixel.
const snap = (v, lineWidth) => {
	const w = Math.max(1, Math.round(Number(lineWidth) || 1));
	return w % 2 === 1 ? Math.round(v - 0.5) + 0.5 : Math.round(v);
};

// Positions of `count + 1` lines spread evenly from `start` to `end`.
const linePositions = (count, start, end, lineWidth) => {
	if (count === 0 || end <= start) return [];
	const step = (end - start) / count;
	const out = [];
	for (let i = 0; i <= count; i++) out.push(snap(start + step * i, lineWidth));
	return out;
};

function gridGeometry({ width = 0, height = 0, columns = 4, rows = 2, inset = 0, lineWidth = 1 } = {}) {
	const w = Math.max(0, Number(width) || 0);
	const h = Math.max(0, Number(height) || 0);
	const c = clampCount(columns);
	const r = clampCount(rows);
	const pad = toInset(inset);

	// An inset larger than half the box leaves no room for a grid.
	const left = Math.min(pad.x, w / 2);
	const top = Math.min(pad.y, h / 2);

	const x = linePositions(c, left, w - left, lineWidth);
	const y = linePositions(r, top, h - top, lineWidth);

	const intersections = [];
	for (let row = 0; row < y.length; row++) {
		for (let col = 0; col < x.length; col++) {
			intersections.push({ col, row, x: x[col], y: y[row] });
		}
	}

	return {
		width: w,
		height: h,
		columns: c,
		rows: r,
		inset: { x: left, y: top },
		cell: {
			width: c ? (w - 2 * left) / c : 0,
			height: r ? (h - 2 * top) / r : 0,
		},
		x,
		y,
		intersections,
	};
}

// Options for the current viewport. Below `breakpoint` the keys in `mobile`
// replace their desktop counterparts; everything else carries over.
function resolveGridOptions(options = {}, viewportWidth = Infinity) {
	const { mobile, ...base } = options || {};
	const breakpoint = Number(base.breakpoint) || 768;
	if (mobile && typeof mobile === "object" && viewportWidth < breakpoint) {
		return { ...base, ...mobile };
	}
	return base;
}

// Where a label sits relative to an intersection. `anchor` names the
// quadrant: "br" below-right (default), "bl", "tr", "tl".
//
// Pass `box` and the anchor becomes a preference rather than an order: a
// label that would land outside the box flips to the opposite side. Without
// it, any readout on the last column or bottom row is clipped by the host's
// overflow — which is what the outermost intersections are FOR, so the
// default must not punish using them.
function readoutPosition(point, anchor = "br", gap = 8, box = null) {
	const a = ["tl", "tr", "bl", "br"].includes(anchor) ? anchor : "br";
	let right = a[1] === "r";
	let below = a[0] === "b";

	if (box) {
		const w = Number(box.width) || 0;
		const h = Number(box.height) || 0;
		// Room for a short label on the side the anchor asks for. The exact
		// text width is a render-time measurement; this only has to catch the
		// case where the intersection sits ON the edge.
		const room = gap + 24;
		if (right && point.x + room > w) right = false;
		else if (!right && point.x - room < 0) right = true;
		if (below && point.y + room > h) below = false;
		else if (!below && point.y - room < 0) below = true;
	}

	return {
		x: point.x + (right ? gap : -gap),
		y: point.y + (below ? gap : -gap),
		textAnchor: right ? "start" : "end",
		baseline: below ? "hanging" : "alphabetic",
	};
}

export { gridGeometry, resolveGridOptions, readoutPosition };

// raster-wrap-size.test.mjs — what the raster wrapper does to an <img>'s size,
// and the halftone loupe's shader shape.
//
// The bug: a raster op on an <img> sized by a STYLESHEET (nothing inline)
// stretched it — the wrapper copied only inline sizing and fell back to
// width: 100%, so a 600x400 image in a 700px column became 700x466. The
// wrapper now takes the image's authored sizing as computed values (a
// percentage stays a percentage). Pixel boxes need a browser and are
// asserted in __tests__/e2e/raster-image-size.spec.js; this checks the
// sizing the wrapper is given, which jsdom's cascade can answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!doctype html><html><head><style>
  .col > img.fixed { width: 600px; }
  .col > img.fluid { width: 50%; max-width: 100%; }
  .col > img.tall { height: 200px; }
  .col > img.capped { max-width: 100%; }
</style></head><body><div class="col" id="col"></div></body></html>`, { pretendToBeVisual: true });
const W = dom.window;
for (const k of ["window", "document", "HTMLElement", "Node", "Element"]) globalThis[k] = W[k];
globalThis.getComputedStyle = W.getComputedStyle.bind(W);

const { wrapReplacedHost, REGISTRY } = await import("../../lib/raster-ops.js");

/** An <img> with a class, natural size 600x400, wrapped. */
function wrapped(cls, inline) {
	const col = W.document.getElementById("col");
	col.innerHTML = "";
	const img = W.document.createElement("img");
	img.className = cls;
	if (inline) img.setAttribute("style", inline);
	Object.defineProperty(img, "naturalWidth", { value: 600 });
	Object.defineProperty(img, "naturalHeight", { value: 400 });
	col.appendChild(img);
	const wrap = wrapReplacedHost(img);
	return { img, wrap };
}

test("stylesheet width: the wrapper takes it, height follows the image (auto)", () => {
	const { img, wrap } = wrapped("fixed");
	assert.equal(wrap.style.width, "600px");
	assert.equal(wrap.style.height, "auto", "not 100%: a parent of definite height must not stretch it");
	assert.equal(img.style.width, "100%");
	assert.equal(img.style.display, "block");
	assert.equal(img.style.getPropertyValue("display"), "block", "the probe's display:none is gone");
});

test("a percentage stays a percentage, so the image stays fluid", () => {
	const { wrap } = wrapped("fluid");
	assert.equal(wrap.style.width, "50%");
	assert.equal(wrap.style.maxWidth, "100%");
});

test("stylesheet height only: width comes from the image's aspect ratio", () => {
	const { wrap } = wrapped("tall");
	assert.equal(wrap.style.height, "200px");
	assert.equal(wrap.style.width, "auto");
	assert.match(wrap.style.aspectRatio, /^1\.5( \/ 1)?$/);
});

test("only max-width (a CSS reset): the image's natural width, capped", () => {
	const { wrap } = wrapped("capped");
	assert.equal(wrap.style.width, "600px");
	assert.equal(wrap.style.maxWidth, "100%");
});

test("inline sizing still wins over the stylesheet", () => {
	const { wrap } = wrapped("fixed", "width: 320px; height: 200px");
	assert.equal(wrap.style.width, "320px");
	assert.equal(wrap.style.height, "200px");
});

test("no sizing anywhere: unchanged, the wrapper fills its parent", () => {
	const { wrap } = wrapped("");
	assert.equal(wrap.style.width, "100%");
	assert.equal(wrap.style.height, "100%");
});

test("halftone with a driver magnifies the grid about the focus instead of re-pitching it in place", () => {
	// Dividing the absolute fragment position by a pitch that varies across
	// the element shears the grid more the further it is from the origin —
	// the moire swirl. The loupe scales about the focus (identity outside
	// the spot), and the grid coordinate is the scaled position over the
	// constant pitch.
	const code = REGISTRY.halftone.code("u_0_", { op: "halftone", by: "mouse" });
	assert.match(code, /sp = u_0_dpos \+ \(frag - u_0_dpos\) \/ mag;/);
	assert.match(code, /ca \* sp\.y\) \/ sz;/);
	assert.doesNotMatch(code, /frag\.y\) \/ max\(sz/, "no per-pixel pitch in the grid coordinate");
	const still = REGISTRY.halftone.code("u_0_", { op: "halftone" });
	assert.doesNotMatch(still, /dpos/, "without a driver: a plain screen, no focus uniform read");
});

test("dither's driver uses the same loupe", () => {
	const code = REGISTRY.dither.code("u_0_", { op: "dither", by: "mouse" });
	assert.match(code, /sp = u_0_dpos \+ \(frag - u_0_dpos\) \//);
	assert.match(code, /b8\(sp \/ sz\)/);
});

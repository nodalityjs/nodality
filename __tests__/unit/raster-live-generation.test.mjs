// raster-live-generation.test.mjs — the live backend speaks both generations
// of the HTML-in-Canvas upload, and prefers the newer one.
//
// Chrome 155 renamed the API: texElementImage2D became texElementSubImage2D
// (into storage the caller allocates), and the canvas opt-in layoutsubtree
// became content="drawable". Chrome 156 still exposes both methods. The
// backend used to look for the old name only, so it kept working by luck,
// and would have turned every live pipeline into a snapshot the day the old
// name went. Every e2e live test would then have skipped, not failed.
//
// There is no GPU here: the context is a stub that records the calls the
// backend makes. Whether the upload really draws is the e2e suite's job.

import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

let raster, dom, calls;

class WebGL2RenderingContext {}

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="host"><h2>Pressed into</h2></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.matchMedia = (q) => ({ matches: false, media: q,
		addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	Object.defineProperty(dom.window.document, "visibilityState", { get: () => "visible", configurable: true });

	globalThis.WebGL2RenderingContext = dom.window.WebGL2RenderingContext = WebGL2RenderingContext;
	const truthy = new Set(["getShaderParameter", "getProgramParameter", "checkFramebufferStatus"]);
	dom.window.HTMLCanvasElement.prototype.getContext = function () {
		const base = Object.create(WebGL2RenderingContext.prototype);
		return new Proxy(base, {
			get(t, k) {
				if (k in t) return t[k];
				if (typeof k !== "string") return undefined;
				if (/^[A-Z_0-9]+$/.test(k)) return 0;          // constants
				if (k === "drawingBufferWidth" || k === "drawingBufferHeight") return 1;
				return (...a) => {
					if (k === "texImage2D") calls.push({ k, a });
					return truthy.has(k) ? true : (k.startsWith("create") || k.startsWith("get") ? {} : undefined);
				};
			},
		});
	};
	raster = await import("../../lib/raster-ops.js");
});

// Each test installs the methods of the browser it pretends to be.
const speak = (...methods) => {
	delete WebGL2RenderingContext.prototype.texElementImage2D;
	delete WebGL2RenderingContext.prototype.texElementSubImage2D;
	for (const m of methods) {
		WebGL2RenderingContext.prototype[m] = function (...a) { calls.push({ k: m, a }); };
	}
};

beforeEach(() => {
	calls = [];
	const host = document.getElementById("host");
	host.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: 400, height: 120, right: 400, bottom: 120 });
});

let handle;
afterEach(() => {
	handle && typeof handle.destroy === "function" && handle.destroy();
	handle = null;
	document.querySelectorAll("canvas[data-nodality-raster]").forEach((c) => c.remove());
});

const NODES = [{ op: "hexalize", by: "hover", lift: 0.35 }, { op: "edges", color: "#0E0F11" }];
const attach = () => {
	const info = console.info; console.info = () => {};
	try {
		handle = raster.applyRasterPipeline(document.getElementById("host"), NODES.map((n) => ({ ...n })));
	} finally {
		console.info = info;
	}
	assert.ok(handle, "the pipeline attached");
	return document.querySelector("canvas[data-nodality-raster]");
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("the newer method wins when a browser has both, as Chrome 156 does", () => {
	const proto = { texElementImage2D() {}, texElementSubImage2D() {} };
	assert.equal(raster.htmlInCanvasGeneration(proto), "sub-image");
	assert.equal(raster.htmlInCanvasGeneration({ texElementImage2D() {} }), "image");
	assert.equal(raster.htmlInCanvasGeneration({ texElementSubImage2D() {} }), "sub-image");
	assert.equal(raster.htmlInCanvasGeneration({}), null);
	assert.equal(raster.htmlInCanvasGeneration(null), null);
});

test("a browser with only the new method still gets the live backend", () => {
	speak("texElementSubImage2D");
	const canvas = attach();
	assert.equal(canvas.getAttribute("data-nodality-raster"), "live");
	assert.equal(canvas.getAttribute("data-nodality-raster-api"), "sub-image");
	assert.equal(canvas.getAttribute("content"), "drawable");
	assert.equal(canvas.hasAttribute("layoutsubtree"), false, "the old opt-in is not mixed in");
	assert.ok(canvas.firstElementChild.hasAttribute("drawable"), "the uploaded wrapper is marked drawable");
});

test("a browser with only the old method keeps the old opt-in", () => {
	speak("texElementImage2D");
	const canvas = attach();
	assert.equal(canvas.getAttribute("data-nodality-raster"), "live");
	assert.equal(canvas.getAttribute("data-nodality-raster-api"), "image");
	assert.equal(canvas.hasAttribute("layoutsubtree"), true);
	assert.equal(canvas.hasAttribute("content"), false);
	assert.equal(canvas.firstElementChild.hasAttribute("drawable"), false);
});

test("a browser with neither stays on the snapshot", () => {
	speak();
	const canvas = attach();
	assert.equal(canvas.getAttribute("data-nodality-raster"), "snapshot");
	assert.equal(canvas.hasAttribute("data-nodality-raster-api"), false);
});

test("the new upload allocates storage first, then writes into it, and stays live", async () => {
	speak("texElementImage2D", "texElementSubImage2D");
	const canvas = attach();
	const wrap = canvas.firstElementChild;
	canvas.dispatchEvent(new dom.window.Event("paint"));
	const kinds = calls.map((c) => c.k);
	assert.ok(kinds.includes("texElementSubImage2D"), "the new method was used");
	assert.ok(!kinds.includes("texElementImage2D"), "the old method was not");
	const alloc = kinds.indexOf("texImage2D");
	assert.ok(alloc >= 0 && alloc < kinds.indexOf("texElementSubImage2D"),
		"storage is allocated before the sub-image upload");
	const allocArgs = calls[alloc].a;
	assert.equal(allocArgs[8], null, "allocation reserves storage without pixels");
	const upload = calls.find((c) => c.k === "texElementSubImage2D").a;
	assert.deepEqual(upload.slice(1, 4), [0, 0, 0], "level 0 at offset 0,0");
	assert.equal(upload[4], wrap, "the wrapper is what gets uploaded");

	// A second paint at the same size writes again without reallocating.
	calls.length = 0;
	canvas.dispatchEvent(new dom.window.Event("paint"));
	assert.deepEqual(calls.map((c) => c.k), ["texElementSubImage2D"]);

	// Past the 1500ms paint budget the backend is still live.
	await wait(1700);
	assert.equal(canvas.getAttribute("data-nodality-raster"), "live");
});

test("a failing new upload falls back to the snapshot and clears both opt-ins", () => {
	speak("texElementSubImage2D");
	WebGL2RenderingContext.prototype.texElementSubImage2D = () => {
		throw new Error("InvalidStateError: No cached paint record for element");
	};
	const canvas = attach();
	const warn = console.warn; const said = [];
	console.warn = (m) => said.push(String(m));
	try {
		canvas.dispatchEvent(new dom.window.Event("paint"));
	} finally {
		console.warn = warn;
	}
	assert.equal(canvas.getAttribute("data-nodality-raster"), "snapshot-fallback");
	assert.ok(said.some((m) => /texElementSubImage2D failed/.test(m)), "the reason is reported");
	assert.equal(canvas.hasAttribute("content"), false);
	assert.equal(canvas.hasAttribute("layoutsubtree"), false);
	assert.equal(canvas.hasAttribute("data-nodality-raster-api"), false);
	assert.ok(document.getElementById("host").textContent.includes("Pressed into"),
		"the content is handed back to the host");
});

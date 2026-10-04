// raster-live-visibility.test.mjs — live HTML-in-Canvas waits for a visible page.
//
// The live backend falls back to the snapshot when no paint event arrives
// within 1500ms. A hidden document (a tab opened in the background) paints
// nothing at all, so timing that from load sent every background-opened page
// to the snapshot for good, even in a browser with the API: found on the
// suitcase site in a Chrome that has texElementImage2D. The clock now starts
// when the page is first shown.
//
// There is no GPU here: the context is a stub on which every WebGL call is a
// no-op, which is enough to reach the backend decision. Shader compilation is
// the e2e suite's job.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let applyRasterPipeline, dom, visibility;

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
	Object.defineProperty(dom.window.document, "visibilityState", { get: () => visibility, configurable: true });

	// A browser with the HTML-in-Canvas API: the method on the prototype is
	// what the backend looks for before it creates a context.
	class WebGL2RenderingContext {}
	WebGL2RenderingContext.prototype.texElementImage2D = function () {};
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
				return (...a) => (truthy.has(k) ? true : (k.startsWith("create") || k.startsWith("get") ? {} : undefined));
			},
		});
	};
	({ applyRasterPipeline } = await import("../../lib/raster-ops.js"));
});

beforeEach(() => {
	const host = document.getElementById("host");
	host.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: 400, height: 120, right: 400, bottom: 120 });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const backend = () => document.querySelector("canvas[data-nodality-raster]")?.getAttribute("data-nodality-raster");
const NODES = [{ op: "hexalize", by: "hover", lift: 0.35 }, { op: "edges", color: "#0E0F11" }];

test("a hidden page keeps the live backend until it is shown, then times the paint", async () => {
	visibility = "hidden";
	const warn = console.warn; const said = [];
	console.warn = (m) => said.push(String(m));
	let handle;
	try {
		handle = applyRasterPipeline(document.getElementById("host"), NODES.map((n) => ({ ...n })));
		assert.ok(handle, "the pipeline attached");
		assert.equal(backend(), "live");
		await wait(1700);
		assert.equal(backend(), "live", "no fallback while nobody can see the page");
		assert.ok(!said.some((m) => /no paint event/.test(m)));

		// Shown, and still no paint: now the budget applies.
		visibility = "visible";
		document.dispatchEvent(new dom.window.Event("visibilitychange"));
		await wait(1700);
		assert.equal(backend(), "snapshot-fallback");
		assert.ok(said.some((m) => /no paint event within 1500ms/.test(m)));
	} finally {
		console.warn = warn;
		handle && typeof handle.destroy === "function" && handle.destroy();
		document.querySelectorAll("canvas[data-nodality-raster]").forEach((c) => c.remove());
	}
});

// core-gaps.test.mjs — five gaps in the core, each closed and pinned here.
//
//   1. Design ops had no parameter vocabulary: list_ops described none of
//      their options and validate_nodes accepted any key inside `op`, so
//      `{ name: "shadow", colours: [...] }` validated clean and painted grey.
//      The registry (lib/design-ops.js) is checked against the code that
//      reads the options, in both directions.
//   2. CSS-named options pages still reached keySet for (scroll snap,
//      columns, text-wrap, …), checked for collisions with existing names.
//   3. resprop/respad/resmar by pixel range and by container width, with the
//      element's own value restored outside the range.
//   4. onScroll under prefers-reduced-motion.
//   5. Page defaults: `new Des().defaults({ font })`.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");

let Des, Animator, validateNodes, describeOps, DESIGN_OP_NAMES;
let DESIGN_OP_PARAMS, TRANSFORM_STYLES, applyPageDefaults, dom, width, reduced;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.MutationObserver = dom.window.MutationObserver;
	globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	({ Des } = await import("../../lib/designer.js"));
	({ Animator } = await import("../../layout/animator.js"));
	({ validateNodes, describeOps, DESIGN_OP_NAMES } = await import("../../lib/validate-nodes.js"));
	({ DESIGN_OP_PARAMS, TRANSFORM_STYLES } = await import("../../lib/design-ops.js"));
	({ applyPageDefaults } = await import("../../lib/page-defaults.js"));
});

const atWidth = (w) => {
	width = w;
	dom.window.matchMedia = (q) => {
		const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
		const matches = /prefers-reduced-motion/.test(q) ? reduced : (!min || width >= +min[1]) && (!max || width <= +max[1]);
		return { matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
	};
	Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
};
const resize = (w) => { atWidth(w); dom.window.dispatchEvent(new dom.window.Event("resize")); };
const tick = () => new Promise((r) => setTimeout(r, 5));

beforeEach(() => {
	document.getElementById("mount").innerHTML = "";
	reduced = false;
	delete dom.window.ResizeObserver;
	atWidth(1440);
});

const render = (els, nodes = [], defaults) => {
	const d = new Des();
	if (defaults !== undefined) d.defaults(defaults);
	return d.nodes(nodes).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
};
const byId = (id) => document.querySelector(`#mount [id="${id}"]`);
const warnsOf = (r, code) => r.warnings.filter((w) => w.code === code);

// ═══ 1. design-op parameters ══════════════════════════════════════════

// Source as the runtime sees it: comments removed (a fifth of the reads in
// these files are commented out), strings kept. `//` after a colon is a URL.
const live = (text) => text
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

const SOURCES = [
	...readdirSync(path.join(ROOT, "layout")).filter((f) => f.endsWith(".js")).map((f) => path.join(ROOT, "layout", f)),
	...readdirSync(path.join(ROOT, "layout", "form-components")).filter((f) => f.endsWith(".js")).map((f) => path.join(ROOT, "layout", "form-components", f)),
	...readdirSync(path.join(ROOT, "lib")).filter((f) => f.endsWith(".js"))
		// The validator and the registry describe the keys; they do not read them.
		.filter((f) => !["validate-nodes.js", "design-ops.js"].includes(f) && !f.includes(".generated."))
		.map((f) => path.join(ROOT, "lib", f)),
];

// Receivers whose op is unambiguous, as the components and helpers name them.
const RECEIVER_OP = {
	stroke: "blast", gradient: "gradient", animation: "animation", anna: "animation",
	spanObj: "span", noiseObject: "filter", cardOption: "card-style", bst: "link-style",
};

/** Every key read off a design node's op, by file: [{ file, receiver, key, op? }]. */
function designOpReads() {
	const reads = [];
	for (const file of SOURCES) {
		const text = live(readFileSync(file, "utf8"));
		const rel = path.relative(ROOT, file);
		// `<receiver>.op.<key>` and the optional-chaining forms.
		for (const m of text.matchAll(/([A-Za-z_$][\w$]*)?(?:\[[^\]]*\])?\??\.op\??\.([A-Za-z_$][\w$]*)/g)) {
			if (m[2] === "name") continue;
			reads.push({ file: rel, receiver: m[1] || "", key: m[2], op: RECEIVER_OP[m[1]] });
		}
		if (rel === path.join("layout", "animator.js")) {
			// `let ass = this.options.animation.op` — the animation op by alias.
			for (const m of text.matchAll(/(?<![.\w$])ass\.([A-Za-z_$][\w$]*)/g)) reads.push({ file: rel, receiver: "ass", key: m[1], op: "animation" });
			// `const { op } = this.options.shadow` — the only bare `op.` in the file.
			for (const m of text.matchAll(/(?<![.\w$])op\.([A-Za-z_$][\w$]*)/g)) reads.push({ file: rel, receiver: "op", key: m[1], op: "shadow" });
			// reactOnTransform: `transform = obj.op`.
			const start = text.indexOf("reactOnTransform = (obj)");
			const body = text.slice(start, text.indexOf("maxWidth(w)", start));
			assert.ok(start > 0 && body.length > 1000, "reactOnTransform located");
			for (const m of body.matchAll(/(?<![.\w$])transform\.([A-Za-z_$][\w$]*)/g)) reads.push({ file: rel, receiver: "transform", key: m[1], op: "transform" });
		}
	}
	return reads;
}

test("every key the code reads off a design op is registered (for that op, where the receiver says which)", () => {
	const reads = designOpReads();
	assert.ok(reads.length > 40, `the scan finds the reads (${reads.length})`);
	const union = new Set(Object.values(DESIGN_OP_PARAMS).flatMap((s) => Object.keys(s.params)));
	const missing = [];
	for (const r of reads) {
		if (r.op) {
			if (!DESIGN_OP_PARAMS[r.op] || !DESIGN_OP_PARAMS[r.op].params[r.key]) missing.push(`${r.op}.${r.key} (${r.file}, ${r.receiver})`);
		} else if (!union.has(r.key)) {
			missing.push(`?.${r.key} (${r.file}, ${r.receiver})`);
		}
	}
	assert.deepEqual(missing, [], "add these to lib/design-ops.js, with what they do");
});

test("every registered design-op parameter is read somewhere (the registry invents nothing)", () => {
	const read = new Set(designOpReads().map((r) => r.key));
	const unread = [];
	for (const [op, spec] of Object.entries(DESIGN_OP_PARAMS)) {
		for (const key of Object.keys(spec.params)) if (!read.has(key)) unread.push(`${op}.${key}`);
	}
	assert.deepEqual(unread, []);
});

test("the registry covers exactly the design ops the validator accepts", () => {
	assert.deepEqual(Object.keys(DESIGN_OP_PARAMS).sort(), [...DESIGN_OP_NAMES].sort());
});

test("TRANSFORM_STYLES are the presets designer.js picks by `style`", () => {
	const src = live(readFileSync(path.join(ROOT, "lib", "designer.js"), "utf8"));
	const fromCode = [...new Set([...src.matchAll(/cool === "([A-Z-]+)"/g)].map((m) => m[1]))].sort();
	assert.deepEqual([...TRANSFORM_STYLES].sort(), fromCode);
});

test("list_ops describes every design op's parameters, animation's fireAt included", () => {
	const d = describeOps();
	assert.equal(d.designOps.length, DESIGN_OP_NAMES.length);
	const anim = d.designOps.find((o) => o.op === "animation");
	const names = anim.params.map((p) => p.name);
	for (const k of ["fireAt", "keyframesOpen", "keyframesClose", "openOptions", "closeOptions"]) assert.ok(names.includes(k), k);
	assert.match(anim.params.find((p) => p.name === "fireAt").summary, /inview/);
	assert.ok(anim.shorthand);
	for (const o of d.designOps) for (const p of o.params) {
		assert.equal(typeof p.unit, "string", `${o.op}.${p.name} has a unit`);
		assert.ok(p.summary.length > 5, `${o.op}.${p.name} says what it does`);
	}
	assert.ok(d.designFields.some((f) => f.name === "range"));
	assert.ok(d.ops.length > 0 && d.ops.every((o) => Array.isArray(o.stage)), "raster ops unchanged");
});

const E1 = [{ id: "hero", type: "h1", text: "A" }, { id: "box", type: "wrap", children: [] }];

test("a misspelled op parameter is UNKNOWN_OP_PARAM with the name it meant, as a warning", () => {
	const r = validateNodes([{ op: { name: "shadow", colours: ["#000"], steps: 2 }, target: ["box"] }], E1);
	assert.equal(r.ok, true, "the page still renders");
	const w = warnsOf(r, "UNKNOWN_OP_PARAM");
	assert.equal(w.length, 1);
	assert.equal(w[0].path, "nodes[0].op.colours");
	assert.equal(w[0].suggestions[0], "colors");
	assert.ok(w[0].valid.includes("movements"));
	assert.match(w[0].detail, /Did you mean "colors"/);
});

test("a parameter of a DIFFERENT design op is suggested too", () => {
	const r = validateNodes([{ op: { name: "gradient", gradient: "linear-gradient(red, blue)", fireAt: "inview" }, target: ["hero"] }], E1);
	assert.deepEqual(warnsOf(r, "UNKNOWN_OP_PARAM").map((w) => w.got), ["fireAt"]);
});

test("BAD_PARAM_VALUE where the reading code provably cannot use the value", () => {
	const r = validateNodes([
		{ op: { name: "animation", fireAt: "onview", keyframesOpen: "fade" }, target: ["hero"] },
		{ op: { name: "shadow", movements: [3, 3], colors: "#000" }, target: ["box"] },
		{ op: { name: "link-style", ops: "round-glow" }, target: ["hero"] },
	], E1);
	const bad = warnsOf(r, "BAD_PARAM_VALUE").map((w) => w.path);
	assert.deepEqual(bad.sort(), [
		"nodes[0].op.fireAt", "nodes[0].op.keyframesOpen", "nodes[1].op.colors",
		"nodes[1].op.movements", "nodes[2].op.ops",
	]);
	const mv = warnsOf(r, "BAD_PARAM_VALUE").find((w) => w.path === "nodes[1].op.movements");
	assert.deepEqual(mv.suggestions, ['["3px","3px"]']);
	assert.equal(r.ok, true);
});

test("a correct node of every shape validates without a warning", () => {
	const r = validateNodes([
		{ op: { name: "animation", fireAt: "inview",
			keyframesClose: [{ opacity: 1 }, { opacity: 0, transform: "translateY(24px)" }],
			keyframesOpen: [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }],
			openOptions: { duration: 500, easing: "ease-out", fill: "forwards" } }, target: ["hero"] },
		{ op: { name: "shadow", steps: 2, colors: ["#000", "#444"], movements: ["2px", "4px"], radius: "6px" }, target: ["box"] },
		{ op: { name: "blast", color: "#f90", width: "2px" }, target: ["hero"], range: ["0px", "900px"] },
		{ op: { name: "filter", filter: "grayscale(0.5)" }, target: ["box"] },
		{ op: "gradient", gradient: "linear-gradient(red, blue)", target: ["hero"] },
		{ op: "blast", color: "#fff", width: "3px", target: ["box"] },
		{ op: { name: "transform" }, target: ["box"], style: "WAVE", duration: "fast" },
	], E1);
	assert.deepEqual(r.warnings.filter((w) => w.code !== "SHADOWED_NODE"), []);
	assert.equal(r.ok, true);
});

test("keys that are read and change nothing are PARAM_INERT, with the reason", () => {
	const r = validateNodes([
		{ op: { name: "transform", values: ["ty:-20px"], on: "mouseover" }, target: ["box"] },
		{ op: "gradient", color: "red", target: ["hero"] },
		{ op: { name: "shadow" }, target: ["box"], style: "WAVE" },
		{ op: { name: "transform" }, target: ["hero"], style: "WAVY" },
	], E1);
	const inert = warnsOf(r, "PARAM_INERT").map((w) => w.path);
	// Round 2: a transform node's own keys are laid over the preset, so
	// `values` and `on` work and are no longer reported.
	assert.deepEqual(inert.sort(), ["nodes[1].color", "nodes[2].style"]);
	assert.match(warnsOf(r, "PARAM_INERT").find((w) => w.path === "nodes[2].style").detail, /only a transform uses it/);
	const style = warnsOf(r, "BAD_PARAM_VALUE").find((w) => w.path === "nodes[3].style");
	assert.equal(style.suggestions[0], "WAVE");
});

test("the transform claim is true: a Des transform node's own options are laid over the preset", async () => {
	// Pins what the registry now says (lib/design-ops.js, no transform key is
	// inert): designer.js keeps the node's own `values`, `on`, … over the preset.
	const seen = [];
	const orig = Animator.prototype.chainReact;
	Animator.prototype.chainReact = function (q, ...rest) { seen.push(...q); return orig.call(this, q, ...rest); };
	try {
		render({ type: "p", id: "t", text: "x" }, [{ op: { name: "transform", values: ["ty:-99px"], on: "click" }, target: ["t"] }]);
	} finally { Animator.prototype.chainReact = orig; }
	const t = seen.find((q) => q.log === "transform");
	assert.ok(t, "the transform reached the component");
	assert.deepEqual(t.op.values, ["ty:-99px"]);
	assert.equal(t.op.on, "click");
	for (const spec of Object.values(DESIGN_OP_PARAMS.transform.params)) assert.equal(spec.inert, undefined);
});

test('animation fireAt "inview": the close state at once, keyframesOpen on first intersection, once', async () => {
	const calls = [];
	const proto = dom.window.Element.prototype;
	const origAnimate = proto.animate;
	proto.animate = function (frames, opts) { calls.push({ frames, opts }); return { finished: Promise.resolve(), cancel() {} }; };
	let fire = null, disconnected = false;
	globalThis.IntersectionObserver = class { constructor(cb) { fire = cb; } observe() {} disconnect() { disconnected = true; } };
	try {
		const close = [{ opacity: 1 }, { opacity: 0 }], open = [{ opacity: 0 }, { opacity: 1 }];
		render({ type: "p", id: "t", text: "x" }, [{ op: { name: "animation", fireAt: "inview", keyframesClose: close, keyframesOpen: open,
			openOptions: { duration: 300, fill: "forwards" } }, target: ["t"] }]);
		assert.deepEqual(calls[0].frames, close);
		assert.equal(calls[0].opts.duration, 0);
		const before = calls.length;
		fire([{ isIntersecting: true }], { disconnect() { disconnected = true; } });
		fire([{ isIntersecting: true }], { disconnect() {} });
		const opened = calls.slice(before).filter((c) => JSON.stringify(c.frames) === JSON.stringify(open));
		assert.equal(opened.length, 1, "played once");
		assert.equal(opened[0].opts.duration, 300);
		assert.ok(disconnected);
	} finally {
		proto.animate = origAnimate;
		delete globalThis.IntersectionObserver;
	}
});

// ═══ 2. CSS-named style options ═══════════════════════════════════════

test("the new CSS-named options reach the element", () => {
	render([
		{ type: "wrap", id: "w", children: [], scrollSnapType: "x mandatory", overscrollBehaviorX: "contain", scrollPaddingLeft: "16px",
			columns: "2", columnRule: "1px solid red", isolation: "isolate", outline: "2px solid red", outlineOffset: "3px", cssFilter: "blur(2px)" },
		{ type: "h1", id: "h", text: "Title", textWrap: "balance", fontVariantNumeric: "tabular-nums", scrollMarginTop: "80px",
			textUnderlineOffset: "4px", textDecorationThickness: "2px", mixBlendMode: "multiply", breakInside: "avoid" },
	]);
	const w = byId("w").style, h = byId("h").style;
	assert.equal(w.scrollSnapType, "x mandatory");
	assert.equal(w.overscrollBehaviorX, "contain");
	assert.equal(w.scrollPaddingLeft, "16px");
	assert.equal(w.columns, "2");
	assert.equal(w.columnRule, "1px solid red");
	assert.equal(w.isolation, "isolate");
	assert.equal(w.outline, "2px solid red");
	assert.equal(w.outlineOffset, "3px");
	assert.equal(w.filter, "blur(2px)");
	assert.equal(h.textWrap, "balance");
	assert.equal(h.fontVariantNumeric, "tabular-nums");
	assert.equal(h.scrollMarginTop, "80px");
	assert.equal(h.textUnderlineOffset, "4px");
	assert.equal(h.textDecorationThickness, "2px");
	assert.equal(h.mixBlendMode, "multiply");
	assert.equal(h.breakInside, "avoid");
});

test("names that already meant something keep their meaning", () => {
	render([
		{ type: "wrap", id: "glass", children: [], filter: true },
		{ type: "img", id: "p", url: "a.jpg", alt: "", clipPath: "M 0 0 L 10 0 L 10 10 Z" },
		{ type: "img", id: "c", url: "a.jpg", alt: "", clipPath: "circle(50%)" },
	]);
	assert.equal(byId("glass").style.backdropFilter, "blur(3px)", "wrap `filter` is still frosted glass");
	assert.equal(byId("glass").style.filter, "");
	assert.equal(byId("p").style.clipPath, 'path("M 0 0 L 10 0 L 10 10 Z")', "img path data still goes through path()");
	assert.equal(byId("c").style.clipPath, "circle(50%)", "a CSS clip-path is applied as written");
});

test("flexDirection is wrap's flexDir by its CSS name, and never overrules a display the page chose", () => {
	render([
		{ type: "wrap", id: "a", children: [], flexDirection: "column" },
		{ type: "wrap", id: "b", children: [], display: "grid", flexDirection: "column" },
		{ type: "p", id: "c", text: "x", flexDirection: "row" },
	]);
	assert.equal(byId("a").style.flexDirection, "column");
	assert.equal(byId("a").style.display, "flex");
	assert.equal(byId("b").style.display, "grid");
	assert.equal(byId("c").style.flexDirection, "row");
});

test("the schema and the validator know the new options", () => {
	const schema = JSON.parse(readFileSync(path.join(ROOT, "schema.json"), "utf8"));
	const p = schema.types.p.params.map((x) => x.name);
	for (const k of ["textWrap", "scrollSnapAlign", "cssFilter", "outline", "columns", "flexDirection"]) assert.ok(p.includes(k), k);
	assert.ok(!schema.types.gridOverlay.params.find((x) => x.name === "columns").description.startsWith("CSS"),
		"gridOverlay keeps its own `columns`");
	const r = validateNodes([], [{ type: "h1", id: "h", text: "A", textWrap: "balance", scrollMarginTop: "80px" }]);
	assert.deepEqual(r.warnings, []);
	assert.deepEqual(r.errors, []);
});

// ═══ 3. resprop by pixel range and by container ═══════════════════════

test("resprop { min }: sticky only from 900px, the element's own position below", async () => {
	render({ type: "wrap", id: "w", children: [], resprop: [{ min: 900, position: "sticky", top: "0px" }] });
	await tick();
	assert.equal(byId("w").style.position, "sticky");
	resize(899);
	assert.equal(byId("w").style.position, "", "below 900 nothing is left behind");
	assert.equal(byId("w").style.top, "");
	resize(900);
	assert.equal(byId("w").style.position, "sticky", "min is inclusive");
});

test("…and back to the base value the element was given", async () => {
	render({ type: "wrap", id: "w", children: [], position: "relative", resprop: [{ min: 900, position: "sticky" }] });
	await tick();
	assert.equal(byId("w").style.position, "sticky");
	resize(375);
	assert.equal(byId("w").style.position, "relative");
});

test("resprop { min, max } is inclusive at both ends, and either bound is optional", async () => {
	render({ type: "p", id: "t", text: "x", resprop: [{ min: 600, max: 899, letterSpacing: "1px" }, { max: 599, letterSpacing: "2px" }] });
	await tick();
	const at = (w) => { resize(w); return byId("t").style.letterSpacing; };
	assert.equal(at(1440), "");
	assert.equal(at(899), "1px");
	assert.equal(at(600), "1px");
	assert.equal(at(599), "2px");
	assert.equal(at(0), "2px");
	assert.equal(at(900), "");
});

test("named breakpoints are unchanged beside the new forms", async () => {
	render({ type: "p", id: "t", text: "x", resprop: [{ breakpoint: "xs", letterSpacing: "2px" }, { min: 1200, letterSpacing: "3px" }] });
	await tick();
	assert.equal(byId("t").style.letterSpacing, "3px");
	resize(500);
	assert.equal(byId("t").style.letterSpacing, "2px");
	resize(800);
	assert.equal(byId("t").style.letterSpacing, "");
});

/** A ResizeObserver stand-in, and a parent whose content box is `w` px. */
function withContainer(w) {
	const observers = [];
	dom.window.ResizeObserver = class { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() {} };
	const state = { w };
	Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.id === "mount" ? state.w : 0; } });
	return {
		set(nw) { state.w = nw; observers.forEach((o) => o.cb([])); },
		restore() { delete dom.window.HTMLElement.prototype.clientWidth; },
	};
}

test("resprop { container }: measured on the parent's content box, re-run when it resizes", async () => {
	const c = withContainer(500);
	try {
		render({ type: "p", id: "t", text: "x", resprop: [{ container: { max: 599 }, fontSize: "14px" }, { container: { min: 600 }, fontSize: "20px" }] });
		await tick();
		assert.equal(byId("t").style.fontSize, "14px");
		c.set(800);
		assert.equal(byId("t").style.fontSize, "20px");
	} finally { c.restore(); }
});

test("a container entry wins over a viewport entry for the keys it names", async () => {
	const c = withContainer(300);
	try {
		render({ type: "p", id: "t", text: "x", resprop: [{ min: 900, color: "red", fontSize: "30px" }, { container: { max: 400 }, fontSize: "12px" }] });
		await tick();
		assert.equal(byId("t").style.color, "red");
		assert.equal(byId("t").style.fontSize, "12px");
	} finally { c.restore(); }
});

test("without ResizeObserver (jsdom, the prerender) container entries do not apply", async () => {
	render({ type: "p", id: "t", text: "x", resprop: [{ container: { min: 0 }, letterSpacing: "1px" }] });
	await tick();
	assert.equal(byId("t").style.letterSpacing, "");
});

test("respad / resmar take { min, max } and hand the sides back outside the range", async () => {
	render({ type: "wrap", id: "w", children: [], respad: [{ min: 900, values: [{ a: 40 }] }], resmar: [{ max: 599, values: [{ t: 8 }] }] });
	// A wrap's own box is margin: 0; padding: 0 (written by Wrapper.set).
	await tick();
	assert.equal(byId("w").style.paddingTop, "40px");
	assert.equal(byId("w").style.marginTop, "0px");
	resize(500);
	assert.equal(byId("w").style.paddingTop, "0px", "the 900+ padding does not stick");
	assert.equal(byId("w").style.marginTop, "8px");
	resize(1440);
	assert.equal(byId("w").style.paddingTop, "40px");
	assert.equal(byId("w").style.marginTop, "0px");
});

test("the validator checks where each resprop entry applies", () => {
	const E = (resprop) => [{ type: "p", id: "t", text: "x", resprop }];
	assert.deepEqual(validateNodes([], E([{ min: 900, position: "sticky" }, { container: { max: 600 }, gap: "4px" }, { breakpoint: "md", color: "red" }])).warnings, []);
	for (const bad of [[{ min: "900px", color: "red" }], [{ color: "red" }], [{ min: 900, max: 100 }], [{ container: 600 }]]) {
		const r = validateNodes([], E(bad));
		assert.equal(warnsOf(r, "BAD_PARAM_VALUE").length, 1, JSON.stringify(bad));
	}
});

// ═══ 4. onScroll and reduced motion ═══════════════════════════════════

test("onScroll writes its start state and listens normally…", () => {
	const added = [];
	const orig = dom.window.addEventListener;
	dom.window.addEventListener = function (type, ...rest) { added.push(type); return orig.call(this, type, ...rest); };
	try {
		render({ type: "p", id: "t", text: "x", onScroll: { value: "opacity", from: 0, to: 400, valMin: 0.2, valMax: 1 } });
	} finally { dom.window.addEventListener = orig; }
	assert.equal(byId("t").style.opacity, "0.2");
	assert.ok(added.includes("scroll"));
});

test("…and under prefers-reduced-motion writes nothing and attaches no scroll listener", () => {
	reduced = true;
	const added = [];
	const orig = dom.window.addEventListener;
	dom.window.addEventListener = function (type, ...rest) { added.push(type); return orig.call(this, type, ...rest); };
	try {
		render({ type: "p", id: "t", text: "x", onScroll: { value: "opacity", from: 0, to: 400, valMin: 0, valMax: 1 } });
	} finally { dom.window.addEventListener = orig; }
	assert.equal(byId("t").style.opacity, "", "content is never left at opacity 0");
	assert.ok(!added.includes("scroll"));
});

// ═══ 5. page defaults ═════════════════════════════════════════════════

test("defaults fill missing keys, recursively, and never override", () => {
	render([
		{ type: "h1", id: "h", text: "A" },
		{ type: "wrap", id: "w", children: [{ type: "p", id: "inner", text: "x" }] },
		{ type: "p", id: "own", text: "y", font: "Georgia" },
		{ type: "ulist", id: "u", items: [{ type: "p", id: "li", text: "z" }] },
	], [], { font: "Inter", color: "rgb(1, 2, 3)" });
	assert.equal(byId("h").style.fontFamily, "Inter");
	assert.equal(byId("inner").style.fontFamily, "Inter");
	assert.equal(byId("inner").style.color, "rgb(1, 2, 3)");
	assert.equal(byId("own").style.fontFamily, "Georgia");
	assert.equal(byId("li").style.fontFamily, "Inter", "spec-shaped items take them too");
});

test("defaults land only where the type reads the key, and leave data items alone", () => {
	const out = applyPageDefaults([
		{ type: "checkbox", id: "c", label: "ok" },
		{ type: "nav", id: "n", items: [{ title: "Home", link: "/" }] },
		{ type: "cards", id: "k", items: [[{ type: "p", text: "in a card" }]] },
	], { color: "red" });
	assert.equal(out[0].color, undefined, "checkbox ignores `color` (known inert), so it is not planted");
	assert.deepEqual(out[1].items, [{ title: "Home", link: "/" }]);
	assert.equal(out[2].items[0][0].color, "red");
});

test("no defaults: the same array back, and the same page", () => {
	const els = [{ type: "h1", id: "h", text: "A" }, { type: "wrap", id: "w", children: [{ type: "p", text: "x" }] }];
	assert.equal(applyPageDefaults(els, undefined), els);
	assert.equal(applyPageDefaults(els, {}), els);
	render(els);
	const plain = document.getElementById("mount").innerHTML;
	document.getElementById("mount").innerHTML = "";
	render(els, [], {});
	assert.equal(document.getElementById("mount").innerHTML, plain);
});

test("defaults after add() are refused, and set({ defaults }) says why it does nothing", () => {
	const d = new Des().nodes([]);
	d.add([{ type: "p", text: "x" }]);
	assert.throws(() => d.defaults({ font: "Inter" }), /before \.add\(\)/);
	const warned = [];
	const orig = console.warn;
	console.warn = (m) => warned.push(String(m));
	try { d.set({ mount: "#mount", code: false, elements: false, defaults: { font: "Inter" } }); }
	finally { console.warn = orig; }
	assert.ok(warned.some((m) => /set\(\{ defaults \}\) is ignored/.test(m)));
});

test("validateNodes takes the defaults: the page as it renders, and the defaults themselves checked", () => {
	const E = [{ type: "h1", id: "h", text: "A" }, { type: "checkbox", id: "c", label: "x" }];
	const r = validateNodes([], E, undefined, { defaults: { font: "Inter", color: "#111", fnt: "x" } });
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.warnings.map((w) => w.code), ["UNKNOWN_ELEMENT_PARAM"], "no PARAM_NOT_ON_TYPE/INERT from defaults");
	assert.equal(r.warnings[0].path, "defaults.fnt");
	assert.equal(r.warnings[0].suggestions[0], "font");
});

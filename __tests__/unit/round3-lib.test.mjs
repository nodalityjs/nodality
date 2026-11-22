// round3-lib.test.mjs — round 3 of the gap work, the lib/bin/scripts side.
// Each section pins one fix:
//
//   1. a CSS-string `border` is accepted on every type that renders it, and a
//      malformed one is BAD_PARAM_VALUE.
//   2. the schema credits what commonMethods applies (resprop, vars, keySet,
//      border) — `model` no longer "ignores" its resprop.
//   3. margin `offsets` work on every element (p, wrap, img…).
//   4. background / margin nodes reach a nav's bars.
//   5. table, code, circle, polygon, stack take the author's universal
//      options and resprop.
//   6. a transform node's top-level `duration` is used.
//   7. lowered background/margin styling is in the generated code.
//   8. `nodality compile` imports the five new classes (and ElementMapper).
//   9. circle/polygon get the shadow design node as `shadowOp`.
//  10. every new feature prerenders, and what it prerenders is sensible.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");

let Des, ElementMapper, NAV_BAR_UNIVERSAL, validateNodes, DESIGN_OP_PARAMS, ELEMENT_PARAMS_BY_TYPE, ELEMENT_PARAM_UNITS;
let loweredFor, Animator, dom, width;

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
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	({ Des } = await import("../../lib/designer.js"));
	({ Animator } = await import("../../layout/animator.js"));
	({ ElementMapper, NAV_BAR_UNIVERSAL } = await import("../../lib/element-mapper.js"));
	({ validateNodes } = await import("../../lib/validate-nodes.js"));
	({ DESIGN_OP_PARAMS } = await import("../../lib/design-ops.js"));
	({ ELEMENT_PARAMS_BY_TYPE, ELEMENT_PARAM_UNITS } = await import("../../lib/element-params.generated.js"));
	({ loweredFor } = await import("../../lib/lower-style-ops.js"));
});

const atWidth = (w) => {
	width = w;
	dom.window.matchMedia = (q) => {
		const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
		const matches = (!min || width >= +min[1]) && (!max || width <= +max[1]);
		return { matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
	};
	Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
};
const resize = (w) => { atWidth(w); dom.window.dispatchEvent(new dom.window.Event("resize")); };
const tick = () => new Promise((r) => setTimeout(r, 5));

beforeEach(() => { document.getElementById("mount").innerHTML = ""; atWidth(500); });

const build = (els, nodes = []) => {
	const d = new Des();
	d.nodes(nodes);
	d.add([].concat(els));
	return d;
};
const render = (els, nodes = []) => {
	const d = build(els, nodes);
	d.set({ mount: "#mount", code: false, elements: false });
	return d;
};
const byId = (id) => document.querySelector(`#mount [id="${id}"]`);
const codes = (r) => [...r.errors, ...r.warnings].map((e) => e.code);
const at = (r, code) => [...r.errors, ...r.warnings].filter((e) => e.code === code).map((e) => e.path);
const mapped = (el, nodes = []) => ElementMapper.mapType({ el, customOptions: nodes });
const codeOf = (inst) => [].concat(inst.toCode()).join("");

// ═══ 1. border ════════════════════════════════════════════════════════

test("border: a CSS string is in the schema, with its shape, wherever it renders", () => {
	for (const type of ["a", "p", "h1", "img", "wrap", "row", "button", "model", "disclosure", "tabs", "scroller", "marquee", "circle", "polygon", "table"]) {
		assert.ok(ELEMENT_PARAMS_BY_TYPE[type].includes("border"), type);
		assert.equal(ELEMENT_PARAM_UNITS[`${type}.border`], "css-border", type);
	}
});

test("border: well-formed strings (any order, keywords, functions, var()) validate clean", () => {
	const good = ["1px solid #0B0B0C", "solid 2px red", "none", "thin dashed rgb(1 2 3 / .5)", "0", "medium double currentColor",
		"2px solid var(--line)", "inherit", "calc(1px + 0.1em) solid oklch(70% 0.1 200)", "dotted"];
	for (const border of good) {
		const r = validateNodes([], [{ type: "a", id: "x", text: "t", url: "#", border }]);
		assert.deepEqual(at(r, "BAD_PARAM_VALUE"), [], border);
	}
	// The object/array forms some components read are theirs to judge.
	const r = validateNodes([], [{ type: "row", id: "r", border: ["top", "2px"], children: [] }, { type: "circle", id: "c", border: { width: 2, color: "red" } }]);
	assert.deepEqual(at(r, "BAD_PARAM_VALUE"), []);
});

test("border: a malformed value is BAD_PARAM_VALUE, with a fix", () => {
	const bad = ["2px solidd red", "2 solid red", "1px solid red blue", "solid dashed", "", "1px solid rgb(1,2", 2, true];
	for (const border of bad) {
		for (const type of ["a", "p", "wrap", "model", "circle", "table"]) {
			const el = { type, id: "x", border, ...(type === "a" ? { text: "t", url: "#" } : {}), ...(type === "p" ? { text: "t" } : {}),
				...(type === "model" ? { url: "/m.glb", alt: "m" } : {}) };
			const r = validateNodes([], [el]);
			const w = [...r.errors, ...r.warnings].find((e) => e.code === "BAD_PARAM_VALUE" && e.path.endsWith(".border"));
			assert.ok(w, `${type} ${JSON.stringify(border)}`);
		}
	}
	const r = validateNodes([], [{ type: "p", id: "x", text: "t", border: 2 }]);
	assert.ok(JSON.stringify(r.warnings).includes("2px solid currentColor"));
});

test("border: the string renders on the types whose mapper used to drop it (circle, polygon, table)", async () => {
	render([{ type: "circle", id: "c", border: "3px dashed rgb(1, 2, 3)" }, { type: "polygon", id: "g", border: "4px solid rgb(4, 5, 6)" },
		{ type: "table", id: "t", border: "5px dotted rgb(7, 8, 9)", items: [{ a: 1 }] }]);
	await tick();
	assert.equal(byId("c").style.border, "3px dashed rgb(1, 2, 3)");
	assert.equal(byId("g").style.border, "4px solid rgb(4, 5, 6)");
	assert.equal(byId("t").style.border, "5px dotted rgb(7, 8, 9)");
});

test("border: a table without one keeps its default", async () => {
	render({ type: "table", id: "t", items: [{ a: 1 }] });
	await tick();
	assert.equal(byId("t").style.border, "2px solid black");
});

// ═══ 2. what commonMethods applies is credited ═══════════════════════

test("model (and the other round-1 types) list resprop, vars, keySet and the CSS-named options", () => {
	for (const type of ["model", "disclosure", "tabs", "scroller", "marquee"]) {
		for (const p of ["resprop", "vars", "keySet", "respad", "resmar", "gap", "boxShadow", "opacity", "border"]) {
			assert.ok(ELEMENT_PARAMS_BY_TYPE[type].includes(p), `${type}.${p}`);
		}
	}
	const r = validateNodes([], [{ type: "model", id: "m", url: "/m.glb", alt: "m", resprop: [{ max: 600, height: "240px" }] }]);
	assert.deepEqual(at(r, "PARAM_NOT_ON_TYPE"), []);
});

test("model's resprop really applies (so the schema is right to list it)", async () => {
	render({ type: "model", id: "m", url: "/m.glb", alt: "m", resprop: [{ max: 600, height: "240px" }] });
	await tick();
	assert.equal(byId("m").style.height, "240px");
});

// ═══ 3. margin offsets on every element ══════════════════════════════

test("margin offsets: p (index 0 too), wrap and img all take offsets[index]", async () => {
	render([
		{ type: "p", id: "p0", text: "A", index: 0 },
		{ type: "p", id: "p1", text: "B", index: 1 },
		{ type: "wrap", id: "w", index: 2, children: [{ type: "p", text: "x" }] },
		{ type: "img", id: "i", url: "a.png", alt: "", index: 1 },
	], [{ op: { name: "margin", offsets: [3, 17, 25] }, target: ["p0", "p1", "w", "i"] }]);
	await tick();
	assert.equal(byId("p0").style.margin, "3px");
	assert.equal(byId("p1").style.margin, "17px");
	assert.equal(byId("w").style.margin, "25px");
	assert.equal(byId("i").style.margin, "17px");
});

test("margin offsets: gated by range; an element without index, or past the end, is untouched", async () => {
	render([{ type: "p", id: "a", text: "A", index: 1 }, { type: "p", id: "n", text: "N" }, { type: "p", id: "far", text: "F", index: 9 }],
		[{ op: { name: "margin", offsets: [3, 17] }, target: ["a", "n", "far"], range: [0, 600] }]);
	await tick();
	assert.equal(byId("a").style.margin, "17px");
	assert.equal(byId("n").style.margin, "0px", "Text's own margin, as without the node");
	assert.equal(byId("far").style.margin, "0px");
	resize(900); await tick();
	assert.equal(byId("a").style.margin, "0px", "back to the element's own value outside the range");
});

test("margin offsets: an untargeted node reaches elements without an id, as chainReact did", async () => {
	render({ type: "wrap", id: "w", children: [{ type: "p", text: "kid", index: 0 }] }, [{ op: { name: "margin", offsets: [9] } }]);
	await tick();
	assert.equal(byId("w").querySelector("p").style.margin, "9px");
});

test("margin offsets: loweredFor reads the element's index; the node alone is withheld from the component", () => {
	const N = [{ op: { name: "margin", offsets: [1, 2] }, target: ["a"] }];
	assert.deepEqual(loweredFor(N, "a", { index: 1 })[0].css, { margin: "2px" });
	assert.deepEqual(loweredFor(N, "a", {}), []);
	assert.equal(ElementMapper.filtero("margin", "a", N), undefined);
	const r = validateNodes(N, [{ type: "p", id: "a", text: "A", index: 1 }]);
	assert.deepEqual(codes(r), []);
});

// ═══ 4. nav ═══════════════════════════════════════════════════════════

const NAV = { type: "nav", id: "nav", items: [{ title: "A", link: "#a" }] };

test("nav: background and margin nodes style both bars, inside their range", () => {
	const nav = mapped(NAV, [
		{ op: { name: "background", color: "rgb(1, 2, 3)" }, target: ["nav"], range: [0, 600] },
		{ op: { name: "margin", margin: "7px" }, target: ["#nav"] },
	]);
	const bars = ElementMapper.navBars(nav);
	assert.equal(bars.length, 2);
	for (const b of bars) {
		assert.equal(b.res.style.backgroundColor, "rgb(1, 2, 3)");
		assert.equal(b.res.style.margin, "7px");
	}
	resize(900);
	for (const b of bars) assert.equal(b.res.style.backgroundColor, "rgb(236, 240, 241)", "the bar's own colour outside the range");
});

test("nav: a background node with no value paints the bars green (chainReact's default), and the demo nav too", () => {
	for (const el of [NAV, { type: "nav", id: "nav" }]) {
		const nav = mapped(el, [{ op: { name: "background" }, target: ["nav"] }]);
		for (const b of ElementMapper.navBars(nav)) assert.equal(b.res.style.backgroundColor, "green");
	}
});

test("nav: without nodes the bars and their code are as before", () => {
	const nav = mapped(NAV);
	for (const b of ElementMapper.navBars(nav)) assert.equal(b.res.style.backgroundColor, "rgb(236, 240, 241)");
	assert.ok(!codeOf(nav).includes("ElementMapper"));
});

test("nav: the bar styling is in the nav's generated code", () => {
	const src = codeOf(mapped(NAV, [{ op: { name: "background", color: "#fde68a" }, target: ["nav"] }]));
	assert.equal(src.match(/ElementMapper\.lowered\(new (Mobile|Desktop)Bar\(\)/g).length, 2);
	assert.ok(src.includes('backgroundColor:"#fde68a"'));
});

// ═══ 5. universal options on table, code, circle, polygon, stack ═════

test("universalOf reads the behaviour options, hover and the responsive trio — by name", () => {
	const all = Object.fromEntries([...NAV_BAR_UNIVERSAL, "hover", "resprop", "respad", "resmar"].map((k) => [k, k]));
	assert.deepEqual(Object.keys(ElementMapper.universalOf(all)).sort(), Object.keys(all).sort());
	assert.deepEqual(ElementMapper.universalOf({ type: "table", id: "x" }), {});
});

test("resprop reaches table, code, circle, polygon and stack", async () => {
	const rp = () => [{ max: 600, opacity: "0.5" }];
	render([
		{ type: "table", id: "t", items: [{ a: 1 }], resprop: rp() },
		{ type: "code", id: "c", resprop: rp() },
		{ type: "circle", id: "o", resprop: rp() },
		{ type: "polygon", id: "g", resprop: rp() },
		{ type: "stack", id: "s", resprop: rp(), children: [{ type: "p", text: "x" }] },
	]);
	await tick();
	for (const id of ["t", "c", "o", "g", "s"]) assert.equal(byId(id).style.opacity, "0.5", id);
	resize(900); await tick();
	for (const id of ["t", "c", "o", "g", "s"]) assert.notEqual(byId(id).style.opacity, "0.5", id);
});

test("the universal options reach table, code, circle and polygon (aria, title, hover)", async () => {
	const u = { aria: { label: "L" }, title: "Zq tooltip", hover: { color: "red" } };
	render([{ type: "table", id: "t", items: [{ a: 1 }], ...u }, { type: "code", id: "c", ...u }, { type: "circle", id: "o", ...u }, { type: "polygon", id: "g", ...u }]);
	await tick();
	for (const id of ["t", "c", "o", "g"]) {
		assert.equal(byId(id).getAttribute("aria-label"), "L", id);
		assert.equal(byId(id).getAttribute("title"), "Zq tooltip", id);
	}
});

test("resprop on those types is in their generated code, as the author wrote it", () => {
	for (const type of ["table", "circle", "polygon", "stack"]) {
		const src = codeOf(mapped({ type, id: "x", resprop: [{ max: 600, opacity: "0.5" }], ...(type === "stack" ? { children: [] } : {}) }));
		assert.match(src, /^ElementMapper\.responsive\(/, type);
		assert.ok(src.endsWith('{resprop:[{max:600,opacity:"0.5"}]})'), type);
	}
	assert.ok(!codeOf(mapped({ type: "circle", id: "x" })).includes("ElementMapper"), "nothing added without it");
});

test("the schema lists the universal options on table, code, circle and polygon", () => {
	for (const type of ["table", "code", "circle", "polygon"]) {
		for (const p of ["resprop", "respad", "resmar", "hover", "reveal", "aria", "loop", "spy"]) {
			assert.ok(ELEMENT_PARAMS_BY_TYPE[type].includes(p), `${type}.${p}`);
		}
	}
	assert.ok(ELEMENT_PARAMS_BY_TYPE.stack.includes("resprop"));
});

// ═══ 6. transform duration ════════════════════════════════════════════

function transformOp(node) {
	const seen = [];
	const orig = Animator.prototype.chainReact;
	Animator.prototype.chainReact = function (q, ...rest) { seen.push(...q); return orig.call(this, q, ...rest); };
	try { render({ type: "p", id: "t", text: "x" }, [node]); } finally { Animator.prototype.chainReact = orig; }
	return seen.find((q) => q.op && q.op.name === "transform").op;
}

test("transform: a top-level duration sets the op's duration (words expanded)", () => {
	assert.equal(transformOp({ op: { name: "transform" }, target: ["t"], style: "WAVE", duration: "fast" }).duration, "3s-ease-in-out");
	assert.equal(transformOp({ op: { name: "transform" }, target: ["t"], duration: "4s-linear" }).duration, "4s-linear");
});

test("transform: op.duration wins over the top-level one; neither gives the op as before", () => {
	assert.equal(transformOp({ op: { name: "transform", duration: "slow" }, target: ["t"], duration: "fast" }).duration, "9s-ease-in-out");
	const plain = transformOp({ op: { name: "transform" }, target: ["t"], style: "SOLARIUM" });
	assert.deepEqual(plain, { name: "transform", values: ["scale(3)"] });
	assert.equal(transformOp({ op: { name: "transform" }, target: ["t"], duration: "default" }).duration, undefined);
});

test("transform: the registry documents it, and the validator checks both durations", () => {
	assert.match(DESIGN_OP_PARAMS.transform.params.duration.summary, /top-level/);
	const E = [{ type: "p", id: "t", text: "x" }];
	assert.deepEqual(codes(validateNodes([{ op: { name: "transform" }, target: ["t"], duration: "fast" }], E)), []);
	assert.deepEqual(codes(validateNodes([{ op: { name: "transform", duration: "4s-ease-in-out" }, target: ["t"] }], E)), []);
	assert.deepEqual(at(validateNodes([{ op: { name: "transform" }, target: ["t"], duration: 3000 }], E), "BAD_PARAM_VALUE"), ["nodes[0].duration"]);
	assert.deepEqual(at(validateNodes([{ op: { name: "transform", duration: "1.5s-ease" }, target: ["t"] }], E), "BAD_PARAM_VALUE"), ["nodes[0].op.duration"]);
	// still inert on any other op
	assert.deepEqual(at(validateNodes([{ op: { name: "shadow" }, target: ["t"], duration: "fast" }], E), "PARAM_INERT"), ["nodes[0].duration"]);
});

// ═══ 7. lowered styling in the generated code ═════════════════════════

test("code: a lowered margin/background is in toCode(), and running that code reproduces it", async () => {
	const d = build([{ type: "p", id: "a", text: "A" }, { type: "wrap", id: "w", children: [{ type: "p", id: "k", text: "kid" }] }],
		[{ op: { name: "margin", margin: 12 }, target: ["a"], range: [0, 600] }, { op: { name: "background", color: "rgb(1, 2, 3)" }, target: ["k"] }]);
	const src = d.code.join(";\n");
	assert.match(src, /ElementMapper\.lowered\(new Text\("A"\)/);
	assert.ok(src.includes('[{css:{margin:"12px"},range:[0,600]}]'));
	assert.ok(src.includes('ElementMapper.lowered(new Text("kid")'), "a child's styling is in its parent's code");

	// The code panel / compile output runs on its own.
	const layout = await import("../../layout/index.js");
	const names = [...new Set([...src.matchAll(/\b([A-Z]\w*)\b/g)].map((m) => m[1]))].filter((n) => typeof layout[n] === "function");
	const host = document.getElementById("mount");
	host.innerHTML = "";
	new Function(...names, src.split(";\n").map((c) => `${c}.render("#mount")`).join(";\n"))(...names.map((n) => layout[n]));
	await tick();
	assert.equal(host.querySelector('[id="a"]').style.margin, "12px");
	assert.equal(host.querySelector('[id="k"]').style.backgroundColor, "rgb(1, 2, 3)");
});

test("code: a page without background/margin values emits no wrapper", () => {
	const d = build([{ type: "p", id: "a", text: "A" }], [{ op: "blast", target: ["a"] }]);
	assert.ok(!d.code.join("").includes("ElementMapper"));
});

// ═══ 8. nodality compile ══════════════════════════════════════════════

test("compile: the five new classes and ElementMapper are imported, and each is a real export", async () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "nod-r3-compile-"));
	try {
		const designer = pathToFileURL(path.join(ROOT, "lib", "designer.js")).href;
		writeFileSync(path.join(dir, "app.js"), `import { Des } from ${JSON.stringify(designer)};
new Des().nodes([{ op: { name: "margin", margin: 12 }, target: ["p1"] }]).add([
  { type: "p", id: "p1", text: "Hello" },
  { type: "model", id: "m", url: "/bike.glb", alt: "A bike", loader: "/mv.js" },
  { type: "disclosure", id: "d", summary: "More", children: ["Inside"] },
  { type: "tabs", id: "t", items: [{ label: "A", children: ["a"] }] },
  { type: "scroller", id: "s", children: ["1", "2"] },
  { type: "marquee", id: "q", children: ["news"] },
]).set({ mount: "#mount" });
`);
		const r = spawnSync(process.execPath, [path.join(ROOT, "bin", "nodality.mjs"), "compile", "app.js", "--stdout"], { cwd: dir, encoding: "utf8" });
		assert.equal(r.status, 0, r.stderr);
		const imp = r.stdout.match(/import \{ ([^}]+) \} from "nodality";/);
		assert.ok(imp, r.stdout.slice(0, 400));
		const names = imp[1].split(",").map((s) => s.trim());
		for (const n of ["Model", "Disclosure", "Tabs", "Scroller", "Marquee", "ElementMapper", "Text"]) assert.ok(names.includes(n), n);
		const layout = await import("../../layout/index.js");
		for (const n of names) assert.equal(typeof layout[n], "function", `${n} is not exported by the package entry`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("compile: every name it may import is exported by the package entry", async () => {
	const src = readFileSync(path.join(ROOT, "bin", "nodality.mjs"), "utf8");
	const block = src.match(/const NODALITY_EXPORTS = new Set\(\[([\s\S]*?)\]\);/)[1];
	const names = [...block.matchAll(/"([A-Za-z]\w*)"/g)].map((m) => m[1]);
	const layout = await import("../../layout/index.js");
	assert.deepEqual(names.filter((n) => typeof layout[n] === "undefined"), []);
});

// ═══ 9. circle / polygon shadow ═══════════════════════════════════════

test("circle/polygon: the shadow node is passed as shadowOp; circle keeps a plain shadow string", async () => {
	const node = { op: { name: "shadow", colors: ["rgb(1, 2, 3)"] }, target: ["x"] };
	for (const type of ["circle", "polygon"]) {
		const inst = mapped({ type, id: "x" }, [node]);
		assert.equal(inst.options.shadowOp, node, type);
		assert.equal(inst.options.shadow, undefined, type);
	}
	render([{ type: "circle", id: "c", shadow: "0 4px 12px rgb(0, 0, 0)" }, { type: "circle", id: "d" }],
		[{ op: { name: "shadow", colors: ["rgb(1, 2, 3)"] }, target: ["d"] }]);
	await tick();
	assert.equal(byId("c").style.boxShadow, "0 4px 12px rgb(0, 0, 0)");
	assert.match(byId("d").style.boxShadow, /rgb\(1, 2, 3\)/);
});

// ═══ 10. prerender ════════════════════════════════════════════════════

const PAGE = [
	{ type: "nav", id: "nav", items: [{ title: "One", link: "#one" }, { title: "Two", link: "#two" }], spy: true, hideOnScroll: true,
		aria: { label: "Main" }, actions: [{ type: "a", id: "cta", text: "Book", url: "#two" }] },
	{ type: "wrap", id: "one", children: [
		{ type: "h1", id: "hero", text: "Big title", reveal: true, fit: true, width: "100%" },
		{ type: "p", id: "stat", text: "1200 riders", count: { duration: 1500 } },
		{ type: "p", id: "words", text: "Reveal by word", reveal: { by: "word" } },
		{ type: "wrap", id: "stag", reveal: { stagger: 80 }, children: [{ type: "p", id: "s1", text: "a" }, { type: "p", text: "b" }] },
	] },
	{ type: "model", id: "bike", url: "/bike.glb", alt: "A bike", poster: "/bike.png", loader: "/vendor/model-viewer.min.js", cameraScrub: { from: "enter", to: "exit" } },
	{ type: "tabs", id: "tabs", label: "Results", items: [{ label: "2025", children: [{ type: "p", id: "t25", text: "Year 2025" }] }, { label: "2024", children: [{ type: "p", id: "t24", text: "Year 2024" }] }] },
	{ type: "disclosure", id: "disc", summary: "Shipping", children: [{ type: "p", id: "ship", text: "Ships in 2 days" }] },
	{ type: "scroller", id: "sc", controls: true, progress: true, children: [{ type: "p", text: "Slide 1" }, { type: "p", text: "Slide 2" }] },
	{ type: "scroller", id: "flow", flow: true, children: [{ type: "p", text: "Col A" }, { type: "p", text: "Col B", breakBefore: true }] },
	{ type: "marquee", id: "mq", children: [{ type: "p", id: "logo1", text: "Logo one" }, { type: "p", text: "Logo two" }] },
	{ type: "wrap", id: "two", spy: { offset: 60 }, children: [
		{ type: "a", id: "toc1", text: "One", url: "#one" },
		{ type: "p", id: "cp", text: "npm i nodality", copy: true, copied: "Copied" },
		{ type: "p", id: "hv", text: "Hover me", hover: { color: "red" } },
		{ type: "wrap", id: "pinned", pin: "100vh", children: [{ type: "p", id: "scrubbed", text: "Scrub", scrub: { keyframes: [{ opacity: 1 }, { opacity: 0 }] } }] },
		{ type: "wrap", id: "rp", resprop: [{ min: 0, max: 600, background: "rgb(1, 2, 3)" }, { min: 601, background: "rgb(4, 5, 6)" },
			{ container: { min: 0, max: 400 }, color: "rgb(7, 8, 9)" }], children: [{ type: "p", text: "resprop" }] },
	] },
];
const PAGE_NODES = [{ op: { name: "background", color: "rgb(10, 20, 30)" }, target: ["hv"] }];

let prerendered = null;
async function prerenderPage(viewport) {
	const { prerender } = await import("../../layout/prerender.js");
	const { JSDOM } = await import("jsdom");
	const dir = mkdtempSync(path.join(os.tmpdir(), "nod-r3-ssg-"));
	try {
		writeFileSync(path.join(dir, "shell.html"),
			'<!doctype html><html><head><title>t</title></head><body><div id="mount"></div><script type="module" src="./app.js"></script></body></html>');
		const warnings = [];
		const warn = console.warn;
		console.warn = (...a) => warnings.push(a.join(" "));
		try {
			await prerender({ template: path.join(dir, "shell.html"), output: path.join(dir, "out.html"), viewport,
				build: () => { new Des().defaults({ font: "Inter" }).nodes(PAGE_NODES).add(PAGE).set({ mount: "#mount" }); } });
		} finally { console.warn = warn; }
		const html = readFileSync(path.join(dir, "out.html"), "utf8");
		return { html, doc: new JSDOM(html).window.document, warnings };
	} finally {
		rmSync(dir, { recursive: true, force: true });
		// prerender restores the globals it replaced: give this file's DOM back.
		globalThis.window = dom.window; globalThis.document = dom.window.document;
	}
}

test("prerender: a page using every new feature renders without throwing, at phone and desktop width", async () => {
	for (const width of [390, 1280]) {
		const r = await prerenderPage({ width, height: 800 });
		if (width === 390) prerendered = r;
		const m = r.doc.querySelector("#mount");
		for (const id of ["nav", "cta", "hero", "stat", "words", "stag", "bike", "tabs", "t25", "t24", "disc", "ship", "sc", "flow", "mq", "logo1", "cp", "hv", "pinned", "scrubbed", "rp"]) {
			assert.equal(m.querySelectorAll(`[id="${id}"]`).length, 1, `${id} @${width}`);
		}
		// The hydration hand-off: a Des mount is marked, not cleared at parse
		// time (that blanked the page until the bundle arrived).
		assert.ok(m.hasAttribute("data-nod-ssr"), `mount marked @${width}`);
		assert.doesNotMatch(r.html, /m\.innerHTML='';/, `no parse-time clear @${width}`);
	}
});

test("prerender: Des swaps the static copy for the live one in a single step (no blank, no duplicate)", async () => {
	const { html, doc } = await prerenderPage({ width: 390, height: 800 });
	// Load the prerendered body into this file's DOM (its globals —
	// HTMLElement and friends — are the ones the components check against).
	const d = dom.window.document;
	const before = d.body.innerHTML;
	d.body.innerHTML = doc.body.innerHTML;
	try {
		const m = d.querySelector("#mount");
		assert.ok(m.hasAttribute("data-nod-ssr"), "marked by the prerenderer");
		assert.ok(m.textContent.includes("Ships in 2 days"), "static copy visible before the script runs");
		new Des().defaults({ font: "Inter" }).nodes(PAGE_NODES).add(PAGE).set({ mount: "#mount", code: false, elements: false });
		assert.ok(!m.hasAttribute("data-nod-ssr"), "marker removed");
		for (const id of ["hero", "stat", "tabs", "t25", "disc", "ship", "sc", "mq", "hv", "rp"]) {
			assert.equal(m.querySelectorAll(`[id="${id}"]`).length, 1, `${id} once after hydration`);
		}
		assert.ok(html.length > 0);
	} finally {
		d.body.innerHTML = before;
	}
});

test("prerender: a page that renders without Des keeps the parse-time clear", async () => {
	const { prerender } = await import("../../layout/prerender.js");
	const dir = mkdtempSync(path.join(os.tmpdir(), "nod-r3-imp-"));
	try {
		writeFileSync(path.join(dir, "shell.html"),
			'<!doctype html><html><head><title>t</title></head><body><div id="mount"></div><script type="module" src="./app.js"></script></body></html>');
		await prerender({ template: path.join(dir, "shell.html"), output: path.join(dir, "out.html"), viewport: { width: 390, height: 800 },
			build: () => { const p = document.createElement("p"); p.textContent = "imperative"; document.querySelector("#mount").appendChild(p); } });
		const html = readFileSync(path.join(dir, "out.html"), "utf8");
		assert.match(html, /m\.innerHTML='';/);
		assert.doesNotMatch(html, /data-nod-ssr/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
		globalThis.window = dom.window; globalThis.document = dom.window.document;
	}
});

test("prerender: nothing is left hidden for a visitor without JavaScript", () => {
	const d = prerendered.doc;
	for (const id of ["hero", "words", "stag", "s1", "scrubbed", "t25", "logo1"]) {
		const s = d.querySelector(`[id="${id}"]`).getAttribute("style") || "";
		assert.doesNotMatch(s, /opacity:\s*0[;\s]|opacity:\s*0$|visibility:\s*hidden|display:\s*none/, id);
	}
	assert.equal(d.querySelector('[id="words"]').textContent, "Reveal by word");
	assert.ok(!d.querySelector("#tabs-panel-0").hasAttribute("hidden"), "the selected tab's panel shows");
	assert.equal(d.querySelector("#tabs-panel-1").getAttribute("hidden"), "until-found", "the others are findable");
	assert.equal(d.querySelector('[id="disc"]').tagName, "DETAILS");
	assert.equal(d.querySelector('[id="hv"]').style.backgroundColor, "rgb(10, 20, 30)", "a lowered background is in the HTML");
	assert.equal(d.querySelectorAll('[data-nod-pin-spacer]').length, 1);
	assert.equal(d.querySelector("nav").getAttribute("aria-label"), "Main");
});

test("prerender: model ships its alt, poster and loader once", () => {
	const d = prerendered.doc;
	const mv = d.querySelector('[id="bike"]');
	assert.equal(mv.tagName, "MODEL-VIEWER");
	assert.equal(mv.getAttribute("alt"), "A bike");
	assert.equal(mv.getAttribute("poster"), "/bike.png");
	assert.equal(d.querySelectorAll('script[src="/vendor/model-viewer.min.js"]').length, 1);
});

// Formerly `todo`: the layout/ fixes (prerender flag, model poster slot,
// prerender waiting for resprop's timer) have landed.
test("prerender: count shows the FINAL number in the HTML", () => {
	// What a sighted visitor sees: the text minus the visually hidden copy.
	const stat = prerendered.doc.querySelector('[id="stat"]').cloneNode(true);
	for (const n of stat.querySelectorAll("span")) if (/clip-path:\s*inset\(50%\)/.test(n.getAttribute("style") || "")) n.remove();
	assert.equal(stat.textContent, "1200 riders");
});

test("prerender: model shows its poster before model-viewer is defined", () => {
	const mv = prerendered.doc.querySelector('[id="bike"]');
	assert.ok(mv.querySelector('img[src="/bike.png"]'), "a slotted <img slot=\"poster\"> fallback");
});

test("prerender: resprop min/max is in the HTML", () => {
	assert.equal(prerendered.doc.querySelector('[id="rp"]').style.backgroundColor, "rgb(1, 2, 3)");
});

test("prerender: a loader's curtain is kept in the saved HTML, with its failsafe", async () => {
	const { prerender } = await import("../../layout/prerender.js");
	const dir = mkdtempSync(path.join(os.tmpdir(), "nod-r3-loader-"));
	try {
		writeFileSync(path.join(dir, "shell.html"),
			'<!doctype html><html><head><title>t</title></head><body><div id="mount"></div><script type="module" src="./app.js"></script></body></html>');
		await prerender({ template: path.join(dir, "shell.html"), output: path.join(dir, "out.html"), viewport: { width: 390, height: 800 },
			build: () => { new Des().nodes([]).add([{ type: "p", id: "x", text: "Hello" }]).set({ mount: "#mount", loader: { text: "Brand" } }); } });
		const html = readFileSync(path.join(dir, "out.html"), "utf8");
		assert.match(html, /<div data-nod-loader="" aria-hidden="true"/, "the curtain survives the body cleanup");
		assert.match(html, /nod-loader-failsafe/, "and the CSS that lifts it without a script");
		assert.match(html, /data-nod-ssr/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
		globalThis.window = dom.window; globalThis.document = dom.window.document;
	}
});

test("prerender: fluid values jsdom rejects (clamp, min, calc) reach the saved HTML, in order", async () => {
	const { prerender } = await import("../../layout/prerender.js");
	const dir = mkdtempSync(path.join(os.tmpdir(), "nod-r3-fluid-"));
	try {
		writeFileSync(path.join(dir, "shell.html"),
			'<!doctype html><html><head><title>t</title></head><body><div id="mount"></div><script type="module" src="./app.js"></script></body></html>');
		await prerender({ template: path.join(dir, "shell.html"), output: path.join(dir, "out.html"), viewport: { width: 390, height: 800 },
			build: () => { new Des().nodes([]).add([
				{ type: "h1", id: "t", text: "Title", exact: "clamp(40px, 6.2vw, 96px)" },
				{ type: "wrap", id: "w", pad: [{ t: "calc(64px + clamp(40px, 6vw, 96px))", lr: "min(5vw, 48px)" }], children: [] },
			]).set({ mount: "#mount" }); } });
		const doc = new (await import("jsdom")).JSDOM(readFileSync(path.join(dir, "out.html"), "utf8")).window.document;
		const t = doc.querySelector("#t").getAttribute("style");
		assert.match(t, /font-size: clamp\(40px, 6\.2vw, 96px\)/, "the title's real size, not an older one");
		const lastFs = [...t.matchAll(/font-size:\s*([^;]+)/g)].pop()[1].trim();
		assert.equal(lastFs, "clamp(40px, 6.2vw, 96px)", "and it is the last font-size, so it wins");
		const w = doc.querySelector("#w").getAttribute("style");
		assert.match(w, /calc\(64px \+ clamp\(40px, 6vw, 96px\)\)/);
		assert.match(w, /min\(5vw, 48px\)/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
		globalThis.window = dom.window; globalThis.document = dom.window.document;
	}
});

// The saved page opened at a given width, its inline scripts run as a browser would.
const openAtWidth = async (html, width) => new (await import("jsdom")).JSDOM(html, { runScripts: "dangerously",
	beforeParse(win) { Object.defineProperty(win, "innerWidth", { value: width, configurable: true }); } }).window.document;

test("prerender: resprop values for the widths not rendered are set inline by a script, with no stylesheet", async () => {
	const { prerender } = await import("../../layout/prerender.js");
	const dir = mkdtempSync(path.join(os.tmpdir(), "nod-r3-rpmedia-"));
	try {
		writeFileSync(path.join(dir, "shell.html"),
			'<!doctype html><html><head><title>t</title></head><body><div id="mount"></div><script type="module" src="./app.js"></script></body></html>');
		await prerender({ template: path.join(dir, "shell.html"), output: path.join(dir, "out.html"), viewport: { width: 390, height: 800 },
			build: () => { new Des().nodes([]).add([
				{ type: "wrap", id: "w", aspectRatio: "4 / 5", resprop: [{ min: 900, aspectRatio: "auto", top: "4px" }], children: [] },
			]).set({ mount: "#mount" }); } });
		const html = readFileSync(path.join(dir, "out.html"), "utf8");
		const doc = new (await import("jsdom")).JSDOM(html).window.document;
		const id = doc.querySelector("#w").getAttribute("data-nod-rp");
		assert.ok(id, "marked");
		assert.equal(doc.querySelector("style[data-nod-prerender-media]"), null, "no stylesheet");
		assert.ok(doc.querySelector("head script[data-nod-prerender-widths]"), "the width script");
		const wide = (await openAtWidth(html, 1200)).querySelector("#w").style;
		assert.equal(wide.aspectRatio || wide.getPropertyValue("aspect-ratio"), "auto");
		assert.equal(wide.top, "4px");
		const narrow = (await openAtWidth(html, 390)).querySelector("#w").style;
		assert.equal(narrow.top, "", "below 900 px: nothing for a key the element does not have");
	} finally {
		rmSync(dir, { recursive: true, force: true });
		globalThis.window = dom.window; globalThis.document = dom.window.document;
	}
});

test("prerender: an element's own side value comes out of its fluid shorthand", async () => {
	const { prerender } = await import("../../layout/prerender.js");
	const dir = mkdtempSync(path.join(os.tmpdir(), "nod-r3-side-"));
	try {
		writeFileSync(path.join(dir, "shell.html"),
			'<!doctype html><html><head><title>t</title></head><body><div id="mount"></div><script type="module" src="./app.js"></script></body></html>');
		await prerender({ template: path.join(dir, "shell.html"), output: path.join(dir, "out.html"), viewport: { width: 390, height: 800 },
			build: () => { new Des().nodes([]).add([
				{ type: "wrap", id: "w", pad: [{ b: "clamp(56px, 8vw, 110px)" }], resprop: [{ max: 899, paddingBottom: "0" }], children: [] },
			]).set({ mount: "#mount" }); } });
		const html = readFileSync(path.join(dir, "out.html"), "utf8");
		assert.match(html, /"padding-bottom":"clamp\(56px, 8vw, 110px\)"/, "the wide value, read out of the shorthand");
		assert.equal((await openAtWidth(html, 390)).querySelector("#w").style.paddingBottom, "0px");
	} finally {
		rmSync(dir, { recursive: true, force: true });
		globalThis.window = dom.window; globalThis.document = dom.window.document;
	}
});

test("prerender: a nav keeps both bars in the saved HTML, each hidden outside its width, with no duplicate ids", async () => {
	const { prerender } = await import("../../layout/prerender.js");
	const dir = mkdtempSync(path.join(os.tmpdir(), "nod-r3-nav-"));
	try {
		writeFileSync(path.join(dir, "shell.html"),
			'<!doctype html><html><head><title>t</title></head><body><div id="mount"></div><script type="module" src="./app.js"></script></body></html>');
		await prerender({ template: path.join(dir, "shell.html"), output: path.join(dir, "out.html"), viewport: { width: 390, height: 800 },
			build: () => { new Des().nodes([]).add([{ type: "nav", id: "nav", breakpoint: "900px",
				brand: { type: "p", id: "brand", text: "Brand" }, items: [{ title: "A", link: "#a" }] }]).set({ mount: "#mount" }); } });
		const html = readFileSync(path.join(dir, "out.html"), "utf8");
		const doc = new (await import("jsdom")).JSDOM(html).window.document;
		const views = [...doc.querySelectorAll("#nav > [data-nod-sw]")];
		assert.equal(views.length, 2, "the phone bar and the desktop bar");
		assert.equal(doc.querySelector("style[data-nod-prerender-media]"), null, "no stylesheet");
		assert.equal(views[1].style.display, "none", "without JavaScript only the bar this render matched shows");
		const shown = async (w) => [...(await openAtWidth(html, w)).querySelectorAll("#nav > [data-nod-sw]")].map((v) => v.style.display !== "none");
		assert.deepEqual(await shown(1200), [false, true], "the desktop bar from 900 px");
		assert.deepEqual(await shown(390), [true, false], "the phone bar below 900 px");
		assert.equal(doc.querySelectorAll('[id="brand"]').length, 1, "no duplicate id");
		assert.ok(views[0].querySelector('[id="brand"]'), "kept on the bar this 390 px render matched");
	} finally {
		rmSync(dir, { recursive: true, force: true });
		globalThis.window = dom.window; globalThis.document = dom.window.document;
	}
});

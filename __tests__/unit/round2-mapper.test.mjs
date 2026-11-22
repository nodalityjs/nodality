// round2-mapper.test.mjs — round 2 of the gap work on the mapper, Des and
// the validator. Each section pins one fix:
//
//   1. transform: a Des node's own options are laid over the preset.
//   2. card-style: inert, and reported so.
//   3. background: reads `color` / `gradient` (no options: green, as before).
//   4. margin: `margin` is applied (offsets unchanged).
//   5. the validator's id walk reaches every spec-shaped slot.
//   6. string children render as a paragraph where the slot maps entries.
//   7. raster `pointer` gate values are checked.
//   8. nav hands every universal option to its bars, demo nav included.
//   9. the round-1 element classes are in Des's components map.
//  10. op-semantics agrees with the registry.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");

let Des, Animator, validateNodes, STRING_CHILD_TYPES, DESIGN_OP_PARAMS, OP_SEMANTICS, shadowedNodes;
let ELEMENT_TYPES, NAV_BAR_UNIVERSAL, nestedSpecs, loweredFor, dom, width;

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
	({ validateNodes, STRING_CHILD_TYPES } = await import("../../lib/validate-nodes.js"));
	({ DESIGN_OP_PARAMS } = await import("../../lib/design-ops.js"));
	({ OP_SEMANTICS, shadowedNodes } = await import("../../lib/op-semantics.js"));
	({ ELEMENT_TYPES, NAV_BAR_UNIVERSAL } = await import("../../lib/element-mapper.js"));
	({ nestedSpecs } = await import("../../lib/spec-walk.js"));
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

const render = (els, nodes = []) => new Des().nodes(nodes).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
const byId = (id) => document.querySelector(`#mount [id="${id}"]`);
const mount = () => document.getElementById("mount");
const codes = (r) => [...r.errors, ...r.warnings].map((e) => e.code);

/** Every query chainReact is handed while `fn` runs. */
function chainQueries(fn) {
	const seen = [];
	const orig = Animator.prototype.chainReact;
	Animator.prototype.chainReact = function (q, ...rest) { seen.push(...q); return orig.call(this, q, ...rest); };
	try { fn(); } finally { Animator.prototype.chainReact = orig; }
	return seen;
}

// ═══ 1. transform ═════════════════════════════════════════════════════

test("transform: the node's own values, on, keep, delay… reach the component over the preset", () => {
	const seen = chainQueries(() => render({ type: "p", id: "t", text: "x" }, [{
		op: { name: "transform", values: ["scale(1.2)"], on: "mouseover", keep: true, delay: 50, static: true, closeAfter: 9, hardCSS: "none" },
		target: ["t"], style: "WAVE",
	}]));
	const t = seen.find((q) => q.log === "transform").op;
	assert.deepEqual(t.values, ["scale(1.2)"], "values replaces the preset's");
	assert.equal(t.on, "mouseover");
	assert.equal(t.keep, true);
	assert.equal(t.delay, 50);
	assert.equal(t.static, true);
	assert.equal(t.closeAfter, 9);
	assert.equal(t.hardCSS, "none");
});

test("transform: a node with only a name still gets the preset, exactly as before", () => {
	const seen = chainQueries(() => render({ type: "p", id: "t", text: "x" }, [{ op: { name: "transform" }, target: ["t"], style: "SOLARIUM" }]));
	const t = seen.find((q) => q.log === "transform").op;
	// reactOnTransform itself fills in its default duration; nothing else is there.
	assert.deepEqual({ ...t, duration: undefined }, { name: "transform", values: ["scale(3)"], duration: undefined });
});

test("transform: keys the preset does not set are taken, and a word duration is expanded", () => {
	const seen = chainQueries(() => render({ type: "p", id: "t", text: "x" }, [{ op: { name: "transform", duration: "slow" }, target: ["t"], style: "SOLARIUM" }]));
	const t = seen.find((q) => q.log === "transform").op;
	assert.deepEqual(t.values, ["scale(3)"]);
	assert.equal(t.duration, "9s-ease-in-out");
});

test("transform: the author's node is not written to", () => {
	const node = { op: { name: "transform", values: ["ty:4px"] }, target: ["t"] };
	render({ type: "p", id: "t", text: "x" }, [node]);
	assert.deepEqual(node, { op: { name: "transform", values: ["ty:4px"] }, target: ["t"] });
});

test("transform: no op key is reported PARAM_INERT any more", () => {
	const r = validateNodes([{ op: { name: "transform", values: ["ty:-20px"], on: "mouseover", keep: true, delay: 10 }, target: ["t"] }],
		[{ type: "p", id: "t", text: "x" }]);
	assert.deepEqual(r.warnings.filter((w) => w.code === "PARAM_INERT"), []);
});

// ═══ 2. card-style ════════════════════════════════════════════════════

test("card-style is inert: INERT_OP, and its keys PARAM_INERT with the reason", () => {
	assert.equal(OP_SEMANTICS["card-style"].combine, "inert");
	const r = validateNodes([{ op: { name: "card-style", theme: "base", ops: "text-blast" } }], [{ type: "cards", id: "c" }]);
	assert.equal(r.ok, true, "accepted, as before");
	assert.ok(r.warnings.some((w) => w.code === "INERT_OP"));
	const inert = r.warnings.filter((w) => w.code === "PARAM_INERT").map((w) => w.path).sort();
	assert.deepEqual(inert, ["nodes[0].op.ops", "nodes[0].op.theme"]);
	assert.match(DESIGN_OP_PARAMS["card-style"].summary, /Inert/);
});

test("card-style really changes nothing on a cards grid", () => {
	render({ type: "cards", id: "c" });
	const plain = mount().innerHTML;
	mount().innerHTML = "";
	render({ type: "cards", id: "c" }, [{ op: { name: "card-style", theme: "dark", ops: "text-blast" } }]);
	assert.equal(mount().innerHTML, plain);
});

// ═══ 3. background ════════════════════════════════════════════════════

test("background: `color` is painted, not green", async () => {
	render({ type: "p", id: "x", text: "A" }, [{ op: { name: "background", color: "rgb(1, 2, 3)" }, target: ["x"] }]);
	await tick();
	assert.equal(byId("x").style.backgroundColor, "rgb(1, 2, 3)");
});

test("background: `gradient` becomes the background image", async () => {
	render({ type: "wrap", id: "x", children: [] }, [{ op: { name: "background", gradient: "linear-gradient(red, blue)" }, target: ["x"] }]);
	await tick();
	assert.match(byId("x").style.backgroundImage, /linear-gradient/);
});

test("background with no options still paints green (the old default)", async () => {
	render({ type: "p", id: "x", text: "A" }, [{ op: { name: "background" }, target: ["x"] }]);
	await tick();
	assert.equal(byId("x").style.backgroundColor, "green");
});

test("background: `range` gates it, the element's own colour comes back outside, and other ops do not clear it", async () => {
	render({ type: "wrap", id: "x", background: "rgb(9, 9, 9)", children: [] }, [
		{ op: { name: "shadow", steps: 1 }, target: ["x"], range: [0, 600] },
		{ op: { name: "background", color: "rgb(1, 2, 3)" }, target: ["x"], range: [0, 700] },
	]);
	await tick();
	assert.equal(byId("x").style.backgroundColor, "rgb(1, 2, 3)");
	resize(650); await tick();       // the shadow's range ends: chainReact re-runs and clears
	assert.equal(byId("x").style.backgroundColor, "rgb(1, 2, 3)");
	resize(800); await tick();
	assert.equal(byId("x").style.backgroundColor, "rgb(9, 9, 9)");
	resize(300); await tick();
	assert.equal(byId("x").style.backgroundColor, "rgb(1, 2, 3)");
});

test("background reaches every kind of element the mapper builds a box for", async () => {
	const els = [
		{ type: "h2", id: "x", text: "A" }, { type: "a", id: "x", text: "A", url: "#" }, { type: "img", id: "x", url: "a.png", alt: "" },
		{ type: "row", id: "x", children: [{ type: "p", text: "a" }] }, { type: "stack", id: "x", children: [] },
		{ type: "ulist", id: "x", items: ["a"] }, { type: "table", id: "x" }, { type: "cards", id: "x" },
		{ type: "code", id: "x", text: "a" }, { type: "circle", id: "x" }, { type: "button", id: "x", text: "b" },
		{ type: "disclosure", id: "x", summary: "S", children: [] }, { type: "marquee", id: "x", children: [{ type: "p", text: "a" }] },
	];
	for (const el of els) {
		mount().innerHTML = "";
		render(el, [{ op: { name: "background", color: "rgb(1, 2, 3)" }, target: ["x"] }]);
		await tick();
		assert.equal(byId("x").style.backgroundColor, "rgb(1, 2, 3)", el.type);
	}
});

test("background: the first node reaching the element decides, as for every `first` op", () => {
	const N = [{ op: { name: "background" } }, { op: { name: "background", color: "red" }, target: ["x"] }];
	assert.deepEqual(loweredFor(N, "x"), [], "the untargeted green node comes first and wins");
	assert.equal(loweredFor(N.slice().reverse(), "#x")[0].css.backgroundColor, "red");
});

test("background options validate clean", () => {
	const r = validateNodes([{ op: { name: "background", color: "#fde68a", gradient: "linear-gradient(#fff, #eee)" }, target: ["x"] }],
		[{ type: "p", id: "x", text: "A" }]);
	assert.deepEqual(codes(r), []);
});

// ═══ 4. margin ════════════════════════════════════════════════════════

test("margin: the `margin` key is applied (a bare number is px), inside its range", async () => {
	render([{ type: "p", id: "a", text: "A" }, { type: "p", id: "b", text: "B" }],
		[{ op: { name: "margin", margin: 12 }, target: ["a", "b"], range: [0, 600] }]);
	await tick();
	assert.equal(byId("a").style.margin, "12px");
	assert.equal(byId("b").style.margin, "12px");
	resize(900); await tick();
	assert.notEqual(byId("a").style.margin, "12px");
});

test("margin: `offsets` by index works as before (on an img; see the report for p/wrap)", async () => {
	render([{ type: "img", id: "a", url: "a.png", alt: "", index: 1 }], [{ op: { name: "margin", offsets: [3, 17] }, target: ["a"] }]);
	await tick();
	assert.equal(byId("a").style.margin, "17px");
});

test("margin's `margin` is registered as working, not inert", () => {
	assert.equal(DESIGN_OP_PARAMS.margin.params.margin.inert, undefined);
	const r = validateNodes([{ op: { name: "margin", margin: "2rem 0" }, target: ["a"] }], [{ type: "p", id: "a", text: "A" }]);
	assert.deepEqual(codes(r), []);
});

// ═══ 5. ids inside spec-shaped item slots ═════════════════════════════

test("a node aimed at an element inside a card, a list, a tab, a nav action is not UNKNOWN_TARGET", () => {
	const E = [
		{ type: "cards", id: "grid", items: [[{ type: "h3", id: "cardTitle", text: "A" }], { title: "B", link: "#b" }] },
		{ type: "ulist", id: "list", items: [{ type: "p", id: "li1", text: "One" }, "Two"] },
		{ type: "tabs", id: "tabs", items: [{ label: "A", children: [{ type: "p", id: "inTab", text: "x" }] }, [{ type: "p", id: "inTabArr", text: "y" }]] },
		{ type: "disclosure", id: "d", summary: { type: "p", id: "sum", text: "S" }, children: [] },
		{ type: "nav", id: "nav", items: [{ title: "A", link: "#a" }], actions: [{ type: "a", id: "cta", text: "Go", url: "#go" }] },
	];
	const ids = ["cardTitle", "li1", "inTab", "inTabArr", "sum", "cta"];
	const r = validateNodes(ids.map((id) => ({ op: { name: "gradient", gradient: "linear-gradient(red, blue)" }, target: [id] })), E);
	assert.deepEqual(r.errors.filter((e) => e.code === "UNKNOWN_TARGET"), []);
	// …and a real typo is still caught.
	const bad = validateNodes([{ op: "blast", target: ["cardTitel"] }], E);
	assert.ok(bad.errors.some((e) => e.code === "UNKNOWN_TARGET" && e.suggestions.includes("cardTitle")));
});

test("data entries are not walked as elements", () => {
	assert.deepEqual(nestedSpecs({ type: "nav", items: [{ title: "A", link: "#a", id: "x" }] }), []);
	assert.deepEqual(nestedSpecs({ type: "cards", items: [{ img: "a", title: "t", link: "#" }] }), []);
});

test("the node really applies to the element inside a card", async () => {
	render({ type: "cards", id: "grid", items: [[{ type: "h3", id: "cardTitle", text: "A" }]] },
		[{ op: { name: "background", color: "rgb(4, 5, 6)" }, target: ["cardTitle"] }]);
	await tick();
	assert.equal(byId("cardTitle").style.backgroundColor, "rgb(4, 5, 6)");
});

// ═══ 6. string children ═══════════════════════════════════════════════

const withStringChild = (type) => {
	const el = { type, id: "x", children: ["HELLOSTR", { type: "p", text: "obj" }] };
	if (type === "disclosure") el.summary = "S";
	if (type === "simple") el.react = [{ at: "0", template: ["aa"] }];
	if (type === "product") el.handle = "h";
	if (type === "a") el.url = "#";
	if (type === "img" || type === "model" || type === "video" || type === "audio") el.url = "a.png";
	return type === "product" ? [{ type: "store", id: "store", domain: "https://mock.shop" }, el] : [el];
};

test("STRING_CHILD_TYPES is exactly the set of types that render a string child (measured)", () => {
	const renders = [];
	for (const type of ELEMENT_TYPES) {
		mount().innerHTML = "";
		try { render(withStringChild(type)); } catch { continue; }
		if (mount().innerHTML.includes("HELLOSTR")) renders.push(type);
	}
	assert.deepEqual(renders.sort(), [...STRING_CHILD_TYPES].sort());
});

test("a string child renders as a paragraph and validates where it renders", () => {
	for (const type of ["wrap", "row", "stack", "scroller", "marquee", "disclosure"]) {
		mount().innerHTML = "";
		const E = withStringChild(type);
		render(E);
		const p = [...mount().querySelectorAll("p")].find((n) => n.textContent === "HELLOSTR");
		assert.ok(p, `${type}: rendered as a <p>`);
		assert.ok(!codes(validateNodes([], E)).includes("LEGACY_CHILD_STRING"), type);
	}
	const tab = [{ type: "tabs", id: "t", items: [{ label: "A", children: ["In a tab"] }] }];
	render(tab);
	assert.match(mount().textContent, /In a tab/);
	assert.ok(!codes(validateNodes([], tab)).includes("LEGACY_CHILD_STRING"));
});

test("where a string child cannot render, LEGACY_CHILD_STRING stays", () => {
	for (const type of ["cards", "nav", "h1", "table"]) {
		const r = validateNodes([], [{ type, id: "x", children: ["image", "text"] }]);
		assert.ok(r.errors.some((e) => e.code === "LEGACY_CHILD_STRING"), type);
	}
});

// ═══ 7. raster pointer gate ═══════════════════════════════════════════

test("pointer: the gate names are accepted, anything else is BAD_PARAM_VALUE", async () => {
	const { POINTER_GATE_NAMES } = await import("../../lib/raster-ops.js");
	const E = [{ type: "img", id: "i", url: "a.png", alt: "" }];
	for (const p of [...POINTER_GATE_NAMES, "any"]) {
		assert.equal(validateNodes([{ op: "dither", target: ["i"], pointer: p }], E).ok, true, p);
	}
	const r = validateNodes([{ op: "dither", target: ["i"], pointer: "fien" }], E);
	const e = r.errors.find((x) => x.code === "BAD_PARAM_VALUE");
	assert.equal(e.path, "nodes[0].pointer");
	assert.ok(e.suggestions.includes("fine"));
	assert.ok(e.valid.includes("any"));
});

// ═══ 8. nav ═══════════════════════════════════════════════════════════

const ITEMS = [{ title: "Material", link: "#material" }];
const bars = () => [...mount().querySelectorAll("nav.desktop-navbar, nav.mobile-navbar")];

test("NAV_BAR_UNIVERSAL covers every universal option the behaviours read (hover aside)", () => {
	const ix = readFileSync(path.join(ROOT, "layout", "behaviours", "interaction.js"), "utf8");
	const keys = JSON.parse(ix.match(/const KEYS = (\[[\s\S]*?\]);/)[1].replace(/\s+/g, " "));
	const mo = readFileSync(path.join(ROOT, "layout", "behaviours", "motion.js"), "utf8");
	const body = mo.slice(mo.indexOf("export function applyMotion"));
	const motion = [...body.slice(0, body.indexOf("\n}")).matchAll(/const (\w+) = obj\.(\w+);/g)].map((m) => m[2]);
	assert.ok(motion.length >= 5);
	for (const k of [...keys, ...motion, "loop", "copied", "transition"]) {
		if (k === "hover") continue;
		assert.ok(NAV_BAR_UNIVERSAL.includes(k), `${k} is not forwarded to the nav bars`);
	}
});

test("navBarUniversal reads exactly NAV_BAR_UNIVERSAL by name (what the schema credits)", () => {
	const src = readFileSync(path.join(ROOT, "lib", "element-mapper.js"), "utf8");
	const block = src.slice(src.indexOf("const given = {"), src.indexOf("};", src.indexOf("const given = {")));
	const names = [...block.matchAll(/(\w+): el\.(\w+)/g)].map((m) => { assert.equal(m[1], m[2]); return m[1]; });
	assert.deepEqual(names.sort(), [...NAV_BAR_UNIVERSAL].sort());
});

test("role, lang, title, tabIndex and the bar's own hover reach both bars", () => {
	const nav = { type: "nav", id: "n", items: ITEMS, role: "navigation", lang: "cs", title: "Hlavní", tabIndex: 0,
		hover: { color: "rgb(1, 1, 1)", bar: { background: "rgb(2, 2, 2)" } } };
	for (const w of [1440, 390]) {
		mount().innerHTML = "";
		atWidth(w);
		render(nav);
		assert.ok(bars().length >= 1, `a bar at ${w}`);
		for (const b of bars()) {
			assert.equal(b.getAttribute("role"), "navigation");
			assert.equal(b.getAttribute("lang"), "cs");
			assert.equal(b.getAttribute("title"), "Hlavní");
			assert.equal(b.getAttribute("tabindex"), "0");
		}
	}
	mount().innerHTML = "";
	atWidth(1440);
	render(nav);
	const desktop = mount().querySelector("nav.desktop-navbar");
	desktop.dispatchEvent(new dom.window.Event("mouseenter"));
	desktop.dispatchEvent(new dom.window.Event("mouseover"));
	assert.equal(desktop.style.background || desktop.style.backgroundColor, "rgb(2, 2, 2)");
});

test("hover without `bar` is still the links' only, so existing navs are unchanged", () => {
	atWidth(1440);
	render({ type: "nav", id: "n", items: ITEMS });
	const plain = mount().innerHTML;
	mount().innerHTML = "";
	render({ type: "nav", id: "n", items: ITEMS, hover: { color: "rgb(1, 1, 1)" } });
	const desktop = mount().querySelector("nav.desktop-navbar");
	const before = desktop.style.cssText;
	desktop.dispatchEvent(new dom.window.Event("mouseenter"));
	desktop.dispatchEvent(new dom.window.Event("mouseover"));
	assert.equal(desktop.style.cssText, before, "the bar does not take the links' hover");
	assert.ok(plain.length > 0);
});

test("the demo nav (no items) gets spy, actions, hideOnScroll, aria and role", () => {
	atWidth(1440);
	render({ type: "nav", id: "demo", spy: true, hideOnScroll: true, aria: { label: "Main" }, role: "navigation",
		actions: [{ type: "a", id: "cta", text: "Book a call", url: "#contact" }] });
	assert.match(mount().textContent, /More/, "still the demo");
	assert.equal(mount().querySelectorAll('[id="cta"]').length >= 1, true, "actions rendered");
	for (const b of bars()) {
		assert.equal(b.getAttribute("aria-label"), "Main");
		assert.equal(b.getAttribute("role"), "navigation");
	}
});

test("a nav's actions are left out of its scroll spy; its links are not", () => {
	atWidth(1440);
	render({ type: "nav", id: "nav", spy: true, items: [{ title: "Talks", link: "#talks" }],
		actions: [{ type: "a", id: "cta", text: "Book a talk", url: "#talks" }] });
	const cta = mount().querySelector('[id="cta"]');
	assert.ok(cta.closest('[data-nod-spy="off"]'), "the action opts out");
	const link = [...mount().querySelectorAll('a[href="#talks"]')].find((a) => a !== cta);
	assert.equal(link.closest('[data-nod-spy="off"]'), null, "the link stays in");
});

test("the demo nav without the new options renders as it always did", () => {
	atWidth(1440);
	render({ type: "nav", id: "demo" });
	const a = mount().innerHTML;
	mount().innerHTML = "";
	render({ type: "nav", id: "demo", items: [] });
	assert.equal(mount().innerHTML, a);
	for (const b of bars()) for (const attr of ["role", "aria-label", "lang"]) assert.equal(b.hasAttribute(attr), false);
});

test("the mobile bar's code carries the universal options", async () => {
	const { MobileBar } = await import("../../layout/beta-mobile-bar.js");
	const code = new MobileBar().set({ role: "navigation", lang: "cs", reveal: true }).add([]).toCode();
	assert.match(code, /role: "navigation"/);
	assert.match(code, /lang: "cs"/);
	assert.match(code, /reveal: true/);
});

// ═══ 9. components map ════════════════════════════════════════════════

test("Des's components map names the round-1 element classes", () => {
	const src = readFileSync(path.join(ROOT, "lib", "designer.js"), "utf8");
	const layout = src.slice(src.indexOf("const layout = {"), src.indexOf("};", src.indexOf("const layout = {")));
	for (const c of ["Model", "Tabs", "Disclosure", "Scroller", "Marquee"]) {
		assert.match(layout, new RegExp(`\\b${c}\\b`), c);
		assert.match(src, new RegExp(`import \\{ ${c} \\} from "\\.\\./layout/`), `${c} imported`);
	}
});

// ═══ 10. op-semantics vs the registry ═════════════════════════════════

test("an op is inert in op-semantics exactly when all its registered keys are inert (and it has some, or reads none)", () => {
	for (const [name, spec] of Object.entries(DESIGN_OP_PARAMS)) {
		const keys = Object.values(spec.params);
		const allInert = keys.length > 0 && keys.every((p) => p.inert);
		if (allInert) assert.equal(OP_SEMANTICS[name].combine, "inert", name);
		if (OP_SEMANTICS[name].combine === "inert") assert.ok(allInert || (keys.length === 0 && spec.readIn.length === 0), name);
	}
	assert.ok(shadowedNodes([{ op: { name: "card-style" } }]).some((f) => f.code === "INERT_OP"));
});

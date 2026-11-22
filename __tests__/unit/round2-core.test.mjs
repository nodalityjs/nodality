// round2-core.test.mjs — the round-2 fixes in the core files: animator.js
// (inview guard, hover timing, the shadow node's key, blast's display, the
// reduced-motion animate helper, composite teardown, datetime), the image
// sequence (lib/keyframe-animation.js), the nav bars, RadioGroup and
// container.js (unknown Wrapper kind, ASI).
//
// jsdom is the prerender: no IntersectionObserver, no Web Animations. Each
// test installs (or removes) exactly the browser APIs it is about.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

let Des, Text, Wrapper, FlexRow, KeyframeAnim, motionAnimate, Animator, dom, w, reduce;
const ANIMATE = () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	w = dom.window;
	globalThis.window = w;
	globalThis.document = w.document;
	Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
	globalThis.HTMLElement = w.HTMLElement;
	globalThis.CustomEvent = w.CustomEvent; // the nav bars dispatch their open/close events on window
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	({ Des } = await import("../../lib/designer.js"));
	({ Text } = await import("../../layout/text.js"));
	({ Wrapper } = await import("../../layout/container.js"));
	({ FlexRow } = await import("../../layout/flex-row.js"));
	({ KeyframeAnim } = await import("../../lib/keyframe-animation.js"));
	({ motionAnimate, Animator } = await import("../../layout/animator.js"));
});

beforeEach(() => {
	reduce = false;
	w.matchMedia = (q) => ({ media: q, matches: /reduced-motion/.test(q) ? reduce : false,
		addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	delete w.IntersectionObserver;
	delete globalThis.IntersectionObserver;
	delete w.Element.prototype.animate;
	w.document.querySelector("#mount").innerHTML = "";
});

function render(elements, nodes = []) {
	const d = new Des();
	d.nodes(nodes).add([].concat(elements)).set({ mount: "#mount", code: false, elements: false });
	return { d, mount: w.document.querySelector("#mount") };
}

function quietWarn(fn) {
	const warns = [];
	const orig = console.warn;
	console.warn = (...a) => warns.push(a.join(" "));
	try { fn(); } finally { console.warn = orig; }
	return warns;
}

// ── 1. animation fireAt "inview" without IntersectionObserver ─────────────

test('1: fireAt "inview" with no IntersectionObserver does not throw and shows the end state', () => {
	const open = [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }];
	const close = [{ opacity: 1 }, { opacity: 0, transform: "translateY(20px)" }];
	let mount;
	assert.doesNotThrow(() => {
		({ mount } = render({ type: "p", id: "t", text: "x" },
			[{ op: { name: "animation", fireAt: "inview", keyframesOpen: open, keyframesClose: close }, target: ["t"] }]));
	});
	const el = mount.querySelector("#t");
	assert.equal(el.style.opacity, "1", "the open state's last frame, not the hidden close state");
	assert.equal(el.style.transform, "none");
});

test('1: with IntersectionObserver present, "inview" still waits for the intersection', () => {
	const observed = [];
	w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(t) { observed.push(t); } disconnect() {} };
	const calls = [];
	w.Element.prototype.animate = function (kf, o) { calls.push([kf, o]); return ANIMATE(); };
	render({ type: "p", id: "t", text: "x" },
		[{ op: { name: "animation", fireAt: "inview", keyframesOpen: [{ opacity: 0 }, { opacity: 1 }], keyframesClose: [{ opacity: 0 }] }, target: ["t"] }]);
	assert.equal(observed.length, 1);
	assert.deepEqual(calls.map((c) => c[1].duration), [0], "only the close state, held");
});

// ── 2. hover animation timing ─────────────────────────────────────────────

test("2: hover animation as a bare number is seconds; a string is used as written", () => {
	const a = new Text("x").set({ hover: { animation: 0.3, background: "red" } });
	assert.equal(a.res.style.transition, "0.3s");
	const b = new Text("x").set({ hover: { animation: "0.2s ease-in", background: "red" } });
	assert.equal(b.res.style.transition, "0.2s ease-in");
});

// ── 3. the shadow design node's key ──────────────────────────────────────

test("3: the shadow node arrives as shadowOp, and an element's own `shadow` is left alone", () => {
	const node = { op: { name: "shadow", colors: ["red"], movements: ["2px"], radius: "4px" } };
	const t = new Text("x").set({ id: "s", shadowOp: node });
	assert.equal(t.res.style.filter, "drop-shadow(2px 2px 4px red)");
	// A wrap with its own (non-node) shadow value and the node beside it.
	const wr = new Wrapper().set({ id: "w", shadow: 5, shadowOp: node });
	assert.equal(wr.res.style.boxShadow, "2px 2px 4px red");
	// A non-node `shadow` with no node: not treated as one (it used to throw).
	assert.doesNotThrow(() => new Wrapper().set({ id: "w2", shadow: "big" }));
});

test("3: the legacy key still works — a page through Des renders its shadow as before", () => {
	const { mount } = render({ type: "h2", id: "h", text: "x" }, [{ op: { name: "shadow", colors: ["blue"] }, target: ["h"] }]);
	assert.match(mount.querySelector("#h").style.filter, /drop-shadow\(3px 3px 3px blue\)/);
});

// ── 4. blast keeps block / flex / grid layouts ───────────────────────────

test("4: blast does not force inline-block on a block, flex or grid wrapper", () => {
	const blast = [{ op: { name: "blast", color: "orange" } }];
	const { mount } = render([
		{ type: "wrap", id: "a", children: [{ type: "p", text: "x" }] },
		{ type: "wrap", id: "b", disp: "grid", children: [{ type: "p", text: "x" }] },
		{ type: "wrap", id: "c", as: "time", children: [{ type: "p", text: "x" }] },
	], [{ ...blast[0], target: ["a", "b", "c"] }]);
	assert.equal(mount.querySelector("#a").style.display, "", "a div stays block");
	assert.equal(mount.querySelector("#b").style.display, "grid");
	assert.equal(mount.querySelector("#c").style.display, "inline-block", "an inline tag needs it for transforms");
	assert.equal(mount.querySelector("#a").style.border, "1px solid orange");
});

test("4: isInlineBox", () => {
	const mk = (tag, display) => { const e = w.document.createElement(tag); if (display) e.style.display = display; return e; };
	assert.equal(Animator.isInlineBox(mk("div")), false);
	assert.equal(Animator.isInlineBox(mk("span")), true);
	assert.equal(Animator.isInlineBox(mk("span", "block")), false);
	assert.equal(Animator.isInlineBox(mk("div", "inline")), true);
	assert.equal(Animator.isInlineBox(mk("model-viewer")), true);
});

// ── 5. the image sequence ────────────────────────────────────────────────

function windowListenerCounter() {
	const live = new Map();
	const add = w.addEventListener.bind(w), rem = w.removeEventListener.bind(w);
	w.addEventListener = (t, f, o) => { live.set(f, t); return add(t, f, o); };
	w.removeEventListener = (t, f, o) => { live.delete(f); return rem(t, f, o); };
	return { get count() { return live.size; }, restore() { w.addEventListener = add; w.removeEventListener = rem; } };
}

function sequence(extra = {}) {
	w.HTMLCanvasElement.prototype.getContext = function () { return { canvas: this, drawImage() {} }; };
	return new KeyframeAnim({ path: "/f/", extension: "jpg", text: new Text("Title"), ...extra });
}

test("5: KeyframeAnim registers its window listeners so destroy() removes them, twice safely", () => {
	const c = windowListenerCounter();
	try {
		const k = sequence();
		k.maska({ start: 0, end: 100 }).setLazyText({ start: 0, end: 10 });
		k.setOpacityRange({ opacityRange: { start: 0, end: 1 }, scaleRange: { start: 0, end: 1 } });
		assert.ok(c.count >= 5, `listeners attached: ${c.count}`);
		w.document.body.appendChild(k.render());
		k.destroy();
		assert.equal(c.count, 0, "every window listener removed");
		assert.equal(k.res.parentNode, null);
		assert.doesNotThrow(() => k.destroy());
	} finally { c.restore(); }
});

test("5: KeyframeAnim under reduced motion: one still frame, the text shown, no listeners", () => {
	reduce = true;
	const c = windowListenerCounter();
	try {
		const k = sequence({ reducedFrame: 12 });
		k.maska({ start: 0, end: 100 }).setLazyText({ start: 0, end: 10 });
		k.setOpacityRange({ opacityRange: { start: 0, end: 1 }, scaleRange: { start: 0, end: 1 } });
		assert.equal(c.count, 0);
		assert.match(k.img.src, /\/f\/0012\.jpg$/);
		assert.equal(k.h2a.style.opacity, "1");
		const k1 = sequence();
		assert.match(k1.img.src, /\/f\/0001\.jpg$/, "default: the opening frame");
	} finally { c.restore(); }
});

// ── 6. nav bars under reduced motion ─────────────────────────────────────

test("6: motionAnimate runs the same keyframes instantly under reduced motion", () => {
	const calls = [];
	const el = { animate(kf, o) { calls.push([kf, o]); return ANIMATE(); } };
	const kf = [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }];
	motionAnimate(el, kf, { duration: 300, delay: 50, fill: "forwards" });
	assert.deepEqual(calls[0][1], { duration: 300, delay: 50, fill: "forwards" }, "untouched without reduced motion");
	reduce = true;
	const opts = { duration: 300, delay: 50, fill: "forwards", iterations: 3 };
	motionAnimate(el, kf, opts);
	assert.equal(calls[1][0], kf);
	assert.deepEqual(calls[1][1], { duration: 0, delay: 0, endDelay: 0, iterations: 1, fill: "forwards" });
	assert.equal(opts.duration, 300, "the caller's options object is not mutated");
});

test("6: the nav bars animate only through motionAnimate", () => {
	for (const f of ["layout/side-nav-bar.js", "layout/new-nav-bar.js", "layout/side-bar.js", "layout/simple-bar.js", "layout/nav-bar.js"]) {
		const code = src(f).replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
		assert.doesNotMatch(code, /[\w\]\)]\.animate\(/, `${f} calls .animate( directly`);
	}
});

test("6: SideNav opening under reduced motion lands at once", () => {
	reduce = true;
	const calls = [];
	w.Element.prototype.animate = function (kf, o) { calls.push(o); return ANIMATE(); };
	const { mount } = render({ type: "sideNav", id: "sn" });
	const toggle = [...mount.querySelectorAll("button")].find((b) => b.textContent === "☰");
	assert.ok(toggle, "the menu button");
	calls.length = 0;
	toggle.click();
	assert.ok(calls.length > 0, "the open animation ran");
	for (const o of calls) assert.equal(o.duration, 0);
});

// ── 7. radio gets the universal behaviours ───────────────────────────────

test("7: radio's root receives behaviour options; its render is unchanged otherwise", () => {
	const { mount, d } = render([
		{ type: "radio", id: "r", items: ["One", "Two"], aria: { label: "Pick one" }, role: "radiogroup" },
		{ type: "radio", id: "plain", items: ["One", "Two"] },
	]);
	const r = mount.querySelector("#r");
	assert.equal(r.getAttribute("aria-label"), "Pick one");
	assert.equal(r.getAttribute("role"), "radiogroup");
	const plain = mount.querySelector("#plain");
	assert.equal(plain.getAttribute("style"), null);
	assert.equal(plain.querySelectorAll("input[type=radio]").length, 2);
	assert.doesNotThrow(() => d.destroy());
});

// ── 8. composites destroy their children ─────────────────────────────────

test("8: a composite's destroy() destroys the children it built, idempotently", () => {
	const a = new Text("a").set({}), b = new Text("b").set({});
	let destroyed = 0;
	for (const c of [a, b]) { const o = c.destroy.bind(c); c.destroy = () => { destroyed++; return o(); }; }
	const wr = new Wrapper().set({}).add([a, b]);
	const row = new FlexRow().set({}).items([new Text("c").set({})]);
	wr.destroy();
	assert.equal(destroyed, 2);
	wr.destroy();
	assert.equal(destroyed, 2, "a second destroy() releases nothing twice");
	assert.doesNotThrow(() => row.destroy());
});

test("8: Des.destroy() still tears a nested page down without throwing", () => {
	const { d, mount } = render({ type: "wrap", id: "outer", children: [
		{ type: "wrap", id: "inner", children: [{ type: "p", id: "p", text: "x", hover: { background: "red" } }] },
	] });
	assert.ok(mount.querySelector("#p"));
	assert.doesNotThrow(() => d.destroy());
	assert.doesNotThrow(() => d.destroy());
});

// ── 9. new Wrapper(unknown kind) ─────────────────────────────────────────

test("9: new Wrapper with an unknown kind renders a div and warns", () => {
	let wr;
	const warns = quietWarn(() => { wr = new Wrapper("nav"); });
	assert.equal(wr.res.tagName, "DIV");
	assert.equal(warns.length, 1);
	assert.match(warns[0], /new Wrapper\("nav"\)/);
	const silent = quietWarn(() => { assert.equal(new Wrapper("section").res.tagName, "SECTION"); });
	assert.equal(silent.length, 0);
	assert.equal(new Wrapper({ center: true }).res.tagName, "DIV", "an options object without isLink is a div");
});

// ── 10. container.js has no ASI hazards ──────────────────────────────────

test("10: no `a && (b)` statement in container.js runs on into the next line", () => {
	const lines = src("layout/container.js").split("\n");
	const bad = [];
	for (let i = 0; i < lines.length; i++) {
		const t = lines[i].trim();
		if (/^[\w.]+\s*&&\s*\(.*\)$/.test(t)) bad.push(`${i + 1}: ${t}`);
	}
	assert.deepEqual(bad, []);
});

// ── 11. datetime on time ─────────────────────────────────────────────────

test("11: datetime is written on a <time> (text tag or wrap as), and silently ignored elsewhere", () => {
	let mount;
	const warns = quietWarn(() => {
		({ mount } = render([
			{ type: "p", id: "t", tag: "time", text: "14 June", datetime: "2026-06-14" },
			{ type: "wrap", id: "w", as: "time", datetime: "2026-06-14T09:00", children: [{ type: "p", text: "9:00" }] },
			{ type: "p", id: "p", text: "no time here", datetime: "2026-06-14" },
		]));
	});
	assert.equal(mount.querySelector("#t").tagName, "TIME");
	assert.equal(mount.querySelector("#t").getAttribute("datetime"), "2026-06-14");
	assert.equal(mount.querySelector("#w").getAttribute("datetime"), "2026-06-14T09:00");
	assert.equal(mount.querySelector("#p").hasAttribute("datetime"), false);
	assert.deepEqual(warns.filter((m) => /datetime/.test(m)), []);
});

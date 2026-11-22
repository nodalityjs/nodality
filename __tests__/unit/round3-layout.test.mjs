// round3-layout.test.mjs — round 3 fixes in the component layer (layout/**,
// lib/theme.js, lib/keyframe-animation.js), one block per fix:
//
//   1  `border` as a CSS string on every element (it crashed a page on `a`)
//   2  the theme's default colour lands on root components only — children inherit
//   3  span parts without a style inherit the element's colour
//   4  img.reveal's zoom never widens the page
//   5  spy: body/html/ancestor targets ignored; the section at the reading line wins
//   6  model: radius keyframes are reached (orbit limits from the data)
//   7  destroy() cancels a running `loop`
//   8  radio groups get ids/names of their own; the unused duplicate is gone
//   9  KeyframeAnim: preload, sticky path, no `data.text`
//  10  circle/polygon: plain `shadow` string vs the `shadowOp` design node
//  11  FlexGrid.items() keeps its method
//  12  reactOnTransform does not write into the caller's node
//  13  tabs and scroller mirror right to left
//  14  scrub follows a scrolling container (scrubSource)
//
// jsdom has no layout: geometry is stubbed where a behaviour depends on it.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true, url: "https://example.test/page" });
const W = dom.window;

const media = { reduced: false };
W.matchMedia = (q) => ({ matches: /reduced-motion/.test(q) ? media.reduced : false, media: q,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.defineProperty(W, "innerHeight", { value: 800, configurable: true, writable: true });

let observers = [];
class FakeObserver {
	constructor(cb, opts) { this.cb = cb; this.opts = opts; this.targets = []; this.live = true; observers.push(this); }
	observe(t) { this.targets.push(t); }
	unobserve() {}
	disconnect() { this.live = false; }
	fire(list) { this.cb(list.map(([target, isIntersecting]) => ({ target, isIntersecting })), this); }
}
W.IntersectionObserver = FakeObserver;
W.ResizeObserver = FakeObserver;

let frames = [];
W.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
W.cancelAnimationFrame = () => {};
const runFrames = () => { const f = frames; frames = []; for (const cb of f) cb(0); };

const animations = [];
W.Element.prototype.animate = function (keyframes, opts) {
	const a = { el: this, keyframes, opts, cancelled: false, currentTime: 0,
		pause() {}, play() {}, cancel() { this.cancelled = true; }, finished: Promise.resolve() };
	animations.push(a);
	return a;
};
// A 2D context is all KeyframeAnim needs from a canvas.
W.HTMLCanvasElement.prototype.getContext = function () { return { canvas: this, drawImage() {} }; };

for (const k of ["window", "document", "HTMLElement", "Node", "Element", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent"]) {
	globalThis[k] = W[k];
}
globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame;
globalThis.cancelAnimationFrame = W.cancelAnimationFrame;
Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true });

const { Des } = await import("../../lib/designer.js");
const { Theme } = await import("../../lib/theme.js");
const { Text } = await import("../../layout/text.js");
const { Link } = await import("../../layout/link.js");
const { Wrapper } = await import("../../layout/container.js");
const { Image } = await import("../../layout/image.js");
const { Model } = await import("../../layout/model.js");
const { RadioGroup } = await import("../../layout/form-components/radio.js");
const { KeyframeAnim } = await import("../../lib/keyframe-animation.js");
const { Circle } = await import("../../layout/circle.js");
const { Polygon } = await import("../../layout/polygon.js");
const { FlexGrid } = await import("../../layout/flex-grid.js");
const { isRTL } = await import("../../layout/element-kit.js");

const mount = () => document.getElementById("mount");
const render = (els, nodes = []) => new Des().nodes(nodes).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
const $ = (sel) => document.querySelector(sel);
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 3; i++) await tick(); };
const key = (el, k) => el.dispatchEvent(new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const silently = async (fn) => {
	const warn = console.warn, error = console.error;
	console.warn = () => {}; console.error = () => {};
	try { return await fn(); } finally { console.warn = warn; console.error = error; }
};

beforeEach(() => {
	mount().innerHTML = "";
	mount().removeAttribute("dir");
	document.documentElement.removeAttribute("dir");
	observers = [];
	frames = [];
	animations.length = 0;
	media.reduced = false;
	Object.defineProperty(W, "scrollY", { value: 0, configurable: true, writable: true });
});

// ── 1. border as a CSS string ───────────────────────────────────────────

test("1. border: a CSS string is a plain border on a, wrap and p — and `a` no longer crashes the page", () => {
	render([{ type: "wrap", id: "w", border: "1px solid #0B0B0C", children: [
		{ type: "a", id: "l", text: "Go", url: "#x", border: "2px solid red" },
		{ type: "p", id: "p", text: "Hi", border: "3px dashed blue" },
	] }]);
	assert.equal($("#w").style.border, "1px solid rgb(11, 11, 12)");
	assert.equal($("#l").style.border, "2px solid red");
	assert.equal($("#p").style.border, "3px dashed blue");
});

test("1. border: the object forms keep working (wrap {width,color,radius}, link design node)", async () => {
	const w = new Wrapper().set({ border: { width: 2, color: "red", radius: 4 } });
	assert.equal(w.res.style.border, "2px solid red");
	assert.equal(w.res.style.borderRadius, "4px");
	// A design-node `border` still reaches the link's chainReact (no throw).
	await silently(() => new Link("Go", "#x").set({ text: "Go", border: { op: { name: "border" }, target: ["l"] } }));
	// A plain {width, color} object is not mistaken for a node either.
	assert.doesNotThrow(() => new Link("Go", "#x").set({ text: "Go", border: { width: 1, color: "red" } }));
});

// ── 2. theme default only on roots ──────────────────────────────────────

test("2. theme: the light default lands on the root; children inherit the section's colour", async () => {
	render([
		{ type: "wrap", id: "dark", color: "rgb(255, 0, 0)", children: [{ type: "p", id: "kid", text: "Kid" }, { type: "h2", id: "head", text: "H" }] },
		{ type: "wrap", id: "plain", children: [{ type: "p", id: "kid2", text: "Kid" }] },
	]);
	await flush();
	assert.equal($("#dark").style.color, "rgb(255, 0, 0)");
	assert.equal($("#kid").style.color, "", "inherits the section colour");
	assert.equal($("#head").style.color, "");
	assert.equal($("#plain").style.color, "rgb(17, 17, 17)", "a root still gets the default");
	assert.equal($("#kid2").style.color, "", "and its children inherit it");
});

test("2. theme: a child's own colour wins; dark-mode switching recolours the roots only", async () => {
	render([{ type: "wrap", id: "root", children: [{ type: "p", id: "own", text: "x", color: "rgb(0, 128, 0)" }, { type: "p", id: "inh", text: "y" }] }]);
	await flush();
	const prevDark = Theme.defaults.dark, mode = Theme.mode;
	try {
		Theme.setDefaults({ dark: { color: "rgb(238, 238, 238)" } });
		Theme.set("dark");
		assert.equal($("#root").style.color, "rgb(238, 238, 238)");
		assert.equal($("#inh").style.color, "");
		assert.equal($("#own").style.color, "rgb(0, 128, 0)");
		Theme.set("light");
		assert.equal($("#root").style.color, "rgb(17, 17, 17)");
		assert.equal($("#inh").style.color, "");
	} finally {
		Theme.defaults.dark = prevDark;
		Theme.set(mode);
	}
});

test("2. theme: an element built first and inserted under a section later gives the default back", async () => {
	const t = new Text("late").set({ text: "late", type: "p" });
	await flush();
	assert.equal(t.res.style.color, "rgb(17, 17, 17)", "detached: it is a root");
	const host = document.createElement("section");
	host.style.color = "rgb(0, 0, 255)";
	host.appendChild(t.res);
	mount().appendChild(host);
	t._applyTheme(Theme.mode);
	assert.equal(t.res.style.color, "", "now it inherits");
});

// ── 3. span parts inherit ───────────────────────────────────────────────

test("3. span: unstyled parts carry no colour of their own; styled parts keep theirs", async () => {
	render([{ type: "wrap", id: "s", color: "rgb(255, 255, 255)", children: [{ type: "p", id: "t", text: "A bold move" }] }],
		[{ op: { name: "span", parts: [{ text: "bold", style: { weight: "700", color: "rgb(255, 0, 0)" } }] }, target: ["t"] }]);
	await flush();
	const parts = [...$("#t").querySelectorAll("span")];
	assert.ok(parts.length >= 3);
	const plain = parts.filter((p) => p.textContent !== "bold");
	for (const p of plain) assert.equal(p.style.color, "", `"${p.textContent}" inherits`);
	assert.equal(parts.find((p) => p.textContent === "bold").style.color, "rgb(255, 0, 0)");
	assert.equal($("#t").style.color, "");
});

// ── 4. img.reveal never widens the page ─────────────────────────────────

test("4. img.reveal: the parent clips sideways while the image is zoomed, and is given back after", async () => {
	const host = document.createElement("div");
	mount().appendChild(host);
	const img = new Image("/a.jpg").set({ url: "/a.jpg", reveal: { zoom: 1.12 } });
	host.appendChild(img.res);
	await flush();
	assert.equal(img.res.style.scale, "1.12");
	assert.equal(host.style.overflowX, "clip", "the zoomed box cannot add scrollable width");
	const io = observers.find((o) => o.targets.includes(img.res) && o.opts && "rootMargin" in o.opts);
	io.fire([[img.res, true]]);
	assert.equal(img.res.style.scale, "1");
	assert.equal(host.style.overflowX, "clip", "still clipped while the zoom transitions out");
	const end = new W.Event("transitionend");
	end.propertyName = "scale";
	img.res.dispatchEvent(end);
	assert.equal(host.style.overflowX, "", "the parent's own value is back");
});

test("4. img.reveal: a parent that already clips or scrolls is left alone; no zoom, no clip", async () => {
	const host = document.createElement("div");
	host.style.overflowX = "auto";
	mount().appendChild(host);
	const a = new Image("/a.jpg").set({ url: "/a.jpg", reveal: true });
	host.appendChild(a.res);
	await flush();
	assert.equal(host.style.overflowX, "auto");
	const host2 = document.createElement("div");
	mount().appendChild(host2);
	const b = new Image("/b.jpg").set({ url: "/b.jpg", reveal: { zoom: 1 } });
	host2.appendChild(b.res);
	await flush();
	assert.equal(host2.style.overflowX, "");
});

// ── 5. spy ──────────────────────────────────────────────────────────────

const box = (el, top, bottom) => { el.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top }); };

test("5. spy: a link to <body id=\"top\"> (or a section holding the nav) is never a section", async () => {
	document.body.id = "top";
	try {
		render([
			{ type: "wrap", id: "toc", spy: true, children: [
				{ type: "a", id: "brand", text: "Brand", url: "#top" },
				{ type: "a", id: "la", text: "A", url: "#a" },
			] },
			{ type: "wrap", id: "a", children: [{ type: "p", text: "a" }] },
		]);
		await flush();
		const io = observers.find((o) => o.targets.some((t) => t.id === "a"));
		assert.ok(io);
		assert.deepEqual(io.targets.map((t) => t.id), ["a"], "body is not observed");
		box($("#a"), 100, 900);
		io.fire([[$("#a"), true]]);
		assert.equal($("#la").getAttribute("aria-current"), "true");
		assert.equal($("#brand").hasAttribute("aria-current"), false);
	} finally {
		document.body.removeAttribute("id");
	}
});

test("5. spy: the section at the reading line wins, not the topmost one in the upper half", async () => {
	render([
		{ type: "wrap", id: "toc", spy: { offset: 80 }, children: [
			{ type: "a", id: "l1", text: "1", url: "#s1" },
			{ type: "a", id: "l2", text: "2", url: "#s2" },
		] },
		{ type: "wrap", id: "s1", children: [{ type: "p", text: "1" }] },
		{ type: "wrap", id: "hero", children: [{ type: "p", text: "not in the nav" }] },
		{ type: "wrap", id: "s2", children: [{ type: "p", text: "2" }] },
	]);
	await flush();
	const lit = () => [...document.querySelectorAll('#toc a[aria-current="true"]')].map((a) => a.id);
	// The line: 80 + (800 - 80) × 0.3 = 296.
	box($("#s1"), 400, 1200); box($("#s2"), 2000, 2600);
	W.dispatchEvent(new W.Event("scroll")); runFrames();
	assert.deepEqual(lit(), [], "above the first section nothing is lit");
	box($("#s1"), -200, 600); box($("#s2"), 1400, 2000);
	W.dispatchEvent(new W.Event("scroll")); runFrames();
	assert.deepEqual(lit(), ["l1"]);
	// A section the nav does not list (hero) holds the line; s2's top is
	// already in the upper half — the old rule lit it here.
	box($("#s1"), -1500, -700); box($("#s2"), 350, 900);
	W.dispatchEvent(new W.Event("scroll")); runFrames();
	assert.deepEqual(lit(), [], "nothing: the line is in an unlisted section");
	box($("#s1"), -2500, -1700); box($("#s2"), 200, 900);
	W.dispatchEvent(new W.Event("scroll")); runFrames();
	assert.deepEqual(lit(), ["l2"]);
});

test("5. spy: `line` moves the reading line", async () => {
	render([
		{ type: "wrap", id: "toc", spy: { line: 0.8 }, children: [{ type: "a", id: "l1", text: "1", url: "#s1" }] },
		{ type: "wrap", id: "s1", children: [{ type: "p", text: "1" }] },
	]);
	await flush();
	box($("#s1"), 500, 1500);
	W.dispatchEvent(new W.Event("scroll")); runFrames();
	assert.equal($("#l1").getAttribute("aria-current"), "true", "640 crosses a section starting at 500");
});

// ── 6. model framing ────────────────────────────────────────────────────

test("6. model: radius keyframes set the orbit limits, so every keyframe is reached", async () => {
	await silently(() => {
		const m = new Model("/bike.glb").set({ alt: "Bike", cameraScrub: { keyframes: [{ radius: 40, phi: 80 }, { radius: 12, phi: 170 }] } });
		assert.equal(m.res.getAttribute("min-camera-orbit"), "-Infinity 22.5deg 12m");
		assert.equal(m.res.getAttribute("max-camera-orbit"), "Infinity 170deg 40m", "phi widened past 157.5°");
		m.destroy();
		const fixed = new Model("/bike.glb").set({ alt: "Bike", camera: { radius: 30 }, radiusLimit: [5, 50] });
		assert.equal(fixed.res.getAttribute("min-camera-orbit"), "-Infinity 22.5deg 5m");
		assert.equal(fixed.res.getAttribute("max-camera-orbit"), "Infinity 157.5deg 50m");
		fixed.destroy();
	});
});

test("6. model: radiusLimit \"auto\" leaves model-viewer's limits and re-frames on load; no radius, no change", async () => {
	await silently(async () => {
		const m = new Model("/bike.glb").set({ alt: "Bike", radiusLimit: "auto", cameraScrub: { keyframes: [{ radius: 40 }, { radius: 12 }] } });
		assert.equal(m.res.hasAttribute("max-camera-orbit"), false);
		let framed = 0;
		m.res.updateFraming = () => { framed++; return Promise.resolve(); };
		m.res.dispatchEvent(new W.Event("load"));
		assert.equal(framed, 1);
		m.destroy();
		const plain = new Model("/bike.glb").set({ alt: "Bike", camera: { theta: 20 } });
		assert.equal(plain.res.hasAttribute("min-camera-orbit"), false);
		assert.equal(plain.res.hasAttribute("max-camera-orbit"), false);
		plain.destroy();
	});
});

// ── 7. destroy cancels loop ─────────────────────────────────────────────

test("7. destroy() cancels a running loop", () => {
	const t = new Text("x").set({ text: "x", loop: { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 1000 } });
	const anim = animations.find((a) => a.opts && a.opts.iterations === Infinity);
	assert.ok(anim, "the loop runs");
	t.destroy();
	assert.equal(anim.cancelled, true);
	assert.equal(t._loop, null);
});

// ── 8. radio ids ────────────────────────────────────────────────────────

test("8. radio: two groups on a page get their own ids and names; labels point at their inputs", () => {
	const a = new RadioGroup().set({ id: "size", items: ["Small", "Large"] });
	const b = new RadioGroup().set({ items: ["Red", "Blue"] });
	mount().append(a.el, b.el);
	const ids = [...document.querySelectorAll('input[type="radio"]')].map((i) => i.id);
	assert.equal(new Set(ids).size, 4, `unique ids: ${ids}`);
	assert.deepEqual(ids.slice(0, 2), ["size-0", "size-1"]);
	for (const label of document.querySelectorAll("label")) {
		assert.ok(document.getElementById(label.getAttribute("for")), "label[for] names a real input");
	}
	const names = [...document.querySelectorAll('input[type="radio"]')].map((i) => i.name);
	assert.notEqual(names[0], names[2], "one-checked-per-name stays inside each group");
	b.el.querySelectorAll("input")[1].checked = true;
	assert.deepEqual(a.getCheckedValues(), []);
	assert.deepEqual(b.getCheckedValues(), ["Blue"]);
	a.el.querySelectorAll("input")[0].checked = true;
	assert.deepEqual(a.getCheckedValues(), ["Small"]);
	assert.deepEqual(b.getCheckedValues(), ["Blue"]);
});

test("8. radio: the unused duplicate radiogroup.js is gone", () => {
	assert.equal(existsSync(fileURLToPath(new URL("../../layout/form-components/radiogroup.js", import.meta.url))), false);
});

// ── 9. KeyframeAnim ─────────────────────────────────────────────────────

test("9. KeyframeAnim: builds without data.text, preloads into separate images, sticky path runs", () => {
	let k;
	assert.doesNotThrow(() => { k = new KeyframeAnim({ path: "/f/", extension: "jpg", stickyData: { top: 300 }, uncomment: true }); });
	runFrames();
	const shown = k.img.src;
	assert.equal(k._preloaded.length, 100);
	assert.match(k._preloaded[0].src, /\/f\/0001\.jpg$/);
	assert.match(k._preloaded[99].src, /\/f\/0100\.jpg$/);
	assert.notEqual(k._preloaded[0], k.img, "the visible frame is not the preloader");
	assert.equal(k.img.src, shown, "preloading did not change the frame on screen");
	mount().appendChild(k.res);
	W.scrollY = 500;
	assert.doesNotThrow(() => W.dispatchEvent(new W.Event("scroll")));
	assert.equal(k.res.style.position, "relative");
	assert.equal(k.res.style.top, "300px");
	assert.equal(k.res.style.background, "", "no debugging colours");
	W.scrollY = 0;
	W.dispatchEvent(new W.Event("scroll"));
	assert.equal(k.res.style.position, "fixed");
	assert.doesNotThrow(() => k.setLazyText({ start: 0, end: 100 }));
	k.destroy();
});

// ── 10. circle / polygon shadow ─────────────────────────────────────────

test("10. circle: `shadow` is a box-shadow string; the design node comes in as shadowOp", async () => {
	const c = new Circle().set({ shadow: "0 4px 12px rgba(0, 0, 0, 0.2)" });
	assert.equal(c.res.style.boxShadow, "0 4px 12px rgba(0, 0, 0, 0.2)");
	const node = { op: { name: "shadow", color: "red" }, target: ["c"] };
	const seen = [];
	const C2 = class extends Circle { chainReact(arr) { seen.push(...arr.map((x) => x.log)); } };
	const d = new C2().set({ id: "c", shadowOp: node });
	assert.deepEqual(seen, ["shadow"], "the node reaches chainReact");
	assert.equal(d.res.style.boxShadow, "", "and is not written as a box-shadow string");
	seen.length = 0;
	new C2().set({ id: "c", shadow: node });
	assert.deepEqual(seen, ["shadow"], "a node still passed as `shadow` is recognised by its shape");
	const P2 = class extends Polygon { chainReact(arr) { seen.push(...arr.map((x) => x.log)); } };
	seen.length = 0;
	assert.doesNotThrow(() => new P2({ id: "p" }).set({ id: "p", sides: 6, shadow: "0 0 4px red" }));
	assert.deepEqual(seen, [], "a string is never treated as a node");
	new P2({ id: "p" }).set({ id: "p", sides: 6, shadowOp: node });
	assert.deepEqual(seen, ["shadow"]);
});

test("10. circle/polygon: a CSS transform string is applied, not fed to chainReact as a node", () => {
	const c = new Circle().set({ transform: "rotate(3deg)" });
	assert.equal(c.res.style.transform, "rotate(3deg)");
	assert.equal(c.res.style.margin, "0px", "no empty chainReact run clearing the margin");
	const p = new Polygon({ id: "p" }).set({ id: "p", sides: 5, transform: "rotate(3deg)" });
	assert.equal(p.res.style.transform, "rotate(3deg)");
});

// ── 11. FlexGrid.items ──────────────────────────────────────────────────

test("11. FlexGrid.items() can be called again: it no longer overwrites itself", () => {
	const g = new FlexGrid();
	g.items([new Text("a").set({ text: "a" })]);
	assert.equal(typeof g.items, "function");
	assert.doesNotThrow(() => g.items([new Text("b").set({ text: "b" })]));
	assert.equal(g.itemList.length, 1);
	assert.equal(g.res.children.length, 2);
});

// ── 12. reactOnTransform ────────────────────────────────────────────────

test("12. a transform node without duration is not written to; the default timing is unchanged", () => {
	const node = { op: { name: "transform", values: ["ty:-20px"], static: false }, target: ["t"] };
	const t = new Wrapper().set({ transform: node });
	W.dispatchEvent(new W.Event("load")); // a transform without `on` plays at window load
	assert.equal("duration" in node.op, false, "the caller's node is untouched");
	assert.match(t.res.style.transition, /transform 1\.5s ease-in-out/, "same timing the mutated default produced");
});

// ── 13. right to left ───────────────────────────────────────────────────

const build = (spec) => render(spec);

test("13. isRTL reads dir from the page or an ancestor", () => {
	const n = document.createElement("div");
	mount().appendChild(n);
	assert.equal(isRTL(n), false);
	mount().setAttribute("dir", "rtl");
	assert.equal(isRTL(n), true);
});

test("13. tabs: right to left, ArrowLeft goes to the next tab and ArrowRight back", () => {
	mount().setAttribute("dir", "rtl");
	build({ type: "tabs", id: "t", items: [{ label: "A", children: [] }, { label: "B", children: [] }, { label: "C", children: [] }] });
	const tabs = [...document.querySelectorAll('[role="tab"]')];
	key(tabs[0], "ArrowLeft");
	assert.equal(tabs[1].getAttribute("aria-selected"), "true");
	key(tabs[1], "ArrowRight");
	assert.equal(tabs[0].getAttribute("aria-selected"), "true");
	mount().removeAttribute("dir");
	key(tabs[0], "ArrowRight");
	assert.equal(tabs[1].getAttribute("aria-selected"), "true", "left to right is unchanged");
});

const geometry = (track, { scrollWidth, clientWidth, scrollLeft = 0 }) => {
	Object.defineProperty(track, "scrollWidth", { value: scrollWidth, configurable: true });
	Object.defineProperty(track, "clientWidth", { value: clientWidth, configurable: true });
	track.scrollLeft = scrollLeft;
	const calls = [];
	track.scrollTo = (o) => { calls.push(o); track.scrollLeft = o.left; };
	return calls;
};

test("13. scroller: right to left, keys, prev/next, End, progress and glyphs mirror", () => {
	mount().setAttribute("dir", "rtl");
	build({ type: "scroller", id: "sc", controls: true, progress: true, children: [{ type: "p", text: "x" }] });
	const track = document.getElementById("sc-track");
	const calls = geometry(track, { scrollWidth: 3000, clientWidth: 1000 });
	key(track, "ArrowLeft");
	assert.equal(calls.at(-1).left, -900, "forward is leftwards");
	key(track, "ArrowRight");
	assert.equal(calls.at(-1).left, 0);
	key(track, "End");
	assert.equal(calls.at(-1).left, -3000);
	key(track, "Home");
	assert.equal(calls.at(-1).left, 0);
	const [prev, next] = [...document.querySelectorAll("#sc button")];
	track.dispatchEvent(new W.Event("scroll")); // the buttons learn the new geometry
	runFrames();
	next.click();
	assert.equal(calls.at(-1).left, -900, "next goes forward");
	track.scrollLeft = -1000;
	track.dispatchEvent(new W.Event("scroll"));
	runFrames();
	const bar = document.querySelector("#sc [aria-hidden=\"true\"] > div");
	assert.equal(bar.style.transform, "scaleX(0.5)");
	assert.equal(bar.style.transformOrigin, "100% 50%", "fills from the right");
	assert.equal(prev.getAttribute("aria-disabled"), "false");
	assert.equal(prev.textContent, "›");
	assert.equal(next.textContent, "‹");
});

test("13. scroller: jump aligns the target's right edge right to left", () => {
	mount().setAttribute("dir", "rtl");
	build({ type: "scroller", id: "sj", jump: true, children: [{ type: "p", id: "far", text: "far" }] });
	const track = document.getElementById("sj-track");
	const calls = geometry(track, { scrollWidth: 3000, clientWidth: 1000, scrollLeft: -200 });
	track.getBoundingClientRect = () => ({ left: 0, right: 1000, top: 0, bottom: 100 });
	document.getElementById("far").getBoundingClientRect = () => ({ left: 100, right: 400, top: 0, bottom: 100 });
	document.getElementById("sj").scrollIntoView = () => {};
	const link = document.createElement("a");
	link.href = "#far";
	mount().appendChild(link);
	link.click();
	assert.equal(calls.at(-1).left, -800, "−200 + (400 − 1000)");
});

// ── 14. scrub in a scrolling container ──────────────────────────────────

const scrollingPanel = () => {
	const panel = document.createElement("div");
	panel.style.overflowY = "auto";
	Object.defineProperty(panel, "scrollHeight", { value: 3000, configurable: true });
	Object.defineProperty(panel, "clientHeight", { value: 500, configurable: true });
	panel.scrollTop = 0;
	panel.getBoundingClientRect = () => ({ top: 100, bottom: 600, left: 0, right: 100, height: 500, width: 100 });
	mount().appendChild(panel);
	return panel;
};

test("14. scrub follows the nearest scrolling ancestor (scrubSource: \"auto\")", async () => {
	const panel = scrollingPanel();
	const t = new Text("x").set({ text: "x", scrub: { keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "top", to: "exit" } });
	panel.appendChild(t.res);
	// Content position 1000 in the panel, 400 tall; the panel's top is at 100.
	t.res.getBoundingClientRect = () => ({ top: 100 + 1000 - panel.scrollTop, height: 400, bottom: 100 + 1400 - panel.scrollTop, left: 0, width: 100 });
	await flush(); runFrames();
	panel.scrollTop = 1200;
	panel.dispatchEvent(new W.Event("scroll"));
	runFrames();
	assert.equal(t._scrubProgress, 0.5, "halfway from top (1000) to exit (1400) of the panel's scroll");
	W.scrollY = 5000;
	W.dispatchEvent(new W.Event("scroll"));
	runFrames();
	assert.equal(t._scrubProgress, 0.5, "the window's scroll does not drive it");
	t.destroy();
});

test("14. scrub: scrubSource \"window\" keeps the page scroll; a box that does not scroll is not a source", async () => {
	const panel = scrollingPanel();
	const t = new Text("x").set({ text: "x", scrubSource: "window", scrub: { keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "top", to: "exit" } });
	panel.appendChild(t.res);
	t.res.getBoundingClientRect = () => ({ top: 1000 - W.scrollY, height: 400, bottom: 1400 - W.scrollY, left: 0, width: 100 });
	await flush(); runFrames();
	W.scrollY = 1200;
	W.dispatchEvent(new W.Event("scroll"));
	runFrames();
	assert.equal(t._scrubProgress, 0.5);
	t.destroy();
	const flat = document.createElement("div");
	flat.style.overflowX = "auto"; // computes overflow-y: auto too, but nothing scrolls vertically
	mount().appendChild(flat);
	const u = new Text("y").set({ text: "y", scrub: { keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "top", to: "exit" } });
	flat.appendChild(u.res);
	u.res.getBoundingClientRect = () => ({ top: 1000 - W.scrollY, height: 400, bottom: 1400 - W.scrollY, left: 0, width: 100 });
	await flush(); runFrames();
	W.scrollY = 1100;
	W.dispatchEvent(new W.Event("scroll"));
	runFrames();
	assert.equal(u._scrubProgress, 0.25, "the window drives it");
	u.destroy();
});

// ── coordinator follow-ups: prerender sanity, resprop copy, stack code, model poster ──

const { Stack } = await import("../../layout/stack.js");

const prerendering = async (fn) => {
	W.__NODALITY_PRERENDER__ = true;
	try { return await fn(); } finally { delete W.__NODALITY_PRERENDER__; }
};

test("prerender flag: no hidden entrance, count/fit/copy/scroller controls stay plain, img.reveal unmasked", async () => {
	await prerendering(async () => {
		render([
			{ type: "h1", id: "h", text: "Title", reveal: true, fit: true },
			{ type: "p", id: "n", text: "1200 riders", count: true },
			{ type: "p", id: "cp", text: "npm i nodality", copy: true },
			{ type: "scroller", id: "sc", controls: true, children: [{ type: "p", text: "x" }] },
			{ type: "img", id: "im", url: "/a.jpg", reveal: true },
		]);
		await flush();
	});
	assert.doesNotMatch($("#h").getAttribute("style") || "", /opacity:\s*0|nowrap/);
	assert.equal($("#n").textContent.includes("1200"), true);
	assert.doesNotMatch($("#n").textContent, /^0/);
	assert.equal($("#cp").hasAttribute("role"), false);
	assert.equal($("#cp").hasAttribute("tabindex"), false);
	for (const b of document.querySelectorAll("#sc button")) assert.equal(b.hasAttribute("aria-disabled"), false);
	assert.equal($("#im").style.clipPath, "");
	assert.equal($("#im").style.scale, "");
});

test("resprop leaves the author's array as it was", () => {
	const rp = [{ max: 600, background: "red" }, { min: 601, background: "blue" }];
	const copy = JSON.parse(JSON.stringify(rp));
	new Wrapper().set({ resprop: rp });
	assert.deepEqual(rp, copy, "no default entry, no ranges, same order");
});

test("stack.toCode() carries every option, not just the id", () => {
	const s = new Stack().set({ id: "st", height: "80vh", sticky: true, reveal: true });
	const code = s.toCode()[0];
	assert.match(code, /height: "80vh"/);
	assert.match(code, /sticky: true/);
	assert.match(code, /reveal: true/);
	assert.match(code, /id: "st"/);
});

test("model: a poster (or the alt text) shows before model-viewer is defined, in its poster slot", async () => {
	await silently(() => {
		const m = new Model("/bike.glb").set({ alt: "A bike", poster: "/bike.png" });
		const img = m.res.querySelector('img[slot="poster"]');
		assert.equal(img.getAttribute("src"), "/bike.png");
		assert.equal(img.getAttribute("alt"), "A bike");
		m.set({ alt: "A bike", poster: "/bike2.png" });
		assert.equal(m.res.querySelectorAll('[slot="poster"]').length, 1, "re-set replaces it");
		const t = new Model("/bike.glb").set({ alt: "A bike" });
		assert.equal(t.res.querySelector('[slot="poster"]').textContent, "A bike");
		const none = new Model("/bike.glb").set({});
		assert.equal(none.res.children.length, 0, "nothing to show: nothing added");
	});
});

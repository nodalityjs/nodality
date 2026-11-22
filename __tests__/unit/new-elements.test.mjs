// new-elements.test.mjs — model, disclosure, tabs, scroller, marquee.
//
// Per type: it renders, the validator knows its slot and its required fields,
// keyboard behaviour where jsdom can show it, reduced motion, headless safety,
// and destroy() releasing what it attached. The conformance sweeps
// (conformance-sweep, render-contract) cover every design/raster op on each.
//
// jsdom has no layout, so geometry (scroll widths, element boxes) is stubbed
// per test exactly where a behaviour depends on it.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true, url: "https://example.test/page" });
const W = dom.window;

// What the media queries answer: a viewport width and the motion preference.
const media = { width: 1280, reduced: false };
W.matchMedia = (q) => {
	let matches = false;
	if (/prefers-reduced-motion:\s*reduce/.test(q)) matches = media.reduced;
	else {
		const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
		matches = (min || max) ? (!min || media.width >= +min[1]) && (!max || media.width <= +max[1]) : false;
	}
	return { matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
};
Object.defineProperty(W, "innerWidth", { get: () => media.width, configurable: true });
Object.defineProperty(W, "innerHeight", { value: 800, configurable: true, writable: true });

// Observers that remember their callbacks, so a test can fire them.
const observers = [];
class FakeObserver {
	constructor(cb) { this.cb = cb; this.targets = []; this.live = true; observers.push(this); }
	observe(t) { this.targets.push(t); }
	unobserve() {}
	disconnect() { this.live = false; }
}
W.ResizeObserver = FakeObserver;
W.IntersectionObserver = FakeObserver;

// requestAnimationFrame runs on demand, so a scroll's update is observable.
let frames = [];
W.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
W.cancelAnimationFrame = () => {};
const flushFrames = () => { const f = frames; frames = []; for (const cb of f) cb(0); };

// Web Animations: record what was asked for.
const animations = [];
W.Element.prototype.animate = function (keyframes, opts) {
	const a = { el: this, keyframes, opts, state: "running", cancelled: false, currentTime: 0,
		effect: { getTiming: () => ({ duration: opts.duration }) },
		pause() { this.state = "paused"; }, play() { this.state = "running"; }, cancel() { this.cancelled = true; },
		finished: Promise.resolve() };
	animations.push(a);
	return a;
};

for (const k of ["window", "document", "HTMLElement", "Node", "Element", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent"]) {
	globalThis[k] = W[k];
}
globalThis.requestAnimationFrame = W.requestAnimationFrame;
globalThis.cancelAnimationFrame = W.cancelAnimationFrame;
Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true });

// Count listeners on window and document, as the render-contract harness does.
const live = { window: 0, document: 0, scroll: 0, click: 0 };
for (const [name, target] of [["window", W], ["document", W.document]]) {
	const add = target.addEventListener.bind(target), rem = target.removeEventListener.bind(target);
	target.addEventListener = (t, f, o) => { live[name]++; if (t === "scroll") live.scroll++; if (t === "click") live.click++; return add(t, f, o); };
	target.removeEventListener = (t, f, o) => { live[name]--; if (t === "scroll") live.scroll--; if (t === "click") live.click--; return rem(t, f, o); };
}
W.document.querySelector("#mount");   // jsdom's own first-query listeners, before counting matters

const { ElementMapper } = await import("../../lib/element-mapper.js");
const { Des } = await import("../../lib/designer.js");
const { validateNodes } = await import("../../lib/validate-nodes.js");
const { cameraAt, cameraAttributes, enterProgress, scrubVariants } = await import("../../layout/model.js");

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const mount = () => W.document.getElementById("mount");
const build = (el, nodes = []) => quiet(() => ElementMapper.mapType({ el, customOptions: nodes, i: 0 }));
const show = (el, nodes) => { const c = build(el, nodes); mount().appendChild(c.render()); return c; };
const codes = (r, list = "errors") => r[list].map((e) => `${e.code} ${e.path}`);
const rect = (node, r) => { node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, ...r }); };

beforeEach(() => {
	mount().innerHTML = "";
	media.width = 1280; media.reduced = false;
	frames = [];
	animations.length = 0;
});

// ── model ───────────────────────────────────────────────────────────

// The bike section's scroll script, as it stands in the page that tuned it
// (petr-new-web/nodality/upload/index.html), reduced to a function of the
// progress p and the viewport width. The element has to reproduce it.
function bikeReference(p, width) {
	const BIKE = [0, 3.15, 0.22], WHEEL = [0, 2.07, -2.85];
	const shift = width >= 768 ? 1 : 0;
	const R = 40, FOV_START = 22, fovEnd = width >= 768 ? 8 : 10.5, TURN = -35, THETA_END = -90;
	const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);
	const t = ease(p);
	const target = BIKE.map((v, i) => lerp(v, WHEEL[i], t));
	const theta = THETA_END - TURN * (1 - p);
	const rad = theta * Math.PI / 180, d = shift * lerp(9, 2.3, t);
	target[0] -= d * Math.cos(rad);
	target[2] += d * Math.sin(rad);
	return { target, theta, phi: lerp(74, 82, t), radius: R, fov: lerp(FOV_START, fovEnd, t) };
}

// The same behaviour, written as data — the configuration docs-gaps/elements.md shows.
const BIKE_START = { theta: -55, phi: 74, radius: 40, fov: 22, target: [0, 3.15, 0.22] };
const BIKE_SCRUB = [
	{ media: "(min-width: 768px)", easing: { default: "smooth", theta: "linear" },
		keyframes: [{ ...BIKE_START, shift: 9 }, { theta: -90, phi: 82, fov: 8, target: [0, 2.07, -2.85], shift: 2.3 }] },
	{ easing: { default: "smooth", theta: "linear" },
		keyframes: [BIKE_START, { theta: -90, phi: 82, fov: 10.5, target: [0, 2.07, -2.85] }] },
];

const parseCamera = (attrs) => {
	const [theta, phi, radius] = attrs["camera-orbit"].split(" ").map(parseFloat);
	return { theta, phi, radius, target: attrs["camera-target"].split(" ").map(parseFloat), fov: parseFloat(attrs["field-of-view"]) };
};

test("model: the bike camera, as data, reproduces the page's hand-written scroll script", () => {
	for (const width of [1280, 390]) {
		media.width = width;
		const variant = scrubVariants(BIKE_SCRUB).find((v) => !v.media || W.matchMedia(v.media).matches);
		// Resolve the keyframes the way the component does (fills carry forward).
		const frames = [];
		let prev = {};
		variant.keyframes.forEach((k, i) => { prev = { ...prev, ...k, at: i / (variant.keyframes.length - 1) }; frames.push(prev); });
		for (const p of [0, 0.1, 0.25, 0.5, 0.73, 0.9, 1]) {
			const got = parseCamera(cameraAttributes(cameraAt(frames, p, variant.easing)));
			const want = bikeReference(p, width);
			for (const k of ["theta", "phi", "radius", "fov"]) assert.ok(Math.abs(got[k] - want[k]) < 1e-6, `${width}px p=${p} ${k}: ${got[k]} vs ${want[k]}`);
			want.target.forEach((v, i) => assert.ok(Math.abs(got.target[i] - v) < 1e-4, `${width}px p=${p} target[${i}]: ${got.target[i]} vs ${v}`));
		}
	}
});

test("model: renders <model-viewer> with its attributes, non-interactive by default", () => {
	const m = show({ type: "model", id: "bike", url: "/bike.glb", alt: "A road bike", poster: "/bike.jpg", exposure: 1.05,
		environment: "neutral", shadow: 0, loading: "lazy", interpolationDecay: 80, loader: "/vendor/mv.js" });
	const mv = m.res;
	assert.equal(mv.tagName, "MODEL-VIEWER");
	assert.equal(mv.id, "bike");
	for (const [k, v] of [["src", "/bike.glb"], ["alt", "A road bike"], ["poster", "/bike.jpg"], ["exposure", "1.05"],
		["environment-image", "neutral"], ["shadow-intensity", "0"], ["loading", "lazy"], ["interpolation-decay", "80"],
		["interaction-prompt", "none"]]) assert.equal(mv.getAttribute(k), v, k);
	assert.ok(mv.hasAttribute("disable-zoom") && mv.hasAttribute("disable-pan"));
	assert.ok(!mv.hasAttribute("camera-controls"));
	assert.equal(mv.style.pointerEvents, "none");
	m.destroy();

	const i = show({ type: "model", url: "/bike.glb", alt: "x", interactive: true, attributes: { ar: true, "min-camera-orbit": "auto 40deg auto" } });
	assert.ok(i.res.hasAttribute("camera-controls"));
	assert.notEqual(i.res.style.pointerEvents, "none");
	assert.equal(i.res.getAttribute("ar"), "");
	assert.equal(i.res.getAttribute("min-camera-orbit"), "auto 40deg auto");
	i.destroy();
});

test("model: url is required (src accepted), alt is advised", () => {
	const none = validateNodes([], [{ type: "model", id: "m", alt: "x" }]);
	assert.equal(none.ok, false);
	assert.deepEqual(codes(none), ["MISSING_FIELD elements[0].url"]);
	assert.throws(() => build({ type: "model" }), /needs a `url`/);

	const src = validateNodes([], [{ type: "model", src: "/a.glb", alt: "x" }]);
	assert.equal(src.ok, true, JSON.stringify(src.errors));
	assert.equal(build({ type: "model", src: "/a.glb", alt: "x" }).res.getAttribute("src"), "/a.glb");

	const noAlt = validateNodes([], [{ type: "model", url: "/a.glb" }]);
	assert.equal(noAlt.ok, true);
	assert.deepEqual(codes(noAlt, "warnings"), ["MISSING_FIELD elements[0].alt"]);
});

test("model: the loader is attached once per page; the decoder location is set before it", () => {
	const head = W.document.head;
	const before = head.querySelectorAll("script").length;
	delete W.ModelViewerElement;
	const a = show({ type: "model", url: "/a.glb", alt: "a", loader: "/vendor/model-viewer.min.js", decoderLocation: "/vendor/meshopt_decoder.js" });
	const b = show({ type: "model", url: "/b.glb", alt: "b", loader: "/vendor/model-viewer.min.js" });
	const scripts = [...head.querySelectorAll('script[src="/vendor/model-viewer.min.js"]')];
	assert.equal(scripts.length, 1);
	assert.equal(scripts[0].getAttribute("type"), "module");
	assert.equal(head.querySelectorAll("script").length, before + 1);
	assert.equal(W.ModelViewerElement.meshoptDecoderLocation, "/vendor/meshopt_decoder.js");
	a.destroy(); b.destroy();
	scripts[0].remove();
});

test("model: the fov limits widen to what the keyframes ask for", () => {
	const m = show({ type: "model", url: "/a.glb", alt: "x", cameraScrub: BIKE_SCRUB });
	// model-viewer clamps field-of-view to 25°–45° by default; 8° would stop at 25°.
	assert.equal(m.res.getAttribute("min-field-of-view"), "8deg");
	assert.ok(!m.res.hasAttribute("max-field-of-view"));
	m.destroy();
});

test("model: entering-the-viewport progress", () => {
	const el = W.document.createElement("div");
	rect(el, { top: 800, height: 400 });
	assert.equal(enterProgress(el, 800), 0);          // top at the viewport's bottom
	rect(el, { top: 600, height: 400 });
	assert.equal(enterProgress(el, 800), 0.5);
	rect(el, { top: 400, height: 400 });
	assert.equal(enterProgress(el, 800), 1);          // bottom at the viewport's bottom
	rect(el, { top: 0, height: 1200 });
	assert.equal(enterProgress(el, 800), 1);          // taller: top at the viewport's top
	rect(el, { top: 400, height: 1200 });
	assert.equal(enterProgress(el, 800), 0.5);
	rect(el, { top: 0, height: 0 });
	assert.equal(enterProgress(el, 800), null);       // no layout
});

test("model: scrolling drives the camera and onScrubProgress, from the trigger's box", () => {
	const section = W.document.createElement("section");
	section.id = "bike";
	mount().appendChild(section);
	const m = build({ type: "model", url: "/a.glb", alt: "x", cameraScrub: BIKE_SCRUB.map((v) => ({ ...v, trigger: "parent" })) });
	section.appendChild(m.render());
	// Starting shot written immediately (desktop variant, p = 0).
	assert.equal(m.res.getAttribute("camera-orbit"), "-55deg 74deg 40m");
	assert.equal(m.res.getAttribute("field-of-view"), "22deg");

	const seen = [];
	m.onScrubProgress((p) => seen.push(p));
	rect(section, { top: 400, height: 400 });          // fully in view
	W.dispatchEvent(new W.Event("scroll"));
	flushFrames();
	assert.equal(m._scrubProgress, 1);
	assert.deepEqual(seen, [1]);
	assert.equal(m.res.getAttribute("field-of-view"), "8deg");
	assert.equal(m.res.getAttribute("camera-orbit"), "-90deg 82deg 40m");

	media.width = 390;                                  // phone: the other variant
	W.dispatchEvent(new W.Event("resize"));
	assert.equal(m.res.getAttribute("field-of-view"), "10.5deg");
	assert.equal(m.res.getAttribute("camera-target"), "0m 2.07m -2.85m");   // no shift
	m.destroy();
});

test("model: reduced motion shows the last keyframe and listens to no scroll", () => {
	media.reduced = true;
	const scrollBefore = live.scroll;
	const m = show({ type: "model", url: "/a.glb", alt: "x", cameraScrub: BIKE_SCRUB });
	assert.equal(live.scroll, scrollBefore, "a scroll listener was attached under reduced motion");
	assert.equal(m.res.getAttribute("field-of-view"), "8deg");
	assert.equal(m.res.getAttribute("camera-orbit"), "-90deg 82deg 40m");
	m.destroy();
});

test("model: a static camera, with shift moving the model right on screen", () => {
	const m = show({ type: "model", url: "/a.glb", alt: "x", camera: { theta: 0, phi: 80, radius: 10, fov: 30, target: [0, 1, 0], shift: 2 } });
	// At θ = 0 screen-right is +x, so the target moves to −x by 2.
	assert.equal(m.res.getAttribute("camera-target"), "-2m 1m 0m");
	assert.equal(m.res.getAttribute("camera-orbit"), "0deg 80deg 10m");
	m.destroy();
});

test("model: destroy() releases its listeners, and nothing fires afterwards", async () => {
	const base = { ...live };
	const m = show({ type: "model", url: "/a.glb", alt: "x", cameraScrub: BIKE_SCRUB });
	assert.ok(live.window > base.window);
	m.destroy();
	assert.equal(live.window, base.window);
	assert.equal(m.res.isConnected, false);
	await new Promise((r) => setTimeout(r, 5));        // the deferred first update
	W.dispatchEvent(new W.Event("scroll"));
	flushFrames();
});

// ── disclosure ─────────────────────────────────────────────────────

test("disclosure: native details/summary, content in the DOM while closed", () => {
	const d = show({ type: "disclosure", id: "ship", summary: "Shipping", children: [{ type: "p", text: "Two to four days." }] });
	assert.equal(d.res.tagName, "DETAILS");
	assert.equal(d.res.id, "ship");
	assert.equal(d.res.querySelector("summary").textContent, "Shipping");
	assert.ok(!d.res.hasAttribute("open"));
	assert.ok(d.res.textContent.includes("Two to four days."), "closed content must stay searchable");
	d.destroy();

	const o = show({ type: "disclosure", open: true, summary: { type: "h3", text: "Rich" }, children: [] });
	assert.ok(o.res.hasAttribute("open"));
	assert.ok(o.res.querySelector("summary h3"), "an element summary renders inside <summary>");
	assert.equal(build({ type: "disclosure" }).res.querySelector("summary").textContent, "Details");
});

test("disclosure: content belongs in children", () => {
	const r = validateNodes([], [{ type: "disclosure", items: [{ type: "p", text: "x" }] }]);
	assert.ok(codes(r).includes("WRONG_CONTENT_SLOT elements[0].items"));
	const inSummary = validateNodes([], [{ type: "disclosure", summary: { type: "h3", txt: "x" } }]);
	assert.ok(inSummary.errors.some((e) => e.code === "UNKNOWN_ELEMENT_PARAM"), "a typo in an element summary is checked");
});

// ── tabs ───────────────────────────────────────────────────────────

const TABS = { type: "tabs", id: "seasons", label: "Seasons", items: [
	{ label: "2025", children: [{ type: "p", id: "r25", text: "Results 2025" }] },
	{ label: "2024", children: [{ type: "p", text: "Results 2024" }] },
	{ label: "2023", children: [{ type: "p", text: "Results 2023" }] },
] };
const key = (el, k) => el.dispatchEvent(new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const state = (t) => t.tabs.map((b) => b.getAttribute("aria-selected") === "true" ? "S" : "-").join("");

test("tabs: the ARIA pattern — roles, wiring, one tab stop, hidden=until-found panels", () => {
	const t = show(TABS);
	const list = t.res.querySelector('[role="tablist"]');
	assert.equal(list.getAttribute("aria-label"), "Seasons");
	const tabs = [...t.res.querySelectorAll('[role="tab"]')];
	const panels = [...t.res.querySelectorAll('[role="tabpanel"]')];
	assert.equal(tabs.length, 3); assert.equal(panels.length, 3);
	tabs.forEach((tab, i) => {
		assert.equal(tab.tagName, "BUTTON");
		assert.equal(tab.getAttribute("aria-controls"), panels[i].id);
		assert.equal(panels[i].getAttribute("aria-labelledby"), tab.id);
	});
	assert.deepEqual(tabs.map((b) => b.getAttribute("tabindex")), ["0", "-1", "-1"]);
	assert.equal(state(t), "S--");
	assert.ok(!panels[0].hasAttribute("hidden"));
	// jsdom knows `beforematch`, so it gets the searchable form.
	assert.equal(panels[1].getAttribute("hidden"), "until-found");
	assert.ok(panels[1].textContent.includes("Results 2024"), "inactive panels stay in the DOM");
	t.destroy();
});

test("tabs: arrow keys, Home and End move selection and focus; click selects", () => {
	const t = show(TABS);
	t.tabs[0].focus();
	key(t.tabs[0], "ArrowRight");
	assert.equal(state(t), "-S-");
	assert.equal(W.document.activeElement, t.tabs[1]);
	assert.deepEqual(t.tabs.map((b) => b.getAttribute("tabindex")), ["-1", "0", "-1"]);
	assert.ok(!t.panels[1].hasAttribute("hidden") && t.panels[0].hasAttribute("hidden"));
	key(t.tabs[1], "End");   assert.equal(state(t), "--S");
	key(t.tabs[2], "ArrowRight"); assert.equal(state(t), "S--", "wraps around");
	key(t.tabs[0], "ArrowLeft");  assert.equal(state(t), "--S");
	key(t.tabs[2], "Home");  assert.equal(state(t), "S--");
	t.tabs[1].click();       assert.equal(state(t), "-S-");
	t.destroy();
});

test("tabs: find-in-page (beforematch) selects the panel's tab; selected is clamped", () => {
	const t = show({ ...TABS, selected: 9 });
	assert.equal(state(t), "--S");
	t.panels[0].dispatchEvent(new W.Event("beforematch"));
	assert.equal(state(t), "S--");
	t.destroy();
});

test("tabs: tabStyle and activeTabStyle follow the selection", () => {
	const t = show({ ...TABS, tabStyle: { color: "rgb(1, 2, 3)" }, activeTabStyle: { color: "rgb(200, 0, 0)" } });
	assert.equal(t.tabs[0].style.color, "rgb(200, 0, 0)");
	assert.equal(t.tabs[1].style.color, "rgb(1, 2, 3)");
	t.select(1);
	assert.equal(t.tabs[0].style.color, "rgb(1, 2, 3)");
	assert.equal(t.tabs[1].style.color, "rgb(200, 0, 0)");
	t.destroy();
});

test("tabs: validation — items required, entry shape, nested specs and ids", () => {
	assert.deepEqual(codes(validateNodes([], [{ type: "tabs" }])), ["MISSING_FIELD elements[0].items"]);
	const wrong = validateNodes([], [{ type: "tabs", items: [{ type: "p", text: "Hello" }] }]);
	const err = wrong.errors.find((e) => e.code === "WRONG_ITEM_SHAPE");
	assert.ok(err, JSON.stringify(wrong.errors));
	assert.deepEqual(JSON.parse(err.suggestions[0]), { label: "Hello", children: [{ type: "p", text: "Hello" }] });
	// The mapper does not quietly turn the misplaced spec into a tab named after it.
	assert.equal(build({ type: "tabs", items: [{ type: "p", text: "Hello" }] }).tabs[0].textContent, "Tab 1");

	const typo = validateNodes([], [{ type: "tabs", items: [{ label: "A", children: [{ type: "p", txt: "x" }] }] }]);
	assert.ok(typo.errors.some((e) => e.code === "UNKNOWN_ELEMENT_PARAM" && e.path === "elements[0].items[0].children[0].txt"));
	const target = validateNodes([{ op: { name: "shadow" }, target: ["r25"] }], [TABS]);
	assert.equal(target.ok, true, "a node may target an element inside a tab: " + JSON.stringify(target.errors));
	assert.equal(validateNodes([], [{ type: "tabs", items: ["A", { label: "B", children: [] }] }]).ok, true);
});

// ── scroller ───────────────────────────────────────────────────────

/** Give the track a geometry: content width, visible width, position. */
const geometry = (track, { scrollWidth, clientWidth, scrollLeft = 0 }) => {
	Object.defineProperty(track, "scrollWidth", { value: scrollWidth, configurable: true });
	Object.defineProperty(track, "clientWidth", { value: clientWidth, configurable: true });
	track.scrollLeft = scrollLeft;
	const calls = [];
	track.scrollTo = (o) => { calls.push(o); track.scrollLeft = o.left; };
	return calls;
};

test("scroller: a focusable, named region; children sized and snapping", () => {
	const s = show({ type: "scroller", id: "races", label: "Races", itemWidth: "min(320px, 85vw)", gap: "24px",
		children: [{ type: "p", text: "One" }, { type: "p", text: "Two" }] });
	const track = s.track;
	assert.equal(s.res.id, "races");
	assert.equal(track.getAttribute("tabindex"), "0");
	assert.equal(track.getAttribute("role"), "region");
	assert.equal(track.getAttribute("aria-label"), "Races");
	assert.equal(track.style.getPropertyValue("--nod-item-width"), "min(320px, 85vw)");
	assert.equal(track.style.scrollSnapType, "x mandatory");
	assert.equal(track.style.gap, "24px");
	assert.equal(s.res.style.gap, "", "gap spaces the children, not the outer box");
	for (const c of track.children) {
		assert.equal(c.style.scrollSnapAlign, "start");
		assert.match(c.style.flex, /var\(--nod-item-width/);
	}
	s.destroy();
	const free = show({ type: "scroller", snap: false, children: [{ type: "p", text: "x" }] });
	assert.equal(free.track.style.scrollSnapType, "");
	assert.equal(free.track.firstChild.style.scrollSnapAlign, "");
	free.destroy();
});

test("scroller: arrow keys page it, Home/End go to the ends — only when it has focus", () => {
	const s = show({ type: "scroller", children: [{ type: "button", text: "In" }] });
	const calls = geometry(s.track, { scrollWidth: 3000, clientWidth: 1000 });
	key(s.track, "ArrowRight");
	assert.equal(calls.at(-1).left, 900);
	key(s.track, "ArrowLeft");
	assert.equal(calls.at(-1).left, 0);
	key(s.track, "End");
	assert.equal(calls.at(-1).left, 3000);
	key(s.track, "Home");
	assert.equal(calls.at(-1).left, 0);
	const n = calls.length;
	key(s.track.querySelector("button"), "ArrowRight");
	assert.equal(calls.length, n, "a control inside the scroller keeps its arrow keys");
	s.destroy();
});

test("scroller: prev/next buttons are named and report aria-disabled at the ends; progress follows", () => {
	const s = show({ type: "scroller", controls: true, progress: true, prevLabel: "Předchozí", nextLabel: "Další", children: [{ type: "p", text: "x" }] });
	assert.equal(s.prevButton.getAttribute("aria-label"), "Předchozí");
	assert.equal(s.nextButton.getAttribute("aria-label"), "Další");
	const calls = geometry(s.track, { scrollWidth: 3000, clientWidth: 1000 });
	s._update();
	assert.equal(s.prevButton.getAttribute("aria-disabled"), "true");
	assert.equal(s.nextButton.getAttribute("aria-disabled"), "false");
	s.nextButton.click();
	assert.equal(calls.at(-1).left, 900);
	s.track.dispatchEvent(new W.Event("scroll"));
	flushFrames();
	assert.equal(s.prevButton.getAttribute("aria-disabled"), "false");
	assert.equal(s.progressBar.style.transform, "scaleX(0.45)");
	s.track.scrollLeft = 2000;
	s._update();
	assert.equal(s.nextButton.getAttribute("aria-disabled"), "true");
	const before = calls.length;
	s.nextButton.click();
	assert.equal(calls.length, before, "a disabled button does nothing");
	assert.equal(s.progressBar.parentNode.getAttribute("aria-hidden"), "true");
	s.destroy();
});

test("scroller: flow mode pours children into fixed-height columns; breakBefore starts a column", () => {
	const spec = { type: "scroller", flow: { height: "60vh", columnWidth: "260px", gap: "2rem" }, children: [
		{ type: "p", text: "2025" }, { type: "p", text: "2024", breakBefore: true }] };
	assert.equal(validateNodes([], [spec]).ok, true, "breakBefore on a child is accepted");
	const s = show(spec);
	const flow = s.track.firstChild;
	assert.equal(flow.style.height, "60vh");
	assert.equal(flow.style.columnWidth, "260px");
	assert.equal(flow.style.columnGap, "2rem");
	assert.equal(flow.style.columnFill, "auto");
	const [a, b] = flow.children;
	assert.equal(a.style.breakInside, "avoid");
	assert.equal(a.style.breakBefore, "");
	assert.equal(b.style.breakBefore, "column");
	assert.ok(!b.hasAttribute("breakBefore") && !b.hasAttribute("breakbefore"));
	s.destroy();
});

test("scroller: jump — an in-page link to something inside scrolls it to the start and focuses it", () => {
	const s = show({ type: "scroller", jump: true, children: [{ type: "p", text: "a" }, { type: "p", id: "y2019", text: "2019" }] });
	const calls = geometry(s.track, { scrollWidth: 3000, clientWidth: 1000, scrollLeft: 100 });
	rect(s.track, { left: 50 });
	const target = W.document.getElementById("y2019");
	rect(target, { left: 750 });
	let pageScrolled = 0;
	s.res.scrollIntoView = () => { pageScrolled++; };
	const a = W.document.createElement("a");
	a.setAttribute("href", "#y2019");
	W.document.body.appendChild(a);
	const ev = new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
	a.dispatchEvent(ev);
	assert.equal(ev.defaultPrevented, true);
	assert.equal(pageScrolled, 1, "the page brings the scroller into view");
	assert.equal(calls.at(-1).left, 800, "target left 750 − track left 50 + scrollLeft 100");
	assert.equal(W.document.activeElement, target);
	assert.equal(target.getAttribute("tabindex"), "-1");
	assert.equal(W.location.hash, "#y2019");

	// A link to something elsewhere is left to the browser.
	const outside = W.document.createElement("a");
	outside.setAttribute("href", "#elsewhere");
	W.document.body.appendChild(outside);
	const ev2 = new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
	outside.dispatchEvent(ev2);
	assert.equal(ev2.defaultPrevented, false);
	a.remove(); outside.remove();
	s.destroy();
});

test("scroller: destroy() releases document and window listeners", () => {
	const base = { ...live };
	const s = show({ type: "scroller", jump: true, controls: true, children: [] });
	assert.ok(live.click > base.click);
	s.destroy();
	assert.deepEqual({ ...live }, base);
});

// ── marquee ────────────────────────────────────────────────────────

test("marquee: copies fill the loop, are hidden from AT and the keyboard, and carry no ids", () => {
	const m = show({ type: "marquee", speed: 50, gap: "20px", label: "Sponsors",
		children: [{ type: "a", id: "sp1", text: "Alpha", url: "/a" }, { type: "p", text: "Beta" }] });
	assert.equal(m.res.getAttribute("aria-label"), "Sponsors");
	assert.equal(m.group.style.gap, "20px");
	assert.equal(m.clones.length, 0, "no copies before there is a layout");
	m.measure();
	assert.equal(m.clones.length, 0, "headless: still none");

	rect(m.group, { width: 400 });
	rect(m.res, { width: 1000 });
	m.measure();
	assert.equal(m.clones.length, 3, "ceil(1000 / 400) copies after the original");
	for (const c of m.clones) {
		assert.equal(c.getAttribute("aria-hidden"), "true");
		assert.ok(c.hasAttribute("inert"));
		assert.equal(c.querySelectorAll("[id]").length, 0);
	}
	assert.equal(W.document.querySelectorAll("#sp1").length, 1);
	const a = animations.at(-1);
	assert.deepEqual(a.keyframes, [{ transform: "translateX(0px)" }, { transform: "translateX(-400px)" }]);
	assert.equal(a.opts.duration, 8000, "400px at 50px/s");
	assert.equal(a.opts.iterations, Infinity);

	m.res.dispatchEvent(new W.Event("mouseenter"));
	assert.equal(a.state, "paused");
	m.res.dispatchEvent(new W.Event("mouseleave"));
	assert.equal(a.state, "running");
	m.res.dispatchEvent(new W.FocusEvent("focusin", { bubbles: true }));
	assert.equal(a.state, "paused", "focus inside pauses it");
	m.destroy();
	assert.equal(a.cancelled, true);
});

test("marquee: direction right reverses; pauseOnHover false keeps moving under the pointer", () => {
	const m = show({ type: "marquee", direction: "right", pauseOnHover: false, children: [{ type: "p", text: "x" }] });
	rect(m.group, { width: 300 });
	rect(m.res, { width: 300 });
	m.measure();
	const a = animations.at(-1);
	assert.deepEqual(a.keyframes, [{ transform: "translateX(-300px)" }, { transform: "translateX(0px)" }]);
	assert.equal(a.opts.duration, 7500, "default speed 40px/s");
	m.res.dispatchEvent(new W.Event("mouseenter"));
	assert.equal(a.state, "running");
	m.destroy();
});

test("marquee: reduced motion is a static, wrapping row with no copies", () => {
	media.reduced = true;
	const m = show({ type: "marquee", children: [{ type: "p", text: "x" }, { type: "p", text: "y" }] });
	rect(m.group, { width: 400 });
	rect(m.res, { width: 1000 });
	m.measure();
	assert.equal(m.clones.length, 0);
	assert.equal(animations.length, 0);
	assert.equal(m.track.style.flexWrap, "wrap");
	m.destroy();
});

// ── all five through Des, headless ────────────────────────────────

test("all five render through Des, carry their ids, and tear down to zero", async () => {
	const base = { ...live };
	const E = [
		{ type: "model", id: "m", url: "/a.glb", alt: "a", cameraScrub: BIKE_SCRUB },
		{ type: "disclosure", id: "d", summary: "s", children: [{ type: "p", text: "x" }] },
		{ type: "tabs", id: "t", items: [{ label: "A", children: [{ type: "p", text: "x" }] }] },
		{ type: "scroller", id: "s", jump: true, controls: true, progress: true, children: [{ type: "p", text: "x" }] },
		{ type: "marquee", id: "q", children: [{ type: "p", text: "x" }] },
	];
	assert.equal(validateNodes([], E).ok, true);
	const des = new Des();
	quiet(() => des.nodes([]).add(E).set({ mount: "#mount", code: false, elements: false }));
	for (const id of ["m", "d", "t", "s", "q"]) assert.ok(W.document.getElementById(id), `#${id}`);
	des.destroy();
	await new Promise((r) => setTimeout(r, 5));
	assert.equal(live.window, base.window);
	assert.equal(live.document, base.document);
	for (const n of [...W.document.body.querySelectorAll("pre.nonLayout, textarea#elements")]) n.remove();
});

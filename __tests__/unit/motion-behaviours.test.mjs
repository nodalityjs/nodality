// motion-behaviours.test.mjs — the universal motion options of
// layout/behaviours/motion.js: reveal, scrub, pin, count, fit, plus the
// reduced-motion path of the design-node `animation` op.
//
// jsdom has no layout, no IntersectionObserver and no Web Animations, which
// makes it the prerender: every option must be a no-op there. The browser
// APIs are stubbed per test where the motion is meant to run, and observers
// are driven by hand so the entry/exit logic is exercised exactly.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, Text, Wrapper, dom, w;
let anims, observers, reduce, mediaMatches, mqls, rafQueue, t_cleanup = null;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	w = dom.window;
	globalThis.window = w;
	globalThis.document = w.document;
	Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
	globalThis.HTMLElement = w.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	({ Des } = await import("../../lib/designer.js"));
	({ Text } = await import("../../layout/text.js"));
	({ Wrapper } = await import("../../layout/container.js").catch(() => ({})));
});

/** Install the browser APIs a motion needs. */
function browser() {
	w.matchMedia = (q) => {
		if (!mqls[q]) {
			const ls = new Set();
			mqls[q] = {
				media: q,
				get matches() { return /reduced-motion/.test(q) ? reduce : !!mediaMatches[q]; },
				addEventListener(t, f) { ls.add(f); }, removeEventListener(t, f) { ls.delete(f); },
				addListener(f) { ls.add(f); }, removeListener(f) { ls.delete(f); },
				fire() { for (const f of [...ls]) f({ matches: this.matches }); },
				get listeners() { return ls.size; },
			};
		}
		return mqls[q];
	};
	w.IntersectionObserver = class {
		constructor(cb, opts) { this.cb = cb; this.opts = opts; this.targets = []; this.off = false; observers.push(this); }
		observe(t) { this.targets.push(t); }
		disconnect() { this.off = true; }
		fire(entry) { this.cb([{ target: this.targets[0], ...entry }], this); }
	};
	w.Element.prototype.animate = function (frames, opts) {
		let resolveFinished;
		const a = {
			el: this, frames, opts, paused: false, cancelled: false, currentTime: 0,
			pause() { this.paused = true; }, play() { this.paused = false; },
			cancel() { this.cancelled = true; },
			finished: new Promise((r) => { resolveFinished = r; }),
			finishNow() { resolveFinished(this); },
		};
		anims.push(a);
		return a;
	};
	w.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
	w.cancelAnimationFrame = () => {};
}

function headless() {
	delete w.matchMedia;
	delete w.IntersectionObserver;
	delete w.Element.prototype.animate;
	delete w.requestAnimationFrame;
	delete w.ResizeObserver;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 3; i++) await tick(); };
const runFrames = (now = 0) => { const q = rafQueue.splice(0); for (const f of q) f(now); };

beforeEach(() => {
	if (t_cleanup) { t_cleanup(); t_cleanup = null; }
	anims = []; observers = []; reduce = false; mediaMatches = {}; mqls = {}; rafQueue = [];
	document.getElementById("mount").innerHTML = "";
	headless();
	browser();
	Object.defineProperty(w, "scrollY", { value: 0, configurable: true, writable: true });
	Object.defineProperty(w, "innerHeight", { value: 800, configurable: true, writable: true });
});

const render = (els, nodes = []) => new Des().nodes(nodes).add(els).set({ mount: "#mount", code: false, elements: false });
const byId = (id) => document.querySelector(`[id="${id}"]`);
const rect = (el, r) => { el.getBoundingClientRect = () => ({ left: 0, right: 100, width: 100, x: 0, y: r.top, ...r }); };

// ── nothing used, nothing changed ────────────────────────────────────

test("a page without motion options renders identically with or without the browser APIs", async () => {
	const page = [{ type: "wrap", id: "w", children: [{ type: "h1", id: "t", text: "Hello 42 world" }, { type: "p", id: "p", text: "Body" }] }];
	headless();
	render(page);
	await flush();
	const bare = document.getElementById("mount").innerHTML;
	document.getElementById("mount").innerHTML = "";
	browser();
	render(page);
	await flush();
	assert.equal(document.getElementById("mount").innerHTML, bare);
	assert.equal(observers.length, 0, "no observer for a page that asked for none");
	assert.equal(anims.length, 0, "no animation either");
	assert.ok(!Object.keys(new Text("x").set({ text: "x" })).includes("onScrubProgress"), "the subscription point is not enumerable");
});

test("headless (the prerender): every option is a no-op and the content stays visible", async () => {
	headless();
	render([{ type: "p", id: "t", text: "Up 1,200 users", reveal: { by: "word" }, count: true, scrub: { keyframes: [{ opacity: 0 }, { opacity: 1 }] }, fit: true }]);
	await flush();
	const t = byId("t");
	assert.equal(t.textContent, "Up 1,200 users");
	assert.equal(t.querySelectorAll("span").length, 0, "no words split, no counter");
	assert.equal(t.style.opacity, "");
	assert.equal(t.style.getPropertyValue("--progress"), "");
});

// ── reveal ───────────────────────────────────────────────────────────

test("reveal holds the start frame, then plays when 15% has risen into view", async () => {
	render([{ type: "p", id: "t", text: "Hi", reveal: { y: 40, duration: 500, delay: 100 } }]);
	await flush();
	const t = byId("t");
	const hold = anims.find((a) => a.el === t);
	assert.ok(hold, "the start state is applied");
	assert.deepEqual(hold.frames, [{ opacity: "0", translate: "0px 40px", offset: 0 }]);
	assert.equal(hold.paused, true);
	assert.equal(hold.opts.fill, "backwards", "nothing is held once it has played");
	const io = observers.find((o) => o.targets.includes(t));
	assert.equal(io.opts.rootMargin, "99999px 0px 0px 0px");

	rect(t, { top: 760, bottom: 860, height: 100 });
	io.fire({ isIntersecting: true, intersectionRatio: 0.05, boundingClientRect: t.getBoundingClientRect() });
	assert.equal(anims.length, 1, "below the threshold nothing plays");
	rect(t, { top: 700, bottom: 800, height: 100 });
	io.fire({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: t.getBoundingClientRect() });
	assert.equal(hold.cancelled, true);
	const play = anims[anims.length - 1];
	assert.equal(play.paused, false);
	assert.equal(play.opts.duration, 500);
	assert.equal(play.opts.delay, 100);
	assert.equal(io.off, true, "once: the observer lets go");
});

test("reveal: an element already scrolled past is shown at once, not animated", async () => {
	render([{ type: "p", id: "t", text: "Hi", reveal: true }]);
	await flush();
	const t = byId("t");
	const io = observers.find((o) => o.targets.includes(t));
	io.fire({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: -900, bottom: -800, width: 100, height: 100 } });
	assert.equal(anims.length, 1);
	assert.equal(anims[0].cancelled, true);
});

test("reveal: clipped sideways but vertically in view (a horizontal scroller) is shown, not left hidden", async () => {
	render([{ type: "p", id: "t", text: "Hi", reveal: true }]);
	await flush();
	const io = observers[0];
	io.fire({ isIntersecting: false, intersectionRatio: 0, boundingClientRect: { top: 100, bottom: 200, width: 100, height: 100 } });
	assert.equal(anims[0].cancelled, true);
});

test("reveal under reduced motion, or without IntersectionObserver: nothing is hidden", async () => {
	reduce = true;
	render([{ type: "p", id: "a", text: "Hi", reveal: true }]);
	await flush();
	assert.equal(anims.length, 0);
	assert.equal(observers.length, 0);
	reduce = false;
	delete w.IntersectionObserver;
	render([{ type: "p", id: "b", text: "Hi", reveal: true }]);
	await flush();
	assert.equal(anims.length, 0);
});

test("reveal.stagger brings the children in, in order", async () => {
	render([{ type: "wrap", id: "w", reveal: { stagger: 80, delay: 20 }, children: [
		{ type: "p", id: "a", text: "A" }, { type: "p", id: "b", text: "B" }, { type: "p", id: "c", text: "C" }] }]);
	await flush();
	const wEl = byId("w");
	const kids = [...wEl.children];
	assert.equal(anims.filter((a) => a.el === wEl).length, 0, "the parent itself is not hidden");
	assert.equal(anims.length, kids.length);
	const io = observers.find((o) => o.targets.includes(wEl));
	io.fire({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 100, bottom: 300, width: 100, height: 200 } });
	const plays = anims.slice(kids.length);
	assert.deepEqual(plays.map((a) => a.el), kids);
	assert.deepEqual(plays.map((a) => a.opts.delay), kids.map((_, i) => 20 + i * 80));
});

test("reveal.by word: words come in one by one and the text is untouched", async () => {
	render([{ type: "h2", id: "t", text: "Plain data in", reveal: { by: "word" } }]);
	const before = byId("t").innerHTML;
	await flush();
	const t = byId("t");
	assert.equal(t.textContent, "Plain data in", "textContent identical while split");
	const words = [...t.querySelectorAll("span")];
	assert.deepEqual(words.map((s) => s.textContent), ["Plain", "data", "in"]);
	assert.ok(words.every((s) => !s.hasAttribute("aria-hidden")), "nothing is hidden from a screen reader");
	observers[0].fire({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 100, bottom: 200, width: 100, height: 100 } });
	const plays = anims.slice(3);
	assert.deepEqual(plays.map((a) => a.opts.delay), [0, 40, 80]);
	plays[2].finishNow();
	await flush();
	assert.equal(t.innerHTML, before, "the original text nodes are back once the words are in");
});

test("reveal.by line groups words by the line they sit on", async () => {
	render([{ type: "p", id: "t", text: "one two three four", reveal: { by: "line", stagger: 100 } }]);
	await flush();
	const words = [...byId("t").querySelectorAll("span")];
	words.forEach((s, i) => rect(s, { top: i < 2 ? 0 : 30, bottom: i < 2 ? 20 : 50, height: 20 }));
	observers[0].fire({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 100, bottom: 200, width: 100, height: 100 } });
	assert.deepEqual(anims.slice(4).map((a) => a.opts.delay), [0, 0, 100, 100]);
});

test("img keeps its own mask reveal", async () => {
	render([{ type: "img", id: "i", url: "/a.png", alt: "", reveal: { mask: "square" } }]);
	await flush();
	const img = byId("i");
	assert.equal(anims.length, 0, "the motion reveal does not run on img");
	assert.match(img.style.clipPath || img.querySelector("img")?.style.clipPath || "", /inset/);
});

test("once: false hides again when the element drops back below the viewport", async () => {
	render([{ type: "p", id: "t", text: "Hi", reveal: { once: false } }]);
	await flush();
	const io = observers[0];
	io.fire({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 100, bottom: 200, width: 100, height: 100 } });
	io.fire({ isIntersecting: false, intersectionRatio: 0, boundingClientRect: { top: 900, bottom: 1000, width: 100, height: 100 } });
	const last = anims[anims.length - 1];
	assert.equal(last.paused, true, "held at the start frame again");
	assert.equal(io.off, false);
});

// ── scrub ────────────────────────────────────────────────────────────

test("scrub maps scroll between two points onto the keyframes, --progress and subscribers", async () => {
	const KF = [{ opacity: 0 }, { opacity: 1 }];
	render([{ type: "wrap", id: "s", scrub: { keyframes: KF, from: "enter", to: "exit" }, children: [] }]);
	const s = byId("s");
	const anim = anims.find((a) => a.el === s);
	assert.deepEqual(anim.frames, KF);
	assert.equal(anim.paused, true, "driven by scroll, never playing on its own");
	// Element 400px tall whose top is 1000px down the document.
	s.getBoundingClientRect = () => ({ top: 1000 - w.scrollY, height: 400, bottom: 1400 - w.scrollY, width: 100 });
	await flush();
	w.scrollY = 200 + 700; // enter = 1000 - 800 = 200, exit = 1400 → a 1200px range
	w.dispatchEvent(new w.Event("scroll"));
	runFrames();
	assert.equal(anim.currentTime, 700 / 1200 * 1000);
	assert.equal(s.style.getPropertyValue("--progress"), (700 / 1200).toFixed(4));
});

test("scrub ranges: full, top, page and pin", async () => {
	const { Text } = await import("../../layout/text.js");
	const mk = (scrub, pin) => {
		const c = new Text("x").set({ text: "x", scrub, ...(pin ? { pin } : {}) });
		document.getElementById("mount").appendChild(c.res);
		c.res.getBoundingClientRect = () => ({ top: 1000 - w.scrollY, height: 400, bottom: 1400 - w.scrollY, width: 100 });
		return c;
	};
	const at = (c, y) => { w.scrollY = y; w.dispatchEvent(new w.Event("scroll")); runFrames(); return c._scrubProgress; };
	const full = mk({ keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "enter", to: "full" });
	assert.equal(at(full, 200), 0);       // top at viewport bottom
	assert.equal(at(full, 600), 1);       // bottom (1400) at viewport bottom (600 + 800)
	full.destroy();
	const top = mk({ keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "top", to: "exit" });
	assert.equal(at(top, 1000), 0);
	assert.equal(at(top, 1200), 0.5);
	top.destroy();
	Object.defineProperty(document.documentElement, "scrollHeight", { value: 5800, configurable: true });
	const page = mk({ keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "page", to: "page" });
	assert.equal(at(page, 2500), 0.5);
	page.destroy();
	const pinned = mk({ keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "pin", to: "pin" }, "800px");
	assert.equal(at(pinned, 1400), 0.5, "halfway through an 800px pin that starts at 1000");
	pinned.destroy();
});

test("onScrubProgress hears the progress, and is released with the component", async () => {
	const c = new Text("x").set({ text: "x", scrub: { keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "top", to: "exit" } });
	document.getElementById("mount").appendChild(c.res);
	c.res.getBoundingClientRect = () => ({ top: 1000 - w.scrollY, height: 400, bottom: 1400 - w.scrollY, width: 100 });
	const heard = [];
	const off = c.onScrubProgress((p) => heard.push(p));
	w.scrollY = 1100; w.dispatchEvent(new w.Event("scroll")); runFrames();
	assert.deepEqual(heard, [0.25]);
	off();
	w.scrollY = 1200; w.dispatchEvent(new w.Event("scroll")); runFrames();
	assert.deepEqual(heard, [0.25]);
	c.onScrubProgress((p) => heard.push(p));
	assert.deepEqual(heard, [0.25, 0.5], "a late subscriber hears the current progress at once");
	c.destroy();
	w.scrollY = 1300; w.dispatchEvent(new w.Event("scroll")); runFrames();
	assert.deepEqual(heard, [0.25, 0.5], "no scroll listener after destroy()");
});

test("scrub variants: the first matching media applies, re-chosen when media changes", async () => {
	mediaMatches["(min-width: 768px)"] = false;
	const wide = { media: "(min-width: 768px)", keyframes: [{ scale: "1" }, { scale: "2" }] };
	const narrow = { keyframes: [{ opacity: 0 }, { opacity: 1 }] };
	const c = new Text("x").set({ text: "x", scrub: [wide, narrow] });
	assert.deepEqual(anims[anims.length - 1].frames, narrow.keyframes);
	mediaMatches["(min-width: 768px)"] = true;
	mqls["(min-width: 768px)"].fire();
	assert.deepEqual(anims[anims.length - 1].frames, wide.keyframes);
	assert.equal(anims[anims.length - 2].cancelled, true, "the old variant is released");
	c.destroy();
	assert.equal(mqls["(min-width: 768px)"].listeners, 0);
});

test("scrub under reduced motion: the last keyframe, no animation, no listeners", async () => {
	reduce = true;
	const c = new Text("x").set({ text: "x", scrub: { keyframes: [{ opacity: 0, translate: "0 40px" }, { opacity: 0.9, translate: "0 0" }] } });
	assert.equal(anims.length, 0);
	assert.equal(c.res.style.opacity, "0.9");
	assert.equal(c._scrubProgress, 1);
	assert.equal(c.res.style.getPropertyValue("--progress"), "1.0000");
});

// ── pin ──────────────────────────────────────────────────────────────

test("pin: sticky to the top, followed by a spacer as long as the pin — also under reduced motion", async () => {
	reduce = true;
	render([{ type: "wrap", id: "sec", children: [{ type: "wrap", id: "p", pin: "80vh", children: [] }] }]);
	const p = byId("p");
	assert.equal(p.style.position, "sticky");
	assert.equal(p.style.top, "0px");
	assert.notEqual(p.style.marginBottom, "80vh", "not a margin: sticky confines the margin box, so it would leave no room");
	await flush();
	const spacer = p.nextElementSibling;
	assert.ok(spacer && spacer.hasAttribute("data-nod-pin-spacer"), "the room to stick in");
	assert.equal(spacer.style.height, "80vh");
	assert.equal(spacer.getAttribute("aria-hidden"), "true");
	assert.equal(spacer.textContent, "");
});

test("pin: a page's own top is kept, re-set does not add a second spacer, and the spacer goes on destroy", async () => {
	const c = new Text("x").set({ text: "x", top: "64px", pin: "100px" });
	document.getElementById("mount").appendChild(c.res);
	await flush();
	assert.equal(c.res.style.top, "64px");
	c.set({ text: "x", top: "64px", pin: "100px" });
	await flush();
	assert.equal(document.querySelectorAll("[data-nod-pin-spacer]").length, 1);
	c.destroy();
	assert.equal(document.querySelectorAll("[data-nod-pin-spacer]").length, 0);
});

test("pin variants: {length, media} pins only while its media matches, and comes and goes with it", async () => {
	const q = "(min-width: 900px) and (prefers-motion-test)";
	mediaMatches[q] = false;
	render([{ type: "wrap", id: "sec", children: [{ type: "wrap", id: "p", pin: { length: "200vh", media: q }, children: [] }] }]);
	await flush();
	const p = byId("p");
	assert.notEqual(p.style.position, "sticky", "a phone: no pin");
	assert.equal(document.querySelectorAll("[data-nod-pin-spacer]").length, 0);
	mediaMatches[q] = true; mqls[q].fire(); await flush();
	assert.equal(p.style.position, "sticky");
	assert.equal(p.nextElementSibling.style.height, "200vh");
	mediaMatches[q] = false; mqls[q].fire(); await flush();
	assert.notEqual(p.style.position, "sticky", "unpinned again");
	assert.equal(document.querySelectorAll("[data-nod-pin-spacer]").length, 0, "and its spacer gone");
});

test("pin variants: the first match of an array wins, a variant without media is the fallback, headless takes only that", async () => {
	mediaMatches["(min-width: 1200px)"] = false;
	render([{ type: "wrap", id: "sec", children: [{ type: "wrap", id: "p",
		pin: [{ media: "(min-width: 1200px)", length: "300vh" }, { length: "50vh" }], children: [] }] }]);
	await flush();
	assert.equal(byId("p").nextElementSibling.style.height, "50vh");
	mediaMatches["(min-width: 1200px)"] = true; mqls["(min-width: 1200px)"].fire(); await flush();
	assert.equal(byId("p").nextElementSibling.style.height, "300vh");
	assert.equal(document.querySelectorAll("[data-nod-pin-spacer]").length, 1, "one spacer, not two");
	document.getElementById("mount").innerHTML = "";
	headless();
	render([{ type: "wrap", id: "sec2", children: [{ type: "wrap", id: "q", pin: { length: "200vh", media: "(min-width: 900px)" }, children: [] }] }]);
	await flush();
	assert.notEqual(byId("q").style.position, "sticky", "the prerender cannot ask the media, so it does not pin");
});

test("a scrub over a media pin runs from the pin's range, and a child reads its --progress", async () => {
	const q = "(min-width: 900px)";
	mediaMatches[q] = true;
	render([{ type: "wrap", id: "sec", children: [{ type: "wrap", id: "stage",
		pin: { length: "800px", media: q }, scrub: { from: "pin", to: "pin" }, children: [] }] }]);
	const st = byId("stage");
	rect(st, { top: 1000, height: 800, bottom: 1800 });
	await flush(); runFrames();
	w.scrollY = 1400; w.dispatchEvent(new w.Event("scroll")); runFrames();
	assert.equal(st.style.getPropertyValue("--progress"), "0.5000", "a progress-only scrub: no keyframes needed");
	assert.equal(anims.length, 0);
});

// ── handover from a prerendered copy ────────────────────────────────

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("handover: what the static copy showed on screen is not hidden and played again; content below keeps its entrance", async () => {
	const { beginHandover } = await import("../../lib/handover.js");
	beginHandover();
	render([
		{ type: "h2", id: "seen", text: "On screen", reveal: true },
		{ type: "p", id: "num", text: "256 Ironmanů", count: true },
		{ type: "img", id: "pic", url: "x.jpg", alt: "x", reveal: { mask: "square" } },
		{ type: "h2", id: "below", text: "Further down", reveal: true },
	]);
	rect(byId("seen"), { top: 100, height: 80, bottom: 180 });
	rect(byId("num"), { top: 200, height: 40, bottom: 240 });
	rect(byId("pic"), { top: 300, height: 200, bottom: 500 });
	rect(byId("below"), { top: 2000, height: 80, bottom: 2080 });
	await flush();
	assert.ok(!anims.some((a) => a.el === byId("seen")), "no hold on the heading the visitor is reading");
	assert.equal(byId("num").textContent, "256 Ironmanů", "the figure stays final");
	assert.equal(byId("pic").style.clipPath, "inset(0px 0px)", "the photo stays open");
	assert.equal(byId("pic").style.scale, "1");
	assert.ok(anims.some((a) => a.el === byId("below") && a.paused), "content further down still waits for its entrance");
	await wait(5);
	document.getElementById("mount").innerHTML = "";
	anims = [];
	render([{ type: "h2", id: "later", text: "Later", reveal: true }]);
	rect(byId("later"), { top: 100, height: 80, bottom: 180 });
	await flush();
	assert.ok(anims.some((a) => a.el === byId("later")), "after the handover task, entrances are normal again");
});

// ── slice ────────────────────────────────────────────────────────────

const scrollTo = (y) => { w.scrollY = y; w.dispatchEvent(new w.Event("scroll")); runFrames(); };
/** A box at page offset `top`, moving with the scroll as a laid-out one does. */
const atPage = (el, top, height) => { el.getBoundingClientRect = () => ({ left: 0, right: 100, width: 100, x: 0, top: top - w.scrollY, y: top - w.scrollY, bottom: top + height - w.scrollY, height }); };

test("slice: headless and under reduced motion the text is left plain", async () => {
	headless();
	render([{ type: "h2", id: "t", text: "Pohyb mi", slice: true }]);
	await wait(10);
	assert.equal(byId("t").querySelectorAll("[data-nod-ch]").length, 0);
	document.getElementById("mount").innerHTML = "";
	browser(); reduce = true;
	render([{ type: "h2", id: "u", text: "Pohyb mi", slice: true }]);
	await wait(10);
	assert.equal(byId("u").querySelectorAll("[data-nod-ch]").length, 0);
});

test("slice: letters in slices, the text unchanged, whole words, and the slices follow the scroll", async () => {
	render([{ type: "h2", id: "t", text: "Dal vše", slice: { slices: 2, assemble: 0.3, scatter: 0.7, stagger: 0 } }]);
	const el = byId("t");
	atPage(el, 1000, 200);
	await flush(); runFrames(); await wait(10);
	const letters = [...el.querySelectorAll("[data-nod-ch]")];
	assert.equal(letters.length, 6, "one box per letter, none for the space");
	assert.equal(el.textContent, "Dal vše", "the slices are not elements: the text is the sentence");
	assert.equal(letters[0].getAttribute("data-nod-ch"), "D", "the glyph the ::before / ::after slices draw");
	assert.equal(letters[0].children.length, 1, "one child: the real character");
	const rule = document.querySelector("[data-nod-slice-style]");
	assert.ok(rule && /content:attr\(data-nod-ch\) \/ ""/.test(rule.textContent), "generated slices with empty alt text");
	assert.equal(letters[0].parentNode.style.whiteSpace, "nowrap", "a word never breaks inside");
	const s0 = () => letters[0].style.getPropertyValue("--nod-s0");
	const s1 = () => letters[0].style.getPropertyValue("--nod-s1");
	// enter = 1000 - 800 = 200, exit = 1200 → range 1000.
	scrollTo(200);
	assert.equal(s0(), "translateY(-150.00%)", "at the start the top slice is away, upward");
	assert.equal(s1(), "translateY(150.00%)", "and the bottom one downward");
	scrollTo(700);
	assert.equal(s0(), "", "whole while it is read");
	scrollTo(1200);
	assert.equal(s0(), "translateY(-150.00%)", "broken apart again at the end");
});

test("slice: three slices make the real letter the middle one", async () => {
	render([{ type: "h2", id: "t", text: "ab", slice: { slices: 3, stagger: 0 } }]);
	const el = byId("t");
	atPage(el, 1000, 200);
	await flush(); runFrames(); await wait(10);
	scrollTo(200);
	const real = el.querySelector("[data-nod-ch] > span");
	assert.notEqual(real.style.color, "transparent");
	assert.match(real.style.clipPath, /inset\(33\.333%/);
	assert.match(real.style.transform, /translateY\(/);
});

test("slice: the shuffled order is staggered, scatter: 1 never breaks, and destroy puts the text back", async () => {
	const c = new Text("abcdef").set({ text: "abcdef", slice: { stagger: 0.8, assemble: 0.5, scatter: 1 } });
	document.getElementById("mount").appendChild(c.res);
	const el = c.res;
	atPage(el, 1000, 200);
	await flush(); runFrames(); await wait(10);
	scrollTo(200 + 1000 * 0.5 * 0.5);
	const offs = [...el.querySelectorAll("[data-nod-ch]")].map((b) => b.style.getPropertyValue("--nod-s0"));
	assert.ok(new Set(offs).size > 2, "letters are at different stages mid-way");
	scrollTo(1200);
	assert.ok([...el.querySelectorAll("[data-nod-ch]")].every((b) => b.style.getPropertyValue("--nod-s0") === ""), "scatter: 1 never breaks apart");
	c.destroy();
	assert.equal(el.querySelectorAll("[data-nod-ch]").length, 0);
	assert.equal(el.textContent, "abcdef");
});

// ── count ────────────────────────────────────────────────────────────

test("count: the first number counts up, the screen reader gets the final figure, the text ends identical", async () => {
	render([{ type: "p", id: "n", text: "Over 1,200 teams and 7/7/7", count: { duration: 1000 } }]);
	const t = byId("n");
	const original = t.firstChild;
	await flush();
	const visual = t.querySelector('[aria-hidden="true"]');
	assert.equal(visual.textContent, "0", "starts from 0");
	const sr = visual.nextSibling;
	assert.equal(sr.textContent, "1,200");
	assert.equal(sr.style.position, "absolute");
	observers[0].fire({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 100, bottom: 200, width: 100, height: 100 } });
	runFrames(0);
	runFrames(500);
	assert.match(visual.textContent, /^1,\d{3}$/, "formatted like the original");
	runFrames(1000);
	assert.equal(t.textContent, "Over 1,200 teams and 7/7/7");
	assert.equal(t.firstChild, original, "the very same text node is back");
	assert.equal(t.childNodes.length, 1);
});

test("count keeps decimals and suffixes; no number means no change; reduced motion is immediate", async () => {
	render([{ type: "p", id: "a", text: "99.5% uptime", count: true }]);
	await flush();
	assert.equal(byId("a").querySelector('[aria-hidden="true"]').textContent, "0.0");
	render([{ type: "p", id: "b", text: "No digits here", count: true }]);
	await flush();
	assert.equal(byId("b").innerHTML, "No digits here");
	reduce = true;
	render([{ type: "p", id: "c", text: "15× faster", count: true }]);
	await flush();
	assert.equal(byId("c").innerHTML, "15× faster");
});

// ── fit ──────────────────────────────────────────────────────────────

test("fit scales the font so the text fills the width on one line", async () => {
	const c = new Text("Big").set({ text: "Big", exact: "20px", fit: true });
	document.getElementById("mount").appendChild(c.res);
	Object.defineProperty(c.res, "clientWidth", { value: 600, configurable: true });
	// The text is 10px wide per px of font size.
	const origRange = document.createRange;
	document.createRange = () => ({ selectNodeContents() {}, getBoundingClientRect: () => ({ width: parseFloat(c.res.style.fontSize) * 10 }) });
	try {
		await flush();
		assert.equal(c.res.style.whiteSpace, "nowrap");
		assert.equal(c.res.style.fontSize, "60px");
	} finally {
		document.createRange = origRange;
	}
});

// ── the design-node animation op ─────────────────────────────────────

const ANIM = (fireAt) => ({ op: { name: "animation", ...(fireAt ? { fireAt } : {}),
	keyframesOpen: [{ opacity: 0, transform: "translate(100%)" }, { opacity: 1, transform: "translate(0%)" }],
	keyframesClose: [{ opacity: 1 }, { opacity: 0 }],
	openOptions: { duration: 300, fill: "forwards" } }, target: ["t"] });

test("animation op, fireAt inview, reduced motion: the end state at once, no observer", async () => {
	reduce = true;
	render([{ type: "p", id: "t", text: "Hi" }], [ANIM("inview")]);
	const t = byId("t");
	const mine = anims.filter((a) => a.el === t);
	assert.equal(observers.length, 0);
	assert.ok(mine.length >= 1);
	assert.ok(mine.every((a) => a.opts.duration === 0));
	assert.deepEqual(mine[mine.length - 1].frames[1], { opacity: 1, transform: "translate(0%)" });
});

test("animation op, fireAt inview, normal motion: unchanged — hidden until in view, then plays", async () => {
	// chainReact reads the global, not window's.
	globalThis.IntersectionObserver = w.IntersectionObserver;
	t_cleanup = () => { delete globalThis.IntersectionObserver; };
	render([{ type: "p", id: "t", text: "Hi" }], [ANIM("inview")]);
	const t = byId("t");
	assert.ok(observers.some((o) => o.targets.includes(t)));
	assert.deepEqual(anims.find((a) => a.el === t).frames, ANIM().op.keyframesClose);
});

test("animation op driven by events, reduced motion: same states, switched instantly", async () => {
	reduce = true;
	render([{ type: "p", id: "t", text: "Hi" }], [ANIM(null)]);
	const t = byId("t");
	w.dispatchEvent(new w.Event("sidebar:open"));
	const mine = anims.filter((a) => a.el === t);
	assert.ok(mine.every((a) => a.opts.duration === 0));
	assert.deepEqual(mine[mine.length - 1].frames[0], { opacity: 1, transform: "translate(0%)" });
});

// ── lifecycle ────────────────────────────────────────────────────────

test("destroy() releases the observers and restores split text", async () => {
	const c = new Text("a b").set({ text: "a b", reveal: { by: "word" }, count: true });
	document.getElementById("mount").appendChild(c.res);
	await flush();
	c.destroy();
	assert.ok(observers.every((o) => o.off));
	assert.equal(c.res.querySelectorAll("span").length, 0);
});

test("a re-set without the options tears down what the previous set attached", async () => {
	const c = new Text("x").set({ text: "x", pin: "50px", reveal: true });
	document.getElementById("mount").appendChild(c.res);
	await flush();
	c.set({ text: "x" });
	assert.equal(c.res.style.position, "");
	assert.equal(document.querySelectorAll("[data-nod-pin-spacer]").length, 0);
	assert.ok(observers.every((o) => o.off));
	assert.ok(anims.every((a) => a.cancelled));
});

// ── round trips ──────────────────────────────────────────────────────

test("parse skips a pin's spacer: it is not an element of the page", async () => {
	const { parseHTML, parseReport } = await import("../../lib/parse-html.js");
	const html = '<h1>Title</h1><div aria-hidden="true" data-nod-pin-spacer="" style="height: 80vh"></div>';
	assert.deepEqual(parseHTML(html, document), [{ type: "h1", text: "Title" }]);
	assert.equal(parseReport(html, document).unrecovered.length, 0);
});

test("the options survive the line syntax", async () => {
	const { printLines, parseLines } = await import("../../lib/lines.js");
	const elements = [{ type: "h2", id: "t", text: "Plain data in", reveal: { by: "word", stagger: 60 }, pin: "80vh", count: true, fit: true,
		scrub: [{ media: "(min-width: 768px)", keyframes: [{ opacity: 0 }, { opacity: 1 }], from: "enter", to: "full" }] }];
	assert.deepEqual(parseLines(printLines({ elements, nodes: [] })).elements, elements);
});

test("the validator knows the options on every element type, and their shapes", async () => {
	const { validateNodes } = await import("../../lib/validate-nodes.js");
	const ok = validateNodes([], [{ type: "p", id: "a", text: "1", reveal: true, count: true, fit: true, pin: "80vh",
		scrub: [{ media: "(min-width: 1px)", keyframes: [{ opacity: 0 }, { opacity: 1 }] }] },
		{ type: "wrap", id: "b", reveal: { stagger: 80 }, children: [] }]);
	const codes = [...ok.errors, ...ok.warnings].map((x) => `${x.code}:${x.path || x.param || ""}`);
	assert.deepEqual(codes.filter((c) => /PARAM_NOT_ON_TYPE|BAD_PARAM_VALUE/.test(c)), []);
	const variants = validateNodes([], [{ type: "wrap", id: "v", pin: [{ length: "200vh", media: "(min-width: 900px)" }], children: [] }]);
	assert.deepEqual([...variants.errors, ...variants.warnings].filter((x) => x.code === "BAD_PARAM_VALUE"), [], "pin variants are valid");
	const bad = validateNodes([], [{ type: "p", id: "a", text: "x", pin: 80, reveal: "yes" }]);
	assert.ok([...bad.errors, ...bad.warnings].filter((x) => x.code === "BAD_PARAM_VALUE").length >= 2);
});

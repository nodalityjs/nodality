// video-loop.test.mjs — the ambient-loop shape of the `video` element.
//
// A muted background clip is the one video shape a marketing page actually
// uses, and it is the shape most easily got wrong: an unmuted autoplay is
// blocked outright, a clip left running off screen decodes frames nobody
// sees, and motion shown to someone who asked for less of it is an
// accessibility failure rather than a style choice. Those three behaviours
// are automatic in the component, so they are asserted here rather than
// trusted.
//
// The default shape — `new Video(url)` with controls — is asserted first,
// because pages depend on it and none of this may change it.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Video, dom, played, paused, reduceMotion, observers;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>", { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};

	// jsdom implements neither playback nor an observer, so both are recorded.
	dom.window.HTMLMediaElement.prototype.play = function () { played.push(this); return Promise.resolve(); };
	dom.window.HTMLMediaElement.prototype.pause = function () { paused.push(this); };
	dom.window.matchMedia = (q) => ({
		matches: /prefers-reduced-motion/.test(q) ? reduceMotion : false,
		media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	});
	dom.window.IntersectionObserver = class {
		constructor(cb) { this.cb = cb; this.targets = []; observers.push(this); }
		observe(t) { this.targets.push(t); }
		disconnect() { this.disconnected = true; }
		fire(isIntersecting) { this.cb(this.targets.map((target) => ({ target, isIntersecting }))); }
	};

	({ Video } = await import("../../layout/video.js"));
});

beforeEach(() => { played = []; paused = []; reduceMotion = false; observers = []; });

const loop = (extra = {}) => new Video("/clip.mp4").set({
	autoplay: true, loop: true, controls: false, poster: "/poster.jpg", ...extra,
});

// ── the default shape must not move ──────────────────────────────────

test("a bare Video is still a player with controls", () => {
	const v = new Video("/clip.mp4").set({});
	assert.equal(v.res.getAttribute("src"), "/clip.mp4");
	assert.equal(v.res.hasAttribute("controls"), true);
	assert.equal(v.res.hasAttribute("autoplay"), false);
	assert.equal(played.length, 0);
});

test("the old options still apply", () => {
	const v = new Video("/clip.mp4").set({ width: "50%", radius: 12, opacity: 0.5 });
	assert.equal(v.res.style.width, "50%");
	assert.equal(v.res.style.borderRadius, "12px");
	assert.equal(v.res.style.opacity, "0.5");
});

// ── the loop shape ───────────────────────────────────────────────────

test("autoplay implies muted and playsinline, and starts the clip", () => {
	const v = loop();
	assert.equal(v.res.muted, true, "an unmuted autoplay is blocked by every browser");
	assert.equal(v.res.hasAttribute("muted"), true);
	assert.equal(v.res.hasAttribute("playsinline"), true);
	assert.equal(v.res.hasAttribute("autoplay"), true);
	assert.equal(v.res.hasAttribute("controls"), false);
	assert.equal(v.res.loop, true);
	assert.equal(v.res.getAttribute("poster"), "/poster.jpg");
	// Not playing yet: lazy playback is on by default, so it waits for the
	// element to come on screen. The next test drives that.
	assert.equal(played.length, 0);
});

test("muted: false is honoured, so the block is the author's choice", () => {
	const v = loop({ muted: false });
	assert.equal(v.res.muted, false);
	assert.equal(v.res.hasAttribute("muted"), false);
});

test("several encodings become <source> children, best first, with types inferred", () => {
	const v = new Video("/clip.mp4").set({
		sources: [{ url: "/clip.av1.webm" }, { url: "/clip.hevc.mov", type: "video/mp4; codecs=hvc1" }],
	});
	// A src attribute wins over <source> children, so it must be gone.
	assert.equal(v.res.hasAttribute("src"), false);
	const got = [...v.res.querySelectorAll("source")].map((s) => [s.getAttribute("src"), s.getAttribute("type")]);
	assert.deepEqual(got, [
		["/clip.av1.webm", "video/webm"],
		["/clip.hevc.mov", "video/mp4; codecs=hvc1"],
		["/clip.mp4", 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'],
	], "the constructor url is kept as the last fallback");
});

test("a repeated url is not emitted twice", () => {
	const v = new Video("/clip.mp4").set({ sources: ["/clip.mp4", "/clip.webm"] });
	assert.deepEqual([...v.res.querySelectorAll("source")].map((s) => s.getAttribute("src")),
		["/clip.mp4", "/clip.webm"]);
});

// ── it only plays when it should ─────────────────────────────────────

test("an autoplaying clip waits until it is on screen, and pauses when it leaves", () => {
	const v = loop();
	assert.equal(observers.length, 1, "lazy playback is on by default for autoplay");
	played.length = 0;
	observers[0].fire(true);
	assert.equal(played.length, 1);
	observers[0].fire(false);
	assert.equal(paused.length, 1);
});

test("lazy: false keeps it running off screen", () => {
	loop({ lazy: false });
	assert.equal(observers.length, 0);
	assert.equal(played.length, 1);
});

test("a hidden tab pauses it, and returning resumes it", () => {
	const v = loop();
	observers[0].fire(true);
	played.length = 0; paused.length = 0;
	// Counted per element: components built by earlier tests are still live and
	// still listening, which is correct — each pauses its own clip.
	const mine = (list) => list.filter((el) => el === v.res).length;

	Object.defineProperty(dom.window.document, "hidden", { value: true, configurable: true });
	dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
	assert.equal(mine(paused), 1, "decoding video in a background tab is pure waste");

	Object.defineProperty(dom.window.document, "hidden", { value: false, configurable: true });
	dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
	assert.equal(mine(played), 1);
});

test("reduced motion cancels autoplay and leaves the poster", () => {
	reduceMotion = true;
	const v = loop();
	assert.equal(v.res.hasAttribute("autoplay"), false);
	assert.equal(played.length, 0);
	assert.equal(v.res.getAttribute("poster"), "/poster.jpg", "the still image is what replaces the motion");
	assert.equal(observers.length, 0);
});

test("destroy() releases the observer and the visibility listener", () => {
	const v = loop();
	const io = observers[0];
	v.destroy();
	assert.equal(io.disconnected, true);
	paused.length = 0;
	Object.defineProperty(dom.window.document, "hidden", { value: true, configurable: true });
	dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
	assert.equal(paused.filter((el) => el === v.res).length, 0,
		"a destroyed component must not still be pausing a detached element");
	Object.defineProperty(dom.window.document, "hidden", { value: false, configurable: true });
});

// ── layout and accessibility ─────────────────────────────────────────

test("box options hold the layout before the first frame", () => {
	const v = loop({ aspectRatio: "16 / 9", objectFit: "cover", background: "#0B1B2B", maxWidth: "1200px" });
	assert.equal(v.res.style.aspectRatio, "16 / 9");
	assert.equal(v.res.style.objectFit, "cover");
	assert.equal(v.res.style.background, "rgb(11, 27, 43)");
	assert.equal(v.res.style.maxWidth, "1200px");
});

test("a decorative loop is hidden from assistive tech; a meaningful one is named", () => {
	assert.equal(loop({ decorative: true }).res.getAttribute("aria-hidden"), "true");
	assert.equal(loop({ label: "The case opening" }).res.getAttribute("aria-label"), "The case opening");
});

test("toCode() round-trips the loop options", () => {
	const [code] = loop({ preload: "metadata" }).toCode();
	assert.match(code, /^new Video\("\/clip\.mp4"\)\.set\(/);
	assert.match(code, /autoplay: true/);
	assert.match(code, /preload: "metadata"/);
});

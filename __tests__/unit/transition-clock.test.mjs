// transition-clock.test.mjs — a morph is SEEN, however slow the first frame.
//
// progressTimeline used wall time since to(). Building both views and
// compiling the shader happen between to() and the first frame, and on a
// busy machine they took longer than the whole transition: the first frame
// computed t = 1 and the page arrived without motion. That is also why four
// browser tests ("never caught a mid-morph frame", "a rebuilt reversal
// actually ANIMATES") failed whenever the release machine was loaded.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let progressTimeline, clock = 0, queue = [];

before(async () => {
	Object.defineProperty(globalThis.performance, "now", { value: () => clock, configurable: true });
	globalThis.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
	globalThis.cancelAnimationFrame = () => {};
	({ progressTimeline } = await import("../../lib/transition.js"));
});

const frame = (ms) => { clock += ms; const q = queue; queue = []; q.forEach((cb) => cb()); };
const pipe = () => ({ progress: 0, setProgress(t) { this.progress = t; return t; } });

test("the clock starts at the first frame, not when the transition was asked for", () => {
	const p = pipe();
	const tl = progressTimeline(p, { duration: 900, easing: "linear", respectReducedMotion: false });
	tl.to(1);
	frame(2000);                       // two seconds of setup before the first frame
	assert.equal(p.progress, 0, "the first frame shows the start, not the end");
	frame(16);
	assert.ok(p.progress > 0 && p.progress < 0.05, `then it moves: ${p.progress}`);
});

test("a stalled frame advances it by at most a sixth, so the middle is still shown", () => {
	const p = pipe();
	const tl = progressTimeline(p, { duration: 900, easing: "linear", respectReducedMotion: false });
	tl.to(1);
	frame(16);
	frame(16);
	frame(3000);                       // a three-second hitch mid-way
	assert.ok(p.progress <= (16 + 150) / 900 + 1e-9, `a stall moved it only a sixth: ${p.progress}`);
	let mids = 0;
	for (let i = 0; i < 200 && p.progress < 1; i++) { frame(16); if (p.progress > 0.1 && p.progress < 0.9) mids++; }
	assert.equal(p.progress, 1, "and it still finishes");
	assert.ok(mids > 10, `with frames in the middle: ${mids}`);
});

test("an unhurried run still takes its duration", () => {
	const p = pipe();
	const tl = progressTimeline(p, { duration: 600, easing: "linear", respectReducedMotion: false });
	tl.to(1);
	let frames = 0;
	while (p.progress < 1 && frames < 1000) { frame(16); frames++; }
	// 600 ms at 16 ms a frame is 38 frames, plus the one that starts the clock.
	assert.ok(frames >= 38 && frames <= 40, `took ${frames} frames`);
});

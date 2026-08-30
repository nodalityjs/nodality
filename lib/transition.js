/*!
 * nodality v1.3.0
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * transition.js — driving transition progress. Phase T4.
 *
 * The pipeline already renders any `t` you hand it (phases T1–T3). This
 * module is only about WHERE t comes from: a timeline, a scroll range, a
 * drag, a test. It owns no pixels.
 *
 *     import { progressTimeline } from "nodality/transition";
 *
 *     const tl = progressTimeline(pipeline, { duration: 600 });
 *     tl.to(1);            // play forward
 *     tl.to(0);            // reverse — from wherever it is NOW
 *     tl.bindScroll("#section");
 *     tl.set(0.37);        // deterministic, for tests and gestures
 *
 * The one property everything rests on: **retargeting starts from the
 * current value, never from zero.** Interrupting a half-finished morph
 * and sending it back is `to(0)`, and it continues from 0.5 rather than
 * snapping. That falls out of `t` being an input rather than a timer
 * (P-1) — there is no timeline state to unwind, only a number to move.
 *
 * Duration scales with the distance actually travelled, so a reversal
 * from the midpoint takes half as long as a full play. A fixed duration
 * makes short corrections feel sluggish and is the usual reason
 * interruptible animation feels wrong.
 */

const EASE = {
	linear: (x) => x,
	in: (x) => x * x * x,
	out: (x) => 1 - Math.pow(1 - x, 3),
	"in-out": (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
};

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const prefersReducedMotion = () =>
	typeof window !== "undefined" && typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {{ setProgress(t: number): number, progress: number }} pipeline
 *   anything with the phase-T1 progress surface — a raster pipeline, or a
 *   test double.
 * @param {object} [opts]
 * @param {number} [opts.duration=600] ms for a FULL 0→1 traversal; a
 *   shorter journey takes proportionally less.
 * @param {string} [opts.easing="in-out"]
 * @param {boolean} [opts.respectReducedMotion=true] jump rather than
 *   animate when the user has asked for reduced motion. The transition
 *   still completes — only the motion is removed.
 */
function progressTimeline(pipeline, opts = {}) {
	// A null pipeline is a legitimate, documented state, not a mistake:
	// applyRasterPipeline refuses to attach under prefers-reduced-motion,
	// and returns null headless or without WebGL. Callers should not have
	// to branch on it — the transition still needs to COMPLETE so the app
	// advances, it just completes without pixels. So drive a stub.
	if (!pipeline || typeof pipeline.setProgress !== "function") {
		let v = 0;
		pipeline = { setProgress(t) { v = Math.min(1, Math.max(0, Number(t) || 0)); return v; },
			get progress() { return v; } };
	}
	const duration = opts.duration != null ? opts.duration : 600;
	const easing = EASE[opts.easing] || EASE["in-out"];
	const respectRM = opts.respectReducedMotion !== false;

	let raf = 0;
	let from = pipeline.progress || 0;
	let to = from;
	let startedAt = 0;
	let span = 0;              // ms this particular journey should take
	let running = false;
	let pending = null;        // resolve of the in-flight to()
	let scroll = null;         // { el, onScroll }
	let destroyed = false;

	const settle = () => {
		running = false;
		raf = 0;
		const done = pending;
		pending = null;
		if (done) done(pipeline.progress);
	};

	const frame = () => {
		if (destroyed) return;
		const elapsed = now() - startedAt;
		const x = span <= 0 ? 1 : Math.min(1, elapsed / span);
		pipeline.setProgress(from + (to - from) * easing(x));
		if (x >= 1) return settle();
		raf = requestAnimationFrame(frame);
	};

	const api = {
		get value() { return pipeline.progress; },
		get running() { return running; },

		/** Jump. No animation, no easing — the deterministic entry point. */
		set(t) {
			api.stop();
			pipeline.setProgress(t);
			return pipeline.progress;
		},

		/**
		 * Animate to `target`, STARTING FROM WHEREVER IT IS. Calling this
		 * mid-flight retargets rather than restarting, which is the whole
		 * of interruption and reversal.
		 */
		to(target, o = {}) {
			if (destroyed) return Promise.resolve(pipeline.progress);
			const dest = Math.min(1, Math.max(0, Number(target) || 0));

			// Reduced motion: complete, do not animate. The user asked for
			// no movement, not for a broken navigation.
			if (respectRM && prefersReducedMotion()) {
				api.set(dest);
				return Promise.resolve(dest);
			}

			// Resolve any in-flight promise before replacing it, so an
			// interrupted `await tl.to(1)` does not hang forever.
			if (pending) { const p = pending; pending = null; p(pipeline.progress); }
			if (raf) cancelAnimationFrame(raf);

			from = pipeline.progress;
			to = dest;
			const dist = Math.abs(to - from);
			if (dist < 1e-4) { pipeline.setProgress(dest); return Promise.resolve(dest); }
			// Distance-scaled: a correction from 0.9 to 1 is brief.
			span = (o.duration != null ? o.duration : duration) * dist;
			startedAt = now();
			running = true;
			raf = requestAnimationFrame(frame);
			return new Promise((res) => { pending = res; });
		},

		stop() {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			running = false;
			if (pending) { const p = pending; pending = null; p(pipeline.progress); }
			return pipeline.progress;
		},

		/**
		 * Scrub `t` from how far `el` has travelled through the viewport.
		 * Same mapping as the `scroll` driver so the two agree.
		 */
		bindScroll(el, o = {}) {
			const node = typeof el === "string" ? document.querySelector(el) : el;
			if (!node) return api;
			api.unbindScroll();
			api.stop();
			const start = o.start != null ? o.start : 0;
			const end = o.end != null ? o.end : 1;
			const update = () => {
				if (destroyed) return;
				const r = node.getBoundingClientRect();
				const vh = window.innerHeight || 1;
				// 0 when the element's top reaches the bottom of the
				// viewport, 1 when its bottom reaches the top.
				const raw = (vh - r.top) / (vh + r.height || 1);
				const p = (Math.min(1, Math.max(0, raw)) - start) / ((end - start) || 1);
				pipeline.setProgress(Math.min(1, Math.max(0, p)));
			};
			scroll = { node, update };
			window.addEventListener("scroll", update, { passive: true });
			window.addEventListener("resize", update, { passive: true });
			update();
			return api;
		},

		unbindScroll() {
			if (!scroll) return api;
			window.removeEventListener("scroll", scroll.update);
			window.removeEventListener("resize", scroll.update);
			scroll = null;
			return api;
		},

		/**
		 * Drive from any 0..1 source — a drag, a slider, a gesture. The
		 * caller owns the source; this just forwards it.
		 */
		drive(value) { return api.set(value); },

		destroy() {
			destroyed = true;
			api.stop();
			api.unbindScroll();
		},
	};

	return api;
}

export { progressTimeline, EASE as TIMELINE_EASINGS, prefersReducedMotion };

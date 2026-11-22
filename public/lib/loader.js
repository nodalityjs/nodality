// Loader — a page's loading state, as data:
//
//   new Des().nodes(N).add(E).set({ mount: "#mount",
//     loader: { text: "Petr Vabroušek", background: "#000", color: "#fff", accent: "#EBFE00" } })
//
// A prerendered page shows its static copy before the bundle arrives; then
// the live tree takes over and every entrance (reveal, the image mask,
// count) hides what the visitor was already looking at and plays it in
// again. The loader is the curtain over that handover: it is in the
// prerendered HTML, so it covers the page from the first paint; it lifts
// once the page is ready — the live tree mounted, the web fonts loaded and
// the images on screen decoded, but never sooner than `minTime` nor later
// than `maxTime` — and only THEN do the entrances start.
//
// Content is never locked away. The static curtain carries a CSS-only
// failsafe: if no script takes it over (no JavaScript, a failed bundle) it
// fades by itself after `failsafe` ms. A script that arrives after that does
// not bring it back.
//
// While the curtain is down, an entrance that would start waits for it
// (afterLoader); motion that follows the scroll position (scrub, pin) is
// unaffected. Under reduced motion the curtain fades instead of sliding.

const KEY = "__NODALITY_LOADER__";
const win = () => (typeof window !== "undefined" ? window : null);

/** Is a loader still covering the page? */
export function loaderPending() {
	const w = win();
	return !!(w && w[KEY] && !w[KEY].done);
}

/** Run `fn` now, or once the loader has started to lift. */
export function afterLoader(fn) {
	const w = win();
	if (!loaderPending()) { fn(); return; }
	w[KEY].promise.then(fn);
}

const num = (v, d) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? d : Number(v));

function styleRules(failsafe) {
	return [
		"[data-nod-loader]{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;",
		`animation:nod-loader-failsafe .5s ease ${failsafe}ms forwards}`,
		"@keyframes nod-loader-failsafe{to{opacity:0;visibility:hidden}}",
		"[data-nod-loader-bar]{width:min(220px,50vw);height:2px;transform-origin:0 50%;animation:nod-loader-bar 2.4s cubic-bezier(.2,.7,.2,1) forwards}",
		"@keyframes nod-loader-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}",
		"@media (prefers-reduced-motion: reduce){[data-nod-loader-bar]{animation:none}}",
	].join("");
}

function build(doc, o) {
	const el = doc.createElement("div");
	el.setAttribute("data-nod-loader", "");
	// Decoration: the page's own content is in the document underneath.
	el.setAttribute("aria-hidden", "true");
	el.style.background = o.background;
	el.style.color = o.color;
	if (o.text) {
		const t = doc.createElement("p");
		t.textContent = o.text;
		Object.assign(t.style, { margin: "0", fontFamily: o.font, fontWeight: String(o.weight), fontSize: o.size,
			letterSpacing: o.letterSpacing, textTransform: o.textTransform });
		el.appendChild(t);
	}
	const bar = doc.createElement("div");
	bar.setAttribute("data-nod-loader-bar", "");
	bar.style.background = o.accent;
	el.appendChild(bar);
	return el;
}

function addStyle(doc, failsafe) {
	if (!doc.head || doc.querySelector("style[data-nod-loader-style]")) return;
	const st = doc.createElement("style");
	st.setAttribute("data-nod-loader-style", "");
	st.textContent = styleRules(failsafe);
	doc.head.appendChild(st);
}

/** Images inside `root` that are on screen now and not decoded yet. */
function pendingImages(root, vh) {
	if (!root || typeof root.querySelectorAll !== "function") return [];
	return Array.from(root.querySelectorAll("img")).filter((img) => {
		if (img.complete) return false;
		const r = img.getBoundingClientRect();
		return r.bottom > 0 && r.top < vh && (r.width || r.height);
	});
}

/**
 * Put the curtain up (or take over the one the prerendered HTML carries) and
 * lift it when the page is ready. `root` is the mounted page.
 */
export function installLoader(spec, root) {
	const w = win();
	if (!w || typeof document === "undefined") return;
	const o = spec && typeof spec === "object" ? spec : {};
	const opts = {
		text: o.text ?? "",
		background: o.background ?? "#000",
		color: o.color ?? "#fff",
		accent: o.accent ?? (o.color ?? "#fff"),
		font: o.font ?? "inherit",
		weight: o.weight ?? 800,
		size: o.size ?? "clamp(20px, 2.4vw, 32px)",
		letterSpacing: o.letterSpacing ?? "0.02em",
		textTransform: o.textTransform ?? "uppercase",
	};
	const minTime = num(o.minTime, 400);
	const maxTime = num(o.maxTime, 2500);
	const failsafe = num(o.failsafe, 3500);
	const duration = num(o.duration, 800);
	const doc = document;

	addStyle(doc, failsafe);
	let curtain = doc.querySelector("[data-nod-loader]");

	// Prerender: the curtain goes into the saved HTML and stays down there.
	if (w.__NODALITY_PRERENDER__) {
		if (!curtain && doc.body) doc.body.insertBefore(build(doc, opts), doc.body.firstChild);
		return;
	}

	// The static curtain already faded (its failsafe ran: the bundle came
	// late). Do not bring it back.
	// Milliseconds since the navigation started.
	const clock = () => (w.performance && typeof w.performance.now === "function" ? w.performance.now() : 0);
	const now = clock();
	if (curtain && (now >= failsafe || (w.getComputedStyle && w.getComputedStyle(curtain).visibility === "hidden"))) {
		curtain.remove();
		return;
	}
	if (!curtain) {
		if (!doc.body) return;
		curtain = build(doc, opts);
		doc.body.insertBefore(curtain, doc.body.firstChild);
	}
	// Taken over: the script decides when it goes, not the failsafe.
	curtain.style.animation = "none";

	let resolve;
	const state = { done: false, promise: new Promise((r) => { resolve = r; }) };
	w[KEY] = state;

	const start = now;
	const vh = w.innerHeight || 0;
	const waits = [];
	if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === "function") waits.push(doc.fonts.ready);
	for (const img of pendingImages(root, vh)) {
		waits.push(new Promise((r) => {
			img.addEventListener("load", r, { once: true });
			img.addEventListener("error", r, { once: true });
		}));
	}
	const ready = Promise.all(waits).then(() => {}, () => {});
	// maxTime counts from the navigation, not from this call: a bundle that
	// took two seconds has already used most of it.
	const cap = Math.max(minTime, maxTime - now);
	const capped = Promise.race([ready, new Promise((r) => setTimeout(r, cap))]);

	let lifted = false;
	const lift = () => {
		if (lifted) return;
		lifted = true;
		const reduce = typeof w.matchMedia === "function" && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const frames = reduce ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }];
		const d = reduce ? 200 : duration;
		const finish = () => { curtain.remove(); };
		// The entrances start while the curtain is still rising, so the page
		// is already moving as it comes into view.
		setTimeout(() => { state.done = true; resolve(); }, reduce ? 0 : Math.round(d * 0.35));
		if (typeof curtain.animate === "function") {
			const a = curtain.animate(frames, { duration: d, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards" });
			a.finished.then(finish, finish);
		} else finish();
	};
	capped.then(() => setTimeout(lift, Math.max(0, minTime - (clock() - start))));
	// Never a curtain that cannot lift.
	setTimeout(lift, cap + 50);
}

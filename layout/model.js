/*!
 * nodality v1.5.10
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";
import { optionsSource, reducedMotion, mediaMatches, applyDesignOps } from "./element-kit.js";
import { jsString } from "../lib/codegen.js";

// Model — a 3D model (glTF / GLB), rendered by Google's <model-viewer>.
//@ model.src {url}: The same as `url` — the name HTML uses.
//
// Nodality stays zero-dependency, so it does not ship model-viewer: the page
// provides it. Either give `loader` (the URL of model-viewer.min.js, served by
// the site), and it is loaded once per page as a module script if the element
// is not already defined; or include the script in the page yourself.
//
// What this adds over writing <model-viewer> by hand is the camera as DATA:
//
//   camera       a static camera: { theta, phi, radius, fov, target, shift }
//   cameraScrub  a camera that follows the element's scroll progress through
//                keyframes, from the moment the element starts to enter the
//                viewport (progress 0) until it is fully in view (progress 1;
//                or its top reaches the top of the viewport, if it is taller).
//
// Camera units: theta (azimuth) and phi (polar) in degrees, radius in metres,
// fov in degrees, target [x, y, z] in metres (model space), and `shift` — a
// horizontal screen-space offset in model units: positive moves the model to
// the RIGHT on screen. It is applied by moving the target against the
// camera's own right vector, (cos θ, 0, −sin θ) at azimuth θ, so it stays a
// screen-space shift whichever way the camera has turned.
//
// Every camera component interpolates numerically, each with its own easing
// if you want: the tuned bike scroll this was built for turns linearly while
// zooming on a smoothstep. Media variants pick a different set of keyframes by
// viewport (the phone ends on a wider fov and does not shift).
//
// prefers-reduced-motion: the LAST keyframe is used and no scroll listener is
// attached — the visitor sees the composed end shot, still.
//
// Camera values are written as ATTRIBUTES (camera-orbit, camera-target,
// field-of-view), never as properties. Before model-viewer's script has run
// the element is a plain HTMLElement, and a property set then would shadow the
// accessor the upgrade installs; an attribute is read by the upgrade.

const CAMERA_KEYS = ["theta", "phi", "radius", "fov", "shift"];
const num = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

const EASINGS = {
	linear: (t) => t,
	smooth: (t) => t * t * (3 - 2 * t),          // smoothstep
	easeIn: (t) => t * t,
	easeOut: (t) => 1 - (1 - t) * (1 - t),
	easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};
const easingFn = (name) => {
	if (typeof name === "function") return name;
	const key = String(name || "linear").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
	return EASINGS[key] || EASINGS.linear;
};

/** The easing for one camera component: a string for all, or {default, theta, …}. */
const easingFor = (spec, key) => {
	if (spec && typeof spec === "object") return easingFn(spec[key] ?? spec.default ?? "linear");
	return easingFn(spec);
};

/** cameraScrub, object or array, as a list of { media, keyframes, easing, trigger }. */
export function scrubVariants(spec) {
	if (!spec) return [];
	const list = Array.isArray(spec) ? spec : [spec];
	const shared = Array.isArray(spec) ? {} : spec;
	return list.filter((v) => v && Array.isArray(v.keyframes) && v.keyframes.length).map((v) => ({
		media: v.media,
		keyframes: v.keyframes,
		easing: v.easing ?? shared.easing,
		trigger: v.trigger ?? shared.trigger,
	}));
}

/** Each keyframe filled in from the ones before it (and the static camera), with its position 0–1. */
function resolveKeyframes(keyframes, base) {
	const n = keyframes.length;
	let prev = { ...(base || {}) };
	const out = keyframes.map((kf, i) => {
		const r = { ...prev, ...kf };
		r.at = num(kf.at) ? clamp01(kf.at) : (n > 1 ? i / (n - 1) : 0);
		prev = r;
		return r;
	});
	return out.sort((a, b) => a.at - b.at);
}

/** The camera at progress p (0–1) through resolved keyframes. */
export function cameraAt(resolved, p, easing) {
	if (!resolved.length) return null;
	if (resolved.length === 1 || p <= resolved[0].at) return { ...resolved[0] };
	const last = resolved[resolved.length - 1];
	if (p >= last.at) return { ...last };
	let j = 0;
	while (j < resolved.length - 2 && p > resolved[j + 1].at) j++;
	const a = resolved[j], b = resolved[j + 1];
	const t = b.at > a.at ? clamp01((p - a.at) / (b.at - a.at)) : 1;
	const out = {};
	for (const key of CAMERA_KEYS) {
		if (num(a[key]) && num(b[key])) out[key] = lerp(a[key], b[key], easingFor(easing, key)(t));
		else out[key] = t < 1 ? (a[key] ?? b[key]) : (b[key] ?? a[key]);
	}
	if (Array.isArray(a.target) && Array.isArray(b.target) && a.target.length === 3 && b.target.length === 3
		&& a.target.every(num) && b.target.every(num)) {
		const e = easingFor(easing, "target")(t);
		out.target = a.target.map((v, i) => lerp(v, b.target[i], e));
	} else {
		out.target = t < 1 ? (a.target ?? b.target) : (b.target ?? a.target);
	}
	return out;
}

/** A camera as model-viewer attribute values. Missing parts get model-viewer's own defaults. */
export function cameraAttributes(c) {
	if (!c) return null;
	const deg = (v, dflt) => (num(v) ? `${v}deg` : typeof v === "string" && v ? v : dflt);
	const theta = num(c.theta) ? c.theta : null;
	const orbit = `${deg(c.theta, "0deg")} ${deg(c.phi, "75deg")} ${num(c.radius) ? `${c.radius}m` : (typeof c.radius === "string" && c.radius ? c.radius : "105%")}`;
	let target = "auto auto auto";
	if (Array.isArray(c.target) && c.target.length === 3 && c.target.every(num)) {
		const t = [...c.target];
		// Screen-right at azimuth θ is (cos θ, 0, −sin θ). Moving the target
		// LEFT by `shift` moves the model RIGHT on screen by the same amount.
		if (num(c.shift) && c.shift !== 0) {
			const rad = ((theta ?? 0) * Math.PI) / 180;
			t[0] -= c.shift * Math.cos(rad);
			t[2] += c.shift * Math.sin(rad);
		}
		target = t.map((v) => `${+v.toFixed(5)}m`).join(" ");
	} else if (typeof c.target === "string" && c.target) {
		target = c.target;
	}
	return { "camera-orbit": orbit, "camera-target": target, "field-of-view": deg(c.fov, "auto") };
}

/**
 * Scroll progress of `el`: 0 when its top edge reaches the bottom of the
 * viewport, 1 when all of it is in view (or its top reaches the top of the
 * viewport, if it is taller than the viewport). null when it has no layout.
 */
export function enterProgress(el, viewportHeight) {
	if (!el || typeof el.getBoundingClientRect !== "function") return null;
	const r = el.getBoundingClientRect();
	const vh = viewportHeight;
	if (!r || !(r.height > 0) || !(vh > 0)) return null;
	const endTop = Math.max(vh - r.height, 0);
	const span = vh - endTop;
	if (!(span > 0)) return r.top < vh ? 1 : 0;
	return clamp01((vh - r.top) / span);
}

let warnedNoLoader = false;

function setDecoderLocation(url) {
	if (typeof window === "undefined" || !url) return;
	const ce = window.customElements;
	const Defined = ce && typeof ce.get === "function" ? ce.get("model-viewer") : null;
	if (Defined) {
		// A static setter on ModelViewerElement; it applies to every model
		// decoded from now on.
		try { Defined.meshoptDecoderLocation = url; } catch (e) { /* older model-viewer */ }
	} else {
		// Read by model-viewer when its script runs, so it has to be in place
		// BEFORE the loader below is attached.
		window.ModelViewerElement = Object.assign(window.ModelViewerElement || {}, { meshoptDecoderLocation: url });
	}
}

function ensureLoader(url) {
	if (typeof document === "undefined" || !url) return;
	const ce = typeof window !== "undefined" ? window.customElements : null;
	if (ce && typeof ce.get === "function" && ce.get("model-viewer")) return;
	// Once per page: whether we added it or the page did.
	for (const s of document.querySelectorAll("script[src]")) if (s.getAttribute("src") === url) return;
	const s = document.createElement("script");
	s.setAttribute("type", "module");
	s.setAttribute("src", url);
	(document.head || document.documentElement).appendChild(s);
}

class Model extends Animator {
	constructor(url) {
		super();
		this.url = url;
		this.options = {};
		this._subs = [];
		this._scrubProgress = null;
		this._raf = 0;
		this.setup();
	}

	setup() {
		const mv = document.createElement("model-viewer");
		if (this.url != null) mv.setAttribute("src", this.url);
		mv.style.display = "block";
		mv.style.width = "100%";
		mv.style.height = "400px";
		this.res = mv;
		return this;
	}

	getType() { return "LayoutWrapperElement"; }

	set(obj = {}) {
		this.options = obj;
		// What the author gave, for toCode: applyDesignOps may put a shadow
		// NODE into this.options.shadow, where this type's own `shadow` lives.
		this._given = obj;
		const mv = this.res;
		const attr = (name, v) => (v == null || v === false ? mv.removeAttribute(name) : mv.setAttribute(name, v === true ? "" : String(v)));

		//@ model.url {url}: The .glb / .gltf file. Required. `src` is accepted as the same thing.
		//@ model.decoderLocation {url}: Where the meshopt decoder is served from, for models compressed with meshopt (gltfpack -c). Set before the model loads; without it model-viewer fetches the decoder from its CDN.
		obj.decoderLocation && setDecoderLocation(obj.decoderLocation);

		//@ model.loader {url}: URL of model-viewer.min.js, served by the site. Loaded once per page as a module script, only if <model-viewer> is not defined yet. Omit it when the page includes the script itself.
		if (obj.loader) ensureLoader(obj.loader);
		else if (!warnedNoLoader && typeof window !== "undefined" && typeof document !== "undefined") {
			const ce = window.customElements;
			const defined = ce && typeof ce.get === "function" && ce.get("model-viewer");
			if (!defined && !document.querySelector('script[src*="model-viewer"]')) {
				warnedNoLoader = true;
				console.warn('[nodality] a "model" element needs <model-viewer>: give `loader: "/path/to/model-viewer.min.js"` or include the script in the page.');
			}
		}

		//@ model.alt {text}: What the model shows, for people who cannot see it — the accessible name. Always give one.
		if (obj.alt != null && obj.alt !== "") attr("alt", obj.alt);
		else console.warn(`[nodality] "model"${obj.id ? ` (id "${obj.id}")` : ""} has no \`alt\`: a screen reader gets nothing for it.`);

		//@ model.poster {url}: Image shown until the model has loaded.
		attr("poster", obj.poster);
		// Something to see before model-viewer's script has run (and in the
		// prerendered HTML): an undefined <model-viewer> is an unknown element
		// and shows none of its attributes, the poster included. Its light-DOM
		// `poster` slot is what model-viewer shows until the model loads and
		// then hides itself, so the fallback costs nothing once it is running.
		// A poster image when there is one, else the alt text.
		this._posterFallback(obj.poster, obj.alt);
		//@ model.posterColor {color}: Colour behind the poster / before load. Default "transparent", so the section's own background shows.
		mv.style.setProperty("--poster-color", obj.posterColor || "transparent");
		//@ model.exposure {px-number}: Brightness of the render; 1 is neutral.
		attr("exposure", obj.exposure);
		//@ model.environment {text}: Lighting: "neutral", "legacy", or the URL of an HDR environment image.
		attr("environment-image", obj.environment);
		//@ model.shadow {ratio}: Ground shadow strength 0–1; true is 1.
		attr("shadow-intensity", obj.shadow === true ? 1 : obj.shadow);
		//@ model.loading {enum(auto|lazy|eager)}: When to load the model. "lazy" waits until it is near the viewport.
		attr("loading", obj.loading);
		//@ model.interpolationDecay {px-number}: How quickly the camera catches up with a change, in model-viewer's units (default 50; higher is snappier). The bike uses 80.
		attr("interpolation-decay", obj.interpolationDecay);

		//@ model.interactive {bool}: Let the visitor orbit and zoom (camera-controls; keyboard arrows work when it has focus). Default false: no controls, no interaction prompt, and pointer events pass through to the page.
		this.interactive = !!obj.interactive;
		if (this.interactive) {
			attr("camera-controls", true);
			attr("interaction-prompt", null);
			attr("disable-zoom", null);
			attr("disable-pan", null);
			mv.style.pointerEvents = "";
			mv.style.touchAction = "pan-y";
		} else {
			attr("camera-controls", null);
			attr("interaction-prompt", "none");
			attr("disable-zoom", true);
			attr("disable-pan", true);
			mv.style.pointerEvents = "none";
		}

		// The style options go after the defaults above, so `pointerEvents`,
		// `width`, `height` given by the author win.
		this.commonMethods(obj);

		//@ model.camera {object}: A static camera: { theta, phi, radius, fov, target: [x, y, z], shift }. Degrees, metres, model units; `shift` > 0 moves the model right on screen (needs a numeric target).
		this.camera = obj.camera && typeof obj.camera === "object" ? obj.camera : null;
		//@ model.cameraScrub: A camera that follows scroll: { keyframes: [camera, …], easing, media?, trigger? } — or an array of those, the first whose `media` matches wins. Progress runs from the element entering the viewport (0) to fully in view (1). `easing`: "linear" | "smooth" | "easeIn" | "easeOut" | "easeInOut", or per component { default, theta, phi, radius, fov, target, shift }. `trigger`: "parent" or a selector whose scroll progress drives it instead of the model's own box. Reduced motion uses the last keyframe.
		this.variants = scrubVariants(obj.cameraScrub);
		this._resolved = new Map();

		this._fovLimits();
		//@ model.radiusLimit: What bounds the camera distance. "data" (the default whenever a camera or keyframe names a numeric `radius`): the orbit limits are written from the data — min/max-camera-orbit radius = the smallest/largest radius named, polar limits widened to any `phi` outside 22.5°–157.5° — so every keyframe is reached exactly, on every screen. "auto": model-viewer's own load-time limit (it frames the model for the element's size, so on a narrow element the camera can stop short — e.g. 29.46 m for 40 m), re-framed on resize. Or [min, max] in metres. With "data" an interactive viewer can zoom only between those radii; pass "auto" or `attributes` to change that.
		this._radiusLimits(obj.radiusLimit);

		//@ model.attributes {object}: Any other <model-viewer> attributes, verbatim: {"min-camera-orbit": "auto 60deg auto", "ar": true}. Applied last, so they override what the options above set.
		if (obj.attributes && typeof obj.attributes === "object") {
			for (const [k, v] of Object.entries(obj.attributes)) attr(k, v);
		}

		applyDesignOps(this, obj);
		this._startCamera();
		return this;
	}

	_posterFallback(poster, alt) {
		const mv = this.res;
		const prev = mv.querySelector(':scope > [slot="poster"][data-nod-poster]');
		if (prev) prev.remove();
		let node = null;
		if (poster) {
			node = document.createElement("img");
			node.setAttribute("src", String(poster));
			// Before the upgrade <model-viewer> is an unknown element whose
			// `alt` names nothing; the picture carries the name until then.
			node.setAttribute("alt", alt != null ? String(alt) : "");
			node.style.width = "100%";
			node.style.height = "100%";
			node.style.objectFit = "contain";
		} else if (alt != null && alt !== "") {
			node = document.createElement("span");
			node.textContent = String(alt);
			node.style.display = "flex";
			node.style.alignItems = "center";
			node.style.justifyContent = "center";
			node.style.width = "100%";
			node.style.height = "100%";
			node.style.textAlign = "center";
		}
		if (!node) return;
		node.setAttribute("slot", "poster");
		node.setAttribute("data-nod-poster", "");
		mv.appendChild(node);
	}

	// model-viewer clamps field-of-view to [min-field-of-view, max-field-of-view]
	// — 25° to 45° by default — so a zoom to 8° silently stops at 25°. Widen
	// the limits to cover every fov the data names (never narrow them: that
	// would change what an interactive viewer lets the visitor do).
	_fovLimits() {
		const fovs = [];
		if (this.camera && num(this.camera.fov)) fovs.push(this.camera.fov);
		for (const v of this.variants) for (const k of v.keyframes) if (k && num(k.fov)) fovs.push(k.fov);
		if (!fovs.length) return;
		const lo = Math.min(...fovs), hi = Math.max(...fovs);
		if (lo < 25) this.res.setAttribute("min-field-of-view", `${lo}deg`);
		if (hi > 45) this.res.setAttribute("max-field-of-view", `${hi}deg`);
	}

	// model-viewer clamps the camera radius to [min, max]-camera-orbit, and
	// the default for both is `auto`: a distance it computes ONCE, when the
	// model loads, from the model's size and the element's aspect ratio. On a
	// narrow element that limit is short, so a keyframe at 40 m silently
	// stopped at ~29.46 m — and a camera that is data should go where the data
	// says. The limits are therefore written from the data ("data"), or left
	// to model-viewer and re-framed on resize ("auto"), or given in metres.
	_radiusLimits(spec) {
		const mv = this.res;
		this._autoFraming = false;
		const radii = [], phis = [];
		const take = (c) => {
			if (!c || typeof c !== "object") return;
			if (num(c.radius)) radii.push(c.radius);
			if (num(c.phi)) phis.push(c.phi);
		};
		take(this.camera);
		for (const v of this.variants) for (const k of v.keyframes) take(k);
		let lo = null, hi = null;
		if (Array.isArray(spec) && spec.length === 2 && spec.every((v) => num(v) || v == null)) {
			lo = num(spec[0]) ? spec[0] : null;
			hi = num(spec[1]) ? spec[1] : null;
		} else if (spec === "auto") {
			this._autoFraming = radii.length > 0;
			return;
		} else if (radii.length) {
			lo = Math.min(...radii);
			hi = Math.max(...radii);
		} else {
			return; // nothing named: model-viewer's defaults, untouched
		}
		const pLo = phis.length ? Math.min(22.5, ...phis) : 22.5;
		const pHi = phis.length ? Math.max(157.5, ...phis) : 157.5;
		mv.setAttribute("min-camera-orbit", `-Infinity ${pLo}deg ${lo == null ? "auto" : `${lo}m`}`);
		mv.setAttribute("max-camera-orbit", `Infinity ${pHi}deg ${hi == null ? "auto" : `${hi}m`}`);
	}

	/** model-viewer's framing for the element's current size ("auto" limits only). */
	_reframe() {
		if (!this._autoFraming || this._destroyed) return;
		const mv = this.res;
		if (mv && typeof mv.updateFraming === "function") {
			try {
				const done = mv.updateFraming();
				// The camera is re-applied once the new limits are in.
				if (done && typeof done.then === "function") done.then(() => this.update(), () => {});
			} catch (e) { /* not loaded yet */ }
		}
	}

	_variant() {
		return this.variants.find((v) => mediaMatches(v.media)) || null;
	}

	_framesOf(v) {
		if (!this._resolved.has(v)) this._resolved.set(v, resolveKeyframes(v.keyframes, this.camera));
		return this._resolved.get(v);
	}

	_triggerOf(v) {
		const t = v && v.trigger;
		if (t === "parent") return this.res.parentElement || this.res;
		if (typeof t === "string" && t) {
			try { return document.querySelector(t) || this.res; } catch (e) { return this.res; }
		}
		if (t && t.nodeType === 1) return t;
		return this.res;
	}

	_applyCamera(c) {
		const a = cameraAttributes(c);
		if (!a) return;
		for (const [k, v] of Object.entries(a)) {
			if (this.res.getAttribute(k) !== v) this.res.setAttribute(k, v);
		}
	}

	_startCamera() {
		if (!this.variants.length) {
			if (this.camera) this._applyCamera(this.camera);
			if (this._autoFraming && typeof window !== "undefined" && !this._wiredFraming) {
				this._wiredFraming = true;
				this._on(window, "resize", () => this._reframe());
				this._on(this.res, "load", () => this._reframe());
			}
			return;
		}
		this.reduced = reducedMotion();
		// The first frame is written now, so a prerendered page (and the moment
		// before the first scroll) shows the starting shot rather than
		// model-viewer's default orbit.
		const v = this._variant();
		if (v) {
			const frames = this._framesOf(v);
			this._applyCamera(cameraAt(frames, this.reduced ? 1 : 0, v.easing));
		}
		if (typeof window === "undefined" || this._wired) return;
		this._wired = true;
		const W = window;
		if (!this.reduced) {
			this._on(W, "scroll", () => this._schedule(), { passive: true });
		}
		// A resize can change the variant (phone ↔ desktop) and the progress.
		this._on(W, "resize", () => { this._reframe(); this.update(); });
		this._on(this.res, "load", () => { this._reframe(); this.update(); });
		const first = setTimeout(() => this.update(), 0);
		this._track(() => clearTimeout(first));
	}

	_schedule() {
		if (this._raf || this._destroyed) return;
		const raf = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : null;
		if (!raf) { this.update(); return; }
		this._raf = raf(() => { this._raf = 0; this.update(); }) || 0;
		if (this._raf && !this._rafTracked) {
			this._rafTracked = true;
			this._track(() => { if (this._raf && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(this._raf); this._raf = 0; });
		}
	}

	/** Recompute the scroll progress and move the camera. */
	update() {
		if (this._destroyed) return this;
		const v = this._variant();
		if (!v) return this;
		const p = this.reduced ? 1 : enterProgress(this._triggerOf(v), typeof window !== "undefined" ? window.innerHeight : 0);
		// No layout yet (headless, display:none): keep the shot already shown.
		if (p == null) return this;
		this._scrubProgress = p;
		this._applyCamera(cameraAt(this._framesOf(v), p, v.easing));
		for (const fn of this._subs) { try { fn(p); } catch (e) { console.warn("[nodality] onScrubProgress listener threw:", e); } }
		return this;
	}

	/**
	 * Be told the camera's scroll progress (0–1) whenever it changes — the same
	 * shape as the `scrub` behaviour's hook, so page code can drive other
	 * things from the model's progress.
	 */
	onScrubProgress(fn) {
		if (typeof fn !== "function") return this;
		this._subs.push(fn);
		if (this._scrubProgress != null) fn(this._scrubProgress);
		return this;
	}

	destroy() {
		this._destroyed = true;
		this._subs.length = 0;
		return super.destroy();
	}

	toCode(indent = 0) {
		const pad = " ".repeat(indent);
		return [`${pad}new Model(${jsString(this.url)}).set(${optionsSource(this._given || this.options)})`];
	}

	render(el) {
		if (el) {
			document.querySelector(el)?.appendChild(this.res);
			return this;
		}
		return this.res;
	}
}

export { Model };

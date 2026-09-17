import { Animator } from "./animator.js";
import { toObjectSource } from "../lib/codegen.js";

// Video — a <video> element as data.
//
// Two shapes, because the web has two:
//
//   a player      { url, controls: true }            — the default, unchanged
//   an ambient loop
//                 { sources: [...], autoplay: true, loop: true,
//                   muted: true, playsinline: true, controls: false }
//
// The loop shape is the one this component grew for. It carries the things a
// muted background clip cannot work without and that a page should not have to
// reach into the DOM to set: the playback attributes, several encodings behind
// one element, a poster to hold the layout while bytes arrive, playback that
// only runs while the element is on screen, and a still image instead of
// motion for anyone who has asked for less of it.
//
// Three behaviours are automatic, because getting them wrong is the norm:
//
//   • `autoplay` implies `muted`. Every browser blocks an unmuted autoplay,
//     and a clip that silently refuses to start is the hardest kind of bug to
//     see. Pass `muted: false` explicitly to override and accept the block.
//   • An autoplaying clip is paused while off screen and while the tab is
//     hidden, and resumes when it comes back. Decoding video nobody is looking
//     at is the single most expensive thing an ambient loop can do.
//   • `prefers-reduced-motion: reduce` cancels autoplay and leaves the poster
//     showing. The clip is still playable if it has controls.

const isPlayable = (v) => v && typeof v.play === "function";

// Enough to save callers writing the MIME type for the formats a site ships.
const MIME = {
	mp4: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
	m4v: "video/mp4",
	mov: "video/quicktime",
	webm: "video/webm",
	ogv: "video/ogg",
	ogg: "video/ogg",
};

const typeFor = (url) => {
	const ext = String(url || "").split("?")[0].split("#")[0].split(".").pop().toLowerCase();
	return MIME[ext] || "";
};

class Video extends Animator {
	constructor(url) {
		super();
		this.url = url;
		this.options = {};
		this.res = null;
		this.setup();
	}

	setup() {
		const el = document.createElement("video");
		if (this.url != null) el.setAttribute("src", this.url);
		// Controls stay on by default: a bare `new Video(url)` has always been
		// a player, and pages depend on that. `controls: false` opts out.
		el.setAttribute("controls", "controls");
		this.res = el;
		return this;
	}

	set(obj = {}) {
		this.options = obj;
		const v = this.res;

		//@ video.sources: Several encodings of the same clip: [{url, type}] or plain url strings. The browser picks the first it can play, so order best-first (AV1, then HEVC, then H.264). `type` is inferred from the extension when omitted.
		if (Array.isArray(obj.sources) && obj.sources.length) {
			// A `src` attribute wins over <source> children, so it has to go.
			v.removeAttribute("src");
			for (const child of [...v.querySelectorAll("source")]) child.remove();
			const list = obj.sources.concat(this.url != null ? [this.url] : []);
			const seen = new Set();
			for (const entry of list) {
				const url = typeof entry === "string" ? entry : entry && entry.url;
				if (!url || seen.has(url)) continue;
				seen.add(url);
				const source = document.createElement("source");
				source.setAttribute("src", url);
				const type = (typeof entry === "object" && entry.type) || typeFor(url);
				if (type) source.setAttribute("type", type);
				v.appendChild(source);
			}
		}

		//@ video.poster: Image shown before the first frame decodes. Give one on any autoplaying clip: it is what holds the layout still and what reduced-motion visitors see instead of the video.
		obj.poster && v.setAttribute("poster", obj.poster);

		//@ video.preload: "none", "metadata" (a good default for a loop) or "auto".
		obj.preload && v.setAttribute("preload", obj.preload);

		//@ video.controls: Show the browser's playback controls. Default true — pass false for an ambient loop.
		if (obj.controls === false) v.removeAttribute("controls");
		else if (obj.controls === true) v.setAttribute("controls", "controls");

		//@ video.loop: Restart when the clip ends.
		obj.loop && (v.loop = true, v.setAttribute("loop", "loop"));

		//@ video.playsinline: Play in place on iPhone instead of taking over the screen. Implied by `autoplay`; there is no reason to refuse it on a background loop.
		const playsinline = obj.playsinline ?? obj.autoplay;
		if (playsinline) {
			v.setAttribute("playsinline", "");
			v.setAttribute("webkit-playsinline", "");
		}

		//@ video.muted: Mute the audio track. Forced on by `autoplay`, because browsers block an unmuted autoplay; pass false only if you mean to accept that.
		const muted = obj.muted ?? (obj.autoplay ? true : undefined);
		if (muted === true) {
			v.muted = true;
			v.setAttribute("muted", "");
		} else if (muted === false) {
			v.muted = false;
			v.removeAttribute("muted");
		}

		//@ video.autoplay: Start on its own. Implies muted and playsinline, pauses off screen and in a hidden tab, and is cancelled by prefers-reduced-motion (the poster stays).
		//@ video.lazy: Only play while on screen. On by default whenever `autoplay` is set; pass false to keep an autoplaying clip running off screen.
		if (obj.autoplay) this._autoplay(obj.lazy !== false);

		//@ video.objectFit: How the frame fills the element box: "cover", "contain", "fill", "none".
		obj.objectFit && (v.style.objectFit = obj.objectFit);

		//@ video.aspectRatio: Box proportion held before the video loads, e.g. "16 / 9". Prevents the page shifting when the first frame arrives.
		obj.aspectRatio && (v.style.aspectRatio = obj.aspectRatio);

		//@ video.label: Accessible name, for a clip that carries meaning.
		obj.label && v.setAttribute("aria-label", obj.label);

		//@ video.decorative: Hide from assistive technology. For an ambient loop that repeats what the page already says in text.
		if (obj.decorative) v.setAttribute("aria-hidden", "true");

		//@ video.background: CSS background behind the frame — visible while the poster loads.
		obj.background && (v.style.background = obj.background);
		//@ video.height: CSS height of the element.
		obj.height && (v.style.height = obj.height);
		//@ video.maxWidth: CSS max-width of the element.
		obj.maxWidth && (v.style.maxWidth = obj.maxWidth);
		//@ video.radius: Corner radius. A CSS length; a bare number is read as pixels.
		obj.radius && (v.style.borderRadius = typeof obj.radius === "number" ? `${obj.radius}px` : obj.radius);
		//@ video.width: CSS width of the element.
		obj.width && (v.style.width = `${obj.width}`);
		//@ video.opacity: 0–1.
		obj.opacity && (v.style.opacity = obj.opacity);

		//@ video.raster: Raster op nodes to run over this element.
		obj.raster && this.rasterize(obj.raster);

		return this;
	}

	// Start playing, but only when it is reasonable to: motion is wanted, the
	// element is on screen, and the tab is in front.
	_autoplay(lazy) {
		const v = this.res;
		if (typeof window === "undefined" || !isPlayable(v)) return this;

		const reduced = typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) {
			// Deliberately NOT an autoplay attribute: the poster stays, and the
			// clip remains playable by anyone who wants it.
			v.removeAttribute("autoplay");
			return this;
		}

		v.setAttribute("autoplay", "");
		// play() rejects when a policy blocks it. That is not an error worth
		// throwing into a page — the poster is still there.
		const play = () => { const p = v.play(); p && p.catch && p.catch(() => {}); };

		if (!lazy || typeof window.IntersectionObserver !== "function") {
			play();
			return this;
		}

		this._visible = false;
		const io = new window.IntersectionObserver((entries) => {
			for (const entry of entries) {
				this._visible = entry.isIntersecting;
				if (entry.isIntersecting && !this._hidden) play();
				else v.pause();
			}
		}, { threshold: 0.2 });
		io.observe(v);
		this._track(() => io.disconnect());

		this._hidden = false;
		this._on(document, "visibilitychange", () => {
			this._hidden = document.hidden;
			if (document.hidden) v.pause();
			else if (this._visible) play();
		});
		return this;
	}

	play() { isPlayable(this.res) && this.res.play()?.catch?.(() => {}); return this; }
	pause() { isPlayable(this.res) && this.res.pause(); return this; }

	size(w) {
		this.res.style.width = w;
		return this;
	}

	toCode() {
		const cleaned = Object.fromEntries(
			Object.entries(this.options || {}).filter(([, v]) => v != null)
		);
		return [`new Video("${this.url}").set(${toObjectSource(cleaned, 4)})`];
	}

	render(el) {
		if (el) {
			document.querySelector(el)?.appendChild(this.res);
			return this.res;
		}
		return this.res;
	}
}

export { Video };

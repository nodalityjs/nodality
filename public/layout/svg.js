import { Wrapper } from "./container.js";

/**
 * Svg — a Nodality primitive for inline SVG icons.
 *
 * Fills the gap that `Image` can't: `<img src=data:…svg…>` doesn't inherit
 * `currentColor`, so you can't recolor an icon via the host's `color` style.
 * `Svg` mounts raw SVG markup *into* the host element, so strokes/fills using
 * `stroke="currentColor"` / `fill="currentColor"` follow the host's color —
 * and they transition when `color` transitions.
 *
 * Usage:
 *   new Svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
 *               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
 *              <polyline points="6 9 12 15 18 9"/>
 *            </svg>`).set({
 *     width: "20px",
 *     height: "20px",
 *     color: "#6B7280",
 *     keySet: [{ key: "transition", value: "transform 0.25s ease, color 0.25s ease" }],
 *   })
 *
 * Swap the glyph after mount:
 *   chev.setSvg(newSvgMarkup);
 */
class Svg extends Wrapper {
	constructor(markup) {
		// Wrapper's constructor accepts `obj` that controls the element type.
		// We always want a <div>-style host for the SVG, so pass nothing.
		super();
		this.svgMarkup = typeof markup === "string" ? markup : "";

		// Defaults that make an icon behave like one: shrink-stable, inline with
		// adjacent text, SVG centered inside whatever width/height the caller sets.
		this.res.style.display = "inline-flex";
		this.res.style.alignItems = "center";
		this.res.style.justifyContent = "center";
		this.res.style.flexShrink = "0";
		// Prevent the host's line-box from padding above/below the SVG glyph.
		this.res.style.lineHeight = "0";

		this.res.innerHTML = this.svgMarkup;

		// Best-effort: make the inner <svg> fill the host so the caller's
		// width/height on the host controls the glyph size even if the SVG
		// markup didn't declare width/height attributes.
		this._sizeInner();

		this.code = [];
		this.code.push("\n new Svg() \n");
	}

	_sizeInner() {
		const svg = this.res.querySelector("svg");
		if (!svg) return;
		if (!svg.getAttribute("width"))  svg.setAttribute("width",  "100%");
		if (!svg.getAttribute("height")) svg.setAttribute("height", "100%");
		// display:block kills the baseline gap some browsers add under inline SVG.
		svg.style.display = "block";
	}

	/**
	 * Replace the SVG markup after mount — handy for state-change icon swaps
	 * (e.g. chevron ↔ x, sun ↔ moon). Returns `this` for chaining.
	 */
	setSvg(markup) {
		this.svgMarkup = typeof markup === "string" ? markup : "";
		this.res.innerHTML = this.svgMarkup;
		this._sizeInner();
		return this;
	}

	/**
	 * Shortcut for setting a square size on both axes.
	 *   new Svg(markup).size(20) // 20×20
	 *   new Svg(markup).size("1.25rem")
	 */
	size(dim) {
		const v = typeof dim === "number" ? `${dim}px` : dim;
		this.res.style.width = v;
		this.res.style.height = v;
		return this;
	}

	toCode(indent = 0) {
		if (this.excludeFromCodeTrue) return [""];
		const pad = " ".repeat(indent);
		// Use a template literal so the SVG's inner quotes survive round-trips.
		const esc = (this.svgMarkup || "").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
		let code = `${pad}new Svg(\`${esc}\`)`;

		if (this.obj && Object.keys(this.obj).length) {
			const cleanedObj = Object.fromEntries(
				Object.entries(this.obj).filter(([k, v]) => v !== null)
			);
			const objString = JSON
				.stringify(cleanedObj, null, 2)
				.replace(/"([^"]+)":/g, "$1:");
			code += `\n${pad}  .set(${objString})`;
		}
		code += `\n${pad}`;
		return [code];
	}
}

export { Svg };

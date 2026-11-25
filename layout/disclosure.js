/*!
 * nodality v1.5.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";
import { nodeOf, codeOf, optionsSource, applyStyle, applyDesignOps } from "./element-kit.js";

// Disclosure — the platform's own <details>/<summary>, as data.
//@ disclosure.children: The content shown when it is open, as element specs. It stays in the page while closed, so find-in-page and search engines still see it.
//
// Native on purpose. A scripted accordion has to reimplement keyboard
// handling, the expanded state for assistive technology, and — the part every
// one of them gets wrong — find-in-page: a closed <details> keeps its content
// in the DOM and the browser opens it when a search lands inside. Content
// hidden with display:none, the usual scripted approach, is invisible to the
// search entirely. So the closed content stays in the tree and is searchable,
// indexable, and prerendered.
//
//   { type: "disclosure", summary: "Shipping", open: false,
//     children: [{ type: "p", text: "Two to four days." }] }

class Disclosure extends Animator {
	constructor() {
		super();
		this.options = {};
		this.children = [];
		this.summaryChild = null;
		this.setup();
	}

	setup() {
		const d = document.createElement("details");
		const s = document.createElement("summary");
		// The browser's marker and pointer are the affordance; only the cursor
		// is made explicit, because Safari shows a text cursor on <summary>.
		s.style.cursor = "pointer";
		d.appendChild(s);
		this.res = d;
		this.summaryEl = s;
		return this;
	}

	getType() { return "LayoutWrapperElement"; }

	set(obj = {}) {
		this.options = obj;
		this.commonMethods(obj);

		//@ disclosure.summary: The always-visible line that opens and closes it: a string, or an element spec rendered inside the <summary>. Defaults to "Details".
		this._setSummary(obj.summary);

		//@ disclosure.open {bool}: Start expanded. The visitor can still close it; find-in-page opens it on its own when a match is inside.
		if (obj.open) this.res.setAttribute("open", "");
		else this.res.removeAttribute("open");

		//@ disclosure.summaryStyle {object}: CSS for the <summary> line, as {camelCaseProperty: value} — e.g. {fontWeight: 600, padding: "0.5em 0"}.
		applyStyle(this.summaryEl, obj.summaryStyle);
		//@ disclosure.dismiss {bool}: Close it again on a click outside it, on Escape (focus returns to the summary) and when a link inside it is followed — what a dropdown (a language picker, a small menu) needs and a plain <details> does not do.
		this._setDismiss(obj.dismiss === true);
		applyDesignOps(this, obj);
		return this;
	}

	_setDismiss(on) {
		if (typeof this._offDismiss === "function") { this._offDismiss(); this._offDismiss = null; }
		if (!on || typeof document === "undefined") return;
		const d = this.res;
		const close = (refocus) => {
			if (!d.hasAttribute("open")) return;
			d.removeAttribute("open");
			if (refocus && typeof this.summaryEl.focus === "function") this.summaryEl.focus();
		};
		const onDown = (e) => { if (d.hasAttribute("open") && !d.contains(e.target)) close(false); };
		const onKey = (e) => { if (e.key === "Escape" && d.hasAttribute("open")) { e.preventDefault(); close(true); } };
		const onClick = (e) => { const a = e.target && e.target.closest && e.target.closest("a[href]"); if (a && d.contains(a)) close(false); };
		document.addEventListener("pointerdown", onDown, true);
		d.addEventListener("keydown", onKey);
		d.addEventListener("click", onClick);
		this._offDismiss = () => {
			document.removeEventListener("pointerdown", onDown, true);
			d.removeEventListener("keydown", onKey);
			d.removeEventListener("click", onClick);
		};
		if (!this._dismissTracked && typeof this._track === "function") {
			this._dismissTracked = true;
			this._track(() => { if (typeof this._offDismiss === "function") this._offDismiss(); });
		}
	}

	_setSummary(summary) {
		const s = this.summaryEl;
		while (s.firstChild) s.removeChild(s.firstChild);
		// An element spec arrives already built by the mapper (summaryChild).
		const node = this.summaryChild ? nodeOf(this.summaryChild) : null;
		if (node) s.appendChild(node);
		else s.textContent = summary != null && typeof summary !== "object" && String(summary) !== "" ? String(summary) : "Details";
	}

	/** A component to render inside the <summary> instead of plain text. */
	summary(component) {
		this.summaryChild = component;
		this._setSummary(this.options.summary);
		return this;
	}

	add(children) {
		this.children = (children || []).filter(Boolean);
		for (const child of this.children) {
			const node = nodeOf(child);
			if (node) this.res.appendChild(node);
		}
		return this;
	}

	/** Open or close it from code. */
	toggle(force) {
		const open = force === undefined ? !this.res.hasAttribute("open") : !!force;
		if (open) this.res.setAttribute("open", ""); else this.res.removeAttribute("open");
		return this;
	}

	toCode(indent = 0) {
		const pad = " ".repeat(indent);
		let code = `${pad}new Disclosure().set(${optionsSource(this.options)})`;
		if (this.summaryChild) code += `\n${pad}  .summary(${codeOf(this.summaryChild)})`;
		if (this.children.length) {
			code += `\n${pad}  .add([\n${this.children.map((c) => codeOf(c, indent + 4)).join(",\n")}\n${pad}  ])`;
		}
		return [code];
	}

	render(el) {
		if (el) {
			document.querySelector(el)?.appendChild(this.res);
			return this;
		}
		return this.res;
	}
}

export { Disclosure };

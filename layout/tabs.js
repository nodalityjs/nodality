/*!
 * nodality v1.5.9
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";
import { nodeOf, codeOf, optionsSource, applyStyle, clearStyle, idBase, applyDesignOps, isRTL } from "./element-kit.js";

// Tabs — the WAI-ARIA tabs pattern, as data.
//@ tabs.items: The tabs, each { label, children: [element specs] } — or a plain string for a tab with no content yet. Required.
//
//   { type: "tabs", selected: 0, label: "Results by season",
//     items: [ { label: "2025", children: [ … ] },
//              { label: "2024", children: [ … ] } ] }
//
// What the pattern requires and this does:
//   • role tablist / tab / tabpanel, each tab aria-controls its panel and each
//     panel aria-labelledby its tab, aria-selected on the active tab;
//   • ONE tab stop for the whole list (roving tabindex): Tab moves into the
//     list and out to the panel, the arrow keys move between tabs, Home and
//     End jump to the ends. Selection follows focus ("automatic activation"),
//     which the APG recommends when panels are already in the page — they are.
//   • Inactive panels are `hidden="until-found"`, not display:none. Their
//     content stays searchable: when find-in-page lands inside one, the
//     browser fires `beforematch` and the tab that owns it is selected. Where
//     the browser does not know `until-found` the attribute is a plain
//     `hidden`, which is the same behaviour minus the search — so that is the
//     fallback, with no feature test needed for correctness. (A test IS used
//     to write the plain form there, so the DOM does not carry a value the
//     browser ignores.)

const supportsUntilFound = () =>
	typeof document !== "undefined" && !!document.documentElement && "onbeforematch" in document.documentElement;

// Defaults kept to what makes a row of buttons read as tabs. Everything is
// overridable through tabStyle / activeTabStyle.
const TAB_DEFAULT = {
	font: "inherit", color: "inherit", background: "none", border: "none",
	borderBottom: "2px solid transparent", padding: "0.5em 1em", margin: "0",
	cursor: "pointer", whiteSpace: "nowrap",
};
const TAB_ACTIVE_DEFAULT = { borderBottomColor: "currentColor", fontWeight: "600" };

class Tabs extends Animator {
	constructor() {
		super();
		this.options = {};
		this.items = [];
		this.tabs = [];
		this.panels = [];
		this.selectedIndex = 0;
		this.setup();
	}

	setup() {
		const root = document.createElement("div");
		const list = document.createElement("div");
		list.setAttribute("role", "tablist");
		list.style.display = "flex";
		list.style.flexWrap = "nowrap";
		list.style.overflowX = "auto";
		list.style.borderBottom = "1px solid rgba(127, 127, 127, 0.35)";
		root.appendChild(list);
		this.res = root;
		this.list = list;
		return this;
	}

	getType() { return "LayoutWrapperElement"; }

	set(obj = {}) {
		this.options = obj;
		this.commonMethods(obj);

		//@ tabs.label {text}: Accessible name of the tab list, e.g. "Results by season". Give one when the page has more than one set of tabs.
		if (obj.label != null && obj.label !== "") this.list.setAttribute("aria-label", String(obj.label));

		//@ tabs.selected: Index of the tab shown first, from 0. Out-of-range values are clamped.
		if (obj.selected != null) this.selectedIndex = Number(obj.selected) || 0;

		//@ tabs.tabStyle {object}: CSS for every tab button, as {camelCaseProperty: value}. Merged over the defaults (no background, a 2px bottom border that the active tab colours).
		//@ tabs.activeTabStyle {object}: CSS added to the selected tab, as {camelCaseProperty: value}, e.g. {color: "#c2410c", borderBottomColor: "#c2410c"}.
		this.tabStyle = obj.tabStyle;
		this.activeTabStyle = obj.activeTabStyle;

		applyDesignOps(this, obj);
		if (this.tabs.length) this._paint();
		return this;
	}

	/**
	 * The tabs: [{ label, children: [components] }]. Called by the mapper with
	 * the children already built.
	 */
	add(items) {
		this.items = (items || []).filter(Boolean);
		const base = idBase("tabs", this.options.id);
		// What an inactive panel's `hidden` holds. Kept on the instance, not
		// written to the DOM, so the markup carries nothing but the pattern.
		this._hiddenValue = supportsUntilFound() ? "until-found" : "";

		this.items.forEach((item, i) => {
			const tab = document.createElement("button");
			tab.setAttribute("type", "button");
			tab.setAttribute("role", "tab");
			tab.setAttribute("id", `${base}-tab-${i}`);
			tab.setAttribute("aria-controls", `${base}-panel-${i}`);
			tab.textContent = item.label != null && item.label !== "" ? String(item.label) : `Tab ${i + 1}`;
			this._on(tab, "click", () => this.select(i, { focus: true }));
			this.list.appendChild(tab);
			this.tabs.push(tab);

			const panel = document.createElement("div");
			panel.setAttribute("role", "tabpanel");
			panel.setAttribute("id", `${base}-panel-${i}`);
			panel.setAttribute("aria-labelledby", `${base}-tab-${i}`);
			// Focusable so a panel whose content has no focusable element is
			// still reachable with Tab after the tab list (APG).
			panel.setAttribute("tabindex", "0");
			for (const child of item.children || []) {
				const node = nodeOf(child);
				if (node) panel.appendChild(node);
			}
			// find-in-page found a match in a hidden panel: show its tab. The
			// browser has already removed `hidden` from this panel by now.
			this._on(panel, "beforematch", () => this.select(i));
			this.res.appendChild(panel);
			this.panels.push(panel);
		});

		this._on(this.list, "keydown", (e) => this._key(e));
		this._paint();
		return this;
	}

	_key(e) {
		const n = this.tabs.length;
		if (!n) return;
		const at = this.tabs.indexOf(e.target);
		if (at < 0) return;
		let next = null;
		// Right to left (dir="rtl"), the tab list runs the other way, so the
		// arrow keys do too: ArrowLeft is the NEXT tab, as the APG requires.
		const fwd = isRTL(this.list) ? -1 : 1;
		if (e.key === "ArrowRight" || e.key === "Right") next = (at + fwd + n) % n;
		else if (e.key === "ArrowLeft" || e.key === "Left") next = (at - fwd + n) % n;
		else if (e.key === "Home") next = 0;
		else if (e.key === "End") next = n - 1;
		if (next === null) return;
		e.preventDefault();
		this.select(next, { focus: true });
	}

	/** Show tab `i`. `{focus: true}` also moves keyboard focus to its tab. */
	select(i, { focus = false } = {}) {
		if (!this.tabs.length) return this;
		this.selectedIndex = Math.max(0, Math.min(this.tabs.length - 1, Number(i) || 0));
		this._paint();
		if (focus && typeof this.tabs[this.selectedIndex].focus === "function") this.tabs[this.selectedIndex].focus();
		if (typeof CustomEvent === "function") {
			this.res.dispatchEvent(new CustomEvent("nodality:tabchange", { bubbles: true, detail: { index: this.selectedIndex } }));
		}
		return this;
	}

	_paint() {
		const n = this.tabs.length;
		if (!n) return;
		const sel = Math.max(0, Math.min(n - 1, this.selectedIndex));
		this.selectedIndex = sel;
		this.tabs.forEach((tab, i) => {
			const on = i === sel;
			tab.setAttribute("aria-selected", on ? "true" : "false");
			tab.setAttribute("tabindex", on ? "0" : "-1");
			clearStyle(tab, TAB_ACTIVE_DEFAULT);
			clearStyle(tab, this.activeTabStyle);
			applyStyle(tab, TAB_DEFAULT);
			applyStyle(tab, this.tabStyle);
			if (on) { applyStyle(tab, TAB_ACTIVE_DEFAULT); applyStyle(tab, this.activeTabStyle); }
		});
		this.panels.forEach((panel, i) => {
			if (i === sel) panel.removeAttribute("hidden");
			else panel.setAttribute("hidden", this._hiddenValue || "");
		});
	}

	toCode(indent = 0) {
		const pad = " ".repeat(indent);
		let code = `${pad}new Tabs().set(${optionsSource(this.options)})`;
		if (this.items.length) {
			const items = this.items.map((it) => `${pad}    { label: ${JSON.stringify(String(it.label ?? ""))}, children: [\n` +
				(it.children || []).map((c) => codeOf(c, indent + 8)).join(",\n") + `\n${pad}    ] }`);
			code += `\n${pad}  .add([\n${items.join(",\n")}\n${pad}  ])`;
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

export { Tabs };

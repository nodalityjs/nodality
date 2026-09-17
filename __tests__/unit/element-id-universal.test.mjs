// element-id-universal.test.mjs
//
// Every element type must put its `id` on the node it renders.
//
// `id` is the joint between E and N: `target`, `parse`, `defs` references and
// the agent surface all name elements by it, and the schema advertises it for
// every type. It was nevertheless applied per component, which meant it could
// be — and was — forgotten. `video` and `table` each accepted an id, listed it,
// and rendered a node without one; nothing threw, nothing was reported, and the
// only symptom was a node that could not be targeted.
//
// A per-type check is the only thing that can catch that, because the defect is
// invisible to the schema (which says the parameter exists), to the validator
// (which says the spec is well formed) and to a page (which renders fine).

import { test, before } from "node:test";
import assert from "node:assert/strict";

let ElementMapper, ELEMENT_TYPES;

before(async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	}
	({ ElementMapper, ELEMENT_TYPES } = await import("../../lib/element-mapper.js"));
});

/** The smallest spec each type will render: content in the slot it reads. */
const fixture = (type, id) => {
	const el = { type, id };
	if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "code", "copy", "simple"].includes(type)) el.text = "Probe";
	if (["img", "video", "audio", "a"].includes(type)) el.url = "/probe.mp4";
	if (["cards", "nav", "sideNav", "table", "ulist", "dropdown", "picker", "radio"].includes(type)) el.items = ["One", "Two"];
	if (["row", "form", "stack", "wrap", "free"].includes(type)) el.children = [{ type: "p", id: `${id}-kid`, text: "Kid" }];
	if (type === "multiswitcher") {
		el.breakpoints = [{ at: "600px", view: { type: "p", id: `${id}-view`, text: "View" } }];
	}
	if (type === "simple") el.react = [{ at: 600, template: "text-above-image" }];
	return el;
};

// `free` is the one type that cannot be built from an element alone: its mapper
// reads a `layout` design node and dereferences the match without checking, so
// omitting one is a raw TypeError rather than a report.
const nodesFor = (type) => type === "free"
	? [{ op: { name: "layout", value: "text-above-image" } }]
	: [];

test("every element type applies its id to the node it renders", () => {
	const missing = [];
	for (const type of ELEMENT_TYPES) {
		let built;
		try {
			built = ElementMapper.mapType({ el: fixture(type, "probe-id"), customOptions: nodesFor(type), i: 0 });
		} catch (e) {
			missing.push(`${type} (threw: ${e.message})`);
			continue;
		}
		// Two shapes come back: an instance holding a node, or — for the
		// types whose mapper emits source (cards, copy) — the code itself.
		if (typeof built === "string") {
			if (!built.includes("probe-id")) missing.push(`${type} (emitted code carries no id)`);
			continue;
		}
		// A Switcher (nav, sideNav, multiswitcher) has no box until it renders,
		// by design: it swaps views in and out, so the id belongs to a box that
		// does not exist at map time. Render to ask it.
		let node = built && (built.res || built.formElement || built.el || built.container);
		if (!node && built && typeof built.render === "function") {
			const out = built.render();
			if (out && typeof out.getAttribute === "function") node = out;
		}
		if (!node || typeof node.getAttribute !== "function") {
			missing.push(`${type} (rendered no element node)`);
			continue;
		}
		if (node.getAttribute("id") !== "probe-id") {
			missing.push(`${type} (id was ${JSON.stringify(node.getAttribute("id"))})`);
		}
	}
	assert.deepEqual(missing, [],
		"these types accept an id and then render a node that cannot be targeted");
});

test("a component that sets its own id keeps it", () => {
	// The central application must not overwrite a component that has already
	// made its own decision — only fill the gap when none was set.
	const built = ElementMapper.mapType({ el: fixture("p", "mine"), customOptions: [], i: 0 });
	assert.equal(built.res.getAttribute("id"), "mine");
});

test("a leading hash is not doubled", () => {
	// Both spellings name the same element everywhere else, so `#hero` must
	// not become an attribute that no selector matches.
	const built = ElementMapper.mapType({ el: fixture("wrap", "#hero"), customOptions: [], i: 0 });
	assert.equal(built.res.getAttribute("id"), "hero");
});

// element-id-universal.test.mjs
//
// Every element type must put its `id` on the node that ends up in the page.
//
// `id` is the joint between E and N: `target`, `parse`, `defs` references and
// the agent surface all name elements by it, and the schema advertises it for
// every type.
//
// The first version of this test checked the instance the mapper returns, and
// passed — while seventeen types still rendered without their id. Des does not
// mount that instance: it takes the instance's generated CODE and runs it, and
// composites embed their children's code inside their own. An id written onto
// the mapped instance's node never reaches the page. So this renders every type
// through Des, exactly as a page does, and looks in the resulting DOM.
//
// It is also the only check that reaches code generation at all: `audio` had no
// toCode(), Des interpolated the object, and every audio element threw
// "[object Object].render(...)" as a syntax error.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, ELEMENT_TYPES, dom;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	}
	({ Des } = await import("../../lib/designer.js"));
	({ ELEMENT_TYPES } = await import("../../lib/element-mapper.js"));
});

beforeEach(() => { document.getElementById("mount").innerHTML = ""; });

/** The smallest spec each type will render: content in the slot it reads. */
const fixture = (type, id) => {
	const el = { type, id };
	if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "code", "copy", "simple"].includes(type)) el.text = "Probe";
	if (["img", "video", "audio", "a"].includes(type)) el.url = "/probe.mp4";
	if (["cards", "nav", "sideNav", "table", "ulist", "dropdown", "picker", "radio"].includes(type)) el.items = ["One", "Two"];
	if (["row", "form", "stack", "wrap", "free"].includes(type)) el.children = [{ type: "p", id: `${id}-kid`, text: "Kid" }];
	if (type === "multiswitcher") el.breakpoints = [{ at: "600px", view: { type: "p", id: `${id}-view`, text: "View" } }];
	if (type === "simple") el.react = [{ at: 600, template: "text-above-image" }];
	return el;
};

// `free` is the one type that cannot be built from an element alone: its mapper
// reads a `layout` design node.
const nodesFor = (type) => type === "free" ? [{ op: { name: "layout", value: "text-above-image" } }] : [];

const render = (elements, nodes = []) =>
	new Des().nodes(nodes).add(elements).set({ mount: "#mount", code: false, elements: false });

test("every element type renders its id into the page", () => {
	const missing = [];
	for (const type of ELEMENT_TYPES) {
		document.getElementById("mount").innerHTML = "";
		try {
			render([fixture(type, "probe-id")], nodesFor(type));
		} catch (e) {
			missing.push(`${type} (threw: ${e.message.slice(0, 80)})`);
			continue;
		}
		if (!document.getElementById("probe-id")) missing.push(type);
	}
	assert.deepEqual(missing, [],
		"these types accept an id and render a page in which nothing carries it");
});

test("an id survives nesting inside a composite", () => {
	// Children are not mounted separately: their code is embedded in the
	// parent's. This is the path a real page takes for almost every element.
	render([{
		type: "wrap", id: "outer", children: [
			{ type: "wrap", id: "inner", children: [
				{ type: "button", id: "deep-button", text: "Go" },
				{ type: "video", id: "deep-video", url: "/a.mp4" },
			] },
		],
	}]);
	for (const id of ["outer", "inner", "deep-button", "deep-video"]) {
		assert.ok(document.getElementById(id), `#${id} is missing from the rendered page`);
	}
});

test("the element's declared id wins over one a mapper hardcoded", () => {
	// `free` emitted id "#3" for every free element, `polygon` "hex", `copy`
	// "#first" — so two of them on a page shared an id and neither could be
	// targeted.
	render([fixture("free", "mine")], nodesFor("free"));
	assert.ok(document.getElementById("mine"));
	assert.equal(document.getElementById("3"), null);
});

test("the id is written exactly as declared, hash included", () => {
	// Ids are compared in normalised form everywhere (sameId), and the DOM keeps
	// the author's spelling. A version of the central fix stripped the hash,
	// and seven browser tests — pages selecting [id="#hero"] — broke at once.
	render([{ type: "wrap", id: "#hero", children: [] }, { type: "wrap", id: "plain", children: [] }]);
	assert.ok(document.querySelector('[id="#hero"]'), "a declared #hero must stay #hero");
	assert.ok(document.getElementById("plain"));
});

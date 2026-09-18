// resprop-render.test.mjs
//
// Every type that accepts `resprop` must still render with it set.
//
// `resprop` is the library's one responsive mechanism, documented on every
// type that reads it. On `img` it blanked the page: Image passed the
// breakpoints to Animator.resprop() without its options, resprop() stored
// `undefined` as the component's options, and toCode() then ran
// Object.entries(undefined). Des threw during hydration and the mount was left
// empty — while `validate_nodes` said the spec was fine and prerender, at a
// phone's width, passed.
//
// So each such type is rendered through Des, at a desktop width, with a
// two-ended resprop, the way a real page writes it.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let Des, ELEMENT_PARAMS_BY_TYPE, dom;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	Object.defineProperty(dom.window, "innerWidth", { value: 1440, configurable: true });
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	}
	({ Des } = await import("../../lib/designer.js"));
	({ ELEMENT_PARAMS_BY_TYPE } = await import("../../lib/element-params.generated.js"));
});

const fixture = (type) => {
	const el = { type, id: "probe" };
	if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "code", "copy", "simple"].includes(type)) el.text = "Probe";
	if (["img", "video", "audio", "a"].includes(type)) el.url = "/probe.png";
	if (["cards", "nav", "sideNav", "table", "ulist", "dropdown", "picker", "radio"].includes(type)) el.items = ["One", "Two"];
	if (["row", "form", "stack", "wrap", "free"].includes(type)) el.children = [{ type: "p", id: "kid", text: "Kid" }];
	return el;
};

const RESPROP = [
	{ breakpoint: 4000, outline: "1px solid red" },
	{ breakpoint: 768, outline: "none" },
];

test("every type that reads resprop still renders with it set", () => {
	const types = Object.entries(ELEMENT_PARAMS_BY_TYPE)
		.filter(([, names]) => names.includes("resprop"))
		.map(([type]) => type);
	assert.ok(types.includes("img"), "img must be among the types that read resprop");

	const broken = [];
	for (const type of types) {
		document.getElementById("mount").innerHTML = "";
		try {
			new Des().nodes([]).add([{ ...fixture(type), resprop: RESPROP }])
				.set({ mount: "#mount", code: false, elements: false });
		} catch (e) {
			broken.push(`${type}: ${e.message}`);
			continue;
		}
		if (!document.querySelector('[id="probe"]')) broken.push(`${type}: rendered nothing`);
	}
	assert.deepEqual(broken, [], "resprop broke rendering for these types");
});

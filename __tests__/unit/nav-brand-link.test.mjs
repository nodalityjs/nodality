// nav-brand-link.test.mjs — the nav's brand can lead home.
//
// A nav's brand was never a link: a logo in the bar that goes nowhere when
// clicked, on a phone and on a desktop. `brandLink` wraps it in an anchor in
// both bars. It travels through the code Des runs (the bars are rebuilt from
// toCode), so it is asserted on the rendered page, not on the component.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, validateNodes, dom, width;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	({ Des } = await import("../../lib/designer.js"));
	({ validateNodes } = await import("../../lib/validate-nodes.js"));
});

const atWidth = (w) => {
	width = w;
	dom.window.matchMedia = (q) => {
		const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
		return { matches: (!min || width >= +min[1]) && (!max || width <= +max[1]), media: q,
			addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
	};
	Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
};

beforeEach(() => { document.getElementById("mount").innerHTML = ""; atWidth(1440); });

const render = (els) => new Des().nodes([]).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
const NAV = { type: "nav", id: "nav", items: [{ title: "Material", link: "#material" }], breakpoint: 768,
	brand: { type: "img", id: "brand", url: "/logo.svg", alt: "Defend Bike Case", height: "28px" } };

for (const [name, w] of [["desktop", 1440], ["phone", 390]]) {
	test(`brandLink makes the brand a link on ${name}`, () => {
		atWidth(w);
		render({ ...NAV, brandLink: "/" });
		const img = document.querySelector('#mount [id="brand"]');
		assert.ok(img, "the brand rendered");
		const a = img.closest("a");
		assert.ok(a, "the brand sits inside a link");
		assert.equal(a.getAttribute("href"), "/");
		assert.equal(img.getAttribute("alt"), "Defend Bike Case", "the link's name is the logo's alt text");
		assert.equal(img.style.height, "28px", "the brand keeps its own styling");
	});

	test(`without brandLink the brand is not a link on ${name}`, () => {
		atWidth(w);
		render(NAV);
		assert.equal(document.querySelector('#mount [id="brand"]').closest("a"), null);
	});
}

test("the schema offers brandLink and colorScheme on a nav, and the validator accepts them", async () => {
	const { ELEMENT_PARAMS_BY_TYPE } = await import("../../lib/element-params.generated.js");
	for (const name of ["brandLink", "colorScheme"]) assert.ok(ELEMENT_PARAMS_BY_TYPE.nav.includes(name), `nav.${name}`);
	assert.ok(ELEMENT_PARAMS_BY_TYPE.wrap.includes("colorScheme"), "wrap.colorScheme");
	const r = validateNodes([], [{ ...NAV, brandLink: "/", colorScheme: "light" }]);
	assert.deepEqual(r.warnings.filter((w) => /brandLink|colorScheme/.test(w.path || "")), []);
});

test("colorScheme is a style option: it reaches the element", () => {
	render({ type: "wrap", id: "w", colorScheme: "light", children: [] });
	assert.equal(document.querySelector('#mount [id="w"]').style.colorScheme, "light");
});

// no-undefined-id.test.mjs — an element without an id must not carry one.
//
// Several components wrote `setAttribute("id", x)` without first checking
// that `x` existed. `setAttribute` stringifies, so a missing id did not
// throw and did not show up in any test: it shipped as the literal
// attribute id="undefined".
//
// That is invisible until two of them meet. Duplicate ids are a
// conformance error, so a page carrying more than one such element fails
// the WHATWG checker — which is how this was found. The four production
// deployments were carrying 1, 1, 2 and 15 of them respectively, and the
// site with 15 failed validation on 14 counts of Duplicate ID "undefined"
// alone.
//
// A second, quieter fault sat next to the first: Center guarded on
// `obj.id` and then wrote a bare `id`, which is not in scope. That path
// threw a ReferenceError for every caller who DID supply an id, so the
// guard could never have worked in either direction.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let ElementMapper;

before(async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>");
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator",
		{ value: dom.window.navigator, configurable: true });
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	globalThis.HTMLElement = dom.window.HTMLElement;
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({
			matches: false, addEventListener() {}, removeEventListener() {},
			addListener() {}, removeListener() {},
		});
	}
	({ ElementMapper } = await import("../../lib/element-mapper.js"));
});

const map = (el, customOptions = []) => ElementMapper.mapType({ el, customOptions, i: 0 });

/** Every element type that can be built from a bare `{ type }`. */
const TYPES = ["h1", "h2", "h3", "p", "img", "a", "cards", "nav", "sideNav",
	"row", "dropdown", "radio", "input", "labelInput", "filePicker", "picker",
	"wrap", "form", "button", "grid", "circle", "polygon", "table"];

test("no element type emits id=\"undefined\" when the id is omitted", () => {
	const offenders = [];
	for (const type of TYPES) {
		let html;
		try {
			const rendered = map({ type, text: "Sample", src: "/a.png", alt: "a", href: "/x",
				items: ["one", "two"], children: [{ type: "p", text: "child" }] }).render();
			html = rendered && rendered.outerHTML;
		} catch {
			continue; // type needs options this bare probe does not supply
		}
		// some components mount themselves rather than returning a node
		if (!html) continue;
		const n = (html.match(/id="undefined"/g) || []).length;
		if (n) offenders.push(`${type} (${n})`);
	}
	assert.deepEqual(offenders, [],
		`these types stringified a missing id into the markup: ${offenders.join(", ")}`);
});

test("a supplied id still reaches the markup", () => {
	// The guard must not have been bought by dropping ids altogether.
	const html = map({ id: "hero", type: "wrap", children: [] }).render().outerHTML;
	assert.match(html, /id="hero"/);
});

test("partial-text styling leaves no id on the spans it introduces", () => {
	// The production source of the duplicate: a `span` node splits one
	// heading into several elements, and only the styled part is ever
	// given an id. The rest used to inherit the literal "undefined".
	const el = map({ id: "h", type: "h1", text: "A gradient word inside a heading" },
		[{ op: { name: "span", parts: [{ text: "gradient", style: { italic: true } }] },
		   target: ["h"] }]);
	const html = el.render().outerHTML;
	assert.ok(html.includes("<span"), "expected the heading to be split into spans");
	assert.equal((html.match(/id="undefined"/g) || []).length, 0);
});

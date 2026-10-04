// check-page-shop.test.mjs — check_page measures a product's loading state.
//
// Until the shop answers, a product shows its static copy in Shopify's
// placeholder. On the suitcase site the copy laid out differently from the
// live elements — price and options on one line on a phone — and no check saw
// it, because nothing overflowed: it was found by eye. check_page now stamps
// the template the way Shopify does and reports LOADING_LAYOUT_SHIFT when a
// live element and its static copy differ. Needs Playwright; skipped without.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let Des, checkPage, html;

before(async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	({ Des } = await import("../../lib/designer.js"));
	({ checkPage } = await import("../../lib/check-page.js"));

	// The suitcase configurator, reduced: a grid with a gap, a price and the
	// options as text. Rendered by the library, so the markup is the real one.
	new Des().nodes([]).add([{
		type: "product", id: "n01", handle: "suitcase-n01",
		keySet: [{ key: "display", value: "grid" }, { key: "gap", value: "22px" }, { key: "width", value: "300px" }],
		children: [
			{ type: "price", id: "n01-price", text: "From €3,900" },
			{ type: "variantPicker", id: "n01-options", text: "Size: Cabin · Check-in" },
		],
	}]).set({ mount: "#mount", code: false, elements: false });
	html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${document.getElementById("mount").innerHTML}</body></html>`;
});

const run = async (doc) => {
	const r = await checkPage(doc, { viewports: [{ name: "mobile", width: 390, height: 844 }] });
	return r.errors[0]?.code === "MISSING_PEER_DEPENDENCY" ? null : r;
};

test("the current placeholder lays out like the loaded product: no shift", async (t) => {
	assert.match(html, /shopify-loading-placeholder="" style="display: contents;"/);
	const r = await run(html);
	if (!r) return t.skip("playwright not installed");
	assert.deepEqual(r.errors.filter((e) => e.code === "LOADING_LAYOUT_SHIFT"), []);
});

test("the 1.3.17 placeholder (a plain block) is reported, naming the element", async (t) => {
	const old = html.replace('shopify-loading-placeholder="" style="display: contents;"', 'shopify-loading-placeholder=""');
	const r = await run(old);
	if (!r) return t.skip("playwright not installed");
	const shift = r.errors.filter((e) => e.code === "LOADING_LAYOUT_SHIFT");
	assert.equal(shift.length, 1);
	assert.match(shift[0].got, /^#n01-(price|options): \d+px$/);
	assert.ok(shift[0].suggestions.length > 0, "the report names a repair");
});

test("the check leaves the page as it found it", async (t) => {
	// It stamps and un-stamps the template inside the browser; another check
	// running after it must not see the stamped copy. Proxy: the report is
	// stable when the page is checked twice at two viewports.
	const r = await checkPage(html, { viewports: [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 900 }] });
	if (r.errors[0]?.code === "MISSING_PEER_DEPENDENCY") return t.skip("playwright not installed");
	assert.deepEqual(r.errors.filter((e) => e.code === "LOADING_LAYOUT_SHIFT"), []);
});

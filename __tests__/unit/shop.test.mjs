// shop.test.mjs — commerce elements on Shopify's Storefront Web Components.
//
// A static page sells through Shopify's custom elements: <shopify-store>,
// <shopify-context> with a <template>, <shopify-money>, <shopify-cart>. What a
// page must never lose is the product itself, so every commerce element also
// has a static form, and a product's static children fill the placeholder
// Shopify shows until data arrives — which is what the prerendered HTML and a
// reader without JavaScript get. Rendered through Des, which runs the
// generated code: an option missing from toCode() never reaches the page.

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, validateNodes, dom;
const SCRIPT = "https://cdn.shopify.com/storefront/web-components.js";

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	({ Des } = await import("../../lib/designer.js"));
	({ validateNodes } = await import("../../lib/validate-nodes.js"));
});

beforeEach(() => {
	document.getElementById("mount").innerHTML = "";
	document.head.querySelectorAll("script, style").forEach((n) => n.remove());
});

const render = (elements) => new Des().nodes([]).add(elements).set({ mount: "#mount", code: false, elements: false });
const mount = () => document.getElementById("mount");
const PRODUCT = {
	type: "product", id: "n01", handle: "suitcase-n01", children: [
		{ type: "productData", id: "n01-title", query: "product.title", text: "Suitcase N°01" },
		{ type: "price", id: "n01-price", text: "€3,900" },
		{ type: "variantPicker", id: "n01-options", text: "Size: Cabin · Check-in" },
		{ type: "buy", id: "n01-buy", text: "Reserve yours", url: "https://shop.example/products/suitcase-n01" },
	],
};

test("a store renders <shopify-store> and loads Shopify's script once", () => {
	render([{ type: "store", id: "store", domain: "https://mock.shop", country: "DE", language: "EN" }]);
	render([{ type: "store", id: "store2", domain: "https://mock.shop" }]);
	const store = mount().querySelector("shopify-store");
	assert.equal(store.getAttribute("store-domain"), "https://mock.shop");
	assert.equal(store.getAttribute("country"), "DE");
	assert.equal(store.getAttribute("language"), "EN");
	assert.equal(store.id, "store");
	assert.equal(document.querySelectorAll(`script[src="${SCRIPT}"]`).length, 1);
	assert.equal(document.querySelector(`script[src="${SCRIPT}"]`).getAttribute("type"), "module");
});

test("a product is a <shopify-context> whose children are live in the template and static in the placeholder", () => {
	render([PRODUCT]);
	const ctx = mount().querySelector("shopify-context");
	assert.equal(ctx.getAttribute("type"), "product");
	assert.equal(ctx.getAttribute("handle"), "suitcase-n01");

	const live = ctx.querySelector("template").content;
	const money = live.querySelector("shopify-money");
	assert.ok(money, "live price");
	assert.equal(money.getAttribute("query"), "product.selectedOrFirstAvailableVariant.price");
	assert.equal(money.textContent, "€3,900", "the static value is the live element's initial content");
	assert.ok(live.querySelector("shopify-variant-selector"));
	assert.equal(live.querySelector("shopify-data").getAttribute("query"), "product.title");
	assert.match(live.querySelector("button").getAttribute("onclick"), /getElementById\('cart'\)\.addLine\(event\)\.showModal\(\)/);

	const ph = ctx.querySelector("[shopify-loading-placeholder]");
	assert.ok(ph, "placeholder");
	assert.equal(ph.querySelector("shopify-money"), null, "no custom elements in the static copy");
	assert.match(ph.textContent, /Suitcase N°01/);
	assert.match(ph.textContent, /€3,900/);
	const link = ph.querySelector("a");
	assert.equal(link.getAttribute("href"), "https://shop.example/products/suitcase-n01");
	assert.equal(link.textContent, "Reserve yours");
});

test("the static copy carries -static ids, so the stamped template never duplicates one", () => {
	render([PRODUCT]);
	const ctx = mount().querySelector("shopify-context");
	assert.ok(ctx.querySelector("template").content.querySelector('[id="n01-price"]'));
	assert.ok(ctx.querySelector('[shopify-loading-placeholder] [id="n01-price-static"]'));
	assert.equal(ctx.querySelector('[shopify-loading-placeholder] [id="n01-price"]'), null);
});

test("commerce elements nested in other elements still split live and static", () => {
	render([{ type: "product", id: "p", handle: "h", children: [
		{ type: "wrap", id: "col", children: [{ type: "price", id: "pr", text: "€1" }] },
	] }]);
	const ctx = mount().querySelector("shopify-context");
	assert.ok(ctx.querySelector("template").content.querySelector('[id="col"] shopify-money'));
	const staticCol = ctx.querySelector('[shopify-loading-placeholder] [id="col-static"]');
	assert.ok(staticCol);
	assert.equal(staticCol.querySelector("shopify-money"), null);
	assert.match(staticCol.textContent, /€1/);
});

test("a product box takes layout options like a wrap", () => {
	render([{ ...PRODUCT, background: "rgb(1, 2, 3)" }]);
	const ctx = mount().querySelector("shopify-context");
	assert.equal(ctx.style.display, "block");
	assert.equal(ctx.style.background || ctx.style.backgroundColor, "rgb(1, 2, 3)");
});

// The suitcase configurator is a grid with a gap. Its placeholder was a plain
// block, so until Shopify answered the static children lost the grid: the
// price and the options — inline spans — ran into one line on a phone.
test("the placeholder has no box: static children lay out in the product's own grid", () => {
	render([{ ...PRODUCT, keySet: { key: "display", value: "grid" } }]);
	const ctx = mount().querySelector("shopify-context");
	const ph = ctx.querySelector("[shopify-loading-placeholder]");
	assert.equal(ph.style.display, "contents");
	assert.equal(ph.style.getPropertyPriority("display"), "", "not !important, so Shopify's [hidden] rule still hides it");
	assert.equal(ph.parentElement, ctx, "a direct child, so its children are the grid's items");
});

test("buy: buyNow goes through the store, and ids that are not ids are refused", () => {
	render([{ type: "buy", id: "b1", text: "Buy", mode: "buyNow", store: "shop" }]);
	assert.equal(mount().querySelector("button").getAttribute("onclick"), "document.getElementById('shop').buyNow(event)");
	mount().innerHTML = "";
	render([{ type: "buy", id: "b2", cart: "x');alert(1);('" }]);
	assert.match(mount().querySelector("button").getAttribute("onclick"), /getElementById\('cart'\)/, "an injected id falls back to the default");
	assert.equal(mount().querySelector("button").getAttribute("type"), "button");
});

test("a cart is <shopify-cart>, themed through ::part rules in one style element", () => {
	const cart = { type: "cart", id: "cart", target: "_self", theme: { background: "#F1EFEA", color: "#0E0F11", font: "JetBrains Mono", accent: "#0E0F11", accentText: "#F1EFEA", radius: "14px" } };
	render([cart]);
	render([cart]);
	const el = mount().querySelector("shopify-cart");
	assert.equal(el.id, "cart");
	assert.equal(el.getAttribute("target"), "_self");
	const styles = document.head.querySelectorAll('style[data-shop="nodality-cart-cart"]');
	assert.equal(styles.length, 1, "a re-render replaces the theme rather than adding another");
	assert.match(styles[0].textContent, /#cart::part\(dialog\) \{ background: #F1EFEA; color: #0E0F11; font-family: JetBrains Mono; border-radius: 14px \}/);
	assert.match(styles[0].textContent, /#cart::part\(primary-button\) \{ background: #0E0F11; color: #F1EFEA/);
});

test("theme values cannot break out of their rule", () => {
	render([{ type: "cart", id: "cart", theme: { background: "red; } body { display: none" } }]);
	const css = document.head.querySelector('style[data-shop="nodality-cart-cart"]').textContent;
	assert.doesNotMatch(css, /body \{/);
});

test("the validator knows the slot: a product's content goes in children", () => {
	const ok = validateNodes([], [PRODUCT]);
	assert.equal(ok.ok, true, JSON.stringify(ok.errors));
	const wrong = validateNodes([], [{ type: "product", id: "p", handle: "h", items: [{ type: "price" }] }]);
	assert.ok(wrong.errors.concat(wrong.warnings).some((e) => e.code === "WRONG_CONTENT_SLOT"));
	const badMode = validateNodes([], [{ type: "buy", id: "b", mode: "later" }]);
	assert.ok(badMode.errors.concat(badMode.warnings).some((e) => e.code === "BAD_PARAM_VALUE"));
});

test("a prerendered page carries the product, its price and a link to buy, and the script", async () => {
	const fs = await import("node:fs");
	const os = await import("node:os");
	const path = await import("node:path");
	const { prerender } = await import("../../layout/prerender.js");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shop-ssg-"));
	const template = path.join(dir, "t.html"), output = path.join(dir, "o.html");
	fs.writeFileSync(template, '<!doctype html><html><head></head><body><div id="mount"></div></body></html>');
	try {
		await prerender({
			template, output, mount: "#mount",
			build: async () => {
				const { Des } = await import("../../lib/designer.js");
				new Des().nodes([]).add([{ type: "store", id: "store", domain: "https://mock.shop" }, PRODUCT, { type: "cart", id: "cart" }])
					.set({ mount: "#mount", code: false, elements: false });
			},
		});
		const html = fs.readFileSync(output, "utf8");
		assert.match(html, /<shopify-store[^>]*store-domain="https:\/\/mock\.shop"/);
		assert.match(html, /shopify-loading-placeholder[\s\S]*€3,900/);
		assert.match(html, /href="https:\/\/shop\.example\/products\/suitcase-n01"/);
		assert.match(html, new RegExp(`<script[^>]*src="${SCRIPT.replace(/[./]/g, "\\$&")}"`));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

// ── agents ─────────────────────────────────────────────────────────────
// A product named in the agent-surface node becomes a read-only tool. Agents
// learn what is for sale; they never get a cart tool, because paying stays a
// human act on the shop's checkout.

test("an allow-listed product becomes a read-only get_product tool, and only that one", async () => {
	const registered = new Map();
	document.modelContext = { registerTool: (t) => registered.set(t.name, t), unregisterTool: (n) => registered.delete(n) };
	try {
		new Des().nodes([{ op: "agent-surface", name: "shop", products: ["n01"] }])
			.add([PRODUCT, { type: "product", id: "other", handle: "other", children: [] }])
			.set({ mount: "#mount", code: false, elements: false });
		assert.ok(registered.has("shop_get_product_n01"));
		assert.ok(![...registered.keys()].some((n) => /other|cart|buy/.test(n)), "no tool for a product not named, and no cart tool");
		const out = await registered.get("shop_get_product_n01").execute({});
		assert.equal(out.ok, true);
		assert.equal(out.handle, "suitcase-n01");
		assert.equal(out.live, false, "before Shopify answers it reads the static copy");
		assert.match(JSON.stringify(out), /€3,900/);
		const manifest = JSON.parse(document.getElementById("nodality-agent-manifest").textContent);
		assert.ok(manifest.tools.some((t) => t.name === "shop_get_product_n01" && !("productId" in t)));
	} finally {
		delete document.modelContext;
	}
});

test("the validator checks that a named product exists", () => {
	const bad = validateNodes([{ op: "agent-surface", products: ["n02"] }], [PRODUCT]);
	const issue = bad.errors.concat(bad.warnings).find((e) => e.code === "UNKNOWN_PRODUCT");
	assert.ok(issue, JSON.stringify(bad));
	const good = validateNodes([{ op: "agent-surface", products: ["n01"] }], [PRODUCT]);
	assert.equal(good.ok, true, JSON.stringify(good.errors));
	assert.ok(!good.warnings.some((w) => w.code === "EMPTY_SURFACE"), "products alone make a surface");
});

test("the validator catches a product placed before its store, or with none", () => {
	const codes = (r) => r.warnings.map((w) => w.code);
	assert.ok(codes(validateNodes([], [PRODUCT])).includes("NO_STORE"));
	const late = validateNodes([], [{ type: "wrap", id: "w", children: [PRODUCT] }, { type: "store", id: "store", domain: "https://mock.shop" }]);
	const issue = late.warnings.find((w) => w.code === "STORE_AFTER_PRODUCT");
	assert.ok(issue, JSON.stringify(late.warnings));
	assert.equal(issue.path, "elements[0].children[0]");
	const right = validateNodes([], [{ type: "store", id: "store", domain: "https://mock.shop" }, { type: "wrap", id: "w", children: [PRODUCT] }]);
	assert.deepEqual(codes(right).filter((c) => /STORE/.test(c)), []);
});

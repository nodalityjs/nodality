/*!
 * nodality v1.3.14
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

// shop.js — commerce for a static page, on Shopify's Storefront Web Components.
//
//   new Shop().set({ kind: "store", domain: "https://mock.shop" }).render("#mount");
//   new Shop().set({ kind: "product", handle: "sweatpants" })
//     .add([ new Shop().set({ kind: "price" }) ])                 // live
//     .fallback([ new Shop().set({ kind: "price", text: "€35", fallback: true }) ])
//     .render("#mount");
//
// One class, one `kind` per element type: store, product, price, productData,
// productMedia, variantPicker, buy, cart. Each renders the matching Shopify
// custom element, so the cart, prices per market and checkout stay Shopify's
// and the page stays static.
//
// Every kind also has a STATIC form (`fallback: true`): plain text, an image
// or a link built from build-time data. A product's static children fill the
// placeholder Shopify shows until its data arrives — which is also what the
// prerenderer writes into the HTML, because jsdom never defines the custom
// elements. So crawlers and no-JS readers get the product, its price and a
// working link to buy it.

import { Animator } from "./animator.js";
import { toObjectSource } from "../lib/codegen.js";

const SCRIPT = "https://cdn.shopify.com/storefront/web-components.js";

// Ids end up inside inline handlers, so only id-shaped strings are accepted.
const safeId = (v, dflt) => {
	const s = String(v ?? dflt).replace(/^#/, "");
	return /^[A-Za-z][\w-]*$/.test(s) ? s : dflt;
};

const DEFAULT_QUERY = {
	price: "product.selectedOrFirstAvailableVariant.price",
	productData: "product.title",
	productMedia: "product.selectedOrFirstAvailableVariant.image",
};

class Shop extends Animator {
	constructor() {
		super();
		this.items = [];
		this.fallbackItems = [];
	}

	set(obj = {}) {
		this.options = obj;
		const kind = obj.kind;
		const builder = this[`build_${kind}`];
		if (typeof builder !== "function") {
			throw new Error(`nodality: Shop has no kind "${kind}"`);
		}
		this.res = builder.call(this, obj);

		if (kind === "product") {
			// A product is a box on the page, styled like a wrap. The
			// custom element is inline by default.
			this.res.style.display = "block";
			this.commonMethods(obj);
		}

		obj.id && this.res.setAttribute("id", String(obj.id));
		obj.font && (this.res.style.fontFamily = obj.font);
		obj.color && (this.res.style.color = obj.color);
		obj.keySet && this.keySet(obj.keySet);
		return this;
	}

	// ── kinds ──────────────────────────────────────────────────────────

	build_store(o) {
		const el = document.createElement("shopify-store");
		el.setAttribute("store-domain", o.domain);
		o.token && el.setAttribute("public-access-token", o.token);
		o.country && el.setAttribute("country", o.country);
		o.language && el.setAttribute("language", o.language);
		Shop.loadScript();
		return el;
	}

	build_product(o) {
		const ctx = document.createElement("shopify-context");
		ctx.setAttribute("type", "product");
		ctx.setAttribute("handle", o.handle);
		this.template = document.createElement("template");
		this.placeholder = document.createElement("div");
		this.placeholder.setAttribute("shopify-loading-placeholder", "");
		ctx.appendChild(this.template);
		ctx.appendChild(this.placeholder);
		return ctx;
	}

	build_price(o) {
		if (o.fallback) return this.text(o.text);
		const el = document.createElement("shopify-money");
		el.setAttribute("query", o.query ?? DEFAULT_QUERY.price);
		// The static value as initial content: shown until Shopify renders,
		// so the price never flashes blank.
		o.text != null && (el.textContent = o.text);
		return el;
	}

	build_productData(o) {
		if (o.fallback) return this.text(o.text);
		const el = document.createElement("shopify-data");
		el.setAttribute("query", o.query ?? DEFAULT_QUERY.productData);
		o.text != null && (el.textContent = o.text);
		return el;
	}

	build_productMedia(o) {
		if (o.fallback) {
			const img = document.createElement("img");
			o.url && img.setAttribute("src", o.url);
			img.setAttribute("alt", o.alt ?? "");
			o.width && img.setAttribute("width", String(o.width));
			o.height && img.setAttribute("height", String(o.height));
			return img;
		}
		const el = document.createElement("shopify-media");
		el.setAttribute("query", o.query ?? DEFAULT_QUERY.productMedia);
		o.width && el.setAttribute("width", String(o.width));
		o.height && el.setAttribute("height", String(o.height));
		if (o.url) {
			const img = document.createElement("img");
			img.setAttribute("src", o.url);
			img.setAttribute("alt", o.alt ?? "");
			el.appendChild(img);
		}
		return el;
	}

	build_variantPicker(o) {
		if (o.fallback) return this.text(o.text);
		const el = document.createElement("shopify-variant-selector");
		o.text != null && (el.textContent = o.text);
		return el;
	}

	build_buy(o) {
		if (o.fallback) {
			// No JavaScript, or not yet: a real link to the product on the
			// shop, so buying never depends on the script loading.
			const a = document.createElement("a");
			o.url && a.setAttribute("href", o.url);
			a.textContent = o.text ?? "Buy";
			return a;
		}
		const button = document.createElement("button");
		button.setAttribute("type", "button");
		button.textContent = o.text ?? "Add to cart";
		const cart = safeId(o.cart, "cart");
		const store = safeId(o.store, "store");
		// An attribute, not a listener: a product's children are cloned out
		// of its <template> by Shopify, and cloning drops listeners.
		button.setAttribute("onclick", o.mode === "buyNow"
			? `document.getElementById('${store}').buyNow(event)`
			: `document.getElementById('${cart}').addLine(event).showModal()`);
		return button;
	}

	build_cart(o) {
		const el = document.createElement("shopify-cart");
		o.target && el.setAttribute("target", o.target);
		o.discountCodes && el.setAttribute("discount-codes", o.discountCodes);
		const id = safeId(o.id, "cart");
		if (o.theme) Shop.themeCart(id, o.theme);
		return el;
	}

	// ── helpers ────────────────────────────────────────────────────────

	text(value) {
		const span = document.createElement("span");
		span.textContent = value ?? "";
		return span;
	}

	/** Shopify's script, once per document. */
	static loadScript() {
		if (typeof document === "undefined" || !document.head) return;
		if (document.querySelector(`script[src="${SCRIPT}"]`)) return;
		const s = document.createElement("script");
		s.setAttribute("type", "module");
		s.setAttribute("src", SCRIPT);
		document.head.appendChild(s);
	}

	/**
	 * The cart draws in its own shadow DOM, styled from outside only through
	 * the parts Shopify exposes. The theme becomes ::part() rules in one
	 * <style> per cart, replaced rather than duplicated on a re-render.
	 */
	static themeCart(id, t) {
		if (typeof document === "undefined" || !document.head) return;
		const sel = `#${id}`;
		const decl = (pairs) => Object.entries(pairs)
			.filter(([, v]) => v != null && v !== "")
			.map(([k, v]) => `${k}: ${String(v).replace(/[;{}<>]/g, "")}`).join("; ");
		const css = [
			`${sel} { ${decl({ "font-family": t.font })} }`,
			`${sel}::part(dialog) { ${decl({ background: t.background, color: t.color, "font-family": t.font, "border-radius": t.radius })} }`,
			`${sel}::part(primary-button) { ${decl({ background: t.accent, color: t.accentText, "font-family": t.font, "border-radius": t.buttonRadius ?? t.radius })} }`,
			`${sel}::part(secondary-button) { ${decl({ color: t.color, "font-family": t.font })} }`,
			`${sel}::part(line-heading) { ${decl({ "font-family": t.headingFont ?? t.font })} }`,
		].join("\n");
		const key = `nodality-cart-${id}`;
		let style = document.head.querySelector(`style[data-shop="${key}"]`);
		if (!style) {
			style = document.createElement("style");
			style.setAttribute("data-shop", key);
			document.head.appendChild(style);
		}
		style.textContent = css;
	}

	// ── children ───────────────────────────────────────────────────────

	/** Live children. A product's go into its <template>. */
	add(els = []) {
		this.items = els;
		const into = this.template ? this.template.content : this.res;
		for (const el of els) if (el && typeof el.render === "function") into.appendChild(el.render());
		return this;
	}

	/** Static children, shown until the product's data arrives. */
	fallback(els = []) {
		this.fallbackItems = els;
		const into = this.placeholder || this.res;
		for (const el of els) if (el && typeof el.render === "function") into.appendChild(el.render());
		return this;
	}

	toCode() {
		const opts = Object.fromEntries(Object.entries(this.options || {}).filter(([, v]) => v != null));
		const kids = (list) => list
			.filter((e) => e && typeof e.toCode === "function")
			.map((e) => [].concat(e.toCode()).join(""))
			.join(",\n");
		let code = `new Shop().set(${toObjectSource(opts, 4)})`;
		if (this.items.length) code += `.add([${kids(this.items)}])`;
		if (this.fallbackItems.length) code += `.fallback([${kids(this.fallbackItems)}])`;
		return [code];
	}

	render(selector) {
		if (selector) {
			const parent = document.querySelector(selector);
			parent && parent.appendChild(this.res);
		}
		return this.res;
	}
}

export { Shop, SCRIPT as SHOP_SCRIPT };

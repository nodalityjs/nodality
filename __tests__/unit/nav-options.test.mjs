// nav-options.test.mjs — a `nav` that declares its links is built from its own
// options.
//
// Until 1.3.14 the nav mapper read two things from the element, `items` and
// `id`. Everything else was a hardcoded demo: brand "Company", background
// #ecf0f1, a blue menu button, and a "More" dropdown of placeholder links whose
// icons were fetched from a third-party CDN on every page view. The schema
// still advertised ~170 parameters for the type, and validate_nodes accepted
// them all, so a page could set `brand`, `background` and `radius` and get the
// demo anyway with no report of it. The collapse itself worked; nothing a page
// said reached it.
//
// Rendered through Des, because Des runs the generated code: an option the
// bar's toCode() leaves out never reaches the page (hamburgerColour did not).

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Des, dom, width;

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
	({ Des } = await import("../../lib/designer.js"));
});

/** Media queries answered against a stated width, the way the Switcher asks. */
const atWidth = (w) => {
	width = w;
	dom.window.matchMedia = (q) => {
		const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
		const matches = (!min || width >= +min[1]) && (!max || width <= +max[1]);
		return { matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
	};
	Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
};

beforeEach(() => { document.getElementById("mount").innerHTML = ""; atWidth(390); });

const ITEMS = [{ title: "Material", link: "#material" }, { title: "Process", link: "#process" }];
const render = (el) => new Des().nodes([]).add([el]).set({ mount: "#mount", code: false, elements: false });
const mount = () => document.getElementById("mount");
const shown = (e) => e && e.style.display !== "none" && !e.closest('[style*="display: none"]');

test("a nav without items is still the demo, unchanged", () => {
	atWidth(1440);
	render({ type: "nav", id: "demo" });
	assert.match(mount().textContent, /Company/);
	assert.match(mount().textContent, /More/, "the demo dropdown is still there");
});

test("a page nav takes its brand, colours, radius and keySet", () => {
	atWidth(1440);
	render({
		type: "nav", id: "nav", items: ITEMS, brand: "Suitcase N°01",
		background: "rgba(241, 239, 234, 0.72)", color: "rgb(14, 15, 17)", radius: "14px",
		font: "JetBrains Mono", keySet: [{ key: "boxShadow", value: "0 10px 30px rgba(0, 0, 0, 0.25)" }],
	});
	const bar = mount().querySelector("nav");
	assert.ok(bar, "a bar rendered");
	assert.match(bar.textContent, /Suitcase N°01/);
	assert.doesNotMatch(bar.textContent, /Company/);
	assert.equal(bar.style.backgroundColor, "rgba(241, 239, 234, 0.72)");
	assert.equal(bar.style.borderRadius, "14px");
	assert.equal(bar.style.color, "rgb(14, 15, 17)");
	assert.match(bar.style.boxShadow, /30px/);
	const link = [...bar.querySelectorAll("a")].find((a) => a.textContent.trim() === "Process");
	assert.ok(link, "the declared link is there");
	assert.equal(link.getAttribute("href"), "#process");
	assert.match(link.style.fontFamily, /JetBrains Mono/);
	assert.equal(link.style.color, "rgb(14, 15, 17)");
});

test("a page nav carries no demo dropdown and fetches nothing from a third party", () => {
	for (const w of [390, 1440]) {
		atWidth(w);
		mount().innerHTML = "";
		render({ type: "nav", id: "nav", items: ITEMS, brand: "Acme" });
		assert.doesNotMatch(mount().textContent, /More|Our story|Team/, `at ${w}px`);
		const external = [...mount().querySelectorAll("img")].map((i) => i.getAttribute("src")).filter((s) => /^https?:/.test(s || ""));
		assert.deepEqual(external, [], `no third-party images at ${w}px`);
	}
});

test("a brand may be an element spec", () => {
	atWidth(1440);
	render({ type: "nav", id: "nav", items: ITEMS, brand: { type: "p", id: "brand", text: "Spec brand", keySet: [{ key: "letterSpacing", value: "0.18em" }] } });
	const brand = mount().querySelector('[id="brand"]');
	assert.ok(brand, "the spec brand rendered with its id");
	assert.equal(brand.textContent, "Spec brand");
	assert.equal(brand.style.letterSpacing, "0.18em");
});

test("on a phone the links sit behind a named button that says whether it is open", () => {
	atWidth(390);
	render({ type: "nav", id: "nav", items: ITEMS, brand: "Acme", hamburgerColour: "rgb(1, 2, 3)" });
	const button = mount().querySelector("button");
	const menu = mount().querySelector(".navbar-content");
	assert.ok(button && menu);
	assert.equal(button.getAttribute("aria-label"), "Menu");
	assert.equal(button.getAttribute("aria-expanded"), "false");
	assert.equal(button.getAttribute("aria-controls"), "nav-menu");
	assert.equal(menu.id, "nav-menu");
	assert.equal(button.style.color, "rgb(1, 2, 3)", "hamburgerColour survives the generated code");
	assert.equal(menu.style.display, "none");

	button.click();
	assert.equal(button.getAttribute("aria-expanded"), "true");
	assert.equal(menu.style.display, "flex");
});

test("following a link closes the menu", () => {
	atWidth(390);
	render({ type: "nav", id: "nav", items: ITEMS, brand: "Acme" });
	const button = mount().querySelector("button");
	const menu = mount().querySelector(".navbar-content");
	button.click();
	menu.querySelector("a").click();
	assert.equal(menu.style.display, "none");
	assert.equal(button.getAttribute("aria-expanded"), "false");
});

test("breakpoint sets where the full bar takes over", () => {
	atWidth(900);
	render({ type: "nav", id: "nav", items: ITEMS, brand: "Acme", breakpoint: 768 });
	assert.equal(mount().querySelector("button"), null, "900px is past a 768px breakpoint: no menu button");
	mount().innerHTML = "";
	render({ type: "nav", id: "nav", items: ITEMS, brand: "Acme" });
	assert.ok(mount().querySelector("button"), "and below the default 1200px it collapses");
});

test("with no matchMedia at all (a bare jsdom) the full bar is rendered, links and all", () => {
	delete dom.window.matchMedia;
	render({ type: "nav", id: "nav", items: ITEMS, brand: "Acme" });
	const hrefs = [...mount().querySelectorAll("a")].map((a) => a.getAttribute("href"));
	assert.deepEqual(hrefs, ["#material", "#process"]);
	assert.equal(mount().querySelector("button"), null);
});

// The static HTML. The prerenderer emulates a phone (390px) and answers media
// queries against it, but it answered every RANGE — "(min-width: 0px) and
// (max-width: 1199px)" — with false, on the stated belief that Nodality never
// emits one. The Switcher behind every nav does, so no view matched and every
// nav shipped to crawlers and no-JS readers as an empty box.
test("a prerendered page carries its nav (the mobile view, at the emulated phone width)", async () => {
	const fs = await import("node:fs");
	const os = await import("node:os");
	const path = await import("node:path");
	const { prerender } = await import("../../layout/prerender.js");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nav-ssg-"));
	const template = path.join(dir, "t.html"), output = path.join(dir, "o.html");
	fs.writeFileSync(template, '<!doctype html><html><head></head><body><div id="mount"></div></body></html>');
	try {
		await prerender({
			template, output, mount: "#mount",
			build: async () => {
				const { Des } = await import("../../lib/designer.js");
				new Des().nodes([]).add([{ type: "nav", id: "nav", items: ITEMS, brand: "Acme" }])
					.set({ mount: "#mount", code: false, elements: false });
			},
		});
		const html = fs.readFileSync(output, "utf8");
		assert.match(html, /href="#material"/, "the links are in the static HTML");
		assert.match(html, /href="#process"/);
		assert.match(html, /aria-label="Menu"/, "as the phone view, with its named button");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

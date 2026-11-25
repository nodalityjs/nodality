// Link `download`: the file is saved instead of opened. `true` keeps the
// file's own name, a string names the saved file, false/absent adds nothing.
import { test } from "node:test";
import assert from "node:assert/strict";

test("link download sets the download attribute", async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>");
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.requestAnimationFrame = () => 0;
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {},
			addListener() {}, removeListener() {} });
	}
	const { Link } = await import("../../layout/link.js");
	const el = (o) => new Link().set({ text: "photos", url: "img/photos.zip", ...o }).res;

	assert.equal(el({ download: true }).getAttribute("download"), "");
	assert.equal(el({ download: "petr-photos.zip" }).getAttribute("download"), "petr-photos.zip");
	assert.equal(el({ download: false }).hasAttribute("download"), false);
	assert.equal(el({}).hasAttribute("download"), false);
});

// escaping.test.mjs: page text can neither close a string in generated code
// nor inject markup through Text's Markdown path.
//
// Architecture scan 8 Nov 2026, P0 §1 and §2. The render core stopped running
// generated source, but toCode() still feeds the code panel and
// `nodality compile`, whose output people run. Markdown-looking text went to
// innerHTML unescaped.

import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function dom() {
	const { JSDOM } = await import("jsdom");
	const d = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>");
	globalThis.window = d.window;
	globalThis.document = d.window.document;
	Object.defineProperty(globalThis, "navigator", { value: d.window.navigator, configurable: true });
	globalThis.requestAnimationFrame = () => 0;
	if (!d.window.matchMedia) {
		d.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	}
	return d;
}

const PAYLOAD = 'x").set({}); globalThis.pwned = 1; new Text("y';

test("hostile text stays inside its string literal in toCode()", async () => {
	await dom();
	const [{ Text }, { Image }, { Button }] = await Promise.all([
		import("../../layout/text.js"), import("../../layout/image.js"), import("../../layout/button.js"),
	]);
	const cases = [
		["Text", new Text(PAYLOAD).set({}), PAYLOAD],
		["Text with a quote and a line break", new Text('He said "hi"\nbye').set({}), 'He said "hi"\nbye'],
		["Image", new Image().set({ url: PAYLOAD }), PAYLOAD],
		["Button", new Button(PAYLOAD).set({}), PAYLOAD],
	];
	for (const [name, el, text] of cases) {
		const src = [].concat(el.toCode()).flat(9).join("");
		assert.doesNotThrow(() => new vm.Script(src), `${name}: emitted code does not parse:\n${src.slice(0, 200)}`);
		assert.ok(src.includes(JSON.stringify(text)), `${name}: the value is emitted as one escaped literal`);
		// Run it in an isolated context with stub classes: the payload must
		// stay data and never execute.
		class Stub { set() { return this; } add() { return this; } }
		const ctx = vm.createContext({ Text: Stub, Image: Stub, Button: Stub });
		vm.runInContext(src, ctx);
		assert.equal(ctx.pwned, undefined, `${name}: the payload ran`);
	}
});

test("no generated-code line pastes a raw value between quotes", () => {
	// Code-building lines: `stra +=`, `this.code.push(`, `new X(` templates.
	// Values must go through jsString(); a raw "${...}" can close its quotes.
	const BUILD = /(stra\s*\+=|this\.code\.push\(|return \[`new |`new [A-Z]\w*\()/;
	const RAW = /\\?"\$\{[^}]*\}\\?"/;
	const offenders = [];
	for (const dir of ["layout", "lib"]) {
		for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith(".js"))) {
			readFileSync(join(ROOT, dir, f), "utf8").split("\n").forEach((line, i) => {
				if (/^\s*\/\//.test(line)) return;
				if (BUILD.test(line) && RAW.test(line)) offenders.push(`${dir}/${f}:${i + 1}: ${line.trim()}`);
			});
		}
	}
	assert.deepEqual(offenders, []);
});

test("Markdown text is escaped before tags are added, and only safe links keep an href", async () => {
	await dom();
	const { Text } = await import("../../layout/text.js");
	const t = new Text("x");
	const html = (s) => t.parseMarkdown(s);

	assert.equal(html("**bold** and <img src=x onerror=alert(1)>"),
		"<strong>bold</strong> and &lt;img src=x onerror=alert(1)&gt;");
	assert.equal(html("2 * 3 * 4"), "2 * 3 * 4", "lone asterisks are not emphasis");
	assert.equal(html("*it*"), "<em>it</em>");
	assert.equal(html("[docs](https://example.com/a?b=1&c=2)"),
		'<a href="https://example.com/a?b=1&amp;c=2">docs</a>');
	assert.equal(html("[rel](/about)"), '<a href="/about">rel</a>');
	assert.ok(!html("[x](javascript:alert(1))").includes("<a"), "javascript: loses its link");
	assert.ok(!html("[x](java\tscript:alert(1))").includes("<a"), "a tab inside the scheme is ignored by browsers, so it is checked without it");
	assert.ok(!html("[x](data:text/html,hi)").includes("<a"));
	assert.equal(html('[a" onmouseover="b](https://e.com)'), '<a href="https://e.com">a&quot; onmouseover=&quot;b</a>');
});

test("a Text whose content looks like Markdown renders no injected element", async () => {
	const d = await dom();
	const { Text } = await import("../../layout/text.js");
	const el = new Text("**hi** <img src=x onerror=alert(1)>").set({});
	const node = el.render ? (el.render("#mount"), d.window.document.querySelector("#mount")) : el.res;
	assert.equal(node.querySelector("img"), null);
	assert.ok(node.querySelector("strong"));
});

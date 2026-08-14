// codegen.test.mjs — phase P2 of HOUDINI-IMPL-SPEC.
//
// The contract: toCode() returns an ARRAY of strings whose concatenation
// parses as JavaScript.
//
// Two defects sat under that sentence. Both are the kind that a green
// suite hides, because nothing in the repo ever ran the emitted code:
//
//   (a) fourteen call sites across twelve files unquoted EVERY object key
//       with /"([^"]+)":/g, so `vars: { --nod-split: 0.9 }` — which the
//       morph expansion now emits on every root — came out as a syntax
//       error. So did any content slot ("main.hero.title"). The correct
//       spelling already existed in four other files.
//   (b) UINavBar.toCode() returned a bare string while every other class
//       returned an array, so Wrapper.add()'s `el.toCode().flatMap(...)`
//       threw and a bar could never be a Wrapper's child.
//
// The third case below is the one that keeps (a) fixed: a static scan of
// the source, so the bad pattern cannot be reintroduced by copy-paste
// from an older file — which is exactly how it spread the first time.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { toObjectSource, unquoteKeys, keyPattern } from "../../lib/codegen.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// ── 1. the helper itself ─────────────────────────────────────────────

test("toObjectSource unquotes identifiers and ONLY identifiers", () => {
	const src = toObjectSource({
		radius: "2px",              // identifier   -> unquoted
		$ref: 1, _x: 2, a1: 3,      // also identifiers
		"--nod-split": 0.2,         // custom property -> must stay quoted
		"main.hero.title": "hi",    // slot id         -> must stay quoted
		"kebab-case": true,         // hyphenated      -> must stay quoted
		"0": "numeric",             // numeric         -> must stay quoted
	}, 2);

	assert.match(src, /\n  radius: "2px"/);
	assert.match(src, /\n  \$ref: 1/);
	assert.match(src, /\n  _x: 2/);
	assert.match(src, /\n  a1: 3/);
	assert.match(src, /"--nod-split": 0\.2/);
	assert.match(src, /"main\.hero\.title": "hi"/);
	assert.match(src, /"kebab-case": true/);
	assert.match(src, /"0": "numeric"/);
});

test("emitted source parses, and round-trips to the same value", () => {
	const value = {
		radius: "calc(0px + 24px * var(--nod-radius))",
		vars: { "--nod-split": 0.2, "--nod-density": 0.5 },
		content: { "main.hero.title": "Layouts you can hold" },
		pad: [{ a: "12px" }],
		nested: { deep: { deeper: [1, 2, { k: "v" }] } },
	};
	const src = toObjectSource(value, 4);

	// The actual claim: this is JavaScript. Under the old regex the `vars`
	// and `content` keys came out bare and this line threw a SyntaxError.
	const back = new Function(`return (${src});`)();
	assert.deepEqual(back, value);
});

test("unquoteKeys leaves non-strings alone, and has no lastIndex state", () => {
	assert.equal(unquoteKeys(undefined), undefined);
	assert.equal(unquoteKeys(null), null);

	// A shared /g regex would carry lastIndex between calls and silently
	// skip matches on every other invocation; keyPattern() hands out a
	// fresh one, so repeated calls are identical.
	const json = '{"a": 1, "b": 2}';
	assert.equal(unquoteKeys(json), unquoteKeys(json));
	assert.equal(unquoteKeys(json), "{a: 1, b: 2}");

	const p1 = keyPattern(), p2 = keyPattern();
	assert.notEqual(p1, p2);
	assert.equal(p1.lastIndex, 0);
});

// ── 2. static regression scan ────────────────────────────────────────

// lstat, and tolerant of what it finds: layout/ has carried a dangling
// emacs lock symlink since 2021, and statSync follows symlinks — so a
// plain stat here crashed the scan on a file that has nothing to do with
// the code being scanned.
const walk = (dir) => readdirSync(dir).flatMap((n) => {
	if (n.startsWith(".")) return [];
	const p = join(dir, n);
	let st;
	try { st = statSync(p); } catch { return []; }   // dangling symlink
	return st.isDirectory() ? walk(p) : (p.endsWith(".js") ? [p] : []);
});

test("no source file re-introduces the unsafe unquote pattern", () => {
	// `"([^"]+)":` — any key at all. This is the bug; codegen.js is the
	// only sanctioned home for the rule.
	const bad = /"\(\[\^"\]\+\)"\s*:/;
	// codegen.js quotes the bad pattern in its own header, as the thing it
	// exists to replace. It is the one file allowed to name it.
	const EXEMPT = new Set(["lib/codegen.js"]);
	const offenders = [];
	for (const file of [...walk(join(ROOT, "layout")), ...walk(join(ROOT, "lib"))]) {
		const rel = file.slice(ROOT.length + 1);
		if (EXEMPT.has(rel)) continue;
		if (bad.test(readFileSync(file, "utf8"))) offenders.push(rel);
	}
	assert.deepEqual(offenders, [],
		"use toObjectSource()/keyPattern() from lib/codegen.js instead");
});

// ── 3. the return-shape contract, at runtime ─────────────────────────

test("toCode() returns an array, and emits no unquoted non-identifier key", async () => {
	// jsdom, because the element classes build real DOM in their
	// constructors. Set up before importing them, not after.
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>");
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator",
		{ value: dom.window.navigator, configurable: true });
	globalThis.requestAnimationFrame = () => 0;
	// jsdom ships no matchMedia, and the bar classes query it while
	// building their rows. Nothing here depends on which branch it takes.
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({
			matches: false, addEventListener() {}, removeEventListener() {},
			addListener() {}, removeListener() {},
		});
	}

	const [{ Wrapper }, { Text }, { Link }, { UINavBar }] = await Promise.all([
		import("../../layout/container.js"), import("../../layout/text.js"),
		import("../../layout/link.js"), import("../../layout/new-nav-bar.js"),
	]);

	// Options deliberately carrying BOTH key shapes — this is the morph
	// expansion's actual output shape.
	const opts = { radius: "2px", vars: { "--nod-split": 0.2 } };

	const subjects = [
		["Wrapper", new Wrapper().set(opts)],
		["Text", new Text("hi").set(opts)],
		["Link", new Link().set({ ...opts, text: "hi", url: "/docs" })],
		["UINavBar", new UINavBar().setup({ background: "#eee" })
			.items([new Link().set({ text: "a", url: "#" })])],
	];

	for (const [name, el] of subjects) {
		const out = el.toCode();
		assert.ok(Array.isArray(out), `${name}.toCode() must return an array, got ${typeof out}`);
		const src = out.flat(9).join("");
		assert.ok(!/[{,]\s*--/.test(src),
			`${name} emitted an unquoted custom property:\n${src.slice(0, 300)}`);
	}

	// The specific regression: a bar inside a Wrapper. This threw
	// "el.toCode(...).flatMap is not a function" before the fix.
	const nested = new Wrapper().set({}).add([
		new UINavBar().setup({}).items([new Link().set({ text: "a", url: "#" })]),
		new Text("body").set({}),
	]);
	assert.ok(Array.isArray(nested.toCode()));
});

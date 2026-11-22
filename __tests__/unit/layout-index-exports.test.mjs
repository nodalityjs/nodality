// layout-index-exports.test.mjs — the five element types added in the
// 2026-11 gaps round (model, disclosure, tabs, scroller, marquee) are
// reachable from the package entry the way every older component is: as a
// named export (what the bundle and `import { … } from "nodality"` see) and
// as a global (what generated imperative code and the CDN snippet use).
//
// They existed and rendered through Des, but layout/index.js never imported
// them, so code that `toCode()` emitted — `new Marquee().set(…)` — named a
// class the bundle did not export.

import { test } from "node:test";
import assert from "node:assert/strict";

const entry = await import("../../layout/index.js");
const { Model } = await import("../../layout/model.js");
const { Disclosure } = await import("../../layout/disclosure.js");
const { Tabs } = await import("../../layout/tabs.js");
const { Scroller } = await import("../../layout/scroller.js");
const { Marquee } = await import("../../layout/marquee.js");

const NEW = { Model, Disclosure, Tabs, Scroller, Marquee };

for (const [name, cls] of Object.entries(NEW)) {
	test(`${name} is a named export of layout/index.js, the same class as its module's`, () => {
		assert.equal(typeof entry[name], "function", `${name} missing from the entry's exports`);
		assert.equal(entry[name], cls);
	});

	test(`${name} is exposed as a global, like the other components`, () => {
		// Bare Node: the entry's `global.X = X` branch. (In a browser the
		// `window.X = X` branch is the same list.)
		assert.equal(globalThis[name], cls);
	});
}

test("the window and global blocks expose the same names as the export list", async () => {
	const { readFile } = await import("node:fs/promises");
	const src = await readFile(new URL("../../layout/index.js", import.meta.url), "utf8");
	const onWindow = new Set([...src.matchAll(/^\s*window\.(\w+)\s*=/gm)].map((m) => m[1]));
	const onGlobal = new Set([...src.matchAll(/^\s*global\.(\w+)\s*=/gm)].map((m) => m[1]));
	for (const name of Object.keys(NEW)) {
		assert.ok(onWindow.has(name), `window.${name}`);
		assert.ok(onGlobal.has(name), `global.${name}`);
	}
});

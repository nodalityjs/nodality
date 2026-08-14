// esm-exports-safe-to-concatenate.test.mjs
//
// The shipped ESM bundle must not declare an exported binding whose name
// shadows a browser global.
//
// It used to end with:
//
//   export const Image=layout_image._;
//   export const Text=layout_text.E;
//   export const Range=range.A;
//
// `Image`, `Text` and `Range` are DOM constructors. A consumer's webpack
// concatenates this module into its own scope, the colliding declaration
// gets renamed, and the emitted `export{…Image…}` clause still names the
// original — so the browser rejects the module before a line of it runs:
//
//   Uncaught SyntaxError: Export 'Image' is not defined in module
//
// Nothing in the pipeline caught it. The package imports fine in Node
// (no DOM globals there), the scaffold BUILDS fine (a bundler does not
// evaluate its output), and prerender runs in jsdom against the SOURCES
// rather than the bundled output. It took a user running
// `npm create nodality` and opening the page.
//
// scripts/namespaceRuntime.mjs now gives every export a private binding
// and aliases it on the way out, so the public name is unchanged and
// nothing shadows. This asserts that transform stayed applied — it runs
// as a post-build step, and a post-build step is exactly the kind of
// thing that gets dropped from a build script by accident.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../../dist/index.esm.js", import.meta.url));

// Names a browser defines that this package also exports, or plausibly
// could. Node has none of these, which is why a Node-side import check
// can never catch the problem.
const BROWSER_GLOBALS = [
	"Image", "Text", "Range", "Audio", "Option", "Comment", "Event",
	"Node", "Document", "Element", "Selection", "Animation", "Path2D",
	"Notification", "Response", "Request", "Headers", "Worker",
];

test("no exported binding shadows a browser global", () => {
	assert.ok(existsSync(DIST), "dist/index.esm.js is missing — run npm run build");
	const src = readFileSync(DIST, "utf8");

	// The unsafe form. After the post-build alias pass there should be
	// none of these at all — every export goes out through `export{…as…}`.
	const declared = [...src.matchAll(/export const (\w+)=/g)].map((m) => m[1]);
	const unsafe = declared.filter((n) => BROWSER_GLOBALS.includes(n));

	assert.deepEqual(unsafe, [],
		`these exports declare a binding that shadows a browser global: ` +
		`${unsafe.join(", ")}. A consumer bundling this module will fail with ` +
		`"Export '${unsafe[0]}' is not defined in module". Run the post-build ` +
		`alias pass (scripts/namespaceRuntime.mjs).`);

	// And the aliasing must actually be there — an empty bundle would
	// pass the check above for the wrong reason.
	assert.match(src, /export\{[^}]*\bas\b[^}]*\}/,
		"the bundle has no aliased export clause; the post-build pass did not run");
});

test("the public export names are unchanged by the aliasing", async () => {
	// The whole point is that only the INTERNAL name moves. If aliasing
	// ever renamed a public export, every consumer breaks at once.
	const mod = await import(DIST);
	for (const name of ["Des", "Image", "Text", "Range", "Animator", "Wrapper"]) {
		assert.equal(typeof mod[name], "function",
			`${name} is no longer exported as a function — the alias pass ` +
			`changed the public surface, which it must never do`);
	}
});

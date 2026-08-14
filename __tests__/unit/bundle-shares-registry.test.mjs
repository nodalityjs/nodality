// bundle-shares-registry.test.mjs — phase H4.
//
// lib/raster-ops.js owns two module-scoped singletons: the op REGISTRY
// that registerRasterOp() extends, and the ACTIVE set of attached
// pipelines the inspector reads. Bundling a second copy of that file
// does not duplicate a helper — it duplicates the state.
//
// Every ESM entry that transitively imports it (index, designer,
// element-mapper, text, animator) used to inline its own registry, so a
// consumer held two:
//
//     import { Des } from "nodality";                     // registry A
//     import { registerRasterOp } from "nodality/raster";  // registry B
//     import { inspectRaster } from "nodality/inspect";    // registry B
//
// An op registered through `nodality/raster` was accepted and then never
// ran, because the Des doing the rendering consulted A. The inspector had
// the mirror-image failure: it listed ACTIVE from B while every real
// pipeline had registered itself in A, so it reported "No raster
// pipelines attached" on a page full of them. Both are silent, which is
// the exact class the registry's own validation exists to eliminate.
//
// Measured before the fix, against the then-current dist:
//     bundle routed the op after registering: false   (SEPARATE)
// and after externalising lib/raster-ops.js in the ESM builds:
//     bundle routed the op after registering: true    (SHARED)
//
// Two assertions, because they fail for different reasons:
//   1. the CONFIG still asks for the external — catches an edit
//   2. the built ARTIFACT actually has it — catches a stale dist,
//      which is what a consumer installs
//
// The e2e suite cannot cover this: its fixture pages import the source
// modules throughout, so both sides are always the same instance.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const distEsm = fileURLToPath(new URL("dist/index.esm.js", root));

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
	globalThis.customElements = dom.window.customElements;
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({
			matches: false, addEventListener() {}, removeEventListener() {},
			addListener() {}, removeListener() {},
		});
	}
});

test("the webpack config marks lib/raster-ops.js external for ESM builds", async () => {
	const { default: configs } = await import(new URL("webpack.config.js", root).href);
	const esm = configs.filter((c) => c.output && /\.esm\.js$/.test(c.output.filename));
	assert.ok(esm.length > 5, `expected the ESM builds, found ${esm.length}`);

	// The merged/UMD builds are deliberately self-contained: a script-tag
	// bundle has no second instance to disagree with.
	const shared = esm.filter((c) => Array.isArray(c.externals) && c.externals.length);
	assert.ok(shared.length >= esm.length - 1,
		`${esm.length - shared.length} ESM builds would still inline the registry`);

	// And the externals hook resolves the real file to a specifier that
	// works from dist/ — one directory up, into the shipped lib/.
	const fn = shared[0].externals[0];
	const asked = await new Promise((res) => fn(
		{ context: fileURLToPath(new URL("lib", root)), request: "./raster-ops.js" },
		(_e, v) => res(v)));
	assert.equal(asked, "module ../lib/raster-ops.js");

	// A same-named file elsewhere must NOT be captured.
	const other = await new Promise((res) => fn(
		{ context: fileURLToPath(new URL("layout", root)), request: "./raster-ops.js" },
		(_e, v) => res(v)));
	assert.equal(other, undefined);

	// Casing must not decide it. webpack's `context` carries whatever
	// casing the invoking path had, and this repo is reached as both
	// .../launch and .../Launch. A string compare would fall through and
	// silently inline the registry again — the fix reintroducing the bug.
	const libDir = fileURLToPath(new URL("lib", root));
	const swapped = libDir.replace(/\/([a-z])(?=[^/]*\/lib$)/, (m, c) => `/${c.toUpperCase()}`);

	// ...but only where casing genuinely does not distinguish files.
	//
	// `canonical()` resolves real casing via realpathSync.native, which
	// works on macOS and Windows. On a CASE-SENSITIVE filesystem (Linux,
	// and therefore CI) the swapped path names a different location that
	// does not exist — realpathSync throws, and declining to treat it as
	// raster-ops is the CORRECT answer, not a regression. Asserting the
	// macOS behaviour unconditionally failed every Linux run and blocked
	// a release on a green codebase.
	const caseInsensitiveFs = (() => {
		try {
			return realpathSync.native(swapped) === realpathSync.native(libDir);
		} catch (e) {
			return false;
		}
	})();

	if (swapped !== libDir && caseInsensitiveFs) {
		const mixed = await new Promise((res) => fn(
			{ context: swapped, request: "./raster-ops.js" }, (_e, v) => res(v)));
		assert.equal(mixed, "module ../lib/raster-ops.js",
			`a differently-cased context (${swapped}) was not recognised`);
	}
});

test("the built bundle imports the registry rather than inlining it", () => {
	assert.ok(existsSync(distEsm), "dist/index.esm.js is missing — run npm run build");
	const src = readFileSync(distEsm, "utf8");
	assert.match(src, /["']\.\.\/lib\/raster-ops\.js["']/,
		"the bundle does not import the shared module");
	// The registry's own source, minified, still contains this key. Its
	// presence means a second copy came along for the ride.
	assert.ok(!/hexalize:/.test(src),
		"the bundle still inlines its own copy of the op registry");
});

test("an op registered through the source surface reaches the bundled mapper",
	async () => {
		// The behaviour all of the above is for. `filteroRaster` decides
		// whether a node is a raster node by consulting RASTER_OP_NAMES, so
		// it sees exactly the registry the bundle is wired to.
		const { ElementMapper } = await import(distEsm);
		const chain = [{ op: "probe", target: ["#x"] }];

		assert.equal(ElementMapper.filteroRaster("#x", chain), undefined,
			"an unregistered op must not be routed");

		const { registerRasterOp } = await import(new URL("lib/raster-ops.js", root).href);
		registerRasterOp("probe", { stage: "color", decl: () => "", code: () => "" });

		const routed = ElementMapper.filteroRaster("#x", chain);
		assert.ok(routed, "the bundle did not see an op registered through nodality/raster " +
			"— the registries are separate again");
		assert.deepEqual(routed.map((n) => n.op), ["probe"]);
	});

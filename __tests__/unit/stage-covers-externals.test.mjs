// stage-covers-externals.test.mjs
//
// The bundle does not contain raster-ops. `webpack.config.js` externalises
// it (see bundle-shares-registry.test.mjs) so every entry shares ONE op
// registry — inlining it per entry gave `Des` and `nodality/raster`
// separate registries, and an op registered through one was invisible to
// the other.
//
// The cost is that `dist/index.esm.js` emits a REAL
// `import "../lib/raster-ops.js"`, resolved relative to wherever the
// bundle is served from. Inside the installed package that resolves fine.
// It does NOT resolve once the bundle is copied somewhere else — which is
// exactly what `nodality stage` does when it writes
// `upload/dist/lib.bundle.js`.
//
// The result was silent: the page 404s on /lib/raster-ops.js, the module
// never loads, and every raster effect does nothing. No error in the
// build, no failing test — it only showed up when a real site (gesos)
// upgraded and its console filled with 404s.
//
// So the invariant is not "raster-ops is external" (that is asserted
// elsewhere). It is: WHATEVER the bundle imports externally, `stage` must
// copy — transitively, because those modules have imports of their own.
// Externalise another module tomorrow and this fails until stage learns
// about it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = new URL("../../", import.meta.url);
const p = (rel) => fileURLToPath(new URL(rel, root));

const DIST = p("dist/index.esm.js");
const BIN = p("bin/nodality.js");

/** Every relative specifier a source file imports or re-exports. */
function relativeImports(src) {
	const out = new Set();
	const re = /(?:import|export)[^'"]*?from\s*["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)|import\s*["'](\.[^"']+)["']/g;
	let m;
	while ((m = re.exec(src))) out.add(m[1] || m[2] || m[3]);
	return [...out];
}

test("stage copies every module the bundle externalises, transitively", () => {
	if (!existsSync(DIST)) {
		assert.fail("dist/index.esm.js is missing — run npm run build");
	}
	const bundle = readFileSync(DIST, "utf8");

	// What the bundle expects to find NEXT TO ITSELF, one directory up.
	// NOT filtered to lib/. The first version of this test did exactly
	// that and passed while nine ../layout/* externals went unstaged —
	// the same bug it was written to catch, hidden by its own filter.
	// Specifiers are relative to dist/, which is where the staged bundle
	// sits too, so resolve them the same way stage does.
	const external = relativeImports(bundle)
		.map((spec) => path.normalize(path.join("dist", spec)));
	assert.ok(external.length > 0,
		"the bundle externalises nothing — if that is intentional, this test " +
		"and bundle-shares-registry.test.mjs should both be revisited");

	// Follow their own relative imports: raster-ops.js pulls in suggest.js,
	// and staging one without the other fails just as loudly.
	// Follow their own relative imports: raster-ops.js pulls in
	// suggest.js, the layout components pull in more still, and staging
	// one without the others fails just as loudly.
	const needed = new Set();
	const queue = [...external];
	while (queue.length) {
		const rel = queue.pop();
		if (needed.has(rel)) continue;
		needed.add(rel);
		const file = p(rel);
		if (!existsSync(file)) continue;      // asserted below
		for (const spec of relativeImports(readFileSync(file, "utf8"))) {
			const dep = path.normalize(path.join(path.dirname(rel), spec));
			if (!needed.has(dep)) queue.push(dep);
		}
	}

	for (const rel of needed) {
		assert.ok(existsSync(p(rel)),
			`the bundle imports ${rel}, which does not exist in the package`);
	}

	// `stage` must walk this graph rather than carry a hand-written list —
	// a list is what went stale and shipped a site with 404s.
	const bin = readFileSync(BIN, "utf8");
	assert.match(bin, /relSpecs|externalised module/,
		"bin/nodality.js no longer stages the bundle's external imports");
	assert.ok(!/const needed\s*=\s*\[/.test(bin),
		"stage is back to a hardcoded file list; it must follow the bundle's " +
		"own imports, or the next externalised module ships broken");

	// Sanity: the graph really is bigger than raster-ops alone, which is
	// what the first version of this test wrongly assumed.
	assert.ok(needed.size >= 5,
		`expected several externalised modules, found ${needed.size}`);
});

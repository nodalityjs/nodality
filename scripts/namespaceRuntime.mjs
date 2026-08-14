// namespaceRuntime.mjs — rename webpack's runtime identifiers in the ESM
// bundles so they cannot collide with a CONSUMER's webpack runtime.
//
// The scaffold (create-nodality) bundles `nodality` as an ESM entry:
//
//   entry: "nodality"
//   output: { library: { type: "module" } }
//   experiments: { outputModule: true }
//
// With ESM output webpack has nowhere to put an IIFE, so it emits its
// runtime at MODULE TOP LEVEL. Our own dist/index.esm.js is itself a
// webpack bundle carrying the same top-level runtime, and webpack
// scope-hoists it into the consumer's scope — so both declare
//
//   var __webpack_module_cache__ = {};
//
// in one scope, and Terser refuses:
//
//   ERROR in lib.bundle.js from Terser plugin
//   "__webpack_module_cache__" is redeclared
//
// This surfaced only after raster-ops was externalised. Before that the
// entry had no imports, so the consumer's build needed no runtime of its
// own and there was nothing to collide with — the same change that fixed
// the split-registry bug created this one.
//
// `output.uniqueName` does not help: it namespaces runtime GLOBALS (chunk
// loading), not these internal identifiers. Ejecting the webpack bundle
// in favour of a re-export barrel would also work but changes what the
// package's main entry IS, days before a release.
//
// So: rename them. They are private to the emitted file — nothing outside
// it can refer to `__webpack_module_cache__` — which makes a textual
// rename safe as long as it is applied uniformly.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PREFIX = "__nodality_wp_";

let touched = 0;
for (const file of readdirSync(dist)) {
	// ESM only. The CJS/UMD builds are wrapped in a function scope by
	// webpack, so their runtime identifiers are already private and a
	// consumer bundling them cannot collide.
	if (!file.endsWith(".esm.js")) continue;

	const path = join(dist, file);
	const src = readFileSync(path, "utf8");

	// Every webpack runtime identifier starts `__webpack_`. Matching the
	// whole family (rather than just the one Terser happened to report)
	// matters: fixing only __webpack_module_cache__ moves the error to
	// __webpack_require__ on the next build.
	const out = src.replace(/\b__webpack_/g, PREFIX);
	if (out === src) continue;

	writeFileSync(path, out);
	const n = (src.match(/\b__webpack_/g) || []).length;
	console.log(`  ${file}: ${n} runtime identifier(s) namespaced → ${PREFIX}*`);
	touched++;
}

console.log(touched
	? `[nodality] runtime namespaced in ${touched} ESM bundle(s)`
	: "[nodality] no ESM bundle needed namespacing");

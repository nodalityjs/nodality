// stage-cache-bust.test.mjs — `nodality stage` puts the version in the URLs.
//
// sls3.cz's host caches JavaScript by URL. After an upgrade it kept serving
// the previous /dist/lib.bundle.js for a day while the pages beside it were
// new. stage now writes ?v=<version> into each page's importmap link to the
// bundle, and into the bundle's imports of the modules it stages beside it —
// a new bundle loading cached old copies of those would be worse than either
// version alone. Run for real against a throwaway project.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BIN = path.join(ROOT, "bin", "nodality.mjs");
const VERSION = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
let dir;

const PAGE = (src) => `<!doctype html><html><head>
<script type="importmap">
{ "imports": { "nodality": "${src}" } }
</script>
<link rel="preload" href="/dist/lib.bundle.js">
</head><body><div id="mount"></div></body></html>`;

before(() => {
	dir = mkdtempSync(path.join(tmpdir(), "nodality-stage-"));
	mkdirSync(path.join(dir, "node_modules"));
	symlinkSync(ROOT, path.join(dir, "node_modules", "nodality"), "dir");
	mkdirSync(path.join(dir, "upload", "en"), { recursive: true });
	writeFileSync(path.join(dir, "upload", "index.html"), PAGE("/dist/lib.bundle.js"));
	writeFileSync(path.join(dir, "upload", "en", "index.html"), PAGE("../dist/lib.bundle.js?v=0.0.1"));
});
after(() => { rmSync(dir, { recursive: true, force: true }); });

const stage = (...args) => spawnSync(process.execPath, [BIN, "stage", ...args], { cwd: dir, encoding: "utf8" });
const read = (rel) => readFileSync(path.join(dir, "upload", rel), "utf8");

test("the importmap link to the bundle carries the version, replacing an older one", () => {
	if (!existsSync(path.join(ROOT, "dist", "index.esm.js"))) assert.fail("dist/index.esm.js missing — run npm run build");
	const r = stage();
	assert.equal(r.status, 0, r.stderr);
	assert.match(read("index.html"), new RegExp(`"/dist/lib\\.bundle\\.js\\?v=${VERSION.replace(/\./g, "\\.")}"`));
	assert.match(read("en/index.html"), new RegExp(`"\\.\\./dist/lib\\.bundle\\.js\\?v=${VERSION.replace(/\./g, "\\.")}"`));
	assert.doesNotMatch(read("en/index.html"), /0\.0\.1/);
	// Outside the importmap nothing is touched.
	assert.match(read("index.html"), /<link rel="preload" href="\/dist\/lib\.bundle\.js">/);
});

// The same matcher stage uses: an import or re-export, not any "from" in text.
const RELSPEC = /(?:import|export)[^'"]*?from\s*["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)|import\s*["'](\.[^"']+)["']/g;
const specsOf = (code) => [...code.matchAll(RELSPEC)].map((m) => m[1] || m[2] || m[3]);

test("the bundle's imports of the staged modules carry it, and so do theirs", () => {
	const specs = specsOf(read("dist/lib.bundle.js"));
	assert.ok(specs.length > 0, "the bundle imports staged modules");
	for (const s of specs) assert.ok(s.endsWith(`?v=${VERSION}`), `${s} is not versioned`);
	const inner = specsOf(read("lib/raster-ops.js"));
	assert.ok(inner.length > 0, "raster-ops imports something of its own");
	for (const s of inner) assert.ok(s.endsWith(`?v=${VERSION}`), `${s} in raster-ops is not versioned`);
});

test("re-running changes nothing", () => {
	const before = [read("index.html"), read("dist/lib.bundle.js")];
	assert.equal(stage().status, 0);
	assert.deepEqual([read("index.html"), read("dist/lib.bundle.js")], before);
	assert.equal((read("dist/lib.bundle.js").match(/\?v=/g) || []).length, (before[1].match(/\?v=/g) || []).length, "no double stamp");
});

test("--no-cache-bust leaves the URLs bare", () => {
	writeFileSync(path.join(dir, "upload", "index.html"), PAGE("/dist/lib.bundle.js"));
	assert.equal(stage("--no-cache-bust").status, 0);
	assert.match(read("index.html"), /"\/dist\/lib\.bundle\.js"/);
	assert.doesNotMatch(read("dist/lib.bundle.js"), /\?v=/);
});

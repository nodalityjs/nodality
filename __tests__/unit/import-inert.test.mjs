// import-inert.test.mjs — phase P1 of HOUDINI-IMPL-SPEC.
//
// `import "nodality"` must not throw in an environment without a DOM.
//
// This is the first wall a new user hits: vitest and jest default to a
// Node environment, so a package that touches `window` at module scope
// dies at the import line, before a single test of theirs runs. It cannot
// be caught by this repo's own suite, because every other spec runs in a
// browser or in jsdom — which is exactly why it survived so long.
//
// What it caught when written (2026-08-12): twelve module-scope
// `window.X = X` global exposures across eleven files — checkbox, list
// (×2), nav-bar, data-list, form-all, radiogroup, floating-input, radio,
// picker, custom-div, range. `layout/index.js` had guarded its own block
// years ago; these were simply written outside it.
//
// The subject is the BUNDLE, not the source: `dist/` is what consumers
// resolve through package.json, and webpack can hoist or re-order in ways
// source-only checking would miss. That means these two cases need
// `npm run build` to have run — CI always builds before testing, and
// locally `npm run test` follows a build. If dist/ is absent the cases
// skip rather than fail, so a source-only checkout is not punished for a
// missing artefact.

import { test, skip } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// A clean child process. NODE_OPTIONS is emptied so nothing a developer
// has exported can quietly supply a DOM and make this pass by accident.
function runInBareNode(args) {
	return new Promise((res, rej) => {
		execFile(process.execPath, args, { env: { ...process.env, NODE_OPTIONS: "" } },
			(err, stdout, stderr) => {
				if (err && typeof err.code !== "number") return rej(err);
				res({ code: err ? err.code : 0, stdout, stderr });
			});
	});
}

const cases = [
	{ name: "ESM bundle", file: "dist/index.esm.js",
		args: (p) => ["--input-type=module", "-e", `await import(${JSON.stringify(p)})`] },
	{ name: "CJS bundle", file: "dist/index.cjs.js",
		args: (p) => ["-e", `require(${JSON.stringify(p)})`] },
	// The source entry too: it is what the sandbox pages and the SSG path
	// import directly, and it localises a regression to a file rather than
	// to a minified bundle offset.
	{ name: "source entry", file: "layout/index.js",
		args: (p) => ["--input-type=module", "-e", `await import(${JSON.stringify(p)})`] },
];

for (const c of cases) {
	test(`${c.name} imports in bare Node — no window, no document`, async (t) => {
		const path = resolve(ROOT, c.file);
		if (!existsSync(path)) {
			t.skip(`${c.file} not built — run npm run build`);
			return;
		}
		// Guard the guard: if this process had a DOM, the child inheriting
		// one would make the whole test vacuous.
		assert.equal(typeof globalThis.window, "undefined");
		assert.equal(typeof globalThis.document, "undefined");

		const { code, stderr } = await runInBareNode(c.args(path));
		assert.equal(code, 0,
			`importing ${c.file} in bare Node exited ${code}.\n` +
			`A module-scope window/document access is the usual cause — ` +
			`wrap it in \`if (typeof window !== "undefined")\`.\n${stderr}`);
	});
}

void skip;

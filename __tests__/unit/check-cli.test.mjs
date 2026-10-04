// check-cli.test.mjs — check_page without the MCP server.
//
// check_page was reachable only as an MCP tool. In a session where the server
// was not loaded (project MCP servers need approving) an agent could not run
// it at all: the module was not exported and no command reached it. Now it is
// `nodality/check` and `npx nodality check <file> [--base=<url>]`, exiting 1
// on findings so it can gate a build. Needs Playwright; skipped without.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BIN = path.join(ROOT, "bin", "nodality.mjs");
const dir = mkdtempSync(path.join(tmpdir(), "nodality-check-"));
const page = (name, body) => {
	const f = path.join(dir, name);
	writeFileSync(f, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`);
	return f;
};
const run = (...args) => spawnSync(process.execPath, [BIN, "check", ...args], { encoding: "utf8", cwd: dir, timeout: 120000 });
const noPlaywright = (r) => /playwright/i.test(r.stderr) && r.status === 1 && !r.stdout;

test("the package exports check_page as nodality/check", async () => {
	const mod = await import("nodality/check");
	assert.equal(typeof mod.checkPage, "function");
});

test("a clean page exits 0; a page with a finding exits 1 and names it", (t) => {
	const ok = run(page("ok.html", "<main><h1>Hello</h1><p>Readable text.</p></main>"));
	if (noPlaywright(ok)) return t.skip("playwright not installed");
	assert.equal(ok.status, 0, ok.stdout + ok.stderr);
	assert.match(ok.stdout, /✓ .*ok\.html/);

	const bad = run(page("bad.html", "<main><h1>Form</h1><input type='text'></main>"));
	assert.equal(bad.status, 1);
	assert.match(bad.stdout, /✗ .*bad\.html/);
	assert.match(bad.stdout, /CONTROL_WITHOUT_LABEL/);
	assert.match(bad.stdout, /→ /, "the repair is printed");
});

test("no file is a usage error, not a crash", () => {
	const r = run();
	assert.equal(r.status, 1);
	assert.match(r.stderr, /name one or more HTML files/);
});

// audit-fixes.test.mjs — the gaps an agent hit building a real site, closed.
//
// Each test is one finding from the suitcase-site build log (agentic-nav-report
// and changelog): a validator that vouched for ignored parameters, a schema
// that buried a type's own parameters, a preview that rendered nothing without
// saying so, an MCP server registered where sessions never started, a manual
// pre-release copy, contrast checks that passed faint text, a form title the
// schema called inert, and the library's own deprecation noise.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLI = path.join(ROOT, "bin", "nodality.mjs");
const SERVER = path.join(ROOT, "bin", "mcp-server.mjs");

let Des, validateNodes;
before(async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	dom.window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	({ Des } = await import("../../lib/designer.js"));
	({ validateNodes } = await import("../../lib/validate-nodes.js"));
});

const render = (els) => {
	document.getElementById("mount").innerHTML = "";
	new Des().nodes([]).add(els).set({ mount: "#mount", code: false, elements: false });
	return document.getElementById("mount");
};

/** One JSON-RPC call to a fresh MCP server. */
function mcp(name, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "pipe"] });
		let buf = "";
		const timer = setTimeout(() => { child.kill(); reject(new Error("timeout")); }, 60000);
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (d) => {
			buf += d;
			for (const line of buf.split("\n")) {
				if (!line.trim()) continue;
				let msg; try { msg = JSON.parse(line); } catch { continue; }
				if (msg.id === 2) {
					clearTimeout(timer); child.kill();
					resolve(JSON.parse(msg.result.content[0].text));
				}
			}
		});
		const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");
		send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
		send({ jsonrpc: "2.0", method: "notifications/initialized" });
		send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } });
	});
}

// ── validate_nodes knows what the conformance baseline knows ───────────

test("a parameter the type advertises and ignores is reported as PARAM_INERT", () => {
	const r = validateNodes([], [{ type: "checkbox", id: "c", name: "ok", color: "red" }]);
	const w = r.warnings.find((x) => x.code === "PARAM_INERT");
	assert.ok(w, JSON.stringify(r.warnings));
	assert.equal(w.path, "elements[0].color");
	assert.equal(r.ok, true, "a warning, not an error: the page still renders");
});

test("size on a text element gets the hint that actually helps", () => {
	const w = validateNodes([], [{ type: "h2", id: "t", text: "x", size: "S1" }]).warnings.find((x) => x.code === "PARAM_INERT");
	assert.match(w.valid[0], /`tag`/);
});

// ── form.title is read by the form ──────────────────────────────────────

test("a form's title is its accessible name, and quotes survive the generated code", () => {
	const mount = render([{ type: "form", id: "f", title: 'Request the "dossier"', children: [] }]);
	assert.equal(mount.querySelector("form").getAttribute("aria-label"), 'Request the "dossier"');
	const w = validateNodes([], [{ type: "form", id: "f", title: "x", children: [] }]).warnings;
	assert.deepEqual(w.filter((x) => x.path.endsWith(".title")), []);
});

// ── the library's own deprecation noise ─────────────────────────────────

test("rounded rounds, and no library component calls the deprecated round()", () => {
	const errors = []; const orig = console.error; const warn = console.warn;
	console.error = (m) => errors.push(String(m)); console.warn = (m) => errors.push(String(m));
	try {
		const mount = render([
			{ type: "a", id: "l", text: "Go", url: "#", rounded: true },
			{ type: "input", id: "i", name: "email", label: "Email", radius: 999 },
		]);
		assert.equal(mount.querySelector('[id="l"]').style.borderRadius, "0.5rem");
	} finally { console.error = orig; console.warn = warn; }
	assert.deepEqual(errors.filter((m) => /round\(\)/.test(m)), []);
});

// ── get_schema puts a type's own parameters first ───────────────────────

test("get_schema lists what the type reads before what it inherits, with a summary", async () => {
	const s = await mcp("get_schema", { type: "nav" });
	assert.ok(s.summary.total > s.summary.readByType);
	assert.equal(s.summary.readByType + s.summary.throughComponents, s.summary.total);
	const firstInherited = s.params.findIndex((p) => p.via !== "mapper");
	assert.ok(firstInherited >= s.summary.readByType, "every mapper-read parameter comes first");
	assert.ok(s.params.slice(0, s.summary.readByType).some((p) => p.name === "brand"));
});

// ── preview says when something rendered nothing ───────────────────────

test("preview reports an element that rendered empty, and takes a viewport", async () => {
	const out = await mcp("preview", { elements: [
		{ type: "p", id: "ok", text: "Hello" },
		{ type: "wrap", id: "hollow", children: [] },
	], viewport: "desktop" });
	assert.deepEqual(out.viewport, { width: 1440, height: 900 });
	assert.ok(out.empty && out.empty.some((e) => e.id === "hollow"), JSON.stringify(out.empty));
	assert.ok(!out.empty.some((e) => e.id === "ok"));
});

// ── check_page reads contrast the way people do ─────────────────────────

test("check_page reports small text that passes WCAG and still reads faint", async () => {
	const { checkPage } = await import("../../lib/check-page.js");
	const html = `<!doctype html><html lang="en"><head><title>t</title><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#8CCFD6">
<main><h1 style="color:#0E0F11">Title</h1>
<p id="faint" style="color:#2E3740;font-size:11.5px;font-weight:400">Thin small label on a mid-tone</p>
<p id="fine" style="color:#0E0F11;font-size:20px;font-weight:500;background:#F1EFEA">Readable</p></main></body></html>`;
	const r = await checkPage(html);
	const all = JSON.stringify(r);
	assert.match(all, /FAINT_TEXT/);
	assert.doesNotMatch(all, /LOW_CONTRAST/, "WCAG passes both — that is the point");
	const findings = (r.issues || r.errors || r.findings || []).concat(r.warnings || []);
	assert.ok(!findings.some((f) => f.code === "FAINT_TEXT" && /fine/.test(JSON.stringify(f))));
});

// ── the MCP server registered where sessions start ──────────────────────

test("mcp --register writes .mcp.json at a parent root, pointing npx at the project", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-"));
	const project = path.join(dir, "site");
	fs.mkdirSync(project);
	try {
		execFileSync(process.execPath, [CLI, "mcp", "--register", `--root=${dir}`], { cwd: project, stdio: "pipe" });
		const cfg = JSON.parse(fs.readFileSync(path.join(dir, ".mcp.json"), "utf8"));
		assert.deepEqual(cfg.mcpServers.nodality, { command: "npx", args: ["--prefix", "site", "nodality", "mcp"] });
		assert.throws(() => execFileSync(process.execPath, [CLI, "mcp", "--register", `--root=${project}/nope`], { cwd: project, stdio: "pipe" }));
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── link-local: a pre-release copy that says so ─────────────────────────

test("link-local copies a local build in, warns on every command, and refuses a wrong source", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "link-"));
	const target = path.join(dir, "node_modules", "nodality");
	fs.mkdirSync(target, { recursive: true });
	fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "nodality", version: "0.0.0" }));
	try {
		execFileSync(process.execPath, [CLI, "link-local", `--from=${ROOT}`, "--no-build"], { cwd: dir, stdio: "pipe" });
		const marker = JSON.parse(fs.readFileSync(path.join(target, ".linked-local.json"), "utf8"));
		assert.equal(path.resolve(marker.from), path.resolve(ROOT));
		assert.ok(fs.existsSync(path.join(target, "lib", "validate-nodes.js")));
		// Every other command warns, on stderr, while the local build is in place.
		const r = spawnSync(process.execPath, [CLI, "help"], { cwd: dir, encoding: "utf8" });
		assert.match(r.stderr, /LOCAL build of nodality/);
		assert.throws(() => execFileSync(process.execPath, [CLI, "link-local", `--from=${dir}`], { cwd: dir, stdio: "pipe" }));
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

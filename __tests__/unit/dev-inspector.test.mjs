// The inspector end to end: a real page built by the shipped bundle, served
// by `nodality dev`, driven in Chromium with real keys and clicks. Asserts
// what lands in .nodality/ — the files an agent reads.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDevServer } from "../../bin/dev-server.mjs";
import { readCurrent, readComments } from "../../lib/dev-state.js";
import { validateNodes } from "../../lib/validate-nodes.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUNDLE = path.join(ROOT, "dist", "index.esm.js");

const E = [
  { id: "hero", type: "h1", text: "Prague summer races" },
  { id: "intro", type: "p", text: "Three races, one summer." },
  { id: "link", type: "a", text: "Races", url: "#races" },
  { id: "pair", type: "row", children: [{ id: "left", type: "p", text: "Krusnoman" }, { id: "right", type: "p", text: "Night 10K" }] },
];
const N = [
  { op: { name: "gradient", gradient: "linear-gradient(90deg,#1d6fe0,#7fd1ff)" }, target: ["hero"] },
  { op: { name: "arrange", mode: "column" }, target: ["pair"], range: [0, 640] },
];

const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="mount"></div>
<script type="module">
import { Des } from "./dist/lib.bundle.js";
new Des().nodes(${JSON.stringify(N)}).add(${JSON.stringify(E)}).set({ mount: "#mount", code: false });
</script></body></html>`;

test("the fixture page is valid Nodality", () => {
  const r = validateNodes(N, E);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.warnings || [], []);
});

test("pick and comment in a real page land in .nodality/ for the agent", { timeout: 60000 }, async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { t.skip("playwright not installed"); return; }
  if (!fs.existsSync(BUNDLE) || !fs.readFileSync(BUNDLE, "utf8").includes("__NODALITY_DEV__")) {
    t.skip("dist/index.esm.js predates the dev hook — run npm run build");
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nodality-inspector-"));
  const upload = path.join(root, "upload");
  fs.mkdirSync(upload);
  fs.writeFileSync(path.join(upload, "index.html"), PAGE);
  // A page written with the imperative layer: no pair, no ids.
  fs.mkdirSync(path.join(upload, "pages"));
  fs.writeFileSync(path.join(upload, "imperative.html"), '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="mount"></div><script type="module" src="pages/imperative.js"></script></body></html>');
  fs.writeFileSync(path.join(upload, "pages", "imperative.js"), 'import { Text } from "../dist/lib.bundle.js";\n\nnew Text("Made by hand").set({ size: "S2" }).render("#mount");\n');
  // The layout `nodality stage` produces: the bundle imports ../lib/raster-ops.js.
  fs.mkdirSync(path.join(upload, "dist"));
  fs.copyFileSync(BUNDLE, path.join(upload, "dist", "lib.bundle.js"));
  fs.cpSync(path.join(ROOT, "lib"), path.join(upload, "lib"), { recursive: true });
  const server = createDevServer({ root, upload });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const waitFor = async (fn, what) => {
    for (let i = 0; i < 100; i++) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 50)); }
    throw new Error(`timed out waiting for ${what}`);
  };
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + "/");
    await page.waitForSelector("#hero");
    await waitFor(() => readCurrent(root)?.page === "index.html", "the arrival report");
    assert.equal(readCurrent(root).selection, null, "arriving reports the page, not a pick");

    // Off by default: a click is the page's own.
    await page.click("#link");
    assert.equal(new URL(page.url()).hash, "#races", "with the inspector off, a link still navigates");

    // S, then click the heading.
    await page.keyboard.press("s");
    await page.click("#hero");
    const cur = await waitFor(() => readCurrent(root)?.selection, "the pick");
    assert.deepEqual(cur.ids, ["hero"]);
    assert.equal(cur.type, "h1");
    assert.deepEqual(cur.nodesTargeting, [0]);
    assert.deepEqual(cur.activeRanges, []);
    assert.equal(readCurrent(root).viewport.width, 390);

    // A group with a width-ranged node: the range in force at 390 px rides along.
    await page.click("#pair", { position: { x: 2, y: 2 } });
    await waitFor(() => readCurrent(root)?.selection?.ids?.[0] === "pair" || readCurrent(root)?.selection?.ids?.[0] === "left", "the row pick");
    const row = readCurrent(root).selection;
    assert.deepEqual(row.ids, ["pair"], "a click on the row's own box picks the row");
    assert.deepEqual(row.nodesTargeting, [1]);
    assert.deepEqual(row.activeRanges, [{ node: 1, range: [0, 640] }], "at 390 px the 0–640 range is in force");

    // In select mode a link does not navigate: the click is the inspector's.
    await page.evaluate(() => { location.hash = ""; });
    await page.click("#link");
    assert.equal(new URL(page.url()).hash, "", "an inspector click never reaches the page");

    // C, click the paragraph, type a note.
    await page.keyboard.press("c");
    await page.click("#intro");
    const input = page.locator('[data-nodality="dev-inspector"] >> #note');
    await input.fill("shorter, one line");
    await input.press("Enter");
    const notes = await waitFor(() => readComments(root).length && readComments(root), "the note");
    assert.equal(notes[0].note, "shorter, one line");
    assert.deepEqual(notes[0].target, ["intro"]);
    assert.equal(notes[0].page, "index.html");
    await page.locator('[data-nodality="dev-inspector"] >> .pin').first().waitFor();

    // An empty note is refused in place.
    await page.click("#hero");
    await page.locator('[data-nodality="dev-inspector"] >> #add').click();
    assert.match(await page.locator('[data-nodality="dev-inspector"] >> #err').textContent(), /Write a note/);
    assert.equal(readComments(root).length, 1);

    // Drag across the heading and the paragraph: one note on both.
    await page.keyboard.press("Escape");
    await page.keyboard.press("c");
    const a = await page.locator("#hero").boundingBox();
    const b = await page.locator("#intro").boundingBox();
    await page.mouse.move(Math.max(1, Math.min(a.x, b.x) - 4), a.y - 4);
    await page.mouse.down();
    await page.mouse.move(Math.max(a.x + a.width, b.x + b.width) + 4, b.y + b.height + 4, { steps: 5 });
    await page.mouse.up();
    await input.fill("tighter spacing between these");
    await input.press("Enter");
    const both = await waitFor(() => readComments(root).length === 2 && readComments(root)[1], "the region note");
    assert.deepEqual([...both.target].sort(), ["hero", "intro"]);
    assert.ok(both.rect && both.rect.w > 0, "a dragged note keeps its rectangle");

    // The imperative page: picked by the line that created the element.
    await page.goto(base + "/imperative.html");
    const made = page.locator("[data-nod-src]", { hasText: "Made by hand" }).first();
    await made.waitFor();
    await page.keyboard.press("s");
    await made.click();
    const pick = await waitFor(() => readCurrent(root)?.page === "imperative.html" && readCurrent(root)?.selection, "the imperative pick");
    assert.deepEqual(pick.ids, []);
    assert.deepEqual(pick.source, { file: "pages/imperative.js", line: 3, col: 1, code: 'new Text("Made by hand").set({ size: "S2" }).render("#mount");' });
    await page.keyboard.press("c");
    await made.click();
    await input.fill("bigger");
    await input.press("Enter");
    const byCode = await waitFor(() => readComments(root).find((c) => c.page === "imperative.html"), "the note on code");
    assert.deepEqual(byCode.target, []);
    assert.equal(byCode.source.file, "pages/imperative.js");
    await page.goto(base + "/");
    await page.waitForSelector("#hero");

    // Live reload: a change under upload/ reloads the page.
    const reloaded = page.waitForEvent("load");
    server.reload();
    await reloaded;
  } finally {
    await browser.close();
    server.close();
  }
});

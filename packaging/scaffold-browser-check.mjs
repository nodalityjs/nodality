// scaffold-browser-check.mjs — load the scaffolded page in a real browser
// and assert it RENDERS.
//
//   node packaging/scaffold-browser-check.mjs /tmp/scaffold/smoke-app/upload
//
// Why this exists, specifically:
//
// 1.1.0 shipped a package whose ESM bundle ended with
// `export const Image=…`. `Image` is a DOM constructor, so when a
// consumer's webpack concatenated the module the colliding declaration
// was renamed while the export clause still said `Image`, and every
// scaffolded site died on load with
//
//   Uncaught SyntaxError: Export 'Image' is not defined in module
//
// Nothing caught it. The package imports fine in Node (no DOM globals).
// The scaffold BUILDS fine — a bundler does not evaluate its output.
// Prerender runs in jsdom against the SOURCES, not the bundle. And the
// job's assertions grepped the prerendered HTML, which is written before
// any of the client code runs. A user found it by opening the page.
//
// So: open the page. The scaffold's shell deliberately clears #mount and
// re-renders from the bundle, which means a page that only "looks right"
// statically will still fail here — the client render is the thing under
// test.

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";

const dir = resolve(process.argv[2] || "upload");
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = join(dir, url === "/" ? "index.html" : url);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

const fail = (msg) => {
  console.error(`::error::${msg}`);
  process.exitCode = 1;
};

await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
console.log(`[scaffold-check] serving ${dir} at ${url}`);

const browser = await chromium.launch();
const page = await browser.newPage();

// Any of these means the page is broken, whatever the DOM ends up
// looking like. `pageerror` is what would have caught the Image bug.
const problems = [];
page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console error: ${m.text()}`);
});
page.on("requestfailed", (r) => {
  problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`);
});

await page.goto(url, { waitUntil: "networkidle" });

// The shell empties #mount and the bundle refills it, so waiting for
// content IS waiting for the client render to succeed.
let rendered = true;
try {
  await page.waitForFunction(
    () => document.querySelector("#mount")?.children.length > 0,
    null, { timeout: 15000 });
} catch {
  rendered = false;
  fail("#mount is still empty after load — the client bundle never rendered");
}

if (rendered) {
  const h = await page.evaluate(() => {
    const el = document.querySelector("#mount h1") ||
      document.querySelector("#mount *");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      text: el.textContent.trim(),
      fill: cs.webkitTextFillColor,
      strokeColor: cs.webkitTextStrokeColor,
      strokeWidth: cs.webkitTextStrokeWidth,
      fontSize: cs.fontSize,
    };
  });

  if (!h) {
    fail("nothing rendered inside #mount");
  } else {
    console.log(`[scaffold-check] rendered: <${h.tag}> "${h.text}" ` +
      `fill=${h.fill} stroke=${h.strokeWidth} ${h.strokeColor} size=${h.fontSize}`);

    if (h.text !== "Hello") {
      fail(`expected the component's text to be "Hello", got "${h.text}"`);
    }
    // OUTLINED, not merely present. The scaffold sets a transparent fill
    // and a stroke; if set() options stopped reaching the DOM the text
    // would still say Hello while looking completely different, and a
    // text-only assertion would pass.
    if (/^0px$/.test(h.strokeWidth)) {
      fail(`text is not outlined — -webkit-text-stroke-width is ${h.strokeWidth}`);
    }
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(h.fill)) {
      fail(`text is not outlined — -webkit-text-fill-color is ${h.fill}, ` +
        `expected transparent`);
    }
  }
}

if (problems.length) {
  for (const p of problems) fail(p);
} else {
  console.log("[scaffold-check] no page errors, console errors or failed requests");
}

await browser.close();
server.close();

if (process.exitCode) {
  console.error("[scaffold-check] FAILED");
} else {
  console.log("[scaffold-check] OK — the scaffolded page renders outlined Hello");
}

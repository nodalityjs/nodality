// Runs nodality/responsive against a served harness page and prints a JSON
// verdict. Spawned by responsive-arrange.spec.js: Playwright's test loader
// reads lib/*.js as CommonJS, so the ES module is imported here, in plain Node.
//
//   node responsive-runner.mjs <baseURL> <spec.json>

import fs from "node:fs";
import { chromium } from "playwright";
import { respond } from "../../../lib/responsive.js";

const [baseURL, specPath] = process.argv.slice(2);
const SPEC = JSON.parse(fs.readFileSync(specPath, "utf8"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const renderAt = async (width, spec) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`${baseURL}/public/responsive-harness`);
  await page.waitForFunction(() => window.__nodalityReady === true);
  await page.evaluate((s) => window.__nodalityRender(s), spec);
  // resprop's first run is scheduled with setTimeout(0); let it land.
  await page.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => r()), 20)));
};

const direction = (id) => page.evaluate((x) => getComputedStyle(document.getElementById(x)).flexDirection, id);

try {
  const out = await respond(page, SPEC, renderAt);
  const final = { elements: out.elements, nodes: out.nodes };

  const exact = {};
  for (const r of out.report.filter((x) => x.kind !== "nav")) {
    const [, hi] = r.intervals[0] || [];
    if (hi == null || hi >= 1920) continue;
    await renderAt(hi, final);
    const atHi = await direction(r.id);
    await renderAt(hi + 1, final);
    exact[r.id] = { hi, atHi, above: await direction(r.id) };
  }

  const widths = new Set();
  for (let w = 320; w <= 1920; w += 32) widths.add(w);
  for (const r of out.report) for (const [lo, hi] of r.intervals) {
    for (const w of [lo - 1, lo, hi, hi + 1]) if (w >= 320 && w <= 1920) widths.add(w);
  }
  const sweep = [...widths].sort((a, b) => a - b);
  const overflow = async (spec) => {
    const bad = [];
    for (const w of sweep) {
      await renderAt(w, spec);
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) bad.push(w);
    }
    return bad;
  };

  process.stdout.write(JSON.stringify({
    report: out.report.map(({ id, kind, intervals, infeasible, probes, roots }) => ({ id, kind, intervals, infeasible, probes, roots })),
    nodes: out.synthesized,
    measurements: out.measurements,
    exact,
    overflowAsAuthored: await overflow(SPEC),
    overflowSynthesized: await overflow(final),
  }));
} finally {
  await browser.close();
}

// transition-choreography.spec.js — phase T3 of TRANSITION-IMPL-SPEC.
//
// Two node-level controls, both acting on the LOCAL progress an op's
// keyframes are sampled against:
//
//   window: [0.2, 0.8]   this op spans that slice of t — stagger
//   ease:   "in-out"     easing on the local progress
//
// Easing lives on the node rather than in the timeline because a chain
// wants different ops on different curves. The timeline driving `t`
// stays linear, so scrubbing and reversal (P-1) are unaffected.

const { test, expect } = require('@playwright/test');
const PAGE = '/public/transition.html';

async function load(page, baseURL, ops) {
  await page.goto(`${baseURL}${PAGE}#ops=${ops}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(280);
}
const at = async (page, t) => {
  await page.evaluate(async (v) => { window.__pipe.setProgress(v);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, t);
  return page.locator('#stage').screenshot();
};

test('T3: a window staggers an op into its slice of t', async ({ page, baseURL }) => {
  // A drives in the first half, B in the second. At t=0.25 only A is
  // active; at t=0.75 only B. Neither is active at both.
  await load(page, baseURL, 'staggerA');
  const a25 = await at(page, 0.25);
  const a75 = await at(page, 0.75);
  const a100 = await at(page, 1);

  await load(page, baseURL, 'staggerB');
  const b25 = await at(page, 0.25);
  const b75 = await at(page, 0.75);

  // A's window is [0, .5]: peaked at .25, finished (back to 0) by .5.
  expect(a25.equals(a100)).toBe(false);
  // B's window is [.5, 1]: nothing has happened yet at .25.
  expect(b25.equals(a25)).toBe(false);
  // The two are choreographed differently at the same t.
  expect(a75.equals(b75)).toBe(false);
});

test('T3: easing changes the curve, not the endpoints', async ({ page, baseURL }) => {
  await load(page, baseURL, 'plain');   // a real origin, for the import below
  const r = await page.evaluate(async () => {
    const { resolveNode } = await import('/lib/raster-ops.js');
    const lin = { op: 'flow', strength: [0, 100] };
    const eas = { op: 'flow', strength: [0, 100], ease: 'in-out' };
    const sample = (n) => [0, 0.25, 0.5, 0.75, 1].map((t) => resolveNode(n, t).strength);
    return { lin: sample(lin), eas: sample(eas) };
  });
  // Endpoints identical — easing must not move where a transition starts
  // or finishes, or a reversal would not meet its own start frame.
  expect(r.eas[0]).toBeCloseTo(r.lin[0], 5);
  expect(r.eas[4]).toBeCloseTo(r.lin[4], 5);
  // ...but the middle is reshaped.
  expect(r.eas[1]).toBeLessThan(r.lin[1]);
  expect(r.eas[3]).toBeGreaterThan(r.lin[3]);
  expect(r.eas[2]).toBeCloseTo(r.lin[2], 5);   // symmetric at the midpoint
});

test('T3: transition presets are ordinary data', async ({ page, baseURL }) => {
  await load(page, baseURL, 'plain');
  const shape = await page.evaluate(async () => {
    const { preset, presetInfo } = await import('/lib/raster-presets.js');
    const p = preset('t-vhs');
    return {
      ops: p.map((n) => n.op),
      keyframed: p.filter((n) => Array.isArray(n.amount) || Array.isArray(n.strength)).length,
      windowed: p.filter((n) => Array.isArray(n.window)).length,
      summary: !!presetInfo('t-vhs').summary,
      isPlainData: JSON.parse(JSON.stringify(p)).length === p.length,
    };
  });
  expect(shape.ops).toEqual(['aberration', 'flow']);
  expect(shape.keyframed).toBe(2);
  expect(shape.windowed).toBe(1);
  expect(shape.summary).toBe(true);
  // Round-trips through JSON: a transition preset is nodes, not code.
  expect(shape.isPlainData).toBe(true);
});

test('T3: a preset renders, and vanishes at both ends', async ({ page, baseURL }) => {
  await load(page, baseURL, 'tvhs');
  const t0 = await at(page, 0);
  const mid = await at(page, 0.5);
  const t1 = await at(page, 1);
  expect(mid.equals(t0)).toBe(false);
  expect(mid.equals(t1)).toBe(false);
});

// t-particles. The op gathers: every pixel looks for the particle that
// covers it, and where none does the sample lands outside both boxes,
// which in a transition is transparent. So mid-flight the page behind
// shows through between the dots, and at both ends nothing is left.
const pixelsOf = (page, png) => page.evaluate(async (b64) => {
  const im = new Image();
  im.src = 'data:image/png;base64,' + b64;
  await im.decode();
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  return Array.from(x.getImageData(0, 0, c.width, c.height).data);
}, png.toString('base64'));

// The body is #0d1520; both captures are bright (teal, orange).
const isBackdrop = (d, i) =>
  Math.abs(d[i] - 13) + Math.abs(d[i + 1] - 21) + Math.abs(d[i + 2] - 32) < 24;

const meanDiff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

test('T3: t-particles breaks the morph into dots and leaves nothing at either end',
  async ({ browser, baseURL }) => {
    // ~29 s locally; CI runners are slower and hit the global 30 s limit
    test.setTimeout(90_000);
    const frames = async (ops) => {
      const page = await browser.newPage();
      await load(page, baseURL, ops);
      const out = {};
      for (const t of [0, 0.5, 1]) out[t] = await pixelsOf(page, await at(page, t));
      out.errors = await page.evaluate(() => window.__errors);
      await page.close();
      return out;
    };
    const plain = await frames('plain');
    const part = await frames('tpart');
    expect(part.errors).toEqual([]);

    // Identity at both ends: the same picture as no effect at all.
    expect(meanDiff(part[0], plain[0])).toBeLessThan(0.5);
    expect(meanDiff(part[1], plain[1])).toBeLessThan(0.5);

    // Mid-flight the shape has come apart: of the pixels a plain morph
    // covers, a good share now shows the backdrop between particles.
    let shape = 0, through = 0;
    for (let i = 0; i < plain[0.5].length; i += 4) {
      if (isBackdrop(plain[0.5], i)) continue;
      shape++;
      if (isBackdrop(part[0.5], i)) through++;
    }
    expect(shape).toBeGreaterThan(1000);
    expect(through / shape).toBeGreaterThan(0.25);
  });

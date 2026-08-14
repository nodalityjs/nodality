// transition-progress.spec.js — phase T1 of TRANSITION-IMPL-SPEC.
//
// `t` is an INPUT, not a timer. That single decision is what makes a
// transition deterministic to test (set t, screenshot — no waiting on a
// timeline), interruptible for free (reverse = animate t back down), and
// scroll-scrubbable without a second code path.
//
// Keyframed params are the other half: `strength: [0, 40, 0]`. The hard
// part is not interpolation, it is telling keyframes apart from params
// that are legitimately arrays — `mask.at`, `remap`, `colors`, `points`,
// `merge.a`. H4's doc.params units already carry that distinction, so a
// scalar-united param given as numbers is keyframes and everything else
// is data. An op with no doc never keyframes.

const { test, expect } = require('@playwright/test');
const PAGE = '/public/rasterOps.html';

async function load(page, baseURL, ops) {
  await page.goto(`${baseURL}${PAGE}#ops=${ops}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(300);
}
const setT = (page, t) => page.evaluate(async (v) => {
  const { activeRasterPipelines } = await import('/lib/raster-ops.js');
  activeRasterPipelines()[0].setProgress(v);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}, t);

test('T1 DoD: a keyframed param peaks at mid-t and vanishes at both ends',
  async ({ page, baseURL }) => {
    // speed: 0 freezes the noise field, so any difference between frames
    // is the keyframe and not the animation.
    await load(page, baseURL, 'kfZero');
    const zero = await page.locator('#mount').screenshot();

    await load(page, baseURL, 'kfFlow');
    await setT(page, 0);
    const t0 = await page.locator('#mount').screenshot();
    await setT(page, 0.5);
    const mid = await page.locator('#mount').screenshot();
    await setT(page, 1);
    const t1 = await page.locator('#mount').screenshot();

    // Ends are the no-op: strength interpolates to 0 at t=0 and t=1.
    expect(t0.equals(zero)).toBe(true);
    expect(t1.equals(zero)).toBe(true);
    // The middle is not.
    expect(mid.equals(zero)).toBe(false);
  });

test('T1: progress is deterministic — the same t renders the same frame',
  async ({ page, baseURL }) => {
    await load(page, baseURL, 'kfFlow');
    await setT(page, 0.37);
    const a = await page.locator('#mount').screenshot();
    await setT(page, 0.9);
    await setT(page, 0.37);
    const b = await page.locator('#mount').screenshot();
    // No timer, no easing state: t alone determines the picture. This is
    // what makes scrubbing and reversal free.
    expect(b.equals(a)).toBe(true);
  });

test('T1: setProgress clamps and reports', async ({ page, baseURL }) => {
  await load(page, baseURL, 'kfFlow');
  const r = await page.evaluate(async () => {
    const { activeRasterPipelines } = await import('/lib/raster-ops.js');
    const p = activeRasterPipelines()[0];
    return { hi: p.setProgress(3), lo: p.setProgress(-1), read: (p.setProgress(0.4), p.progress) };
  });
  expect(r.hi).toBe(1);
  expect(r.lo).toBe(0);
  expect(r.read).toBeCloseTo(0.4, 5);
});

test('T1: a chain with no keyframes is untouched by progress',
  async ({ page, baseURL }) => {
    // The common case must cost nothing and change nothing.
    await load(page, baseURL, 'halftone');
    const before = await page.locator('#mount').screenshot();
    await setT(page, 0.5);
    const after = await page.locator('#mount').screenshot();
    expect(after.equals(before)).toBe(true);
  });

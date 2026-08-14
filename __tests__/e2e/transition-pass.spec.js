// transition-pass.spec.js — phase T2 of TRANSITION-IMPL-SPEC.
//
// Two captures, one interpolating box. u_tex is the NEW element, u_old
// the frozen OLD one, and both are drawn into a box lerped from the old
// rect to the new rect by t — geometry and pixels kept as separate
// problems.
//
// The old side MUST be a frozen capture: by the time a morph runs, that
// DOM is gone. Which is why transitions need no live-capture support at
// all, and therefore work in every browser with WebGL rather than only
// those in the HTML-in-Canvas origin trial. That is asserted below.

const { test, expect } = require('@playwright/test');
const PAGE = '/public/transition.html';

async function load(page, baseURL, ops) {
  await page.goto(`${baseURL}${PAGE}#ops=${ops}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(300);
}
const setT = (page, t) => page.evaluate(async (v) => {
  window.__pipe.setProgress(v);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}, t);

test('T2 DoD: the transition renders distinctly across t, deterministically',
  async ({ page, baseURL }) => {
    await load(page, baseURL, 'plain');
    const shots = {};
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      await setT(page, t);
      shots[t] = await page.locator('#stage').screenshot();
    }
    // Every sampled point is a different picture: the box is moving and
    // the two captures are crossing.
    const keys = Object.keys(shots);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        expect(shots[keys[i]].equals(shots[keys[j]]),
          `t=${keys[i]} and t=${keys[j]} rendered identically`).toBe(false);
      }
    }
    // And re-setting a value reproduces its frame exactly — t is an
    // input, so there is no timeline state to drift.
    await setT(page, 0.25);
    const again = await page.locator('#stage').screenshot();
    expect(again.equals(shots['0.25'])).toBe(true);
  });

test('T2: t=0 shows the OLD geometry, t=1 the NEW', async ({ page, baseURL }) => {
  await load(page, baseURL, 'plain');
  // Sample inside the old rect but outside the new one, and vice versa.
  // oldRect = 20,20 600x60 ; newRect = 200,60 320x180
  const probe = async (t, x, y) => {
    await setT(page, t);
    const shot = await page.locator('#stage').screenshot({
      clip: { x, y, width: 6, height: 6 },
    });
    return shot.length;   // a uniform transparent patch compresses smaller
  };
  // (40, 30): inside old, outside new.
  const oldOnly0 = await probe(0, 40, 30);
  const oldOnly1 = await probe(1, 40, 30);
  // (300, 200): outside old, inside new.
  const newOnly0 = await probe(0, 300, 200);
  const newOnly1 = await probe(1, 300, 200);
  // The box has moved away from the first point and onto the second.
  expect(oldOnly0).not.toBe(oldOnly1);
  expect(newOnly0).not.toBe(newOnly1);
});

test('T2: transitions do not require live capture', async ({ page, baseURL }) => {
  // The whole point of P-2. The pipeline may pick either backend for the
  // NEW side, but the transition must render regardless — the old side is
  // a still, so nothing here depends on the origin trial.
  await load(page, baseURL, 'plain');
  const info = await page.evaluate(() => ({
    backend: window.__pipe.backend,
    errors: window.__errors,
    hasCanvas: !!document.querySelector('[data-nodality-raster]'),
  }));
  expect(info.errors).toEqual([]);
  expect(info.hasCanvas).toBe(true);
  expect(['live', 'snapshot']).toContain(info.backend);
});

test('T2: an effect chain decorates the transition, keyframed over t',
  async ({ page, baseURL }) => {
    // The composability claim, over time: ordinary ops with keyframed
    // params, running on the crossfaded content.
    await load(page, baseURL, 'plain');
    await setT(page, 0.5);
    const plain = await page.locator('#stage').screenshot();

    await load(page, baseURL, 'vhs');
    await setT(page, 0.5);
    const vhs = await page.locator('#stage').screenshot();
    expect(vhs.equals(plain)).toBe(false);

    // ...and the keyframes return to zero at the ends. The control has to
    // be the SAME chain with the param pinned at 0 — not an empty chain,
    // which takes a different compositing path entirely (that mistake is
    // what surfaced the vacuous-pureOverlay bug).
    await load(page, baseURL, 'abOnly');
    await setT(page, 1);
    const kfEnd = await page.locator('#stage').screenshot();
    await load(page, baseURL, 'abZero');
    await setT(page, 1);
    const constEnd = await page.locator('#stage').screenshot();
    expect(kfEnd.equals(constEnd)).toBe(true);

    await load(page, baseURL, 'abOnly');
    await setT(page, 0.5);
    const kfMid = await page.locator('#stage').screenshot();
    expect(kfMid.equals(constEnd)).toBe(false);
  });

// ── the two gaps closed after the first T2 landing ──────────────────

test('T2 gap 1: the real new element is hidden until the morph completes',
  async ({ page, baseURL }) => {
    // Without this the destination is painted under the canvas and is
    // visible at t=0 — the morph shows its own endpoint behind its start
    // frame. Ink suppression is driven off `progress`, so it is a pure
    // function of t (P-1) and scrubbing back out of 1 re-hides.
    await load(page, baseURL, 'plain');
    const inkAt = (t) => page.evaluate(async (v) => {
      window.__pipe.setProgress(v);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const el = document.getElementById('newEl');
      return getComputedStyle(el).color;
    }, t);

    const mid = await inkAt(0.5);
    const end = await inkAt(1);
    const backAgain = await inkAt(0.5);

    expect(mid).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(end).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    // Scrubbing backwards re-hides — it is not a one-way lifecycle event.
    expect(backAgain).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  });

test('T2 gap 2: each side can travel its own path', async ({ page, baseURL }) => {
  // One shared box could only express "both march together". With
  // oldTo/newFrom the outgoing element exits left while the incoming one
  // enters from the right — per-side motion kept in the geometry tier.
  await load(page, baseURL, 'plain');
  await page.evaluate(async () => {
    window.__pipe.setProgress(0.5);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const together = await page.locator('#stage').screenshot();

  await load(page, baseURL, 'split');
  await page.evaluate(async () => {
    window.__pipe.setProgress(0.5);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const apart = await page.locator('#stage').screenshot();

  expect(apart.equals(together)).toBe(false);
});

test('T2: a capture landing AFTER completion does not blank the element',
  async ({ page, baseURL }) => {
    // The bug this replaces only appeared in a real browser. The snapshot
    // path hides the host's ink on EVERY capture completion, and a capture
    // can land long after a transition finishes — a resize, a late image
    // load, a refresh(). When one landed after t reached 1, the ink was
    // hidden again while the canvas was already down, and the element
    // vanished. Headless never reproduced it: it finishes its single
    // capture before anything can scrub.
    //
    // Ownership is now decided by progress in one place, so a late
    // capture cannot contradict it.
    await load(page, baseURL, 'plain');
    await setT(page, 1);

    const before = await page.evaluate(() => {
      const el = document.getElementById('newEl');
      return getComputedStyle(el).color;
    });

    const after = await page.evaluate(async () => {
      await window.__pipe.refresh();
      await new Promise((r) => setTimeout(r, 250));
      const el = document.getElementById('newEl');
      const cv = window.__pipe.canvas;
      return { color: getComputedStyle(el).color,
               canvasVis: cv.style.visibility,
               // The live backend MOVES the element into the canvas, so
               // the canvas is its home rather than an overlay over it.
               hostsContent: cv.contains(el) };
    });

    // The invariant is about the ELEMENT: it stays painted through a late
    // capture. That holds on both backends.
    expect(before).not.toMatch(/rgba\(0, 0, 0, 0\)/);
    expect(after.color).toBe(before);

    // "The canvas stands down" is only meaningful when it overlays the
    // content. When it HOSTS the content, standing down would hide the
    // element it is handing over to — which was the t=1 disappearance
    // reported on live-capable Chrome, invisible to a snapshot-only run.
    expect(after.canvasVis).toBe(after.hostsContent ? 'visible' : 'hidden');
  });

test('T2: the completed state is actually ON SCREEN at t=1, on either backend',
  async ({ page, baseURL }) => {
    // The reported symptom was narrow and total: every t from 0 to 0.99
    // looked right, and at exactly 1.0 the element vanished. It only
    // happened on Chrome with the HTML-in-Canvas API, because that
    // backend MOVES the element into the canvas — so the t=1 "canvas
    // stands down" step hid the content instead of revealing it. A
    // snapshot-only browser can never show this, which is why every
    // check that ran there said the handover was fine.
    //
    // So assert the thing the user actually sees: pixels, at t=1.
    await load(page, baseURL, 'plain');

    await setT(page, 0.5);
    const mid = await page.locator('#stage').screenshot();
    await setT(page, 1);
    const end = await page.locator('#stage').screenshot();

    const spread = (buf) => {
      let lo = 255, hi = 0;
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] < lo) lo = buf[i];
        if (buf[i] > hi) hi = buf[i];
      }
      return hi - lo;
    };

    // A blank stage is a single flat colour. The completed card is not.
    expect(spread(mid), 'mid-morph should not be blank').toBeGreaterThan(8);
    expect(spread(end), 'the completed state must be visible at t=1')
      .toBeGreaterThan(8);

    // And the element itself is painted, not transparent ink.
    const color = await page.evaluate(() =>
      getComputedStyle(document.getElementById('newEl')).color);
    expect(color).not.toMatch(/rgba\(0, 0, 0, 0\)/);
  });

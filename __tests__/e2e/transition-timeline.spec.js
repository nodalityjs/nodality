// transition-timeline.spec.js — phase T4 of TRANSITION-IMPL-SPEC.
//
// The pipeline renders whatever `t` it is given (T1–T3). This is about
// where t comes from, and the single property everything rests on:
// retargeting starts from the CURRENT value, never from zero. Reversing a
// half-finished morph is `to(0)` continuing from 0.5, not a snap back to
// the start and a replay.
//
// That falls out of t being an input rather than a timer — there is no
// timeline state to unwind, only a number to move.

const { test, expect } = require('@playwright/test');
const PAGE = '/public/transition.html';

async function load(page, baseURL, ops = 'plain') {
  await page.goto(`${baseURL}${PAGE}#ops=${ops}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__trace.length = 0; });
}

test('T4 DoD: reversing mid-flight is continuous — no jump, no restart',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    const r = await page.evaluate(async () => {
      const tl = window.__tl;
      tl.to(1);                                  // start forward
      await new Promise((res) => setTimeout(res, 180));   // ~halfway
      const atInterrupt = tl.value;
      tl.to(0);                                  // reverse
      await new Promise((res) => setTimeout(res, 700));
      return { atInterrupt, end: tl.value, trace: window.__trace.slice() };
    });

    // It was genuinely mid-flight when interrupted, and it arrived home.
    expect(r.atInterrupt).toBeGreaterThan(0.05);
    expect(r.atInterrupt).toBeLessThan(0.95);
    expect(r.end).toBeCloseTo(0, 3);

    // No discontinuity — judged per unit TIME, not per frame.
    //
    // The frame-delta version of this assertion failed a release: under
    // full-suite load a dropped frame produced a 0.49 step against a 0.2
    // budget. That is a stalled frame, not a restart; the animation was
    // continuous in value the whole way. Rate is the property that
    // actually distinguishes the two — a restart is an instantaneous jump
    // (huge rate), a stall is a normal rate observed over a long gap.
    //
    // A restart is INSTANTANEOUS; a stalled frame is not. So judge the
    // step only across pairs that are close in time — a 400ms gap with a
    // big delta is a dropped frame under load, and cannot demonstrate a
    // restart no matter how large the jump looks.
    //
    // (A rate budget was tried first and is the wrong tool: `in-out`
    // easing peaks well above the mean rate, and `to()` scales the span
    // by distance, so any fixed units-per-ms figure is either too tight
    // or too loose to mean anything.)
    const NORMAL_FRAME_MS = 50;
    let maxStep = 0;
    let judged = 0;
    for (let i = 1; i < r.trace.length; i++) {
      const [v0, t0] = r.trace[i - 1];
      const [v1, t1] = r.trace[i];
      if (t1 - t0 > NORMAL_FRAME_MS) continue;   // dropped frame, not a jump
      judged++;
      maxStep = Math.max(maxStep, Math.abs(v1 - v0));
    }
    expect(judged, 'every frame was a stall — nothing to judge').toBeGreaterThan(3);
    expect(maxStep,
      `largest step across a normal (<=${NORMAL_FRAME_MS}ms) frame was ${maxStep}`)
      .toBeLessThan(0.2);

    // And it never snapped to 0 or 1 before easing back down.
    const peak = Math.max(...r.trace.map(([v]) => v));
    expect(peak).toBeLessThan(0.99);
  });

test('T4: a reversal is shorter than a full play — duration scales with distance',
  async ({ page, baseURL }) => {
    // A fixed duration makes short corrections feel sluggish, which is
    // the usual reason interruptible animation feels wrong.
    await load(page, baseURL);
    const ms = await page.evaluate(async () => {
      const tl = window.__tl;
      const t0 = performance.now();
      await tl.to(1);
      const full = performance.now() - t0;
      tl.set(0.9);
      const t1 = performance.now();
      await tl.to(1);
      const short = performance.now() - t1;
      return { full, short };
    });
    expect(ms.short).toBeLessThan(ms.full * 0.5);
  });

test('T4: an interrupted await resolves rather than hanging',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    const settled = await page.evaluate(async () => {
      const tl = window.__tl;
      let resolved = false;
      const p = tl.to(1).then(() => { resolved = true; });
      await new Promise((r) => setTimeout(r, 120));
      tl.to(0);                       // retarget mid-flight
      await Promise.race([p, new Promise((r) => setTimeout(r, 900))]);
      return resolved;
    });
    // A promise left pending by an interruption is a leak that shows up
    // as a UI that never advances.
    expect(settled).toBe(true);
  });

test('T4: scroll scrubbing is deterministic for the same position',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    const r = await page.evaluate(async () => {
      const tl = window.__tl;
      // The stage has to start BELOW the fold and travel through the
      // viewport, or the mapping saturates at 1 for every scroll
      // position and the test proves nothing. (It did, first time.)
      const before = document.createElement('div');
      before.style.height = '150vh';
      document.body.insertBefore(before, document.body.firstChild);
      const after = document.createElement('div');
      after.style.height = '250vh';
      document.body.appendChild(after);
      tl.bindScroll('#stage');
      const at = async (y) => {
        window.scrollTo(0, y);
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        return tl.value;
      };
      const a1 = await at(900);
      const b = await at(1300);
      const a2 = await at(900);   // same position again
      tl.unbindScroll();
      return { a1, b, a2 };
    });
    // Same scroll position, same t — twice.
    expect(r.a2).toBeCloseTo(r.a1, 5);
    // And moving actually changes it.
    expect(Math.abs(r.b - r.a1)).toBeGreaterThan(0.01);
  });

test('T4: reduced motion — no effect attaches, and the transition still completes',
  async ({ page, baseURL }) => {
    // Two separate obligations, and the second is the one people forget:
    //   1. no effect renders (applyRasterPipeline refuses to attach —
    //      a pre-existing guard, and P-4 at the pipeline tier);
    //   2. the transition still ARRIVES, so the app advances. The user
    //      asked for no movement, not for a broken navigation.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${baseURL}${PAGE}#ops=plain`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
    await page.waitForTimeout(200);

    const r = await page.evaluate(async () => {
      const t0 = performance.now();
      await window.__tl.to(1);
      return {
        pipeline: window.__pipe,                     // null under reduce
        canvases: document.querySelectorAll('[data-nodality-raster]').length,
        ms: performance.now() - t0,
        end: window.__tl.value,
      };
    });
    expect(r.pipeline).toBeNull();
    expect(r.canvases).toBe(0);
    // The timeline drives a stub rather than throwing, so callers need no
    // branch — and it completes immediately rather than animating.
    expect(r.end).toBe(1);
    expect(r.ms).toBeLessThan(60);
    await page.emulateMedia({ reducedMotion: null });
  });

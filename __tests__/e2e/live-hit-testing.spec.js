// live-hit-testing.spec.js — controls inside a LIVE pipeline respond to
// real clicks.
//
// THE PROBLEM
//
// To be uploaded as a texture, content has to live inside the <canvas>.
// There it is canvas fallback content: laid out, but never painted into
// the page. `document.elementFromPoint` therefore walks straight past it
// and lands on the canvas, so every control inside a live pipeline was
// dead — including a morph's own back button, which made a live morph
// one-way with no way out.
//
// Phase I3 retargeting did not help, for two separate reasons:
//
//   1. it resolved its target with `document.elementFromPoint`, which
//      cannot see canvas-hosted content at all; and
//   2. it returned early whenever the source and client coordinates
//      agreed to within half a pixel — "nothing moved, let the browser's
//      hit test stand". At rest a settled morph presents 1:1, so the
//      displacement is zero and every event took that early return.
//
// THE FIX
//
// Canvas-hosted boxes are REAL — a back button inside a live morph
// reports its true 88x28 rect. Only painting and hit testing are missing,
// and hit testing is the part that can be replaced: walk the hosted
// subtree and test the boxes directly, deepest match wins.
//
// These tests click with a REAL MOUSE at the pixel where the control
// appears. `element.click()` would pass without any of this, because a
// direct dispatch never goes through hit testing — which is precisely how
// the bug survived manual checking.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/two-arrays-live';

async function load(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForFunction(
    () => !!document.querySelector('.nod-morph-live a'), null, { timeout: 15000 });
  await page.evaluate(async () => {
    const m = await import('../lib/raster-ops.js');
    const host = () => document.querySelector('.nod-morph-host');
    window.__api = m.isHTMLInCanvasAvailable();
    window.__pipe = () =>
      [...m.activeRasterPipelines()].filter((x) => host().contains(x.canvas)).pop();
    window.__until = async (f, ms) => {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        const v = f(); if (v) return v;
        await new Promise((r) => setTimeout(r, 100));
      }
      return null;
    };
  });
}

/** Morph forward and hand back the back button's on-screen box. */
async function morphIn(page) {
  return page.evaluate(async () => {
    document.querySelector('.nod-morph-live a').click();
    const ok = await window.__until(
      () => window.__pipe() && window.__pipe().progress === 1, 20000);
    const p = window.__pipe();
    const btn = document.querySelector('.nod-morph-host div button');
    const r = btn && btn.getBoundingClientRect();
    return {
      api: window.__api,
      reached1: !!ok,
      backend: p ? p.backend : null,
      insideCanvas: !!(p && btn && p.canvas.contains(btn)),
      box: r ? { x: r.x + r.width / 2, y: r.y + r.height / 2,
                 w: Math.round(r.width), h: Math.round(r.height) } : null,
      // The browser's own hit test, asked at the button's own centre.
      nativeHit: r && r.width
        ? (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === btn)
        : null,
    };
  });
}

test('a REAL click on the back button returns a live morph to its source',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    const state = await morphIn(page);

    test.skip(!state.api,
      'HTML-in-Canvas is not available in this browser — nothing to test');

    expect(state.backend).toBe('live');
    expect(state.reached1).toBe(true);
    // The premise: the control really is canvas-hosted, and the browser
    // really cannot find it. Without both, this test proves nothing.
    expect(state.insideCanvas,
      'the button is not inside the canvas — live did not host the content').toBe(true);
    expect(state.nativeHit,
      'elementFromPoint found the button, so the native path would have worked ' +
      'and this test is no longer exercising retargeting').toBe(false);
    expect(state.box.w, 'canvas-hosted content should still be laid out')
      .toBeGreaterThan(0);

    // The actual assertion: a real mouse click, at the pixel where the
    // button appears, drives the morph home.
    await page.mouse.click(state.box.x, state.box.y);
    // A landed reversal destroys its pipeline: the DOM is handed back so
    // the source is painted again, which on this backend is the only way
    // it is visible at all — canvas-hosted content stops being painted
    // the moment the canvas stands down. So the arrival is asserted on
    // the source presenting, not on a pipeline that is meant to be gone.
    const back = await page.evaluate(() => window.__until(() =>
      document.querySelector('.nod-morph-live').style.display !== 'none' ? true : null,
      20000));
    expect(back, 'the back button did not respond to a real click').toBeTruthy();
  });

test('the source is CLICKABLE again after a live morph returns',
  async ({ page, baseURL }) => {
    // The morph ran, it came back, and then the page was dead: the nav
    // looked perfectly normal and no longer responded to anything.
    //
    // Two endpoints, not symmetric. At t=1 the canvas must stay up — it
    // hosts the destination. At t=0 it must stand down, because what
    // presents there is the caller's own element, outside the canvas.
    // The pipeline hid the canvas only when it hosted nothing, so a live
    // morph kept the canvas up at BOTH ends; morph-node keys its handover
    // on the canvas standing down, so the source layer stayed
    // display:none and its links measured 0x0. What you saw at t=0 was
    // the shader's frozen first frame — a picture of a working navbar.
    await load(page, baseURL);
    const state = await morphIn(page);
    test.skip(!state.api, 'HTML-in-Canvas is not available in this browser');

    await page.mouse.click(state.box.x, state.box.y);
    await page.evaluate(() =>
      window.__until(() => window.__pipe() && window.__pipe().progress === 0, 20000));

    // The source layer has to come back on its own...
    const shown = await page.evaluate(() => window.__until(() =>
      document.querySelector('.nod-morph-live').style.display !== 'none' ? true : null, 6000));
    expect(shown, 'the source layer never came back — it is still display:none').toBeTruthy();

    // The nav is collapsed at this viewport, so the hamburger has to open
    // it — with a REAL click, which is the interaction that was reported
    // dead. `disclosed` proves the source is genuinely live again and not
    // merely visible: a picture of a navbar cannot expand.
    const disclosed = await page.evaluate(async () => {
      const live = document.querySelector('.nod-morph-live');
      const laidOut = () => [...live.querySelectorAll('a')]
        .some((a) => a.getBoundingClientRect().width > 0);
      if (laidOut()) return 'already open';
      const burger = live.querySelector('button, [class*=toggle]');
      if (!burger) return null;
      const r = burger.getBoundingClientRect();
      if (!r.width) return null;
      window.__burger = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      return 'needs click';
    });
    expect(disclosed, 'no hamburger with a box — the source layer is not laid out')
      .toBeTruthy();
    if (disclosed === 'needs click') {
      const b = await page.evaluate(() => window.__burger);
      await page.mouse.click(b.x, b.y);
      const opened = await page.evaluate(() => window.__until(() =>
        [...document.querySelectorAll('.nod-morph-live a')]
          .some((a) => a.getBoundingClientRect().width > 0) ? true : null, 5000));
      expect(opened, 'the hamburger did not expand the menu after the morph returned')
        .toBeTruthy();
    }

    // ...with links that have real boxes, and a REAL click has to morph
    // again. A 0x0 link is the failure: present, wired, unclickable.
    const link = await page.evaluate(() => {
      const a = [...document.querySelectorAll('.nod-morph a')]
        .find((x) => x.dataset.nodMorphTo && x.getBoundingClientRect().width > 0);
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    expect(link, 'no source link has a clickable box after the morph returned').toBeTruthy();

    await page.mouse.click(link.x, link.y);
    const again = await page.evaluate(() =>
      window.__until(() => window.__pipe() && window.__pipe().progress === 1, 20000));
    expect(again, 'a second real click did not start a new morph').toBeTruthy();
  });

test('the source becomes ordinary DOM again once a live morph has returned',
  async ({ page, baseURL }) => {
    // The handover moves the children back OUT of the canvas, so the nav
    // is natively hit-testable again and needs no retargeting at rest.
    await load(page, baseURL);
    const state = await morphIn(page);
    test.skip(!state.api, 'HTML-in-Canvas is not available in this browser');

    await page.mouse.click(state.box.x, state.box.y);
    await page.evaluate(() =>
      window.__until(() => window.__pipe() && window.__pipe().progress === 0, 20000));

    const anchors = await page.evaluate(() =>
      [...document.querySelectorAll('.nod-morph a')].map((a) => ({
        wired: !!a.dataset.nodMorphTo,
        inCanvas: !!a.closest('canvas'),
      })));
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.every((a) => !a.inCanvas),
      'the nav is still inside the canvas after the morph returned').toBe(true);
    expect(anchors.every((a) => a.wired),
      'links lost their morph wiring across the handover').toBe(true);
  });

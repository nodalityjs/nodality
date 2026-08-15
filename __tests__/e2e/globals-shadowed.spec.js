// globals-shadowed.spec.js — the library must survive its own exports
// being published onto globalThis.
//
// THE BUG THIS EXISTS FOR
//
// gesos.cz shipped a page whose nav morphed into cards. It rendered, the
// links were wired, the click handler ran and called preventDefault — and
// then nothing happened. No error, no console output, no canvas. Clicking
// simply did nothing, forever.
//
// The page ran the scaffolded globals bridge:
//
//     import * as N from "nodality";
//     Object.assign(globalThis, N);
//
// This package exports components named `Image`, `Text` and `Range`.
// Those are DOM constructors too, so that line replaced them page-wide.
// Both capture paths in the library then did `new Image()` and got a
// COMPONENT: `onload` and `src` landed on it as inert properties, the
// image never loaded, the promise never settled — and the awaiting code
// hung with nothing to log. A rejected promise would have been visible;
// a promise that never settles is not.
//
// It is worth naming why nothing else caught this. Every other fixture
// imports `../lib/designer.js` directly, so the globals stay native and
// the bug cannot appear. The unit tests run in Node, which has no DOM
// `Image` to shadow. The published bundle was fine. The only way to see
// it was to run the library the way the scaffold tells consumers to.
//
// The fix is `document.createElement("img")`, which no assignment to
// globalThis can take away. These tests assert the behaviour rather than
// the mechanism: under shadowed globals, a morph must still complete and
// a raster node must still produce a canvas.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/two-arrays-shadowed';

async function load(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForFunction(
    () => !!document.querySelector('.nod-morph-live a'), null, { timeout: 15000 });
}

const openMenu = (page) => page.evaluate(async () => {
  const live = document.querySelector('.nod-morph-live');
  const laidOut = () => [...live.querySelectorAll('a')]
    .some((a) => a.getBoundingClientRect().width > 0);
  const burger = live.querySelector('button, [class*=toggle]');
  for (let i = 0; i < 3 && !laidOut() && burger; i++) {
    burger.click();
    await new Promise((r) => setTimeout(r, 400));
  }
});

async function progress(page) {
  return page.evaluate(async () => {
    const { activeRasterPipelines } = await import('../lib/raster-ops.js');
    const host = document.querySelector('.nod-morph-host');
    const mine = [...activeRasterPipelines()].filter((x) => host.contains(x.canvas));
    const p = mine[mine.length - 1];
    return p ? p.progress : null;
  });
}

test('the fixture really has replaced the globals — otherwise it proves nothing',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    const shadowed = await page.evaluate(() => {
      const native = (f) => /\[native code\]/.test(Function.prototype.toString.call(f));
      return {
        image: !native(window.Image),
        text: !native(window.Text),
        range: !native(window.Range),
        // The DOM itself is untouched; only the constructors are gone.
        domStillWorks: document.createElement('img') instanceof HTMLImageElement,
      };
    });
    expect(shadowed.image, 'window.Image is still native — the premise is gone').toBe(true);
    expect(shadowed.text).toBe(true);
    expect(shadowed.range).toBe(true);
    expect(shadowed.domStillWorks).toBe(true);
  });

test('a morph completes with the globals shadowed', async ({ page, baseURL }) => {
  // The exact failure: handler ran, preventDefault fired, progress stayed
  // null forever because capture() awaited an image that never loaded.
  await load(page, baseURL);
  await openMenu(page);

  const clicked = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.nod-morph-live a')]
      .find((x) => /^about$/i.test(x.textContent.trim()));
    if (!a) return false;
    a.click();
    return true;
  });
  expect(clicked, 'no About link to click').toBe(true);

  await expect.poll(() => progress(page), { timeout: 20000 }).toBe(1);
  const h = await page.evaluate(() => {
    const d = document.querySelector('.nod-morph-host > div');
    const el = d && d.querySelector('h1,h2,h3,h4,h5,h6');
    return el ? el.textContent.trim() : null;
  });
  expect(h).toBe('About');
});

test('the snapshot raster backend still captures with the globals shadowed',
  async ({ page, baseURL }) => {
    // raster-ops' toImage() had the same `new Image()`, so a plain raster
    // node on a page with the globals bridge produced no canvas either.
    // This is the half of the bug that has nothing to do with morphing.
    await load(page, baseURL);
    await page.evaluate(() => document.querySelector('.nod-morph-live a').click());
    await expect.poll(() => progress(page), { timeout: 20000 }).toBe(1);

    const canvases = await page.evaluate(() =>
      document.querySelectorAll('#stage canvas').length);
    expect(canvases, 'no canvas was produced — the capture never resolved')
      .toBeGreaterThan(0);
  });

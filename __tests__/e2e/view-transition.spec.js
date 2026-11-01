// view-transition.spec.js — nodalityTransition(), the single-page wrapper
// with the View Transitions API's calling convention.
//
// The demo has two routes: a team dropdown, and the same page with one
// person's full-screen overlay. The tapped name and the overlay share
// view-transition-name "hero", which is the only input the wrapper reads.
//
// What can go wrong is mostly what is LEFT behind: an overlay layer that
// never comes off, a new element still visibility:hidden, an old still
// lingering. Every test therefore ends by checking the page is clean.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/spa-transition';

async function load(page, { duration = 1500, effect = 't-fluid' } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${PAGE}?duration=${duration}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.selectOption('#effect', effect);
  return errors;
}

const state = (page) => page.evaluate(() => ({
  layer: !!document.querySelector('[data-nodality-view-transition]'),
  overlay: !!document.querySelector('.overlay'),
  hidden: [...document.querySelectorAll('*')].filter((e) => e.style.visibility === 'hidden').length,
  route: location.hash,
}));

for (const effect of ['t-fluid', 't-particles']) {
  test(`${effect}: a name opens its overlay and closes back, leaving the page clean`,
    async ({ page }) => {
      const errors = await load(page, { effect });

      await page.click('.who[data-id="tomas"]');
      // Mid-flight: the transition layer holds a pipeline canvas.
      await page.waitForFunction(() =>
        !!document.querySelector('[data-nodality-view-transition] canvas'), null, { timeout: 8000 });
      await page.evaluate(() => window.__transition.finished);
      expect(await state(page)).toEqual({ layer: false, overlay: true, hidden: 0, route: '#/p/tomas' });

      await page.click('#close');
      await page.evaluate(() => window.__transition.finished);
      expect(await state(page)).toEqual({ layer: false, overlay: false, hidden: 0, route: '#/' });
      expect(errors).toEqual([]);
    });
}

test('mid-flight the effect is on screen, and both ends are the real pages', async ({ page }) => {
  await load(page, { duration: 3000 });
  const before = await page.screenshot();
  await page.click('.who[data-id="ada"]');
  await page.waitForFunction(() =>
    !!document.querySelector('[data-nodality-view-transition] canvas'), null, { timeout: 8000 });
  await page.waitForTimeout(1300);
  const mid = await page.screenshot();
  await page.evaluate(() => window.__transition.finished);
  const after = await page.screenshot();
  expect(mid.equals(before)).toBe(false);
  expect(mid.equals(after)).toBe(false);
  // The overlay really is the one on screen at the end, not a still.
  expect(await page.evaluate(() =>
    getComputedStyle(document.querySelector('.overlay')).visibility)).toBe('visible');
});

test('the promises arrive in the platform order', async ({ page }) => {
  await load(page);
  await page.click('.who[data-id="lin"]');
  const order = await page.evaluate(async () => {
    const t = window.__transition;
    const seen = [];
    await Promise.all([
      t.updateCallbackDone.then(() => seen.push('update')),
      t.ready.then(() => seen.push('ready')),
      t.finished.then(() => seen.push('finished')),
    ]);
    return seen;
  });
  expect(order).toEqual(['update', 'ready', 'finished']);
});

test('skipTransition jumps to the end and still cleans up', async ({ page }) => {
  await load(page, { duration: 5000 });
  await page.click('.who[data-id="marek"]');
  await page.evaluate(async () => {
    await window.__transition.ready;
    window.__transition.skipTransition();
    await window.__transition.finished;
  });
  expect(await state(page)).toEqual({ layer: false, overlay: true, hidden: 0, route: '#/p/marek' });
});

test('reduced motion: no shader, the route still changes', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', baseURL });
  const page = await context.newPage();
  const errors = await load(page);
  await page.click('.who[data-id="tomas"]');
  // The wrapper hands over to the platform (or just updates) — either way
  // no Nodality layer is ever created.
  const sawLayer = await page.evaluate(() =>
    !!document.querySelector('[data-nodality-view-transition]'));
  await page.evaluate(() => window.__transition.finished);
  expect(sawLayer).toBe(false);
  expect(await state(page)).toEqual({ layer: false, overlay: true, hidden: 0, route: '#/p/tomas' });
  expect(errors).toEqual([]);
  await context.close();
});

test('a still matches the element it freezes, so the handover does not jump',
  async ({ page }) => {
    // The capture has to carry what the page's STYLESHEET did — colour,
    // margins, border-box sizing — or the frozen overlay differs from the
    // real one and the transition pops at t=1. Laid exactly over the real
    // element, the still must be indistinguishable from it.
    await page.goto(`${PAGE}#/p/tomas`);
    await page.waitForFunction(() => window.__ready === true && !!document.querySelector('.overlay'));
    const real = await page.screenshot();
    await page.evaluate(async () => {
      const { captureStill } = await import('/public/lib/morph-node.js');
      const el = document.querySelector('.overlay');
      const r = el.getBoundingClientRect();
      const img = await captureStill(el, r.width, r.height);
      img.id = 'still';
      img.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;` +
        `width:${r.width}px;height:${r.height}px;z-index:2147483646;`;
      document.body.appendChild(img);
      el.style.visibility = 'hidden';
    });
    const still = await page.screenshot();
    const diff = await page.evaluate(async ([a, b]) => {
      const load = async (b64) => {
        const im = document.createElement('img');
        im.src = 'data:image/png;base64,' + b64;
        await im.decode();
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        const x = c.getContext('2d');
        x.drawImage(im, 0, 0);
        return x.getImageData(0, 0, c.width, c.height).data;
      };
      const [p, q] = [await load(a), await load(b)];
      let s = 0;
      for (let i = 0; i < p.length; i++) s += Math.abs(p[i] - q[i]);
      return s / p.length;
    }, [real.toString('base64'), still.toString('base64')]);
    expect(diff).toBeLessThan(1.5);
  });

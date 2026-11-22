const { test, expect } = require('@playwright/test');

/**
 * Regression: a raster op aimed at an <img> sized by a STYLESHEET (nothing
 * inline) stretched it. The wrapper copied only inline sizing and fell back
 * to width: 100%, so a 600x400 image in a 700px column came out 700x466.
 *
 * The wrapper now takes the image's authored sizing — read as computed
 * values, so a percentage stays fluid — and every case here checks that the
 * image keeps the box it had before it was wrapped.
 */

const PAGE = '/__tests__/e2e/fixtures/raster-image-size.html';

async function load(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
}

/** Put an <img class=cls> in the column, load the photo, return its box. */
function place(page, cls, tallParent) {
  return page.evaluate(async ({ cls, tallParent }) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    let parent = host;
    if (tallParent) {
      // A flex column of definite height, still a `.col > img` for the rules.
      host.classList.add('tall-parent');
    } else {
      host.classList.remove('tall-parent');
    }
    const img = document.createElement('img');
    img.className = cls;
    img.id = 'photo';
    img.alt = 'test photo';
    parent.appendChild(img);
    await new Promise((r) => { img.onload = r; img.src = window.__photoUrl; });
    const b = img.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height) };
  }, { cls, tallParent });
}

function wrapAndMeasure(page) {
  return page.evaluate(() => {
    const img = document.getElementById('photo');
    const wrap = window.__raster.wrapReplacedHost(img);
    const r = (n) => { const b = n.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
    return { wrap: r(wrap), img: r(img), inlineImg: img.getAttribute('style') };
  });
}

const CASES = [
  ['fixed', 'width: 600px (height from the ratio)', { w: 600, h: 400 }],
  ['both', 'width: 600px; height: 400px', { w: 600, h: 400 }],
  ['fluid', 'width: 50%', { w: 350, h: 233 }],
  ['tall', 'height: 200px (width from the ratio)', { w: 300, h: 200 }],
  ['capped', 'max-width: 100% at natural size', { w: 600, h: 400 }],
];

test.describe('raster wrapper keeps a stylesheet-sized <img> at its size', () => {
  for (const [cls, what, want] of CASES) {
    test(`${what}`, async ({ page, baseURL }) => {
      await load(page, baseURL);
      const before = await place(page, cls, false);
      expect(before).toEqual(want);
      const after = await wrapAndMeasure(page);
      expect(after.wrap, 'wrapper box').toEqual(before);
      expect(after.img, 'image box inside the wrapper').toEqual(before);
    });
  }

  test('a fixed width is not stretched to a parent of definite height', async ({ page, baseURL }) => {
    await load(page, baseURL);
    const before = await place(page, 'fixed', true);
    expect(before).toEqual({ w: 600, h: 400 });
    const after = await wrapAndMeasure(page);
    expect(after.wrap).toEqual(before);
    expect(after.img).toEqual(before);
  });

  test('a percentage width stays fluid after wrapping', async ({ page, baseURL }) => {
    await load(page, baseURL);
    await place(page, 'fluid', false);
    await wrapAndMeasure(page);
    const w = await page.evaluate(() => {
      document.getElementById('host').style.width = '500px';
      return Math.round(document.querySelector('[data-nodality-raster-host]').getBoundingClientRect().width);
    });
    expect(w).toBe(250);
  });

  test('the whole pipeline: the canvas covers the image at 600x400, not 700x466', async ({ page, baseURL }) => {
    await load(page, baseURL);
    await place(page, 'fixed', false);
    const ok = await page.evaluate(() => !!window.__raster.applyRasterPipeline(
      document.getElementById('photo'), [{ op: 'halftone' }]));
    expect(ok).toBe(true);
    await page.waitForFunction(() => !!document.querySelector('canvas[data-nodality-raster]'));
    const box = await page.evaluate(() => {
      const r = (n) => { const b = n.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
      return { host: r(document.querySelector('[data-nodality-raster-host]')),
               canvas: r(document.querySelector('canvas[data-nodality-raster]')) };
    });
    expect(box.host).toEqual([600, 400]);
    expect(box.canvas).toEqual([600, 400]);
  });
});

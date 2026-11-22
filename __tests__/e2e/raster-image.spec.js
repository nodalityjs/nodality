const { test, expect } = require('@playwright/test');

/**
 * Raster ops aimed at an <img>: the scroll driver, device gating, and what
 * happens to the original image (accessibility, LCP, cross-origin).
 *
 * The scroll test is a regression test for a report that
 * `{ op: "halftone", by: "scroll" }` "halftones the whole image with no
 * travelling band". That is what halftone does — `by` only coarsens its
 * dots near the focus — and the driver's doc string promised a band. The
 * docs were wrong; the band is `mask from: "band"` + `masked:`. Both
 * halves are pinned here so neither the behaviour nor the advice drifts.
 *
 * Pixels are judged by CHROMA: the fixture photo is a saturated hue sweep
 * and the screen is ink on paper (near grey), so "screened" is simply
 * "lost its colour".
 */

const PAGE = '/__tests__/e2e/fixtures/raster-image.html';

async function load(page, baseURL, hash) {
  await page.goto(`${baseURL}${PAGE}${hash || ''}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
}

async function attach(page, chain) {
  return page.evaluate((ch) => {
    const h = window.__raster.applyRasterPipeline(document.getElementById('photo'), ch);
    window.__handle = h;
    return !!h;
  }, chain);
}

// The canvas is up and showing the effect (the image host waits for the
// photo to paint first, so this is a condition, not a sleep). The repo's
// Playwright config enables the HTML-in-Canvas trial, so the backend may
// be `live` (content moved INTO the canvas) or `snapshot` (canvas over the
// untouched host); both are accepted, and asserted separately below.
const waitForCanvas = (page) => page.waitForFunction(() => {
  const c = document.querySelector('canvas[data-nodality-raster]');
  if (!c) return false;
  if (c.getAttribute('data-nodality-raster') === 'live') return true;
  return c.style.visibility === 'visible';
}, null, { timeout: 10000 }).then(() => page.waitForTimeout(100));

const backendOf = (page) => page.evaluate(() => {
  const c = document.querySelector('canvas[data-nodality-raster]');
  return c && c.getAttribute('data-nodality-raster');
});

/** Per-row fraction of near-grey (screened) pixels inside the host box. */
async function screenedRows(page) {
  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-nodality-raster-host]').getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  const png = await page.screenshot({ clip: box });
  return page.evaluate(async (b64) => {
    const im = new Image();
    im.src = 'data:image/png;base64,' + b64;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const rows = [];
    for (let y = 0; y < c.height; y++) {
      let grey = 0;
      for (let xx = 0; xx < c.width; xx++) {
        const i = (y * c.width + xx) * 4;
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        if (mx - mn < 70) grey++;
      }
      rows.push(grey / c.width);
    }
    return rows;
  }, png.toString('base64'));
}

/** Centroid row of the rows that are mostly screened, plus their count. */
function screenedCentroid(rows) {
  let sum = 0, n = 0;
  rows.forEach((f, y) => { if (f > 0.5) { sum += y; n++; } });
  return { centroid: n ? sum / n : -1, count: n };
}

async function scrollTo(page, y) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  // A few frames for the draw loop to pick up the new driver value.
  await page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await page.waitForTimeout(150);
}

test.describe('by: "scroll" on an image', () => {
  test('halftone by:"scroll" alone screens the WHOLE image (documented: by only coarsens)',
    async ({ page, baseURL }) => {
      await load(page, baseURL);
      expect(await attach(page, [{ op: 'halftone', by: 'scroll', size: 7 }])).toBe(true);
      await waitForCanvas(page);
      await scrollTo(page, 500);
      const rows = await screenedRows(page);
      const { count } = screenedCentroid(rows);
      // Every row is screened — there is no un-screened region for a
      // "band" to travel through. This is the behaviour the docs now state.
      expect(count).toBeGreaterThan(rows.length * 0.95);
    });

  test('mask from:"band" by:"scroll" + masked halftone gives a stripe that travels down the element',
    async ({ page, baseURL }) => {
      await load(page, baseURL);
      expect(await attach(page, [
        { op: 'mask', from: 'band', as: 'band', by: 'scroll', radius: 50 },
        { op: 'halftone', masked: 'band', size: 7 },
      ])).toBe(true);
      await waitForCanvas(page);

      // Viewport 800 tall, image 400 tall at document y=900.
      //   scrollY 500 -> top 400, progress (800-400)/1200 = 0.333 -> focus y 133
      //   scrollY 800 -> top 100, progress (800-100)/1200 = 0.583 -> focus y 233
      const geo = await page.evaluate(() => ({ h: innerHeight }));
      expect(geo.h).toBe(800);

      await scrollTo(page, 500);
      const a = screenedCentroid(await screenedRows(page));
      await scrollTo(page, 800);
      const b = screenedCentroid(await screenedRows(page));

      // A stripe, not the whole image: well under half the rows.
      for (const s of [a, b]) {
        expect(s.count).toBeGreaterThan(20);
        expect(s.count).toBeLessThan(200);
      }
      expect(Math.abs(a.centroid - 133)).toBeLessThan(30);
      expect(Math.abs(b.centroid - 233)).toBeLessThan(30);
      // Scrolling the page DOWN moves the stripe DOWN the element.
      expect(b.centroid - a.centroid).toBeGreaterThan(60);
    });

  test('the scroll driver doc describes a point and points at mask band', async ({ page, baseURL }) => {
    await load(page, baseURL);
    const doc = await page.evaluate(() => window.__raster.DRIVER_DOCS.scroll);
    expect(doc).not.toMatch(/^A band that travels up/);
    expect(doc).toMatch(/point/);
    expect(doc).toMatch(/from: \\?"band\\?"/);
  });
});

test.describe('device gating', () => {
  // Chromium's headless pointer type is not something a context option
  // controls reliably, so the media query is pinned in the page instead.
  const pinPointer = (page, fine) => page.addInitScript((isFine) => {
    const real = window.matchMedia.bind(window);
    // `matches` is a prototype getter, so a plain assignment is ignored;
    // an own property shadows it.
    const pinned = (q, v) => Object.defineProperty(real(q), 'matches', { value: v });
    window.matchMedia = (q) => {
      if (/\(pointer:\s*fine\)/.test(q)) return pinned(q, isFine);
      if (/\(pointer:\s*coarse\)/.test(q)) return pinned(q, !isFine);
      return real(q);
    };
  }, fine);

  test('pointer:"fine" does not attach on a coarse pointer, and leaves the <img> untouched',
    async ({ page, baseURL }) => {
      await pinPointer(page, false);
      await load(page, baseURL);
      expect(await attach(page, [{ op: 'halftone', pointer: 'fine' }])).toBe(false);
      const state = await page.evaluate(() => {
        const img = document.getElementById('photo');
        return {
          wrapped: !!img.closest('[data-nodality-raster-host]'),
          canvas: !!document.querySelector('canvas[data-nodality-raster]'),
          opacity: getComputedStyle(img).opacity,
        };
      });
      expect(state).toEqual({ wrapped: false, canvas: false, opacity: '1' });
    });

  test('pointer:"fine" attaches on a fine pointer', async ({ page, baseURL }) => {
    await pinPointer(page, true);
    await load(page, baseURL);
    expect(await attach(page, [{ op: 'halftone', pointer: 'fine' }])).toBe(true);
    await waitForCanvas(page);
  });

  test('a gated node is dropped while the rest of the chain still runs', async ({ page, baseURL }) => {
    await pinPointer(page, false);
    await load(page, baseURL);
    expect(await attach(page, [
      { op: 'halftone', size: 7 },
      { op: 'offset', by: 'mouse', strength: 20, pointer: 'fine' },
    ])).toBe(true);
    await waitForCanvas(page);
  });

  test('an unknown pointer value fails closed with a warning', async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect(await attach(page, [{ op: 'halftone', pointer: 'mouse' }])).toBe(false);
    const logs = await page.evaluate(() => window.__logs.join('\n'));
    expect(logs).toMatch(/unknown pointer gate 'mouse'/);
  });

  test('prefers-reduced-motion: nothing attaches, the image stays as authored',
    async ({ page, baseURL }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await load(page, baseURL);
      expect(await attach(page, [{ op: 'halftone', by: 'scroll' }])).toBe(false);
      expect(await page.evaluate(() =>
        !!document.querySelector('[data-nodality-raster-host]'))).toBe(false);
    });
});

test.describe('the original image', () => {
  test('stays in the accessibility tree with its alt; the canvas is not a second image',
    async ({ page, baseURL }) => {
      await load(page, baseURL);
      expect(await attach(page, [{ op: 'halftone' }])).toBe(true);
      await waitForCanvas(page);
      const snap = await page.locator('body').ariaSnapshot();
      const imgs = snap.split('\n').filter((l) => /^\s*- img\b/.test(l));
      expect(imgs).toEqual(['- img "A hue sweep test photo"']);
      const canvas = await page.evaluate(() => {
        const c = document.querySelector('canvas[data-nodality-raster]');
        return { hidden: c.getAttribute('aria-hidden'), role: c.getAttribute('role') };
      });
      const img = await page.evaluate(() => {
        const el = document.getElementById('photo');
        return { connected: el.isConnected, alt: el.alt, inCanvas: !!el.closest('canvas') };
      });
      expect(img.connected).toBe(true);
      expect(img.alt).toBe('A hue sweep test photo');
      if (await backendOf(page) === 'live') {
        // Live: the <img> is the canvas's fallback content, which IS the
        // accessible subtree -- so the canvas must not be aria-hidden.
        expect(img.inCanvas).toBe(true);
        expect(canvas.hidden).toBeNull();
      } else {
        // Snapshot: the <img> stays where it was (transparent), and the
        // canvas is decoration.
        expect(img.inCanvas).toBe(false);
        expect(canvas).toEqual({ hidden: 'true', role: null });
      }
    });

  // The worst case: the pipeline attaches the moment the image has
  // DECODED, before the frame that would present it. The direct-image
  // capture is synchronous, so before the fix the image went to opacity:0
  // without ever being presented and the page reported no LCP entry at
  // all (verified: this test fails with the paint wait disabled). Snapshot
  // backend pinned (`live: false`): the live backend moves the <img> into
  // the canvas at attach, where LCP cannot see it — a documented limit of
  // the origin-trial API.
  test('the image paints before the canvas replaces it, so it remains the LCP element',
    async ({ page, baseURL }) => {
      await load(page, baseURL, '#nosrc');
      await page.evaluate(async () => {
        // LCP only counts what is in the viewport.
        document.getElementById('above').style.height = '0px';
        window.__lcp = [];
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__lcp.push(e.element && e.element.tagName);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        const img = document.getElementById('photo');
        img.src = window.__photoUrl;
        await img.decode();
        window.__handle = window.__raster.applyRasterPipeline(img,
          [{ op: 'halftone', live: false }]);
      });
      expect(await backendOf(page)).toBe('snapshot');
      await waitForCanvas(page);
      await page.waitForFunction(() => window.__lcp.length > 0, null, { timeout: 5000 });
      expect(await page.evaluate(() => window.__lcp)).toContain('IMG');
    });

  test('a cross-origin <img> without CORS is left alone instead of halftoning a broken icon',
    async ({ page, baseURL }) => {
      await load(page, baseURL, '#nosrc');
      // Same server, other origin: localhost <-> 127.0.0.1.
      const u = new URL(baseURL);
      u.hostname = u.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
      const other = `${u.origin}/assets/arrow-right.png`;
      await page.evaluate((src) => new Promise((r) => {
        const img = document.getElementById('photo');
        img.onload = img.onerror = r;
        img.src = src;
      }), other);
      expect(await attach(page, [{ op: 'halftone' }])).toBe(false);
      const state = await page.evaluate(() => ({
        wrapped: !!document.querySelector('[data-nodality-raster-host]'),
        logs: window.__logs.join('\n'),
      }));
      expect(state.wrapped).toBe(false);
      expect(state.logs).toMatch(/cross-origin without CORS/);
    });
});

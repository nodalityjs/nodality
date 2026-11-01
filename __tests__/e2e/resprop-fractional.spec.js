const { test, expect } = require('@playwright/test');

// resprop ranges are closed integer intervals of visualViewport.width, but a
// zoomed visual viewport is fractional. Between [0, 640] and [641, 99999] a
// width of 640.5 used to match neither, and the row fell back to its declared
// direction for that half pixel. The integer part of the width is matched
// now, so adjacent ranges leave no gap.
test('resprop covers fractional widths between adjacent integer ranges', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1281, height: 800 });
  await page.goto(`${baseURL}/public/responsive-harness`);
  await page.waitForFunction(() => window.__nodalityReady === true);
  await page.evaluate(() => window.__nodalityRender({
    elements: [{
      type: 'row', id: 'r',
      resprop: [
        { breakpoint: [0, 640], flexDirection: 'column' },
        { breakpoint: [641, 99999], flexDirection: 'row' },
      ],
      children: [{ type: 'p', text: 'a' }, { type: 'p', text: 'b' }],
    }],
  }));

  // Pinch zoom by 2: the visual viewport is 1281 / 2 = 640.5 CSS px wide.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 100)));
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const vv = await page.evaluate(() => window.visualViewport.width);
  expect(vv).toBeGreaterThan(640);
  expect(vv).toBeLessThan(641);
  const dir = await page.evaluate(() => getComputedStyle(document.getElementById('r')).flexDirection);
  expect(dir).toBe('column');
});

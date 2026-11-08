const { test, expect } = require('@playwright/test');

/**
 * WebGL contexts are a hard browser limit (about 16 per page in Chrome); past
 * it the browser kills the oldest, and that element's effect goes blank with
 * no error. A page that re-renders must release the contexts it replaces.
 *
 * Marked test.fail(): the render core does not release them yet
 * (ARCHITECTURE-SCAN-08-11-26.md §5). The suite stays green while it fails,
 * and Playwright reports it the moment it starts passing, so the mark is
 * removed together with the fix.
 */

const PAGE = '/public/lifecycleGl.html';

async function ready(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(500);
}

test('the fixture attaches one WebGL context per raster element', async ({ page, baseURL }) => {
  await ready(page, baseURL);
  const gl = await page.evaluate(() => window.__gl);
  // Three dithered headings. If the browser has no WebGL at all, the pipeline
  // falls back and this test is meaningless rather than wrong.
  test.skip(gl.created === 0, 'no WebGL in this browser');
  expect(gl.created).toBeGreaterThanOrEqual(3);
});

test('re-rendering releases the contexts it replaces', async ({ page, baseURL }) => {
  test.fail(true, 'render core: Des.destroy() must release raster pipelines (loseContext)');
  await ready(page, baseURL);
  const first = await page.evaluate(() => window.__gl.created);
  test.skip(first === 0, 'no WebGL in this browser');
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.__render());
    await page.waitForTimeout(150);
  }
  const gl = await page.evaluate(() => window.__gl);
  const live = gl.created - gl.released - gl.forciblyLost;
  console.log(`after 8 re-renders: created ${gl.created}, released ${gl.released}, taken back by the browser ${gl.forciblyLost}, live ${live}`);
  expect(gl.forciblyLost, 'the browser had to take contexts back').toBe(0);
  expect(live, 'only the current render may hold contexts').toBeLessThanOrEqual(first);
});

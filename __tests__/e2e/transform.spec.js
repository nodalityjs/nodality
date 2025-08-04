const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Transform object works', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/transform`);

  const h1 = page.locator('h1');
  await expect(h1).toBeVisible();

  // Wait until a transform is applied
  await page.waitForFunction(() => {
    const el = document.querySelector('h1');
    return el && getComputedStyle(el).transform !== 'none';
  });

  const transform = await h1.evaluate(el => getComputedStyle(el).transform);
  console.log('Computed transform:', transform);

  expect(transform.startsWith('matrix3d(')).toBe(true);

  const matrix = transform
    .replace(/^matrix3d\(|\)$/g, '')
    .split(',')
    .map(n => parseFloat(n.trim()));

  expect(matrix.length).toBe(16);

  // Example checks for qualitative transform effects
  expect(matrix[0]).toBeGreaterThan(1); // Scale x > 1
  expect(matrix[5]).toBeGreaterThan(1); // Scale y > 1
  expect(Math.abs(matrix[12])).toBeGreaterThan(0); // Translate x ≠ 0
  expect(Math.abs(matrix[13])).toBeGreaterThan(0); // Translate y ≠ 0
});


// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


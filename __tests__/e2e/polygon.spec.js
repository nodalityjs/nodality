const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Polygon test', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/polygon`);

  const div = page.locator('#mount > div');
  await expect(div).toBeVisible();


   // Get clip-path
  const clipPath = await div.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('clip-path');
  });

  console.log('clip-path:', clipPath);

  // Check that it starts with polygon(
  expect(clipPath.startsWith('polygon(')).toBe(true);

  // Simple validation: check that polygon has at least 3 points
  const polygonRegex = /^polygon\(\s*([0-9.%\s,]+)\s*\)$/;
  const match = clipPath.match(polygonRegex);
  expect(match).not.toBeNull();

  if (match) {
    const points = match[1].split(',').map(pt => pt.trim());
    expect(points.length).toBeGreaterThanOrEqual(3); // at least a triangle
  }
});


// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


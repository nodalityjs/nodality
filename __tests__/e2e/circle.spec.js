const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Circle test', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/circle`);

  const div = page.locator('#mount div');
  await expect(div).toBeVisible();

 // Get computed styles
const { width, height, borderRadius } = await div.evaluate(el => {
  const style = getComputedStyle(el);
  return {
    width: parseFloat(style.width),
    height: parseFloat(style.height),
    borderRadius: parseFloat(style.borderRadius),
  };
});

// Ensure it's square
expect(width).toBeCloseTo(height, 1);

// Ensure border-radius is ~50% of width
expect(borderRadius / width).toBeCloseTo(0.5, 1);

});


// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


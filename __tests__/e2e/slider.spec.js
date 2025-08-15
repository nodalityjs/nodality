const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Slider works', async ({browser, baseURL }) => {
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/slider`);
  
   const slides = await page.locator('.slide');
  await expect(slides).toHaveCount(4);

  // Check that the first slide contains "One"
  await expect(slides.nth(0)).toContainText('One');

  // Check nav buttons exist
  await expect(page.locator('button')).toHaveCount(2);

  // Click the right button (optional scroll test)
  await page.locator('button').nth(1).click();
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


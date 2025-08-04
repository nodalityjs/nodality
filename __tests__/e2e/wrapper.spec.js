const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Wrapper', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/wrap`);

  const div = page.locator('#mount');
  await expect(div).toBeVisible();

  const paragraphs = page.locator('p');
  await expect(paragraphs).toHaveCount(3);

});


// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


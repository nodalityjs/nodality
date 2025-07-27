const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/public/link.html';

test('Link test', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}`);

  const h1 = page.locator('a');
  await expect(h1).toHaveText('Hello');
});

// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading





// 1- serve launcj folder at 3000
// npx playwright test
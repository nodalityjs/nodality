const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/public/code.html';

test('Code test', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}`);

   // ✅ Check that the table element exists
  const table = page.locator('code[class="language-js"]');
  await expect(table).toBeVisible();
});

// 1- serve launcj folder at 3000
// run npx playwright test
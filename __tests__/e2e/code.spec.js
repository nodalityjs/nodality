const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE



test('Code test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
    await page.goto(`${baseURL}/public/code.html`);

   // ✅ Check that the table element exists
  const table = page.locator('code[class="language-js"]');
  await expect(table).toBeVisible();
});

// 1- serve launcj folder at 3000
// run npx playwright test
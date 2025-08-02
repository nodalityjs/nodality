// tests/filter-ui.spec.js
const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Keyset test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${baseURL}/public/keyset.html`);
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();

  // Get computed style for border
  const border = await heading.evaluate(el =>
    getComputedStyle(el).getPropertyValue('border')
  );

  expect(border).toBe('3px solid rgb(0, 128, 0)'); // "green" is rgb(0, 128, 0)
});

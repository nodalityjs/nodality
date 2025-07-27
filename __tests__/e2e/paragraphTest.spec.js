const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/public/paragraph.html';

test('Paragraph test', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}`);

  const h1 = page.locator('p');
  await expect(h1).toHaveText('Hello');
});

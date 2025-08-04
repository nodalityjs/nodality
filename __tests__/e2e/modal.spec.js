const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Modal test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 768, height: 800 }); // Mobile size
  await page.goto(`${baseURL}/public/modal.html`);


 // Click the first button
   await page.getByRole('button', { name: 'wow' }).click();

  

  const divWithWidth600 = page.locator('div[style*="width: 600px"]');
  await expect(divWithWidth600).toBeVisible();

  });

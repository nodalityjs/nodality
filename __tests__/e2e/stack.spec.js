const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Stack test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 768, height: 800 }); // Mobile size
  await page.goto(`${baseURL}/public/stack.html`);

  const image = page.locator('div[style*="display: grid"] img');
  const heading = page.locator('div[style*="display: grid"] h2');

  // Check they are visible
  await expect(image).toBeVisible();
  await expect(heading).toBeVisible();

  // Get computed styles
  const imageGridArea = await image.evaluate(el =>
    window.getComputedStyle(el).getPropertyValue('grid-area')
  );
  const headingGridArea = await heading.evaluate(el =>
    window.getComputedStyle(el).getPropertyValue('grid-area')
  );

  expect(imageGridArea.trim()).toBe('1 / 1');
  expect(headingGridArea.trim()).toBe('1 / 1');
  
  });

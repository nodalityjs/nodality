// tests/filter-ui.spec.js
const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Row test applies filter to an <img> element', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${baseURL}/public/row.html`);

  const container = page.locator('#mount > *').first();

  // Check that the container is visible
  await expect(container).toBeVisible();

  // Check computed display style is flex
  const display = await container.evaluate(el => getComputedStyle(el).display);
  expect(display).toBe('flex');

  const flexDirection = await container.evaluate(el =>
    getComputedStyle(el).getPropertyValue('flex-direction')
  );
  
  expect(flexDirection).toBe('row'); // or 'column', depending on what you expect


  // Check that it has exactly 3 children that are h3
  const headers = container.locator('h3');
  await expect(headers).toHaveCount(3);

  // Check their text content
  await expect(headers.nth(0)).toHaveText('This');
  await expect(headers.nth(1)).toHaveText('is');
  await expect(headers.nth(2)).toHaveText('row.');
});

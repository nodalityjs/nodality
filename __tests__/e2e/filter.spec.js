// tests/filter-ui.spec.js
const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/public/filter.html';

test('Des applies filter to an <img> element', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(baseURL);

  // Locate rendered image inside the mount point
  const img = page.locator('#mount img');

  // Check that image is rendered and visible
  await expect(img).toBeVisible();

  // Filter style should be applied
  const filter = await img.evaluate(el => getComputedStyle(el).filter);
  expect(filter).toMatch(/grayscale|blur|contrast|brightness|saturate|sepia/);

  // Visibility checks
  const styles = await img.evaluate(el => {
    const s = getComputedStyle(el);
    return {
      display: s.display,
      visibility: s.visibility,
      opacity: s.opacity
    };
  });

  expect(styles.display).not.toBe('none');
  expect(styles.visibility).not.toBe('hidden');
  expect(parseFloat(styles.opacity)).toBeGreaterThan(0);

  // Dimensions check
  const box = await img.boundingBox();
  expect(box?.width).toBeGreaterThan(10);
  expect(box?.height).toBeGreaterThan(10);
});

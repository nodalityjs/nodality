const { test, expect } = require('@playwright/test');

test('Transform works', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/transform`);
const image = page.locator('img').nth(1);

  // Wait for image to be visible and fully loaded
  await expect(image).toBeVisible();
  await image.evaluate(img =>
    img.complete ? true : new Promise(resolve => img.onload = resolve)
  );

  // Get initial scale (should be 1 if not transformed)
  let transform = await image.evaluate(el => getComputedStyle(el).transform);
  let match = transform.match(/^matrix\(([^,]+),/);
  let initialScale = match ? parseFloat(match[1]) : 1;

  // Scroll down slowly
  await page.evaluate(async () => {
    for (let i = 0; i < 1000 / 5; i++) {
      window.scrollBy(0, 5);
      await new Promise(r => setTimeout(r, 10));
    }
  });

  await page.waitForTimeout(300); // wait for any animation to complete

  // Get scale after scroll
  transform = await image.evaluate(el => getComputedStyle(el).transform);
  match = transform.match(/^matrix\(([^,]+),/);
  let finalScale = match ? parseFloat(match[1]) : 1;

  console.log('Initial scale:', initialScale);
  console.log('Final scale:', finalScale);

  expect(finalScale).toBeLessThan(1.6);
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


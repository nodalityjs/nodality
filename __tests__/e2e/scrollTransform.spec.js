const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Scroll Transform works', async ({browser, baseURL }) => {
  
  const videoDir = path.join(os.homedir(), 'playwright-videos');

  const context = await browser.newContext({
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  
  
  
  
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/scrolltransform`);
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

  expect(finalScale).toBeLessThan(1.6);

   await context.close(); // Ensure the video is saved
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


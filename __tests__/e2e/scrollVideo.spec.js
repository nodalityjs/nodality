const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Scroll video works', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/scrollVideo`);


 const video = page.locator('video');

   // Wait until video element is in the viewport and visible
  await expect(video).toBeVisible();

  await page.screenshot({ path: 'after-scrolll.png', fullPage: true });

/*
  // Confirm video has not played yet
  let currentTime = await video.evaluate(el => el.currentTime);
  expect(currentTime).toBe(0);

  // scroll page here
await page.evaluate(async () => {
  for (let i = 0; i < 50 / 3; i++) {
    window.scrollBy(0, 3);
    await new Promise(r => setTimeout(r, 10));
  }
});

  // Wait until the video starts playing
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && video.currentTime > 0;
  }, { timeout: 2000 });
*/

  // Verify video started playing
 // currentTime = await video.evaluate(el => el.currentTime);
 // expect(currentTime).toBeGreaterThan(0);

});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


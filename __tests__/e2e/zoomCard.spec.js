const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const os = require('os');
const path = require('path'); // <-- ADD THIS LINE
// Breakpoint widths and expected directions

  test(`Zoom Card`, async ({ browser, baseURL }) => {

    const videoDir = path.join(os.homedir(), 'playwright-videos');

  const context = await browser.newContext({
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  
    await page.waitForTimeout(1300);


    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto(`${baseURL}/public/zoomCard`);

   const cards = page.locator('div[style*="background-image"]');

  // Ensure 3 cards exist
  await expect(cards).toHaveCount(3);

  for (let i = 0; i < 3; i++) {
    await cards.nth(i).hover({force: true});
    await page.waitForTimeout(1300); // wait for any hover animation

    const hoverTransform = await cards.nth(i).evaluate(el => getComputedStyle(el).transform);
    const match = hoverTransform.match(/^matrix\(([^,]+),/);
    const scale = match ? parseFloat(match[1]) : 1;
    expect(scale).toBeGreaterThan(1);
  }

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


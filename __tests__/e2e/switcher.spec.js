const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Switcher test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto(`${baseURL}/public/switcher`);
   const selector = '#mount p';

    // 1. At 0px (mobile)
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.locator(selector)).toHaveText('First');

    // 2. At 700px
    await page.setViewportSize({ width: 700, height: 800 });
    await expect(page.locator(selector)).toHaveText('Nice');

    // 3. At 800px
    await page.setViewportSize({ width: 800, height: 800 });
    await expect(page.locator(selector)).toHaveText('Best');

    // 4. Beyond 800px
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator(selector)).toHaveText('Best');
});

// 201814 passed 

// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


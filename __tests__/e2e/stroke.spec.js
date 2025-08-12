const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Blast op (text-stroke) at 700px viewport', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto(`${baseURL}/public/stroke`);

    const h1 = page.locator('h1');
   const stroke = await h1.evaluate(el => getComputedStyle(el).webkitTextStroke);
   expect(stroke).toMatch(/^1px\s+rgb\(\d+,\s*\d+,\s*\d+\)$/i);

   // Before
  // expect(stroke).toMatch(/^1px\s+rgb\(\d+,\s*\d+,\s*\d+\)$/i);

  });



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


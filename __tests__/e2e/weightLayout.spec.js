const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Test there are divs with grid-area', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/weightLayout`);
 const selectors = ['#A', '#B', '#G'];

  for (const selector of selectors) {
    const hasGridPosition = await page.$eval(selector, el => {
      const style = getComputedStyle(el);
      const rowStart = style.gridRowStart;
      const colStart = style.gridColumnStart;
      return !isNaN(parseInt(rowStart)) && !isNaN(parseInt(colStart));
    });

    expect(hasGridPosition).toBe(true);
  }
});

// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading





// 1- serve launcj folder at 3000
// run npx playwright test
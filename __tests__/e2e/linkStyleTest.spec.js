const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Link style test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/linkStyle`);

  const link = page.locator('a');
  await expect(link).toHaveText('Hello');

   // Check default styles
  let color = await link.evaluate(el => getComputedStyle(el).color);
  let background = await link.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(background).toBe('rgba(0, 0, 0, 0)'); // transparent
  //expect(color).toBe('rgb(0, 0, 0)'); // black

  // Hover the link
  await link.hover();
  await page.waitForTimeout(300); // wait for hover transition

  // Check hover styles
  color = await link.evaluate(el => getComputedStyle(el).color);
  background = await link.evaluate(el => getComputedStyle(el).backgroundColor);

  expect(color).toBe('rgb(26, 188, 156)'); // #1abc9c
  expect(background).toBe('rgb(255, 165, 0)'); // orange


});

// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading





// 1- serve launcj folder at 3000
// run npx playwright test
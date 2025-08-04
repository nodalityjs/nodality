const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Floating object works', async ({browser, baseURL }) => {
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/floatingInput`);
  
   const container = page.locator('#mount > div');
  const label = container.locator('label');
  const input = container.locator('input');

  // Check default label state (hidden)
  let labelStyle = await label.evaluate(el => getComputedStyle(el));
  expect(labelStyle.opacity).toBe('0');

  // Focus the input
  await input.focus();

  // Re-fetch label styles after focus
  labelStyle = await label.evaluate(el => getComputedStyle(el));

  // Check that label is now styled
  expect(labelStyle.opacity).not.toBe('0'); // if it becomes visible
  expect(labelStyle.transform).toMatch(/^matrix.*$/); // scale(1)
  expect(labelStyle.transition).toContain('transform');
  expect(labelStyle.textTransform.toLowerCase()).toBe('uppercase');
  expect(labelStyle.fontWeight).toMatch(/bold|[7-9]00/); // bold or 
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


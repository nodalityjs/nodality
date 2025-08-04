const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Transform object works', async ({browser, baseURL }) => {
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/transform`);
  const h1 = page.locator('h1');


  // Check that the element is visible
  await expect(h1).toBeVisible();

  // Get computed transform
  const transform = await h1.evaluate(el => getComputedStyle(el).transform);

  // Debug output
  console.log('Computed transform:', transform);

     const expected = [
    1.00012, 3.08471e-05, 0, 0,
    1.02824e-05, 1.00012, 0, 0,
    0, 1.388e-10, 1, -1.17814e-07,
    0.00294572, 0.00176764, 0, 1,
  ];

  const actual = transform
    .replace(/^matrix3d\(|\)$/g, '')
    .split(',')
    .map(n => parseFloat(n.trim()));

  expect(actual.length).toBe(expected.length);

  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 3); // Allow margin: ~0.001
  }
  // Assert that the transform is a valid matrix()
 // expect(transform).toMatch(/^matrix\([^)]+\)$/);
 // Ensure the video is saved
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


const { test, expect } = require('@playwright/test');

test('Span is applied to text', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/spanTest`);

  const h1 = await page.locator('h1');

await expect(h1).toBeVisible(); 
  const text = await h1.innerText();

  expect(text).toContain('The first time');
  expect(text).toContain('We went to the Moon');

  // Optional: full text assertion
  //expect(text.trim()).toBe('The first time\nWe went to the Moon');
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


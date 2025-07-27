const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/public/multipleTextEffects.html';

test('Does applies text-stroke at 700px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto(`${baseURL}`);

  const h1 = page.locator('h1');
  await expect(h1).toHaveText('Hello');



   await expect(h1).toHaveCSS('background-image', /gradient/);
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


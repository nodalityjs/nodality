const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Layout test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/layout.html`);
 const gridDiv = page.locator('div[style*="display: grid"]');

  // Assert it's present
  await expect(gridDiv).toHaveCount(1);

  // Check styles
  const styles = await gridDiv.evaluate(el => getComputedStyle(el));

  expect(styles.display).toBe('grid');

  const columnTemplate = await gridDiv.evaluate(el =>
  getComputedStyle(el).gridTemplateColumns.split(' ').length
);
expect(columnTemplate).toBe(6);

const rowTemplate = await gridDiv.evaluate(el =>
  getComputedStyle(el).gridTemplateRows.split(' ').length
);
expect(rowTemplate).toBe(6);


  expect(styles.height).toBe('600px');

  // Check h1 child exists
  const h1 = gridDiv.locator('h1');
  await expect(h1).toHaveCount(1);
  await expect(h1).toContainText('I am free');

  // Check image child exists and has correct src
  const img = gridDiv.locator('img');
  await expect(img).toHaveCount(1);
});

// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading





// 1- serve launcj folder at 3000
// run npx playwright test
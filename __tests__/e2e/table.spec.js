const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/public/table.html';

test('Table test', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}`);

   // ✅ Check that the table element exists
  const table = page.locator('table');
  await expect(table).toBeVisible();
/*
  // ✅ Check that at least one row (excluding thead) exists
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCountGreaterThan(0);

  // ✅ Check that at least one column (cell) exists in the first row
  const firstRowCells = rows.nth(0).locator('td');
  await expect(firstRowCells).toHaveCountGreaterThan(0);*/
});

// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading





// 1- serve launcj folder at 3000
// run npx playwright test
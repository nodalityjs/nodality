const { test, expect } = require('@playwright/test');

test('Sidebar works', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/sideBar`);

  
 // Find the open button (☰) — it has opacity 0, but still clickable
  const openButton = page.locator('button', { hasText: '☰' });
  await expect(openButton).toBeVisible();
  await openButton.click();

  // Locate the paragraph with "Off canvas"
  const text = page.locator('p', { hasText: 'Off canvas' });
  await expect(text).toBeVisible();
  
/*
   // Parent div of the <p>, the off-canvas panel
  const panel = text.locator('../..');

  
  let transform = await panel.evaluate(el => getComputedStyle(el).transform);
  let match = transform.match(/matrix\([^,]+, [^,]+, [^,]+, [^,]+, ([^,]+), [^)]+\)/);
  let tx = match ? parseFloat(match[1]) : NaN;

  expect(tx).toBeCloseTo(0, 1);  // panel visible, translateX ≈ 0

  const closeButton = panel.locator('button', { hasText: '×' });
  await closeButton.click();

  await page.waitForTimeout(300); // wait for close animation

  transform = await panel.evaluate(el => getComputedStyle(el).transform);
  match = transform.match(/matrix\([^,]+, [^,]+, [^,]+, [^,]+, ([^,]+), [^)]+\)/);
  tx = match ? parseFloat(match[1]) : NaN;

  expect(tx).toBeGreaterThan(300); // panel hidden, translateX shifted right


  // Check the computed transform style of the panel div
 // const transform = await panel.evaluate(el => getComputedStyle(el).transform);
  
  // The panel is off-canvas, so transform should contain translateX(100%) or matrix equivalent
  //expect(transform).toContain('matrix(1, 0, 0, 1, 0, 0)'); // or adjust as needed
*/
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


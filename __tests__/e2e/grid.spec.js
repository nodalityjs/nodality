const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Grid test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/grid.html`);

  const grid = page.locator('.grid-container');
  await expect(grid).toHaveCSS('display', 'grid');

  const children = grid.locator('> div');
  await expect(children).toHaveCount(5);

  const expectedAreas = ['a', 'b', 'c', 'd', 'e'];

  for (let i = 0; i < expectedAreas.length; i++) {
    const child = children.nth(i);
    const gridArea = await child.evaluate(el => window.getComputedStyle(el).gridArea);
    expect(gridArea).toBe(expectedAreas[i]);
  }
  
 // 120908 wow!
});

// npx playwright test
// SINGLE npx playwright test grid.spec.js 

// npx playwright test --reporter=html
// npx playwright show-report
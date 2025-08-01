const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Grid test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/grid.html`);

  const container = page.locator('#mount');
  
  await expect(container.locator(':scope > div')).toHaveCount(1);

 const cards = container.locator(':scope > div > div');
 await expect(cards).toHaveCount(3);

  for (let i = 0; i < 3; i++) {
    const card = cards.nth(i);
    await expect(card.locator('img')).toHaveCount(1);
    await expect(card.locator('h3')).toHaveText('Hello');
    await expect(card.locator('a')).toHaveText('Hello');
  }
 
});

// npx playwright test
// SINGLE npx playwright test grid.spec.js 

// npx playwright test --reporter=html
// npx playwright show-report
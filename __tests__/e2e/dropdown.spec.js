const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Dropdown test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/dropdown.html`);

  // Locate the trigger element — the <div> that contains "Flower"
  const hoverTarget = page.locator('div:has(p:has-text("Flower"))').first();

  // Ensure the target is visible
  await expect(hoverTarget).toBeVisible();

  // Perform the hover
  await hoverTarget.click();
  await page.waitForTimeout(5000);

  await page.screenshot({ path: `${process.env.HOME}/popover.png`, fullPage: true });

  // Wait for the popover to appear — match by background or part of the inner text
  const popover = page.locator('div[style*="position: absolute"]');
 
  // Assert it becomes visible
  await expect(popover).toBeVisible();
});

// npx playwright test
// SINGLE npx playwright test grid.spec.js 

// npx playwright test --reporter=html
// npx playwright show-report
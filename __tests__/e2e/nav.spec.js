const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Mobile navbar layout on < 1200px viewport', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 768, height: 800 }); // Mobile size
  await page.goto(`${baseURL}/public/nav.html`);
  
 // await page.screenshot({ path: 'debug.png', fullPage: true });
  
  const nav = page.locator('#mount > div');
  await expect(nav).toBeVisible();


  // ✅ navbar-header
  const header = nav.locator('.navbar-header');
  await expect(header).toBeVisible();
  await expect(header.locator('.navbar-brand')).toBeVisible();
  await expect(header.locator('h1')).toHaveText('A');
  await expect(header.locator('.navbar-toggle')).toHaveText('☰');

  // ✅ navbar-content (hidden by default)
  const content = nav.locator('.navbar-content');
  await expect(content).toHaveCSS('display', 'none');

  // ✅ Links and interactive item structure inside content
  const links = content.locator('a');
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveText('A');
  await expect(links.nth(1)).toHaveText('B');
  await expect(links.nth(2)).toHaveText('C');

  // ✅ First interactive element with image inside <p>
  /*const mainInteractive = content.locator('div >> nth=0');
  const p = mainInteractive.locator('p');
  await expect(p).toHaveText(/First/);
  await expect(p.locator('img')).toHaveAttribute('src', /60995\.png/);

  // ✅ Dropdown container is hidden
  const dropdown = content.locator('div >> nth=1');
  await expect(dropdown).toHaveCSS('display', 'none');

  // ✅ Dropdown contains two paragraphs
  const dropdownTexts = dropdown.locator('p');
  await expect(dropdownTexts.nth(0)).toHaveText('Firsti');
  await expect(dropdownTexts.nth(1)).toHaveText('Firstiuu');
*/
  });

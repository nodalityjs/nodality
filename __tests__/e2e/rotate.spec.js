const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Rotate test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/rotate.html`);

   const expectedAngles = [0, 30, 120];
   const divs = page.locator('#mount > div > h1');
   await expect(divs.first()).toBeVisible();

  const count = await divs.count();
  expect(count).toBe(3);

  for (let i = 0; i < divs.length; i++) {
    const matrix = await divs[i].evaluate(el => getComputedStyle(el).transform);
    const match = matrix.match(/matrix\(([^,]+), ([^,]+), ([^,]+), ([^,]+),/);

    expect(match).not.toBeNull();

    const a = parseFloat(match[1]);
    const b = parseFloat(match[2]);

    const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
    const angleNormalized = (angle + 360) % 360;

    console.log(`Div ${i}: transform = ${matrix}, angle ≈ ${angleNormalized}°`);
    expect(angleNormalized).toBe(expectedAngles[i]);
  }

});

// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading





// 1- serve launcj folder at 3000
// run npx playwright test
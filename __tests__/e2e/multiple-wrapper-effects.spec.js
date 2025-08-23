const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const viewportRanges = [
  {
    width: [400, 599],
    expect: { stroke: false, shadow: false, gradient: true }, // < 600: nothing
  },
  {
    width: [600, 800],
    expect: { stroke: true, shadow: true, gradient: true }, // both active
  },
  {
    width: [801, 900],
    expect: { stroke: false, shadow: true, gradient: false }, // only shadow
  },
  {
    width: [901, 1000],
    expect: { stroke: false, shadow: false, gradient: false }, // > 900: nothing
  },
];

for (const { width: [minWidth, maxWidth], expect: expected } of viewportRanges) {
  for (let width = minWidth; width <= maxWidth; width += 50) { // step 50 for brevity
    test(`LS Style Wrap test at ${width}px`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${baseURL}/public/multipleWrapperEffects.html`);

      const h1 = page.locator('#mount > div');
     // await expect(h1).toHaveText('Hello');

      const styles = await h1.evaluate(el => {
        const style = getComputedStyle(el);
        return {
          stroke: style.webkitTextStroke,
          shadowFilter: style.boxShadow,
        };
      });

      // Screenshot once per test
     /* const buffer = await h1.screenshot();
      const homeDir = os.homedir();
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(homeDir, `h1-${width}px-${timestamp}.png`);
      fs.writeFileSync(filePath, buffer);
      */

      // mv h1-*px*.png ~/.Trash/

      // Check stroke
      if (expected.stroke) {
        expect(styles.stroke).toMatch(/\d+px\s+rgb/i);
      } else {
        expect(
  styles.stroke.toLowerCase().startsWith('0px') || styles.stroke.toLowerCase() === 'none'
).toBe(true);
      }


if (expected.shadow) {
   expect(styles.shadowFilter.toLowerCase()).not.toBe('none');
} else {
  expect(styles.shadowFilter.toLowerCase()).toBe('none');
}

if (expected.gradient){
  const h1 = page.locator('#mount > div');
 
  await expect(h1).toHaveCSS('background-image', /gradient/);
} else {
  // fill in this
   const h1 = page.locator('#mount > div');
 
  const bg = await h1.evaluate(el => getComputedStyle(el).backgroundImage);
  expect(bg).toBe('none');
}


    });
  }
}

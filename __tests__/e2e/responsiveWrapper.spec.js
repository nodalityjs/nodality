const { test, expect } = require('@playwright/test');
// Breakpoint widths and expected directions

const breakpoints = [
  { width: 600, expectedDirection: 'column' },
  { width: 700, expectedDirection: 'row' },
  { width: 1200, expectedDirection: 'column' },
  { width: 1400, expectedDirection: 'column' },
];

for (const { width, expectedDirection } of breakpoints) {
  test(`Check flex-direction at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${baseURL}/public/responsiveWrapper`);

    const direction = await page.locator('#mount > div').evaluate(el =>
      getComputedStyle(el).flexDirection
    );

    expect(direction).toBe(expectedDirection);
  });

};



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


const { test, expect } = require('@playwright/test');

test('Does applies text-stroke at 700px viewport', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/stroke.html`);

  const h1 = page.locator('h1');
  await expect(h1).toHaveText('Hello');

  const styles = await h1.evaluate(el => {
    const style = getComputedStyle(el);
    return {
      stroke: style.webkitTextStroke,
      fill: style.webkitTextFillColor,
    };
  });

  expect(styles.stroke).not.toBe('none');
  expect(styles.strokeWidth).not.toBe('0px');
  expect(styles.fill).toBe('rgba(0, 0, 0, 0)');
});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


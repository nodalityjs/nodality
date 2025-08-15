const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

test('Transform style (MEDIUM, FAST) works', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/transformStyle`);

  const h1 = page.locator('h1');
  await expect(h1).toBeVisible();

  // Wait until a transform is applied
  await page.waitForFunction(() => {
    const el = document.querySelector('h1');
    return el && getComputedStyle(el).transform !== 'none';
  });

  await page.waitForTimeout(1300);

  const transform = await h1.evaluate(el => getComputedStyle(el).transform);

  expect(transform.startsWith('matrix(')).toBe(true);

  const [a, b, c, d, e, f] = transform.match(/-?\d+(\.\d+)?/g).map(Number);

expect(a).toBeCloseTo(1.19511, 2); // scaleX
expect(d).toBeCloseTo(1, 2);       // scaleY
//expect(e).toBeCloseTo(97.5539, 1); // translateX
expect(f).toBeCloseTo(0, 1);       // translateY


const pre = await page.locator('pre').textContent();
expect(pre).toContain(`new Text("Hello").set({
    size: "S1",
    font: "Arial",
    transform: {
        op: {
            name: "transform",
            transform: {
                values: [
                    "tx:100px",
                    "opacity:0.2",
                    "scale(1.2, 1.0)"
                ],
                duration: "3s-ease-in-out"
            }
        }
    }
}).render("#mount");`); // 161920 code test


/*
  const matrix = transform
    .replace(/^matrix3d\(|\)$/g, '')
    .split(',')
    .map(n => parseFloat(n.trim()));

  expect(matrix.length).toBe(6);

  // Example checks for qualitative transform effects
  expect(matrix[0]).toBeGreaterThan(1); // Scale x > 1
  expect(matrix[5]).toBeGreaterThan(1); // Scale y > 1
  expect(Math.abs(matrix[12])).toBeGreaterThan(0); // Translate x ≠ 0
  expect(Math.abs(matrix[13])).toBeGreaterThan(0); // Translate y ≠ 0
  */
});

/*

1) __tests__/e2e/transform.spec.js:5:1 › Transform object works ────────

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      22 |   console.log('Computed transform:', transform);
      23 |
    > 24 |   expect(transform.startsWith('matrix3d(')).toBe(true);
         |                                             ^
      25 |
      26 |   const matrix = transform
      27 |     .replace(/^matrix3d\(|\)$/g, '')
        at /Users/filipvabrousek/Launch/__tests__/e2e/transform.spec.js:24:45

    Error Context: test-results/transform-Transform-object-works/error-context.md

  1 failed
    __tests__/e2e/transform.spec.js:5:1 › Transform object works 
*/


// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


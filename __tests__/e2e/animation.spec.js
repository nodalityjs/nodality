const { test, expect } = require('@playwright/test');

test('Anim works', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/animation`);

  // Wait slightly longer than animation duration
/*await page.waitForTimeout(300); 

const panel = page.locator('h1');
const transform = await panel.evaluate(el => getComputedStyle(el).transform);
expect(transform).toContain('matrix(1, 0, 0, 1, 684, 0)'); // translateX(0%)
*/

 const panel = page.locator('h1');

  // Get initial transform before animation ends
  const initialTransform = await panel.evaluate(el => getComputedStyle(el).transform);
  console.log('Initial transform:', initialTransform);

  // Wait for animation to finish
  await page.waitForTimeout(9300);

  // Get final transform
  const finalTransform = await panel.evaluate(el => getComputedStyle(el).transform);
  console.log('Final transform:', finalTransform);

  // Extract X translation from the final matrix
  const match = finalTransform.match(/matrix\([^,]+, [^,]+, [^,]+, [^,]+, ([^,]+),/);
  const tx = match ? parseFloat(match[1]) : NaN;

  // Final translation should be 0
  expect(tx).toBeCloseTo(0, 1); // allow ±1px error margin

  // Optional: also assert that initial and final transform differ
  expect(initialTransform).not.toBe(finalTransform);

  // 132405 Nice in Vankovka 01/08/25






// npx playwright test __tests__/e2e/animation.spec.js


/*
expect(tx).toBeCloseTo(0, 1); // optional tolerance

  await page.waitForTimeout(1300);

 // Locate and click the close button (×)
  const closeButton = page.locator('button', { hasText: '×' });
  await closeButton.click({ force: true });
  // await closeButton.click();

  // Wait a bit for the animation (if any)
  await page.waitForTimeout(300);

  // Recheck the transform
  transform = await panel.evaluate(el => getComputedStyle(el).transform);
  match = transform.match(/matrix\([^,]+, [^,]+, [^,]+, [^,]+, ([^,]+), [^)]+\)/);
  tx = match ? parseFloat(match[1]) : NaN;

  expect(tx).toBeGreaterThan(200); // Closed state (offscreen to the right)
  */
 
  /*

You write translateX(...) (or scale, rotate, etc.)
The computed style (what the test sees) is always returned as matrix(...)
This is because browsers internally convert all 2D transforms to matrix form for performance and consistency

2. Match the matrix(...) string
let match = transform.match(/matrix\([^,]+, [^,]+, [^,]+, [^,]+, ([^,]+), [^)]+\)/);
This is a regular expression for matching a matrix like:

matrix(a, b, c, d, tx, ty)
You're extracting the fifth value, tx, which is the horizontal translation (i.e., how far it’s been shifted sideways).
  
104543 transform: sth => converted into single trans. matrix
GPU acceleration (operate directly on matrices)
When you ask:
getComputedStyle(el).transform
You're not getting the original CSS; you're getting the browser's computed result, which is always in matrix form.
That’s why Playwright (or Puppeteer, or Cypress) sees matrix(...) even if you wrote transform: translateX(...).

transform: translateX(100px) => matrix(1, 0, 0, 1, 100, 0)
No scale or rotation → 1, 0, 0, 1
tx = 100, ty = 0


ROTATE 
rotate(45deg)

ROT:
matrix(cos θ, sin θ, -sin θ, cos θ, 0, 0)

Step 1: Convert degrees to radians
CSS uses degrees, but matrix math uses radians.
θ = 45 degrees = π / 4 radians ≈ 0.7854


From θ = π/4:
cos(π/4) ≈ 0.7071
sin(π/4) ≈ 0.7071

matrix(
  0.7071,   // a = cos(θ)
  0.7071,   // b = sin(θ)
 -0.7071,   // c = -sin(θ)
  0.7071,   // d = cos(θ)
  0,        // tx (translation x)
  0         // ty (translation y)
)

It rotates every point on the element by 45° around its origin. For example:
A point at (1, 0) becomes approximately (0.707, 0.707)
A point at (0, 1) becomes approximately (−0.707, 0.707)
That’s a classic clockwise rotation.

For each point (x, y) on the element, the browser calculates its new position (x', y') using this formula:
*/

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


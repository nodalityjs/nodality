const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Complex form test', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto(`${baseURL}/public/formAllTest`);

 const inputCount = await page.locator('input').count();
 expect(inputCount).toBeGreaterThan(0);

const maleRadio = page.locator('input[type="radio"][value="Male"]');
const femaleRadio = page.locator('input[type="radio"][value="Female"]');
const preferNotToSayRadio = page.locator('input[type="radio"][value="Preffernottosay"]');

// Example assertions
await expect(maleRadio).toHaveCount(1);
await expect(femaleRadio).toHaveCount(1);
await expect(preferNotToSayRadio).toHaveCount(1);


// Locate the <datalist> element by ID
const datalist = page.locator('datalist');

// Get all <option> children of the <datalist>
const options = datalist.locator('option');

// Assert there are exactly 3 options
await expect(options).toHaveCount(3);


const rangeInput = page.locator('input[type="range"]');
await expect(rangeInput).toHaveCount(1);

// Locate the checkbox
  const checkbox = page.locator('input[type="checkbox"][name="acceptTerms"]');
  await expect(checkbox).toHaveCount(1);

  // Assert that the adjacent text exists
  const labelText = page.locator('text=Check it out!');
  await expect(labelText).toBeVisible();

  // Optionally check the checkbox
  await checkbox.check();
  await expect(checkbox).toBeChecked();

const submitButton = page.locator('button');
await expect(submitButton).toHaveCount(1);
// npx playwright test __tests__/e2e/form.spec.js
});

// 201814 passed 

// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


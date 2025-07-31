const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Filepicker test', async ({ page, baseURL }) => {
 // run with npx playwright test filePicker.spec.js
 // const screenshotPath = path.resolve(__dirname, 'screenshot.png');

// resolves to http://localhost:3000/public/filePicker.html
 // console.log(`${baseURL}/public/filePicker.html`)
   await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/filePicker.html`);

  /* await page.screenshot({ path: screenshotPath });

  let openCommand = `open ${screenshotPath}`;
 exec(openCommand, (err) => {
    if (err) {
      console.error('❌ Failed to open screenshot:', err);
    } else {
      console.log('✅ Screenshot opened');
    }
  });*/


  // await page.screenshot({ path: screenshotPath });

  // Click the label associated with the hidden input
  const label = page.locator('label[for="A"]');
  await expect(label).toBeVisible();
  await label.click(); // optional realism

  // Get the hidden input
  const fileInput = page.locator('input[type="file"]');

  // Force visibility so we can attach a file
  await fileInput.evaluate(el => {
    el.style.display = 'block';
    el.style.visibility = 'visible';
  });

  // Set a file (make sure it exists)
  const testFilePath = path.resolve(__dirname, 'fixtures/test.txt');
  await fileInput.setInputFiles(testFilePath);

  // Validate that the file was set
  const fileName = await fileInput.evaluate(input => input.files[0]?.name);
  expect(fileName).toBe('test.txt');

});



// NOW:
// cd launch
// npx playwright test











// OLDER NOTES
// npm run test:playwright
// create files like in development they will run on localhost:3000 in sequence
// prepare mutliple folders like designertest
// comment out  webserver section before uploading


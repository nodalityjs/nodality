// tests/filter-ui.spec.js
const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('Row test applies filter to an <img> element', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${baseURL}/public/shadow.html`);

  const h1 = page.locator('h1').first();
   await expect(h1).toHaveText('Hello');
 // console.log(h1);

   const styles = await h1.evaluate(el => {
        const style = getComputedStyle(el);
        return {
          stroke: style.webkitTextStroke,
          shadowFilter: style.filter,
        };
      });

     // console.log("We live in shadows.");
     // console.log(styles.shadowFilter.toLowerCase());
      
       expect(styles.shadowFilter.toLowerCase()).not.toBe('none');

      let count = styles.shadowFilter.split("drop-shadow").filter(x => x.trim().length > 0);
      expect(count.length).toBe(3);
});

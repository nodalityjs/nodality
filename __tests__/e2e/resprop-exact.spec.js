const { test, expect } = require('@playwright/test');

// `exact` is Nodality's alias for font size in set() on every component,
// so writing it inside a resprop breakpoint reads as the obvious thing to
// do. It used to be dropped with a warning that a first-class Nodality
// key "is not a CSS property" — one key meaning fontSize in set() and
// nothing in resprop. Two real pages (sls3-2025, gesos-2025) hit this and
// silently rendered at the wrong size.
test('resprop accepts `exact` as the font-size alias', async ({ page, baseURL }) => {
  const warnings = [];
  page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${baseURL}/public/resprop-exact.html`);
  await page.waitForFunction(() => window.__ready === true);

  const el = page.locator('#mount >> text=Sized via exact');
  await expect(el).toBeVisible();

  // 3rem against the 16px root.
  const size = await el.evaluate(n => getComputedStyle(n).fontSize);
  expect(size).toBe('48px');

  // And it must not warn about a key it now supports.
  expect(warnings.filter(w => /resprop: "exact"/.test(w))).toHaveLength(0);
});

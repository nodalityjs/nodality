const { test, expect } = require('@playwright/test');

// loadJson's own docs call out "team.json doesn't exist yet" stub pages
// as the reason `fallback` exists — but it warned on every build anyway,
// so the message stopped distinguishing "not written yet" from "the file
// I shipped is missing or malformed", which is the one worth seeing.
test('loadJson: quiet silences an EXPECTED miss, and only that', async ({ page, baseURL }) => {
  const warnings = [];
  page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });

  await page.goto(`${baseURL}/public/loadjson-quiet.html`);
  await page.waitForFunction(() => window.__ready === true);

  // Both still return the fallback — quiet changes reporting, not behaviour.
  const res = await page.evaluate(() => window.__res);
  expect(res.quiet).toEqual([]);
  expect(res.loud).toEqual([]);

  expect(warnings.filter(w => /definitely-missing\.json/.test(w))).toHaveLength(0);
  expect(warnings.filter(w => /also-missing\.json/.test(w))).toHaveLength(1);
});

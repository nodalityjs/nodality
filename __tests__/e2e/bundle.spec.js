const { test, expect } = require('@playwright/test');

/**
 * The only spec that exercises the BUILT bundle.
 *
 * All 46 other fixtures import source — ../lib/designer.js,
 * ../layout/text.js, ../layout/animator.js. Consumers import
 * dist/index.esm.js, which webpack produced. Nothing else in the suite
 * ever executes that file, so a regression introduced by bundling rather
 * than by source — tree-shaking dropping a module whose only job is
 * registration, the minifier rewriting a construct, a webpack config
 * change — passes every existing test and breaks every consumer.
 *
 * That is not theoretical: in a consumer project esbuild's minifier
 * rewrote a block-scoped function declaration as `let f = function(){}`
 * and changed runtime behaviour. Bundlers alter semantics.
 *
 * Requires `npm run build` to have run first (the workflow's test job
 * does this before `npm run test`).
 */
test.describe('built bundle (dist/index.esm.js)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/public/bundle-smoke.html`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  });

  test('the bundle loads and exposes its public names', async ({ page }) => {
    // A missing name here means tree-shaking or a webpack config change
    // dropped it from the shipped artefact.
    const present = await page.evaluate(() => window.__exports);
    for (const [name, ok] of Object.entries(present)) {
      expect(ok, `${name} is missing from dist/index.esm.js`).toBe(true);
    }
    expect(await page.evaluate(() => window.__errors)).toEqual([]);
  });

  test('the shared style map survives bundling', async ({ page }) => {
    // `exact` -> fontSize and flexDir -> display:flex + flexDirection are
    // resolved inside commonMethods. If minification mangled that
    // dispatch these would fall back to defaults.
    const text = page.locator('#b-text');
    await expect(text).toBeVisible();
    expect(await text.evaluate(n => getComputedStyle(n).fontSize)).toBe('32px');
    expect(await text.evaluate(n => getComputedStyle(n).fontWeight)).toBe('700');

    const wrap = page.locator('#b-wrap');
    const box = await wrap.evaluate(n => {
      const cs = getComputedStyle(n);
      return { display: cs.display, dir: cs.flexDirection, gap: cs.gap, width: cs.width };
    });
    expect(box).toEqual({ display: 'flex', dir: 'column', gap: '12px', width: '240px' });
  });

  test('inherited dispatch works through the class hierarchy', async ({ page }) => {
    // TextField and Picker reach height/boxSizing only via the
    // commonMethods they inherit from Animator. A broken prototype chain
    // after bundling leaves both at their natural height.
    for (const id of ['#b-field', '#b-picker']) {
      const el = page.locator(id);
      await expect(el).toBeVisible();
      const m = await el.evaluate(n => {
        const cs = getComputedStyle(n);
        return { h: Math.round(n.getBoundingClientRect().height), box: cs.boxSizing };
      });
      expect(m, `${id} did not receive height/boxSizing`).toEqual({ h: 40, box: 'border-box' });
    }
    // Picker must have built its own option nodes.
    expect(await page.locator('#b-picker option').count()).toBe(2);

    // `color` reaches a component that has NO obj.color handler of its
    // own and is styled purely through the shared map. It was missing
    // from that map while `background` was present, so a Picker given a
    // colour silently rendered in the browser default black next to a
    // TextField that took the same option correctly.
    expect(await page.locator('#b-picker').evaluate(n => getComputedStyle(n).color))
      .toBe('rgb(15, 83, 168)');
  });

  test('component-specific options still apply', async ({ page }) => {
    // `new: true` on Link is handled in link.js, not the shared map.
    const link = page.locator('#b-link');
    await expect(link).toHaveAttribute('target', '_blank');
    expect(await link.getAttribute('rel')).toContain('noopener');

    // FlexGrid.items() calls render() on each child and appends the result.
    expect(await page.locator('#b-grid > *').count()).toBe(2);
  });
});

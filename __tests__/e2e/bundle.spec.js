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

  // The consumer scenario, in a real browser: `nodality` resolves to the
  // bundle, `nodality/raster` to the source module. Those used to be two
  // module instances with two op registries, so an op registered through
  // the public surface was accepted and then never ran — and the shipped
  // inspector, importing the source module too, reported no pipelines on
  // a page full of them. Both silent.
  //
  // Fixed by marking lib/raster-ops.js external in the ESM builds, so the
  // bundle imports it rather than inlining a second copy. This is the
  // browser half of the proof; the Node half is in
  // __tests__/unit/bundle-shares-registry.test.mjs.
  test('an op registered through the source module reaches the bundled mapper',
    async ({ page }) => {
      const seen = await page.evaluate(async () => {
        const { ElementMapper } = await import('/dist/index.esm.js');
        const { registerRasterOp, RASTER_OP_NAMES } = await import('/lib/raster-ops.js');
        const chain = [{ op: 'probe', target: ['#x'] }];

        const before = ElementMapper.filteroRaster('#x', chain) !== undefined;
        registerRasterOp('probe', { stage: 'color', decl: () => '', code: () => '' });
        return {
          before,
          after: ElementMapper.filteroRaster('#x', chain) !== undefined,
          sourceKnows: RASTER_OP_NAMES.includes('probe'),
          // The built-ins reach the bundle through the same import, so a
          // broken external would show up as an empty routing list.
          builtinsVisible: ElementMapper.filteroRaster(
            '#y', [{ op: 'halftone', target: ['#y'] }]) !== undefined,
        };
      });
      expect(seen.before).toBe(false);
      expect(seen.sourceKnows).toBe(true);
      expect(seen.builtinsVisible).toBe(true);
      expect(seen.after,
        'the bundle did not see an op registered through the source module ' +
        '— dist/ is inlining its own registry again').toBe(true);
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

    // Same story for `borderObj`: dispatched only from commonMethods (and
    // from hover(), which this component does not declare), so a Picker
    // given a border through set() used to render with none.
    expect(await page.locator('#b-picker').evaluate(n => getComputedStyle(n).border))
      .toBe('2px solid rgb(15, 83, 168)');
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

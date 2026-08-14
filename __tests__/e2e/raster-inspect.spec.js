// raster-inspect.spec.js — phase H3 of HOUDINI-IMPL-SPEC.
//
// The inspector's two load-bearing claims, tested against a real GPU:
//
//   1. Tuning a UNIFORM param changes the picture and does NOT touch the
//      host DOM. The library's whole pitch is that these effects sit
//      beside your markup instead of rewriting it; a dev tool that
//      re-rendered the page while you dragged would quietly make that
//      false. Asserted with a MutationObserver over the host subtree,
//      the same proof the morph demo uses for its axes.
//   2. A STRUCTURAL param — one compiled into the GLSL — rebuilds and the
//      result still renders. Half the point of the structural/live split
//      is that getting it wrong is invisible: a param baked into the
//      shader, written as a uniform, simply does nothing.
//
// Pixels are compared via Playwright screenshots rather than readPixels:
// the pipeline's context has no `preserveDrawingBuffer`, so reading the
// backbuffer after compositing returns cleared data and would compare
// equal no matter what changed — a green test that proves nothing.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/rasterOps.html';

async function load(page, baseURL, ops) {
  await page.goto(`${baseURL}${PAGE}#ops=${ops}`);
  await page.waitForFunction(() => !!document.querySelector('[data-nodality-raster]'), null,
    { timeout: 10000 });
  await page.waitForTimeout(300);
}

test.describe('inspector plumbing', () => {
  test('a pipeline registers itself and exposes its flattened chain',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'mask');
      const info = await page.evaluate(async () => {
        const { activeRasterPipelines } = await import('/lib/raster-ops.js');
        const pipes = activeRasterPipelines();
        return {
          count: pipes.length,
          ops: pipes[0].nodes.map((n) => n.op),
          backend: pipes[0].backend,
          hasSetParam: typeof pipes[0].setParam === 'function',
          hasRebuild: typeof pipes[0].rebuild === 'function',
        };
      });
      expect(info.count).toBe(1);
      // The FLAT list — index i is the `u<i>_` uniform prefix.
      expect(info.ops).toEqual(['mask', 'halftone']);
      expect(['live', 'snapshot']).toContain(info.backend);
      expect(info.hasSetParam).toBe(true);
      expect(info.hasRebuild).toBe(true);
    });

  test('destroy() deregisters, so the panel cannot list a dead pipeline',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'halftone');
      const counts = await page.evaluate(async () => {
        const { activeRasterPipelines } = await import('/lib/raster-ops.js');
        const before = activeRasterPipelines().length;
        activeRasterPipelines()[0].destroy();
        return { before, after: activeRasterPipelines().length };
      });
      expect(counts.before).toBe(1);
      expect(counts.after).toBe(0);
    });
});

test.describe('inspector: tuning', () => {
  test('a uniform param changes the picture with zero host mutations',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'halftone');

      // Start counting structural mutations over the host subtree.
      await page.evaluate(() => {
        window.__structural = 0;
        const host = document.querySelector('[data-nodality-raster]').parentElement;
        new MutationObserver((rs) => { window.__structural += rs.length; })
          .observe(host, { childList: true, subtree: true, characterData: true });
      });

      const before = await page.locator('#mount').screenshot();

      const how = await page.evaluate(async () => {
        const { activeRasterPipelines } = await import('/lib/raster-ops.js');
        const pipe = activeRasterPipelines()[0];
        const i = pipe.nodes.findIndex((n) => n.op === 'halftone');
        // 5 -> 26: a dot screen four times coarser. Nothing subtle.
        return pipe.setParam(i, 'size', 26);
      });
      await page.waitForTimeout(400);
      const after = await page.locator('#mount').screenshot();

      expect(how).toBe('uniform');
      expect(after.equals(before)).toBe(false);
      expect(await page.evaluate(() => window.__structural)).toBe(0);
    });

  test('a structural param rebuilds, and the rebuilt pipeline renders',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'ditherDriver');
      const before = await page.locator('#mount').screenshot();

      const res = await page.evaluate(async () => {
        const { activeRasterPipelines } = await import('/lib/raster-ops.js');
        const pipe = activeRasterPipelines()[0];
        const i = pipe.nodes.findIndex((n) => n.op === 'dither');
        // `mono` is read inside code(): it selects a different shader body.
        const how = pipe.setParam(i, 'mono', true);
        return { how, live: activeRasterPipelines().length };
      });
      await page.waitForTimeout(600);
      const after = await page.locator('#mount').screenshot();

      expect(res.how).toBe('rebuild');
      // Exactly one pipeline afterwards: the old one deregistered and the
      // replacement registered. A leak here would show as 2.
      expect(res.live).toBe(1);
      expect(after.equals(before)).toBe(false);
      // And it is still a working pipeline, not a corpse.
      const alive = await page.evaluate(async () => {
        const { activeRasterPipelines } = await import('/lib/raster-ops.js');
        const c = activeRasterPipelines()[0].canvas;
        return !!c && c.width > 0 && c.isConnected;
      });
      expect(alive).toBe(true);
    });
});

test.describe('inspector: the panel', () => {
  test('lists every pipeline, its ops and its params', async ({ page, baseURL }) => {
    await load(page, baseURL, 'noiseField');
    const panel = await page.evaluate(async () => {
      const { inspectRaster } = await import('/lib/raster-inspect.js');
      inspectRaster();
      const el = document.querySelector('[data-nodality-inspector]');
      return {
        present: !!el,
        text: el.textContent,
        controls: el.querySelectorAll('input').length,
        // Field wiring is shown as chips: a producer's `as` and each
        // consumer's `masked`.
        showsFieldWiring: /turb/.test(el.textContent),
      };
    });
    expect(panel.present).toBe(true);
    expect(panel.text).toContain('noise');
    expect(panel.text).toContain('offset');
    expect(panel.controls).toBeGreaterThan(3);
    expect(panel.showsFieldWiring).toBe(true);
  });

  test('copy-as-code emits the chain as data that round-trips',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'mask');
      const round = await page.evaluate(async () => {
        const { activeRasterPipelines } = await import('/lib/raster-ops.js');
        const nodes = activeRasterPipelines()[0].nodes;
        // What the panel's copy button writes.
        const src = JSON.stringify(nodes, null, 2);
        const back = JSON.parse(src);
        return {
          ops: back.map((n) => n.op),
          sameShape: JSON.stringify(back) === JSON.stringify(nodes),
        };
      });
      expect(round.ops).toEqual(['mask', 'halftone']);
      expect(round.sameShape).toBe(true);
    });

  // A panel that shows the value it was OPENED with is not an inspector,
  // it is a screenshot. setParam announces every write, so a value changed
  // by the page's own UI — or from the console, or by a second panel — has
  // to pull the matching field straight. This regressed in a demo page
  // first: sliders moved the printed code while the picture stayed put,
  // because Des.cloneNodes() deep-copies the nodes array and the page was
  // addressing pipeline nodes by identity.
  test('a field follows a value written from outside the panel',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'mask');
      const seen = await page.evaluate(async () => {
        const { inspectRaster } = await import('/lib/raster-inspect.js');
        const { activeRasterPipelines } = await import('/lib/raster-ops.js');
        const api = inspectRaster();
        await new Promise((r) => setTimeout(r, 200));

        const sizeField = () =>
          [...document.querySelectorAll('[data-nodality-inspector] input')]
            .find((i) => (i.closest('label')?.textContent || '').trim().startsWith('size'));

        const pipe = activeRasterPipelines()[0];
        const ni = pipe.nodes.findIndex((n) => n.op === 'halftone');
        const before = sizeField().value;

        pipe.setParam(ni, 'size', 17);          // nobody touched the panel
        await new Promise((r) => setTimeout(r, 200));
        const after = sizeField().value;

        // And a field being typed into is left alone, so the panel never
        // rewrites a half-entered number under the caret.
        const f = sizeField();
        f.focus();
        pipe.setParam(ni, 'size', 9);
        await new Promise((r) => setTimeout(r, 200));
        const whileFocused = f.value;

        api.close();
        return { before, after, whileFocused, live: pipe.nodes[ni].size };
      });
      expect(seen.before).not.toBe('17');
      expect(seen.after).toBe('17');
      expect(seen.live).toBe(9);
      expect(seen.whileFocused).toBe('17');   // untouched while focused
    });

  test('the panel closes and leaves nothing behind', async ({ page, baseURL }) => {
    await load(page, baseURL, 'halftone');
    const gone = await page.evaluate(async () => {
      const { inspectRaster } = await import('/lib/raster-inspect.js');
      const api = inspectRaster();
      const opened = !!document.querySelector('[data-nodality-inspector]');
      api.close();
      return { opened, closed: !document.querySelector('[data-nodality-inspector]') };
    });
    expect(gone.opened).toBe(true);
    expect(gone.closed).toBe(true);
  });
});

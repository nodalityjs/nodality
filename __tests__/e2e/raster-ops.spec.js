const { test, expect } = require('@playwright/test');

/**
 * End-to-end tests for the raster operation pipeline.
 *
 * These need a real GL context, so they cover what the jsdom unit tests
 * in __tests__/jest/raster-ops.test.js cannot: which capture backend the
 * pipeline picks, the DOM contract it honours in each mode, and whether
 * each op and driver actually compiles and attaches.
 *
 * The live backend needs the HTML-in-Canvas origin trial
 * (chrome://flags/#canvas-draw-element). Tests that require it detect its
 * absence and assert the documented fallback instead of failing, so the
 * suite is meaningful with the flag either way.
 */

const PAGE = '/public/rasterOps.html';

async function load(page, baseURL, ops) {
  // Hash, not query: the dev server's clean-URL redirect drops the query
  // string, which would silently hand every test the default chain.
  await page.goto(`${baseURL}${PAGE}#ops=${ops}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  // Guard against exactly that class of mistake ever coming back.
  const got = await page.evaluate(() => window.__chain);
  if (got !== ops) throw new Error(`fixture loaded chain "${got}", expected "${ops}"`);
}

const backendOf = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('[data-nodality-raster]');
    return c ? c.getAttribute('data-nodality-raster') : null;
  });

const logs = (page) => page.evaluate(() => (window.__logs || []).join('\n'));

const apiAvailable = (page) =>
  page.evaluate(() =>
    (typeof WebGL2RenderingContext !== 'undefined' &&
      'texElementImage2D' in WebGL2RenderingContext.prototype) ||
    (typeof WebGLRenderingContext !== 'undefined' &&
      'texElementImage2D' in WebGLRenderingContext.prototype));

test.describe('module surface', () => {
  test('registry and drivers are exported', async ({ page, baseURL }) => {
    await load(page, baseURL, 'none');
    const api = await page.evaluate(() => ({
      ops: window.__raster.RASTER_OP_NAMES,
      drivers: window.__raster.DRIVER_NAMES,
    }));
    for (const op of ['hexalize', 'offset', 'duotone', 'edges',
                      'halftone', 'aberration', 'stir', 'blobs']) {
      expect(api.ops).toContain(op);
    }
    expect(api.drivers).toEqual(expect.arrayContaining(['mouse', 'hover', 'scroll', 'time']));
  });
});

test.describe('backend selection', () => {
  test('an in-place chain attempts the live backend', async ({ page, baseURL }) => {
    await load(page, baseURL, 'inplace');
    const backend = await backendOf(page);
    expect(backend).not.toBeNull();
    if (await apiAvailable(page)) {
      expect(backend).toBe('live');
    } else {
      // Documented fallback: it still wants live, and says so.
      expect(backend).toBe('snapshot');
      expect(await logs(page)).toMatch(/HTML-in-Canvas API not available/);
    }
  });

  test('a pure-overlay chain never attempts live', async ({ page, baseURL }) => {
    await load(page, baseURL, 'overlay');
    // Nothing is restructured into the canvas, so there is no live
    // subtree to capture; snapshot is correct regardless of the flag.
    expect(await backendOf(page)).toBe('snapshot');
    expect(await logs(page)).not.toMatch(/HTML-in-Canvas API not available/);
  });

  test('a mixed in-place + overlay chain attempts live', async ({ page, baseURL }) => {
    await load(page, baseURL, 'mixed');
    const backend = await backendOf(page);
    if (await apiAvailable(page)) {
      expect(backend).toBe('live');
    } else {
      expect(backend).toBe('snapshot');
      expect(await logs(page)).toMatch(/HTML-in-Canvas API not available/);
    }
  });

  test('live:false opts a chain out', async ({ page, baseURL }) => {
    await load(page, baseURL, 'optout');
    expect(await backendOf(page)).toBe('snapshot');
    expect(await logs(page)).not.toMatch(/HTML-in-Canvas API not available/);
  });
});

test.describe('DOM contract', () => {
  test('snapshot mode leaves the content in place under an aria-hidden overlay',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'overlay');
      const state = await page.evaluate(() => {
        const el = document.getElementById('#hero');
        const c = el.querySelector('canvas[data-nodality-raster]');
        return {
          textStillInHost: el.textContent.includes('Raster'),
          canvasHasContent: !!(c && c.querySelector('h1, span, div')),
          ariaHidden: c && c.getAttribute('aria-hidden'),
          position: c && getComputedStyle(c).position,
        };
      });
      expect(state.textStillInHost).toBe(true);
      expect(state.canvasHasContent).toBe(false);
      expect(state.ariaHidden).toBe('true');
      expect(state.position).toBe('absolute');
    });

  test('the effect canvas is present and sized to the host', async ({ page, baseURL }) => {
    await load(page, baseURL, 'inplace');
    const ok = await page.evaluate(() => {
      const c = document.querySelector('[data-nodality-raster]');
      return c && c.width > 0 && c.height > 0;
    });
    expect(ok).toBe(true);
  });
});

test.describe('ops compile and attach', () => {
  for (const ops of ['inplace', 'overlay', 'halftone', 'aberration', 'all']) {
    test(`chain "${ops}" builds without a shader error`, async ({ page, baseURL }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      await load(page, baseURL, ops);
      const attached = await page.evaluate(() =>
        !!document.querySelector('[data-nodality-raster]'));

      expect(attached).toBe(true);
      expect(await logs(page)).not.toMatch(/raster shader/);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('drivers', () => {
  for (const driver of ['Mouse', 'Hover', 'Scroll', 'Time']) {
    test(`driver ${driver.toLowerCase()} builds a working pipeline`, async ({ page, baseURL }) => {
      await load(page, baseURL, `driver${driver}`);
      const attached = await page.evaluate(() =>
        !!document.querySelector('[data-nodality-raster]'));
      expect(attached).toBe(true);
      expect(await logs(page)).not.toMatch(/unknown driver/);
    });
  }

  test('an unknown driver warns but keeps rendering', async ({ page, baseURL }) => {
    await load(page, baseURL, 'badDriver');
    const attached = await page.evaluate(() =>
      !!document.querySelector('[data-nodality-raster]'));
    expect(attached).toBe(true);
    const text = await logs(page);
    expect(text).toMatch(/unknown driver 'telepathy'/);
    // The warning should name the drivers that do exist.
    expect(text).toMatch(/mouse/);
  });

  test('the mouse driver responds to pointer movement', async ({ page, baseURL }) => {
    await load(page, baseURL, 'driverMouse');
    const box = await page.locator('[data-nodality-raster]').boundingBox();
    expect(box).not.toBeNull();
    // Drive the pointer across the element; the frame loop must survive it.
    for (let i = 0; i <= 4; i++) {
      await page.mouse.move(box.x + (box.width * i) / 4, box.y + box.height / 2);
      await page.waitForTimeout(60);
    }
    const alive = await page.evaluate(() =>
      !!document.querySelector('[data-nodality-raster]'));
    expect(alive).toBe(true);
  });
});

test.describe('HTML-in-Canvas API', () => {
  test('isHTMLInCanvasAvailable agrees with the WebGL1 prototype',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'none');
      const r = await page.evaluate(() => ({
        reported: window.__raster.isHTMLInCanvasAvailable(),
        raw: typeof WebGLRenderingContext !== 'undefined' &&
          'texElementImage2D' in WebGLRenderingContext.prototype,
      }));
      expect(r.reported).toBe(r.raw);
    });

  test('texElementImage2D accepts a known signature when the flag is on',
    async ({ page, baseURL }) => {
      await load(page, baseURL, 'none');
      if (!(await apiAvailable(page))) {
        test.skip(true, 'needs chrome://flags/#canvas-draw-element');
        return;
      }
      // The call is only valid once the browser has a paint record for
      // the nested subtree, so it has to be made from inside the
      // canvas's `paint` event - outside it, even the correct signature
      // fails with InvalidStateError. This therefore covers the paint
      // event and the signature together, which is how the pipeline
      // actually uses the API.
      const result = await page.evaluate(() => new Promise((resolve) => {
        const c = document.createElement('canvas');
        c.setAttribute('layoutsubtree', '');
        c.width = 64; c.height = 64;
        const gl = c.getContext('webgl2');
        const inner = document.createElement('div');
        inner.style.cssText = 'font:16px Helvetica;color:#fff;';
        inner.textContent = 'probe';
        c.appendChild(inner);
        document.body.appendChild(c);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        const RGBA8 = gl.RGBA8 || 0x8058;
        // Known shapes across Chromium builds. Chrome 148 takes the
        // 3-argument form; Playwright's bundled Chromium takes the
        // 6-argument one. The module discovers this at runtime, so the
        // test accepts whichever this build implements.
        const forms = [
          ['(target, level, internalformat, format, type, element)',
            [gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inner]],
          ['(target, internalformat, element)', [gl.TEXTURE_2D, RGBA8, inner]],
          ['(target, level, internalformat, element)', [gl.TEXTURE_2D, 0, RGBA8, inner]],
          ['(target, level, element)', [gl.TEXTURE_2D, 0, inner]],
        ];
        const attempt = () => {
          const errs = [];
          for (const [label, args] of forms) {
            try { gl.texElementImage2D.apply(gl, args); return { form: label, errs }; }
            catch (e) { errs.push(`${label} -> ${e.name}: ${e.message}`); }
          }
          return { form: null, errs };
        };

        let settled = false;
        let paints = 0;
        const finish = (r) => {
          if (settled) return;
          settled = true;
          c.remove();
          resolve({ ...r, paints, arity: gl.texElementImage2D.length });
        };
        c.addEventListener('paint', () => {
          paints++;
          const r = attempt();
          if (r.form) finish(r);
        });
        setTimeout(() => finish(attempt()), 4000);
      }));

      expect(result.paints, 'the canvas never emitted a paint event').toBeGreaterThan(0);
      expect(result.form, `no known signature accepted (arity ${result.arity}): ` +
        result.errs.join(' | ')).not.toBeNull();
    });

  test('live mode hosts the content inside the canvas', async ({ page, baseURL }) => {
    await load(page, baseURL, 'inplace');
    if ((await backendOf(page)) !== 'live') {
      test.skip(true, 'needs chrome://flags/#canvas-draw-element');
      return;
    }
    const state = await page.evaluate(() => {
      const c = document.querySelector('[data-nodality-raster]');
      return {
        // The host element itself stays put and the canvas is appended
        // to it; what moves inside the canvas is the host's CHILDREN,
        // wrapped in a div. So look for the content, not a nested copy
        // of the host tag.
        hostsContent: (c.textContent || '').includes('Raster'),
        wrapped: !!c.querySelector('div'),
        layoutsubtree: c.hasAttribute('layoutsubtree'),
      };
    });
    expect(state.hostsContent).toBe(true);
    expect(state.wrapped).toBe(true);
    expect(state.layoutsubtree).toBe(true);
  });
});

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
                      'halftone', 'aberration', 'stir', 'blobs',
                      'mask', 'noise', 'copy', 'echo', 'merge', 'switch']) {
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
  for (const ops of ['inplace', 'overlay', 'halftone', 'aberration', 'all',
                     'mask', 'maskAt', 'noiseField', 'copyRing', 'copyPoints',
                     'mergeMode', 'mergeWarp', 'warpFull', 'solverInMerge',
                     'switchOn', 'switchOff']) {
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

  test('live mode captures a wrapper that fills the canvas box', async ({ page, baseURL }) => {
    // Regression guard for rasterised glyphs not landing where the DOM
    // text is.
    //
    // The wrapper the pipeline moves content into had no width, so it
    // shrink-wrapped to its content -- 593px for a headline inside a
    // 900px element. texElementImage2D captures THAT box while the
    // shader maps the texture across the whole canvas, so everything
    // came out stretched horizontally by canvasWidth/contentWidth
    // (1.517x in the case that surfaced this). Zero error at the first
    // glyph and growing across the line, so selecting text highlighted
    // steadily wronger characters the further in you went.
    //
    // The shader maps uv 0..1 over the full canvas, so "capture source
    // and canvas are the same box" is precisely the condition that makes
    // the drawn pixels line up with the DOM underneath. Assert the boxes
    // rather than the pixels: it is exact and deterministic, where a
    // screenshot diff would be neither.
    await load(page, baseURL, 'inplace');
    if ((await backendOf(page)) !== 'live') {
      test.skip(true, 'needs chrome://flags/#canvas-draw-element');
      return;
    }
    const m = await page.evaluate(() => {
      const c = document.querySelector('[data-nodality-raster]');
      const wrap = c.firstElementChild;
      const cb = c.getBoundingClientRect();
      const wb = wrap.getBoundingClientRect();
      const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
      const tn = walker.nextNode();
      let text = null;
      if (tn) {
        const r = document.createRange();
        r.selectNodeContents(tn);
        const tb = r.getBoundingClientRect();
        text = { left: tb.left, right: tb.right, width: tb.width };
      }
      return {
        canvas: { left: cb.left, width: cb.width, height: cb.height },
        wrapper: { tag: wrap.tagName, width: wb.width, height: wb.height },
        backingW: c.width, backingH: c.height,
        dpr: window.devicePixelRatio,
        text,
      };
    });

    expect(m.wrapper.tag).toBe('DIV');
    // The capture source must be exactly the canvas box, not the
    // content's shrink-wrapped box.
    expect(m.wrapper.width).toBeCloseTo(m.canvas.width, 0);
    expect(m.wrapper.height).toBeCloseTo(m.canvas.height, 0);
    // Stated as the ratio too, because that ratio IS the stretch factor
    // the bug applied to every glyph position.
    expect(m.canvas.width / m.wrapper.width).toBeCloseTo(1, 2);

    // The backing store must match the CSS box scaled by dpr, or the
    // shader's uv mapping would be off even with the boxes agreeing.
    expect(m.backingW).toBe(Math.round(m.canvas.width * m.dpr));
    expect(m.backingH).toBe(Math.round(m.canvas.height * m.dpr));

    // And the text the shader draws from has to sit inside the region
    // the shader samples.
    expect(m.text).not.toBeNull();
    expect(m.text.width).toBeGreaterThan(0);
    expect(m.text.left).toBeGreaterThanOrEqual(m.canvas.left - 1);
    expect(m.text.right).toBeLessThanOrEqual(m.canvas.left + m.canvas.width + 1);
  });
});

// ── Node-to-node ops ────────────────────────────────────────────────
//
// These are the ops whose whole point is that one node reads another's
// output, so the assertions are about the RELATIONSHIP between chains:
// a masked chain must not render the same as an unmasked one, and a
// switch must actually pick a branch.

// A chain's rendered result, as raw PNG bytes. Compared for inequality
// rather than equality: a GPU is entitled to differ by a least
// significant bit, but not to render a constrained effect identically
// to an unconstrained one.
async function shot(page, baseURL, ops) {
  await load(page, baseURL, ops);
  // Let the first animation frame land before capturing.
  await page.waitForTimeout(250);
  return page.locator('#mount').screenshot();
}

test.describe('fields', () => {
  test('a masked op renders differently from the same op unmasked',
    async ({ page, baseURL }) => {
      const plain = await shot(page, baseURL, 'halftone');
      const masked = await shot(page, baseURL, 'mask');
      expect(masked.equals(plain)).toBe(false);
    });

  test('moving the mask with at: changes where the effect lands',
    async ({ page, baseURL }) => {
      const centred = await shot(page, baseURL, 'mask');
      const placed = await shot(page, baseURL, 'maskAt');
      expect(placed.equals(centred)).toBe(false);
    });

  test('a field producer draws nothing on its own', async ({ page, baseURL }) => {
    // mask/noise write a scalar field and no colour. With nothing
    // reading the field, the result must be the untouched element.
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page, baseURL, 'noiseField');
    expect(await logs(page)).not.toMatch(/raster shader/);
    expect(errors).toEqual([]);
  });
});

test.describe('copy', () => {
  test('instances change the rendered result', async ({ page, baseURL }) => {
    const none = await shot(page, baseURL, 'none');
    const copied = await shot(page, baseURL, 'copyPoints');
    expect(copied.equals(none)).toBe(false);
  });

  test('a point set and a ring are not the same arrangement',
    async ({ page, baseURL }) => {
      const points = await shot(page, baseURL, 'copyPoints');
      const ring = await shot(page, baseURL, 'copyRing');
      expect(ring.equals(points)).toBe(false);
    });
});

test.describe('merge', () => {
  test('a merge is not the same as chaining the two branches',
    async ({ page, baseURL }) => {
      // The whole claim of merge: branches see the shared input, not
      // each other. If this ever renders identically to the chained
      // form, the branch rewind has stopped working.
      const chained = await shot(page, baseURL, 'all');
      const merged = await shot(page, baseURL, 'mergeMode');
      expect(merged.equals(chained)).toBe(false);
    });

  test('a stateful solver works inside a merge branch', async ({ page, baseURL }) => {
    // stir allocates ping-pong float targets and steps them per frame.
    // Nested in a branch it must still get its uniform slot, its driver
    // and its solver — a flatten that only walked top-level nodes would
    // compile fine here and then render nothing.
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page, baseURL, 'solverInMerge');
    expect(await logs(page)).not.toMatch(/raster shader|pipeline skipped/);
    expect(errors).toEqual([]);

    // Stir it, then check the frame actually changed: a solver that was
    // never stepped renders the same pixels no matter where the pointer
    // goes.
    const box = await page.locator('#mount').boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 10, y);
    await page.waitForTimeout(200);
    const before = await page.locator('#mount').screenshot();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(box.x + 10 + i * 30, y + (i % 2 ? 6 : -6));
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(300);
    const after = await page.locator('#mount').screenshot();
    expect(after.equals(before)).toBe(false);
  });

  test('merging a warp against no warp lands between the two',
    async ({ page, baseURL }) => {
      // Strictly between: a chain cannot express this at all, because
      // in a chain the second op only ever sees the first op's
      // already-displaced coordinates.
      const half = await shot(page, baseURL, 'mergeWarp');
      const none = await shot(page, baseURL, 'halftone');
      const full = await shot(page, baseURL, 'warpFull');
      expect(half.equals(none)).toBe(false);
      expect(half.equals(full)).toBe(false);
      expect(none.equals(full)).toBe(false);
    });
});

test.describe('switch', () => {
  test('a passing test takes the use branch', async ({ page, baseURL }) => {
    await load(page, baseURL, 'none');
    const ops = await page.evaluate(() =>
      window.__raster.resolveSwitches([{
        op: 'switch', when: true,
        use: [{ op: 'hexalize' }], else: [{ op: 'halftone' }],
      }], 0).map((n) => n.op));
    expect(ops).toEqual(['hexalize']);
  });

  test('a failing test takes the else branch', async ({ page, baseURL }) => {
    await load(page, baseURL, 'none');
    const ops = await page.evaluate(() =>
      window.__raster.resolveSwitches([{
        op: 'switch', when: false,
        use: [{ op: 'hexalize' }], else: [{ op: 'halftone' }],
      }], 0).map((n) => n.op));
    expect(ops).toEqual(['halftone']);
  });

  test('switches nest and flatten in order', async ({ page, baseURL }) => {
    await load(page, baseURL, 'none');
    const ops = await page.evaluate(() =>
      window.__raster.resolveSwitches([
        { op: 'edges' },
        { op: 'switch', when: true,
          use: [{ op: 'switch', when: false,
                  use: [{ op: 'blobs' }], else: [{ op: 'halftone' }] },
                { op: 'duotone' }],
          else: [{ op: 'stir' }] },
      ], 0).map((n) => n.op));
    expect(ops).toEqual(['edges', 'halftone', 'duotone']);
  });

  test('an empty branch attaches no pipeline at all', async ({ page, baseURL }) => {
    await load(page, baseURL, 'switchEmpty');
    const attached = await page.evaluate(() =>
      !!document.querySelector('[data-nodality-raster]'));
    expect(attached).toBe(false);
  });

  test('the two branches render differently', async ({ page, baseURL }) => {
    const on = await shot(page, baseURL, 'switchOn');
    const off = await shot(page, baseURL, 'switchOff');
    expect(on.equals(off)).toBe(false);
  });
});

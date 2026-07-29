const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

/**
 * Unit tests for the raster pipeline that need something a browser
 * cannot provide: an environment with no DOM, and one with a DOM but no
 * WebGL.
 *
 * The second is the case that matters in production. `nodality/ssg`
 * prerenders under jsdom for the h7active.com build, so `document` and
 * `window` both exist there and the DOM guard never fires -- what keeps
 * the page untouched is the pipeline bailing out when it cannot get a GL
 * context. No page test can exercise that.
 *
 * These run in a child Node process rather than in the Playwright worker
 * directly. lib/*.js is ESM while package.json declares no "type", so
 * Node only accepts it via its typeless-package fallback (it reparses as
 * ESM after CJS parsing fails). Playwright's own module transform does
 * not apply that fallback and throws "Unexpected token 'export'", so the
 * import has to happen in a plain Node process.
 *
 * Anything needing a real GL context lives in raster-ops.spec.js.
 */

const ROOT = path.resolve(__dirname, '../..');
const LIB = `file://${path.join(ROOT, 'lib', 'raster-ops.js')}`;

/**
 * Run an ES module snippet in a real Node process and return whatever it
 * passes to report(). Throws with the child's stderr if it fails.
 */
function runInNode(body) {
  const src = `
    const report = (v) => console.log('__RESULT__' + JSON.stringify(v));
    const mod = await import(${JSON.stringify(LIB)});
    ${body}
  `;
  let out;
  try {
    out = execFileSync(process.execPath, ['--input-type=module', '-e', src], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
    });
  } catch (e) {
    throw new Error(`node child failed:\n${e.stderr || e.message}`);
  }
  const line = out.split('\n').find((l) => l.startsWith('__RESULT__'));
  if (!line) throw new Error(`child produced no result. stdout:\n${out}`);
  return JSON.parse(line.slice('__RESULT__'.length));
}

test.describe('registry', () => {
  test('exposes the built-in ops and drivers', () => {
    const r = runInNode(`report({ ops: mod.RASTER_OP_NAMES, drivers: mod.DRIVER_NAMES });`);
    for (const op of ['hexalize', 'offset', 'duotone', 'edges',
                      'halftone', 'dither', 'aberration', 'stir', 'blobs']) {
      expect(r.ops).toContain(op);
    }
    expect(r.drivers).toEqual(expect.arrayContaining(['mouse', 'hover', 'scroll', 'time']));
  });

  test('registerRasterOp extends the routing list', () => {
    const r = runInNode(`
      const before = mod.RASTER_OP_NAMES.length;
      mod.registerRasterOp('unitTestOp', {
        stage: 'color', decl: () => '', code: () => '', uniforms: () => ({}),
      });
      report({ before, after: mod.RASTER_OP_NAMES.length,
               has: mod.RASTER_OP_NAMES.includes('unitTestOp') });
    `);
    expect(r.has).toBe(true);
    expect(r.after).toBe(r.before + 1);
  });
});

test.describe('headless safety', () => {
  test('the module does no work at import time', () => {
    // Node has neither document nor window. If anything ran on import
    // this child would throw instead of reporting.
    const r = runInNode(`
      report({
        hasDocument: typeof document !== 'undefined',
        isFn: typeof mod.applyRasterPipeline === 'function',
        htmlInCanvas: mod.isHTMLInCanvasAvailable(),
      });
    `);
    expect(r.hasDocument).toBe(false);
    expect(r.isFn).toBe(true);
    expect(r.htmlInCanvas).toBe(false);
  });

  test('with no DOM at all, applyRasterPipeline returns null', () => {
    const r = runInNode(`
      report({
        nullEl: mod.applyRasterPipeline(null, [{ op: 'hexalize' }]),
        plainObj: mod.applyRasterPipeline({}, [{ op: 'hexalize' }]),
      });
    `);
    expect(r.nullEl).toBeNull();
    expect(r.plainObj).toBeNull();
  });

  test('under jsdom (the prerender path) it returns null without throwing', () => {
    // document and window exist, so the DOM guard does NOT fire here.
    // What has to save the prerender is the WebGL guard further down.
    const r = runInNode(`
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM('<!doctype html><div id="host">content</div>',
                            { pretendToBeVisual: true });
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      const el = dom.window.document.getElementById('host');
      let threw = null, result = 'unset';
      try { result = mod.applyRasterPipeline(el, [{ op: 'hexalize', size: 12 }]); }
      catch (e) { threw = e.message; }
      report({
        domWasPresent: typeof document !== 'undefined' && !!el,
        threw,
        result,
        canvasAdded: el.querySelectorAll('canvas').length,
      });
      dom.window.close();
    `);
    expect(r.domWasPresent).toBe(true);
    expect(r.threw).toBeNull();
    expect(r.result).toBeNull();
    // The prerendered markup must come out untouched.
    expect(r.canvasAdded).toBe(0);
  });

  test('an empty or unknown op list is tolerated', () => {
    const r = runInNode(`
      let threw = null;
      try {
        mod.applyRasterPipeline({}, []);
        mod.applyRasterPipeline({}, [{ op: 'no-such-op' }]);
      } catch (e) { threw = e.message; }
      report({ threw });
    `);
    expect(r.threw).toBeNull();
  });
});

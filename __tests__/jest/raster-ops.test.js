// __tests__/jest/raster-ops.test.js

/**
 * Unit tests for the raster operation pipeline.
 *
 * These run under jsdom, which has no WebGL and no real layout, so they
 * cover exactly the parts that must behave correctly *without* a GPU:
 * the module must be inert at import time, applyRasterPipeline must
 * return null rather than throw, and the registry / codegen must be
 * intact. Anything that needs an actual GL context is covered by the
 * Playwright spec in __tests__/e2e/raster-ops.spec.js instead.
 *
 * The prerender path (nodality/ssg, used by the h7active.com build) runs
 * under jsdom too, so "inert when headless" is a hard requirement here,
 * not a nicety.
 */

import {
  applyRasterPipeline,
  registerRasterOp,
  RASTER_OP_NAMES,
  DRIVER_NAMES,
  isHTMLInCanvasAvailable,
} from '../../lib/raster-ops.js';
import { Des } from '../../lib/designer.js';

describe('raster ops registry', () => {
  test('exposes the built-in ops', () => {
    for (const op of ['hexalize', 'offset', 'duotone', 'edges',
                      'halftone', 'aberration', 'stir', 'blobs']) {
      expect(RASTER_OP_NAMES).toContain(op);
    }
  });

  test('exposes the drivers', () => {
    for (const d of ['mouse', 'hover', 'scroll', 'time']) {
      expect(DRIVER_NAMES).toContain(d);
    }
  });

  test('registerRasterOp extends the routing list', () => {
    const before = RASTER_OP_NAMES.length;
    registerRasterOp('unitTestOp', {
      stage: 'color',
      decl: () => '',
      code: () => '',
      uniforms: () => ({}),
    });
    expect(RASTER_OP_NAMES).toContain('unitTestOp');
    expect(RASTER_OP_NAMES.length).toBe(before + 1);
  });
});

describe('headless safety', () => {
  test('importing the module touches nothing', () => {
    // If import-time work had happened, the calls above would already
    // have thrown; assert the exported surface instead.
    expect(typeof applyRasterPipeline).toBe('function');
    expect(Array.isArray(RASTER_OP_NAMES)).toBe(true);
  });

  test('isHTMLInCanvasAvailable() is false under jsdom', () => {
    expect(isHTMLInCanvasAvailable()).toBe(false);
  });

  test('applyRasterPipeline returns null instead of throwing', () => {
    document.body.innerHTML = '<div id="host">content</div>';
    const el = document.getElementById('host');
    expect(() => applyRasterPipeline(el, [{ op: 'hexalize', size: 12 }])).not.toThrow();
    expect(applyRasterPipeline(el, [{ op: 'hexalize', size: 12 }])).toBeNull();
  });

  test('applyRasterPipeline tolerates a missing element', () => {
    expect(() => applyRasterPipeline(null, [{ op: 'hexalize' }])).not.toThrow();
    expect(applyRasterPipeline(null, [{ op: 'hexalize' }])).toBeNull();
  });

  test('applyRasterPipeline tolerates an empty / unknown op list', () => {
    document.body.innerHTML = '<div id="host">content</div>';
    const el = document.getElementById('host');
    expect(() => applyRasterPipeline(el, [])).not.toThrow();
    expect(() => applyRasterPipeline(el, [{ op: 'no-such-op' }])).not.toThrow();
  });
});

describe('codegen', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="mount"></div>';
    // The responsive-op path reads window.visualViewport, which jsdom
    // does not implement. Same shim as filter.test.js.
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { width: 1024, height: 768 },
    });
  });

  test('a raster node does not disturb ordinary rendering', () => {
    new Des()
      .nodes([{ op: 'hexalize', size: 14 }])
      .add([{ type: 'h1', text: 'Hello' }])
      .set({ mount: '#mount', code: false });

    const h1 = document.querySelector('#mount h1');
    expect(h1).not.toBeNull();
    expect(h1.textContent).toBe('Hello');
  });

  test('adding a raster node leaves CSS-level output byte-identical', () => {
    // The guarantee that matters: routing raster ops through codegen
    // must not perturb what the CSS-level ops emit. Whatever blast
    // renders here, it has to render exactly the same with a raster
    // node sitting next to it in the chain.
    const render = (nodes) => {
      document.body.innerHTML = '<div id="mount"></div>';
      new Des()
        .nodes(nodes)
        .add([{ type: 'h1', text: 'Hello' }])
        .set({ mount: '#mount', code: false });
      return document.querySelector('#mount').innerHTML;
    };

    const blast = { op: 'blast', color: 'green', width: '1px' };
    const withoutRaster = render([blast]);
    const withRaster = render([blast, { op: 'hexalize', size: 14 }]);

    expect(withoutRaster).not.toBe('');
    expect(withRaster).toBe(withoutRaster);
  });

  test('the raster property never leaks into the DOM', () => {
    new Des()
      .nodes([{ op: 'hexalize', size: 14 }, { op: 'aberration', amount: 5 }])
      .add([{ type: 'h1', text: 'Hello' }])
      .set({ mount: '#mount', code: false });

    const html = document.querySelector('#mount').innerHTML;
    expect(html).not.toMatch(/raster/i);
    expect(html).not.toMatch(/hexalize|aberration/i);
  });

  test('a raster node targeted elsewhere leaves this element alone', () => {
    new Des()
      .nodes([{ op: 'hexalize', size: 14, target: ['#other'] }])
      .add([{ type: 'h1', id: '#hero', text: 'Hello' }])
      .set({ mount: '#mount', code: false });

    const h1 = document.querySelector('#mount h1');
    expect(h1).not.toBeNull();
    expect(h1.textContent).toBe('Hello');
  });

  test('every driver survives codegen', () => {
    for (const by of DRIVER_NAMES) {
      document.body.innerHTML = '<div id="mount"></div>';
      expect(() => {
        new Des()
          .nodes([{ op: 'offset', by, strength: 8 }])
          .add([{ type: 'h1', text: 'Hello' }])
          .set({ mount: '#mount', code: false });
      }).not.toThrow();
      expect(document.querySelector('#mount h1').textContent).toBe('Hello');
    }
  });
});

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Regression tests for the Designer/Animator contract bugs found in the
 * 2026-08 audit. Every case here corresponds to a defect that shipped
 * undetected because nothing asserted the behaviour.
 *
 * These run in the browser rather than in a child Node process (the way
 * raster-ops-unit.spec.js does) because designer.js pulls in the whole
 * component fleet, and some of those modules assign to `window` at module
 * scope — importing it headless throws "window is not defined".
 */

const ROOT = path.resolve(__dirname, '../..');
const PAGE = '/public/designerContract.html';

async function load(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
}

test.describe('Des.nodes() purity', () => {
  // The array used to be stored by reference and then rewritten in place:
  // entries replaced with library objects, item.gradient written in, and any
  // key valued "default" deleted recursively. A nodes array was single-use.
  test('does not mutate the caller array', async ({ page, baseURL }) => {
    await load(page, baseURL);
    const r = await page.evaluate(() => {
      const nodes = [
        { op: 'blast', color: 'red', target: ['#a'], style: 'default' },
        { op: 'gradient', direction: 'radial', target: ['#b'] },
      ];
      const before = JSON.stringify(nodes);
      const d = new window.Des().nodes(nodes);
      d.options[0].op = { name: 'mutated' };
      d.options[1].gradient = 'linear-gradient(red, blue)';
      return { before, after: JSON.stringify(nodes) };
    });
    expect(r.after).toBe(r.before);
  });

  test('at() keeps options and protoOptions in lockstep', async ({ page, baseURL }) => {
    // add() indexes protoOptions[q] for every options[q]; at() used to push
    // to only one of them, so the first .at() without .nodes() threw.
    await load(page, baseURL);
    const r = await page.evaluate(() => {
      const a = new window.Des().nodes([{ op: 'blast' }]).at({ op: 'shadow' });
      const b = new window.Des().at({ op: 'shadow' });
      return {
        aOpts: a.options.length, aProto: a.protoOptions.length,
        bOpts: b.options.length, bProto: b.protoOptions.length,
      };
    });
    expect(r.aOpts).toBe(r.aProto);
    expect(r.bOpts).toBe(r.bProto);
    expect(r.bOpts).toBe(1);
  });
});

test.describe('op replacement', () => {
  // Every node of a given op kind used to receive the SAME replacement
  // object, so two blast nodes with different targets collapsed into one and
  // the last write won for both.
  test('two same-kind ops keep their own targets', async ({ page, baseURL }) => {
    await load(page, baseURL);
    const r = await page.evaluate(() => {
      const d = new window.Des().nodes([
        { op: 'blast', color: 'red', width: '1px', target: ['#a'] },
        { op: 'blast', color: 'blue', width: '9px', target: ['#b'] },
      ]);
      d.add([
        { type: 'h1', id: '#a', text: 'A' },
        { type: 'h1', id: '#b', text: 'B' },
      ]);
      const o = d.options;
      return {
        distinctObjects: o[0] !== o[1],
        targets: [o[0].target, o[1].target],
        colors: [o[0].op && o[0].op.color, o[1].op && o[1].op.color],
      };
    });
    expect(r.distinctObjects).toBe(true);
    expect(r.targets[0]).toEqual(['#a']);
    expect(r.targets[1]).toEqual(['#b']);
    expect(r.colors[0]).not.toBe(r.colors[1]);
  });
});

test.describe('mount option', () => {
  // .render("#mount") was a hard-coded literal, so set({mount}) was ignored
  // and a second Des rendered into the first one's mount.
  test('set({mount}) is honoured in the generated code', async ({ page, baseURL }) => {
    await load(page, baseURL);
    const code = await page.evaluate(() => {
      const d = new window.Des()
        .nodes([{ op: 'blast' }])
        .add([{ type: 'h1', id: '#z', text: 'Z' }]);
      d.set({ mount: '#mount2', code: false });
      return d.code.join('\n');
    });
    expect(code).toContain('#mount2');
  });
});

test.describe('size mapping', () => {
  // "p".substr(1) is "", producing the size string "S". fluidCopy only
  // branches on S1..S6, so paragraphs silently received no fluid sizing.
  test('p maps to a size fluidCopy understands', async ({ page, baseURL }) => {
    await load(page, baseURL);
    const r = await page.evaluate(() => {
      const d = new window.Des();
      return { p: d.getElType('p'), h1: d.getElType('h1'), h6: d.getElType('h6') };
    });
    expect(r.h1).toBe('S1');
    expect(r.h6).toBe('S6');
    expect(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']).toContain(r.p);
  });
});

// ── Static source checks ────────────────────────────────────────────────
// These need no browser; they guard properties of the shipped source.

/** Modules actually reachable from the package entry, by walking imports. */
function liveModules() {
  const seen = new Set();
  const queue = ['lib/designer.js'];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    seen.add(rel);
    const src = fs.readFileSync(abs, 'utf8');
    for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      queue.push(path.normalize(path.join(path.dirname(rel), spec)));
    }
  }
  return [...seen];
}

test.describe('shipped source invariants', () => {
  test('the generated example code imports files that exist', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib', 'designer.js'), 'utf8');
    const imports = [...src.matchAll(/from "\.\.\/layout\/([A-Za-z0-9._-]+\.js)"/g)]
      .map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    const missing = [...new Set(imports)]
      .filter((f) => !fs.existsSync(path.join(ROOT, 'layout', f)));
    expect(missing).toEqual([]);
  });

  test('no live module calls alert()', () => {
    // alert() blocks the visitor's page. Several sat in ordinary paths:
    // Button.large() fired for every phone-width visitor, FlexRow.toColumn()
    // on every documented colat collapse, FlexRow columnAlways on every use,
    // and Text.apply() on every non-matching breakpoint.
    const offenders = [];
    for (const rel of liveModules()) {
      const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      const stripped = text
        .replace(/\/\*[\s\S]*?\*\//g, '')          // block comments
        .replace(/(^|[^:])\/\/.*$/gm, '$1');       // line comments, keeping URLs
      if (/(^|[^.\w])alert\s*\(/.test(stripped)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

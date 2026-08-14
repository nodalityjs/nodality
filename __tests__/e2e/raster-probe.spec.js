// raster-probe.spec.js — phase I1 of INTERACTION-IMPL-SPEC.
//
// The overlay canvas is pointer-events:none and the DOM underneath stays
// where layout put it. So once a warp displaces content, a link is
// clickable where it is NOT drawn. Fixing that (phase I3) needs one fact
// first: given a screen point, which source pixel is shown there?
//
// The shader already computes it — output pixel -> sampleP -> fetch — so
// rather than reimplement each op's arithmetic on the CPU, `sourceAt`
// runs the SAME chain with a different last line and reads the answer
// back from a 1x1 framebuffer.
//
// Two bugs this suite caught, both of which a determinism-only test
// reported as passing:
//
//   1. An earlier design offset the VIEWPORT to select the queried pixel.
//      It rasterised nothing, and readback returned a confident (0, 0).
//      The probe now takes the coordinate as a uniform instead.
//   2. Static op uniforms were uploaded once to the main program only, so
//      the probe program saw `size` as 0 — a divide by zero, then NaN,
//      then a clamped 0. Which is why the analytic test below exists:
//      self-consistency is not correctness.

const { test, expect } = require('@playwright/test');
const PAGE = '/public/rasterOps.html';

async function load(page, baseURL, ops) {
  await page.goto(`${baseURL}${PAGE}#ops=${ops}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(350);
}

test('sourceAt returns a coordinate and identity holds with no warp', async ({ page, baseURL }) => {
  await load(page, baseURL, 'halftone');   // colour-only: sampleP === frag
  const r = await page.evaluate(async () => {
    const { activeRasterPipelines } = await import('/lib/raster-ops.js');
    const p = activeRasterPipelines()[0];
    const box = p.canvas.getBoundingClientRect();
    const pts = [[0.25, 0.4], [0.5, 0.5], [0.75, 0.6]].map(([fx, fy]) => ({
      cx: box.left + box.width * fx, cy: box.top + box.height * fy,
    }));
    return pts.map(({ cx, cy }) => {
      const s = p.sourceAt(cx, cy);
      return s ? { dx: s.x - cx, dy: s.y - cy } : null;
    });
  });
  for (const d of r) {
    expect(d, 'sourceAt returned null').not.toBeNull();
    // No warp in the chain, so the source is the point itself.
    expect(Math.abs(d.dx)).toBeLessThan(1.5);
    expect(Math.abs(d.dy)).toBeLessThan(1.5);
  }
});

test('a warp actually displaces the source coordinate', async ({ page, baseURL }) => {
  await load(page, baseURL, 'custom');   // pixelate: quantises coordinates
  const r = await page.evaluate(async () => {
    const { activeRasterPipelines } = await import('/lib/raster-ops.js');
    const p = activeRasterPipelines()[0];
    const box = p.canvas.getBoundingClientRect();
    const out = [];
    for (let i = 0; i < 12; i++) {
      const cx = box.left + box.width * (0.2 + i * 0.05);
      const cy = box.top + box.height * 0.5;
      const s = p.sourceAt(cx, cy);
      out.push(s ? { cx, cy, sx: s.x, sy: s.y } : null);
    }
    return out;
  });
  const moved = r.filter(Boolean).filter((d) => Math.abs(d.sx - d.cx) > 1);
  expect(moved.length, 'pixelate quantises x, so most probes should differ').toBeGreaterThan(4);
});

test('probe matches an ANALYTIC ground truth (the DoD)', async ({ page, baseURL }) => {
  // Determinism is not correctness: a wrong viewport offset would be
  // consistently wrong. `pixelate` with no driver has a closed form
  //     sampleP = (floor(frag / size) + 0.5) * size
  // computed here in JS, independently of the shader — so this checks the
  // offset trick, the byte packing and both coordinate conversions at once.
  await load(page, baseURL, 'custom');   // { op: 'pixelate', size: 16 }
  const r = await page.evaluate(async () => {
    const { activeRasterPipelines } = await import('/lib/raster-ops.js');
    const p = activeRasterPipelines()[0];
    const box = p.canvas.getBoundingClientRect();
    const sx = p.canvas.width / box.width;
    const sy = p.canvas.height / box.height;
    const S = 16 * sx;                       // uniforms(): size * dpr
    let worst = 0;
    const rows = [];
    for (let iy = 1; iy < 4; iy++) {
      for (let ix = 1; ix < 8; ix++) {
        const cx = box.left + (box.width * ix) / 8;
        const cy = box.top + (box.height * iy) / 4;
        const got = p.sourceAt(cx, cy);
        if (!got) return { err: 'null result' };
        // Independent expectation, in device px, top-down.
        const dx = (cx - box.left) * sx;
        const dy = (cy - box.top) * sy;
        const ex = box.left + ((Math.floor(dx / S) + 0.5) * S) / sx;
        const ey = box.top + ((Math.floor(dy / S) + 0.5) * S) / sy;
        const e = Math.max(Math.abs(got.x - ex), Math.abs(got.y - ey));
        if (e > worst) { worst = e; }
        rows.push({ cx: +cx.toFixed(1), got: +got.x.toFixed(1), want: +ex.toFixed(1) });
      }
    }
    return { worst, rows: rows.slice(0, 3) };
  });
  expect(r.err).toBeUndefined();
  console.log('  sample:', JSON.stringify(r.rows));
  // 16-bit packing over the element gives sub-0.1px; 1px is the DoD.
  expect(r.worst).toBeLessThan(1);
});

test('repeated probes of an unchanged frame agree exactly', async ({ page, baseURL }) => {
  await load(page, baseURL, 'driverMouse');
  const worst = await page.evaluate(async () => {
    const { activeRasterPipelines } = await import('/lib/raster-ops.js');
    const p = activeRasterPipelines()[0];
    const b = p.canvas.getBoundingClientRect();
    const cx = b.left + b.width * 0.5, cy = b.top + b.height * 0.5;
    const a = p.sourceAt(cx, cy), c = p.sourceAt(cx, cy);
    return Math.max(Math.abs(a.x - c.x), Math.abs(a.y - c.y));
  });
  expect(worst).toBeLessThan(0.001);
});

test('the probe does not disturb the visible render', async ({ page, baseURL }) => {
  await load(page, baseURL, 'inplace');
  const before = await page.locator('#mount').screenshot();
  await page.evaluate(async () => {
    const { activeRasterPipelines } = await import('/lib/raster-ops.js');
    const p = activeRasterPipelines()[0];
    const b = p.canvas.getBoundingClientRect();
    for (let i = 0; i < 30; i++) p.sourceAt(b.left + b.width * 0.5, b.top + b.height * 0.5);
  });
  await page.waitForTimeout(250);
  const after = await page.locator('#mount').screenshot();
  expect(after.equals(before)).toBe(true);
});

test('every op in the registry answers sourceAt, in bounds', async ({ page, baseURL }) => {
  // The DoD's coverage half. Each op gets its own pipeline on its own
  // element, and must resolve a source coordinate that lands inside the
  // element — including the stateful ones (`stir`, `echo`) that have no
  // closed form and are exactly why this is a GPU readback.
  await load(page, baseURL, 'none');
  const r = await page.evaluate(async () => {
    const { REGISTRY, applyRasterPipeline } = await import('/lib/raster-ops.js');
    const out = [];
    for (const op of Object.keys(REGISTRY)) {
      const host = document.createElement('div');
      host.style.cssText = 'width:240px;height:120px;background:#123f6d;color:#fff';
      host.textContent = 'Probe ' + op;
      document.body.appendChild(host);
      let h = null;
      try {
        // `merge` needs branches; every other op is valid bare.
        const node = op === 'merge'
          ? { op: 'merge', a: [{ op: 'hexalize', size: 14 }], b: [] }
          : { op };
        h = applyRasterPipeline(host, [node]);
        if (!h) { out.push({ op, skip: 'no pipeline' }); continue; }
        await new Promise((res) => setTimeout(res, 260));
        const b = h.canvas.getBoundingClientRect();
        const s = h.sourceAt(b.left + b.width * 0.5, b.top + b.height * 0.5);
        out.push({
          op,
          ok: !!s,
          inBounds: !!s && s.x >= b.left - 1 && s.x <= b.right + 1
                         && s.y >= b.top - 1 && s.y <= b.bottom + 1,
        });
      } catch (e) {
        out.push({ op, err: String(e.message).slice(0, 60) });
      } finally {
        if (h) h.destroy();
        host.remove();
      }
    }
    return out;
  });
  const bad = r.filter((x) => x.err || (!x.skip && (!x.ok || !x.inBounds)));
  expect(bad, `ops failing sourceAt: ${JSON.stringify(bad)}`).toEqual([]);
  expect(r.filter((x) => x.ok).length).toBeGreaterThan(12);
});

// ── phase I2: the declared CPU twin ─────────────────────────────────
//
// A GPU readback is a pipeline sync — fine per click, too slow per
// pointermove. An op may declare `map`, the same coordinate arithmetic
// its GLSL does, in JS. The duplication is only safe because I1 is here
// to check it, which is what these two tests do.

test('I2: the CPU twin agrees with the GPU oracle over the parameter space',
  async ({ page, baseURL }) => {
    // The DoD. `offset` and `pixelate` both declare `map`; both are
    // driven, so the comparison covers the driver focus and falloff too.
    await load(page, baseURL, 'driverMouse');
    const r = await page.evaluate(async () => {
      const { activeRasterPipelines } = await import('/lib/raster-ops.js');
      const p = activeRasterPipelines()[0];
      const b = p.canvas.getBoundingClientRect();
      let worst = 0, n = 0, cpuNull = 0;
      // Deterministic sweep rather than Math.random, so a failure is
      // reproducible: 15 x 7 points x 2 parameter settings = 210 pairs.
      for (const strength of [10, 34]) {
        p.setParam(0, 'strength', strength);
        await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
        for (let ix = 0; ix < 15; ix++) {
          for (let iy = 0; iy < 7; iy++) {
            const cx = b.left + (b.width * (ix + 0.5)) / 15;
            const cy = b.top + (b.height * (iy + 0.5)) / 7;
            const cpu = p.sourceAt(cx, cy);
            const gpu = p.sourceAt(cx, cy, { gpu: true });
            if (!gpu) continue;
            if (!cpu) { cpuNull++; continue; }
            worst = Math.max(worst, Math.abs(cpu.x - gpu.x), Math.abs(cpu.y - gpu.y));
            n++;
          }
        }
      }
      return { worst, n, cpuNull };
    });
    expect(r.n, 'no pairs compared — the CPU path never engaged').toBeGreaterThan(150);
    expect(r.cpuNull, 'offset declares map, so it must not fall back').toBe(0);
    expect(r.worst).toBeLessThan(1);
  });

test('I2: ops with no twin fall back rather than guessing', async ({ page, baseURL }) => {
  // `flow` is curl noise and `stir` is a fluid simulation; neither
  // declares `map`. The CPU path must decline, and the GPU path must
  // still answer — a wrong-but-fast answer would be the worst outcome.
  await load(page, baseURL, 'none');
  const r = await page.evaluate(async () => {
    const { applyRasterPipeline } = await import('/lib/raster-ops.js');
    const out = [];
    for (const op of ['flow', 'stir', 'offset']) {
      const host = document.createElement('div');
      host.style.cssText = 'width:200px;height:100px;background:#123f6d;color:#fff';
      host.textContent = op;
      document.body.appendChild(host);
      const h = applyRasterPipeline(host, [{ op }]);
      await new Promise((r2) => setTimeout(r2, 260));
      const b = h.canvas.getBoundingClientRect();
      const cx = b.left + b.width * 0.5, cy = b.top + b.height * 0.5;
      const auto = h.sourceAt(cx, cy);
      const gpu = h.sourceAt(cx, cy, { gpu: true });
      // With no twin, the automatic path IS the gpu path, so they match
      // exactly; with a twin they agree to within packing precision.
      out.push({ op, ok: !!auto && !!gpu,
        identical: !!auto && !!gpu && auto.x === gpu.x && auto.y === gpu.y });
      h.destroy(); host.remove();
    }
    return out;
  });
  const byOp = Object.fromEntries(r.map((x) => [x.op, x]));
  expect(byOp.flow.ok).toBe(true);
  expect(byOp.stir.ok).toBe(true);
  // No twin -> the readback answer, byte for byte.
  expect(byOp.flow.identical).toBe(true);
  expect(byOp.stir.identical).toBe(true);
  // offset HAS a twin, so its automatic answer comes from the CPU and
  // will differ from the readback in the last fraction of a pixel.
  expect(byOp.offset.ok).toBe(true);
});

test('a live setParam reaches the probe program too', async ({ page, baseURL }) => {
  // Found by the property test above, as a 24px CPU/GPU disagreement that
  // was exactly the strength delta. setParam uploaded the new uniform to
  // the visible program only, so the probe kept answering with the values
  // it was BUILT with. The inspector calls setParam on every drag, so
  // hit-testing would drift from the picture the moment anyone tuned an
  // effect — and drift silently, since both paths still returned
  // plausible coordinates.
  await load(page, baseURL, 'driverMouse');
  const r = await page.evaluate(async () => {
    const { activeRasterPipelines } = await import('/lib/raster-ops.js');
    const p = activeRasterPipelines()[0];
    const b = p.canvas.getBoundingClientRect();
    // Near the driver focus, where the radial falloff is ~1 so the full
    // strength applies. At 0.8 of the width the falloff leaves under a
    // fifth of it, and the difference would be a handful of pixels.
    const at = () => p.sourceAt(b.left + b.width * 0.55, b.top + b.height * 0.5, { gpu: true });
    p.setParam(0, 'strength', 5);
    await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
    const weak = at();
    p.setParam(0, 'strength', 60);
    await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
    const strong = at();
    return { weak: weak && weak.x, strong: strong && strong.x };
  });
  // A twelvefold strength change must move the probed source materially.
  expect(Math.abs(r.strong - r.weak)).toBeGreaterThan(15);
});

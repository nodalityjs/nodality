// per-side-effects.spec.js — `side: "old" | "new"` on a transition node.
//
// Every other op in a transition chain decorates the CROSSFADE: it runs
// after old and new are already mixed, so both ends get the same
// treatment. That cannot say "the outgoing state burns out while the
// incoming one develops" — the thing a designer actually reaches for, and
// the thing neither the View Transitions API (CSS animations on
// pseudo-elements) nor a shader component library (no DOM to attach to)
// can express.
//
// A sided op runs on its own side's colour BEFORE nodBlend sees it.
//
// Asserted on PIXELS rather than on the generated shader source: the
// point is not that the string contains the op, it is that the two halves
// of the morph end up looking different.

const { test, expect } = require('@playwright/test');

// Any page will do — the harness builds its own pipelines. transition.html
// is already served and already imports nothing that interferes.
const PAGE = '/public/transition.html';

/**
 * Build a pipeline with `chain`, hold it at `t`, and return a SCREENSHOT
 * of the result.
 *
 * Not readPixels. The pipeline's context has no preserveDrawingBuffer, so
 * a read after compositing returns whatever the browser feels like —
 * sometimes the frame, sometimes zeros, sometimes the previous t. Three
 * successive attempts to stabilise that were flaky at ~1-in-5, which is
 * worse than useless in a release gate. A screenshot captures the
 * composited frame, deterministically, and is what the rest of this
 * suite already uses.
 */
async function shot(page, chain, t = 0.25) {
  await page.evaluate(async ({ chain, t }) => {
    document.querySelector("#probe")?.remove();
    const { applyRasterPipeline, activeRasterPipelines } =
      await import("../lib/raster-ops.js");
    for (const p of activeRasterPipelines()) p.destroy();

    const mk = (c) => new Promise((r) => {
      const i = new Image();
      i.onload = () => r(i);
      i.src = "data:image/svg+xml," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120">` +
        `<rect width="200" height="120" fill="${c}"/></svg>`);
    });
    // Two visibly different sides, so an op scoped to one is detectable.
    const oldImage = await mk("#e03030");
    const newImage = await mk("#3060e0");

    const host = document.createElement("div");
    host.id = "probe";
    host.style.cssText = "position:fixed;left:0;top:0;width:200px;" +
      "height:120px;z-index:99999;background:#000";
    document.body.appendChild(host);

    const p = applyRasterPipeline(host, chain, {
      transition: {
        oldImage, newImage,
        oldRect: { x: 0, y: 0, w: 200, h: 120 },
        newRect: { x: 0, y: 0, w: 200, h: 120 },
      },
    });
    window.__probePipe = p;
    if (!p) return;
    // Let the capture upload, then pin t and let it draw.
    await new Promise((r) => setTimeout(r, 600));
    p.setProgress(t);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, { chain, t });

  const attached = await page.evaluate(() => !!window.__probePipe);
  expect(attached, "no pipeline attached — WebGL unavailable?").toBe(true);
  return page.locator("#probe").screenshot();
}

// A hard, unmistakable recolour: whatever it touches goes green/black.
const DUO = { op: 'duotone', amount: 1, dark: '#000000', light: '#00ff00' };

test('side:"old" and side:"new" affect DIFFERENT halves of the morph',
  async ({ page, baseURL }) => {
    await page.goto(`${baseURL}${PAGE}#ops=plain`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });

    const plain = await shot(page, []);
    const onOld = await shot(page, [{ ...DUO, side: 'old' }]);
    const onNew = await shot(page, [{ ...DUO, side: 'new' }]);

    // Each side-scoped op must change the frame...
    expect(onOld.equals(plain), 'side:"old" changed nothing').toBe(false);
    expect(onNew.equals(plain), 'side:"new" changed nothing').toBe(false);
    // ...and scoping it to the OTHER side must give a different result.
    // If `side` were ignored, these two would be identical.
    expect(onOld.equals(onNew),
      'side:"old" and side:"new" rendered identically — side is ignored')
      .toBe(false);
  });

test('a sided op differs from the same op applied to the blend',
  async ({ page, baseURL }) => {
    await page.goto(`${baseURL}${PAGE}#ops=plain`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });

    const unsided = await shot(page, [DUO]);
    const onOld = await shot(page, [{ ...DUO, side: 'old' }]);

    // Unsided recolours everything; sided recolours one half and leaves
    // the other to blend in untouched. At t=0.25 the mix is visible, so
    // the two cannot coincide.
    expect(onOld.equals(unsided),
      'a sided op rendered the same as an unsided one').toBe(false);
  });

test('side is REFUSED on a warp op, loudly, rather than silently ignored',
  async ({ page, baseURL }) => {
    // Both sides share one sampling coordinate, so a sided warp has no
    // meaning. Rejecting it in silence would leave the author believing
    // the morph was art-directed when it was not.
    await page.goto(`${baseURL}${PAGE}#ops=plain`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });

    const warned = await page.evaluate(async () => {
      const msgs = [];
      const orig = console.warn;
      console.warn = (...a) => { msgs.push(a.join(' ')); orig(...a); };
      const { applyRasterPipeline } = await import('../lib/raster-ops.js');
      const host = document.createElement('div');
      host.style.cssText =
        'position:absolute;left:-9999px;top:0;width:200px;height:120px';
      document.body.appendChild(host);
      const img = new Image();
      await new Promise((r) => { img.onload = r;
        img.src = 'data:image/svg+xml,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120">' +
          '<rect width="200" height="120" fill="#888"/></svg>'); });
      const p = applyRasterPipeline(host, [{ op: 'flow', side: 'old', strength: 20 }], {
        transition: { oldImage: img, newImage: img,
          oldRect: { x: 0, y: 0, w: 200, h: 120 },
          newRect: { x: 0, y: 0, w: 200, h: 120 } },
      });
      await new Promise((r) => setTimeout(r, 300));
      if (p) p.destroy();
      host.remove();
      console.warn = orig;
      return msgs;
    });

    expect(warned.some((m) => /side/i.test(m) && /flow/.test(m)),
      `expected a warning naming the op and the side, got: ${JSON.stringify(warned)}`)
      .toBe(true);
  });

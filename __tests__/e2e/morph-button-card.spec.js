// morph-button-card.spec.js — a BUTTON morphing into a card with an image.
//
// Two things this covers that the navbar fixture cannot:
//
//   1. The source is a plain control, not a set of links. `wire` used to
//      look only for <a>, so a button-triggered morph wired nothing at
//      all and the page just sat there.
//   2. The destination contains a real {type:"img"}. The morph freezes
//      each side through an SVG foreignObject loaded from a data: URL,
//      which cannot fetch subresources — an external src renders on the
//      page and comes out BLANK in the still, so the card would lose its
//      image for the whole transition and gain it back at t=1.
//
// And one regression guard: making buttons eligible triggers must NOT
// make a navbar's hamburger one. That control discloses a menu; wiring it
// to navigate is the exact usability bug this suite already fixed once.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/morph-button-card';
const NAV_PAGE = '/public/two-arrays';

async function load(page, baseURL, path = PAGE) {
  await page.goto(`${baseURL}${path}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForFunction(
    () => !!document.querySelector('.nod-morph-live'), null, { timeout: 15000 });
}

/** Progress of the CURRENT pipeline — goTo() replaces it, so take the last. */
const progress = (page) => page.evaluate(async () => {
  const { activeRasterPipelines } = await import('../lib/raster-ops.js');
  const host = document.querySelector('.nod-morph-host');
  const mine = [...activeRasterPipelines()].filter((x) => host.contains(x.canvas));
  const p = mine[mine.length - 1];
  return p ? p.progress : null;
});

const clickSource = (page) => page.evaluate(() => {
  const live = document.querySelector('.nod-morph-live');
  const b = live.querySelector('button') || live.firstElementChild;
  if (!b) return false;
  b.click();
  return true;
});

test('a BUTTON source is a morph trigger, and starts hidden-destination',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    const state = await page.evaluate(() => {
      const live = document.querySelector('.nod-morph-live');
      const b = live.querySelector('button') || live.firstElementChild;
      return {
        tag: b && b.tagName,
        label: b && b.textContent.trim(),
        wiredTo: b && b.dataset.nodMorphTo,
        hostEmpty: document.querySelector('.nod-morph-host').children.length === 0,
        destinationDetached: !document.getElementById('shot'),
      };
    });
    expect(state.tag).toBe('BUTTON');
    expect(state.label).toBe('View project');
    // A single destination needs no label map or index — any trigger goes there.
    expect(state.wiredTo).toBe('shot');
    expect(state.hostEmpty).toBe(true);
    expect(state.destinationDetached).toBe(true);
  });

test('it morphs into the card, and the IMAGE is really there',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect(await clickSource(page)).toBe(true);
    await expect.poll(() => progress(page), { timeout: 20000 }).toBe(1);

    const card = await page.evaluate(() => {
      const d = document.querySelector('.nod-morph-host > div');
      const img = d && d.querySelector('img');
      return {
        heading: d && d.querySelector('h1,h2,h3,h4,h5,h6').textContent.trim(),
        hasImg: !!img,
        // complete + naturalWidth is the only reliable "it decoded"
        // signal; a broken src is `complete` too, with naturalWidth 0.
        decoded: !!(img && img.complete && img.naturalWidth > 0),
        // Inlined on purpose — see the header. If this ever becomes an
        // http(s) src, the still goes blank and nothing else here fails.
        inlined: !!(img && img.src.startsWith('data:')),
        renderedWidth: img ? Math.round(img.getBoundingClientRect().width) : 0,
        hasBack: !!(d && d.querySelector('button')),
      };
    });
    expect(card.heading).toBe('Harbour, 2026');
    expect(card.hasImg).toBe(true);
    expect(card.decoded, 'the card image did not decode').toBe(true);
    expect(card.inlined, 'an external src cannot appear in the capture').toBe(true);
    expect(card.renderedWidth).toBeGreaterThan(50);
    expect(card.hasBack).toBe(true);
  });

test('the shader presents the middle — the destination is never shown early',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    await clickSource(page);
    const observed = await page.evaluate(async () => {
      const host = document.querySelector('.nod-morph-host');
      const { activeRasterPipelines } = await import('../lib/raster-ops.js');
      const prog = () => {
        const m = [...activeRasterPipelines()].filter((x) => host.contains(x.canvas));
        const p = m[m.length - 1];
        return p ? p.progress : null;
      };
      for (let i = 0; i < 200 && !host.querySelector('canvas'); i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      let mid = 0;
      let leaked = 0;
      for (let i = 0; i < 120; i++) {
        const t = prog();
        const d = host.querySelector('div');
        const cv = host.querySelector('canvas');
        if (t != null && t > 0.1 && t < 0.9) {
          mid++;
          const destPainted = d && getComputedStyle(d).visibility === 'visible';
          const canvasDown = !cv || (cv.style.visibility || 'visible') !== 'visible';
          if (destPainted || canvasDown) leaked++;
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      return { mid, leaked };
    });
    expect(observed.mid, 'never caught a mid-morph frame').toBeGreaterThan(0);
    expect(observed.leaked,
      'frames where the destination painted or the canvas stood down mid-morph')
      .toBe(0);
  });

test('back returns to the button', async ({ page, baseURL }) => {
  await load(page, baseURL);
  await clickSource(page);
  await expect.poll(() => progress(page), { timeout: 20000 }).toBe(1);

  const clickedBack = await page.evaluate(() => {
    const b = document.querySelector('.nod-morph-host button');
    if (!b) return false;
    b.click();
    return true;
  });
  expect(clickedBack, 'no back control in the card').toBe(true);
  // No progress assertion here: a landed reversal DESTROYS its pipeline,
  // handing the DOM back so the source is painted again — on the live
  // backend that handover is the only thing that makes it visible at
  // all. `progress` therefore reads null on arrival, and the assertion
  // that matters is the one below: the source is presenting.
  //
  // Polled: who presents is applied by the morph's rAF loop, a frame
  // after the landing.
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('.nod-morph-live').style.display !== 'none'),
    { timeout: 5000 }).toBe(true);
});

test("REGRESSION: a navbar's hamburger is still NOT a morph trigger",
  async ({ page, baseURL }) => {
    // Buttons became eligible triggers so a plain CTA could start a
    // morph. Anchors keep priority precisely so this stays true: the
    // hamburger DISCLOSES the menu, and a control that reveals options
    // must not also move you somewhere.
    await load(page, baseURL, NAV_PAGE);
    const wired = await page.evaluate(() => {
      const live = document.querySelector('.nod-morph-live');
      return [...live.querySelectorAll('button, [class*=toggle]')]
        .map((b) => b.dataset.nodMorphTo || null);
    });
    expect(wired.length, 'no toggle found to check').toBeGreaterThan(0);
    expect(wired.every((w) => w === null),
      `a nav control was wired as a morph trigger: ${JSON.stringify(wired)}`)
      .toBe(true);
  });

test('EXACTLY ONE thing presents on every frame — no flash at either end',
  async ({ page, baseURL }) => {
    // The endpoint flash. Who presents was computed from `t` in this
    // module's rAF loop, in parallel with the pipeline deciding the same
    // thing in ITS loop. Whichever ran first won, so a frame could land
    // with the canvas already down and the DOM not yet revealed — nothing
    // on screen — or, after a naive fix, with the source AND the
    // destination both up at t=1.
    //
    // The invariant is stronger than "no flash": at every frame exactly
    // one of {canvas, source, destination} is visible. Zero is a flash of
    // background; two is a double image.
    await load(page, baseURL);
    const seen = await page.evaluate(async () => {
      const host = document.querySelector('.nod-morph-host');
      const live = document.querySelector('.nod-morph-live');
      let blank = 0, both = 0, frames = 0, stop = false;
      (function poll() {
        if (stop) return;
        frames++;
        const cv = host.querySelector('canvas');
        const d = host.querySelector('div');
        const n = [
          !!cv && (cv.style.visibility || 'visible') === 'visible',
          live.style.display !== 'none',
          !!d && getComputedStyle(d).visibility === 'visible',
        ].filter(Boolean).length;
        if (n === 0) blank++; else if (n > 1) both++;
        requestAnimationFrame(poll);
      })();
      const go = live.querySelector('button') || live.firstElementChild;
      go.click();
      await new Promise((r) => setTimeout(r, 3500));
      const back = host.querySelector('button');
      if (back) back.click();
      await new Promise((r) => setTimeout(r, 2500));
      stop = true;
      return { frames, blank, both };
    });
    expect(seen.frames, 'sampled no frames').toBeGreaterThan(60);
    expect(seen.blank, 'frames with NOTHING on screen (the flash)').toBe(0);
    expect(seen.both, 'frames with two states on screen at once').toBe(0);
  });

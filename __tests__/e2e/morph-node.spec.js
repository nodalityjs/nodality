// morph-node.spec.js — `{ op: "morph" }`, the (E,N) form of a transition.
//
// Every assertion here corresponds to a bug that actually happened while
// this node was being built, in the order they were found:
//
//   1. all four elements rendered stacked, because nothing hid the
//      destinations — "why isn't only the nav visible?"
//   2. links were mapped by POSITION, so "About" morphed to "Selected
//      work"; the prototype nav renders two links both labelled About,
//      and a different set of links per breakpoint
//   3. the destination flashed on screen before the morph ran, during the
//      two awaited captures
//   4. crossing a breakpoint replaced every link and silently unwired them
//   5. the live backend moved content INTO the canvas, where it is
//      fallback content and no longer hit-testable — the back button and
//      the nav links stopped responding
//
// Paths are extensionless on purpose: the dev server (`npx serve`) uses
// clean URLs, so `/public/two-arrays.html` 301s and costs a redirect.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/two-arrays';
const PAGE_LIVE = '/public/two-arrays-live';

async function load(page, baseURL, path = PAGE) {
  await page.goto(`${baseURL}${path}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  // The morph node runs after Des mounts and then does two async
  // captures, so readiness is not the same as wired.
  await page.waitForFunction(
    () => !!document.querySelector('.nod-morph-live a'), null, { timeout: 15000 });
}

/** The nav collapses below its breakpoint; open it so links are laid out. */
const openMenu = (page) => page.evaluate(async () => {
  const live = document.querySelector('.nod-morph-live');
  const laidOut = () => [...live.querySelectorAll('a')]
    .some((a) => a.getBoundingClientRect().width > 0);
  const burger = live.querySelector('button, [class*=toggle]');
  for (let i = 0; i < 3 && !laidOut() && burger; i++) {
    burger.click();
    await new Promise((r) => setTimeout(r, 400));
  }
});

const mapping = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.nod-morph-live a')]
    .map((a) => `${a.textContent.trim()} -> ${a.dataset.nodMorphTo || 'UNWIRED'}`));

const clickLink = (page, label) => page.evaluate(async (l) => {
  const a = [...document.querySelectorAll('.nod-morph-live a')]
    .find((x) => x.textContent.trim().toLowerCase() === l.toLowerCase());
  if (!a) return false;
  a.click();
  return true;
}, label);

// Poll budgets are 20s, not 12s. A morph runs TWO awaited captures
// before its timeline starts, so the wall-clock cost is capture +
// duration, and under full-suite load 12s was not enough — `back returns
// to the source` reached t=0.394 and failed a release on a green
// codebase. The morph-button-card spec already used 20s; this matches it.
/** Read progress without importing anything into the page under test. */
async function progress(page) {
  return page.evaluate(async () => {
    const { activeRasterPipelines } = await import('../lib/raster-ops.js');
    const host = document.querySelector('.nod-morph-host');
    // The LAST match, not the first: goTo() destroys the previous
    // pipeline and builds a new one, so under load both can briefly be
    // live and reading [0] can report the outgoing one's progress.
    const mine = [...activeRasterPipelines()].filter((x) => host.contains(x.canvas));
    const p = mine[mine.length - 1];
    return p ? p.progress : null;
  });
}

const heading = (page) => page.evaluate(() => {
  const d = document.querySelector('.nod-morph-host > div');
  const h = d && d.querySelector('h1,h2,h3,h4,h5,h6');
  return h ? h.textContent.trim() : null;
});

test('at rest ONLY the source is on screen — destinations are not stacked below it',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    const state = await page.evaluate(() => ({
      liveHasNav: !!document.querySelector('.nod-morph-live a'),
      hostEmpty: document.querySelector('.nod-morph-host').children.length === 0,
      // Rendered, then removed from flow — not merely display:none.
      destinationsInDocument: ['work', 'about', 'contact']
        .filter((id) => document.getElementById(id)),
    }));
    expect(state.liveHasNav).toBe(true);
    expect(state.hostEmpty).toBe(true);
    expect(state.destinationsInDocument).toEqual([]);
  });

test('links map by LABEL, so a nav that repeats one still routes correctly',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    await openMenu(page);
    const map = await mapping(page);
    // Nothing is left unwired...
    expect(map.filter((m) => /UNWIRED/.test(m))).toEqual([]);
    // ...and every "About" goes to `about`, however many there are. By
    // position, the first one went to `work`.
    for (const entry of map) {
      const [label, dest] = entry.split(' -> ');
      if (/^about$/i.test(label)) expect(dest).toBe('about');
      if (/^contact$/i.test(label)) expect(dest).toBe('contact');
      if (/^services$/i.test(label)) expect(dest).toBe('work');
    }
  });

test('a link morphs to ITS OWN destination and completes', async ({ page, baseURL }) => {
  await load(page, baseURL);
  await openMenu(page);
  expect(await clickLink(page, 'About')).toBe(true);
  await expect.poll(() => progress(page), { timeout: 20000 }).toBe(1);
  expect(await heading(page)).toBe('About');
});

test('the destination never paints before its morph has run',
  async ({ page, baseURL }) => {
    // It used to appear for the frames between being inserted into the
    // host and applyRasterPipeline taking ownership — two awaited
    // captures wide, which is very visible.
    await load(page, baseURL);
    await openMenu(page);
    const flashes = await page.evaluate(async () => {
      const host = document.querySelector('.nod-morph-host');
      let bad = 0;
      let stop = false;
      (function poll() {
        if (stop) return;
        const d = host.querySelector('div');
        const cv = host.querySelector('canvas');
        // Painted while nothing was yet presenting it.
        if (d && getComputedStyle(d).visibility === 'visible' && !cv) bad++;
        requestAnimationFrame(poll);
      })();
      const a = [...document.querySelectorAll('.nod-morph-live a')][0];
      a.click();
      await new Promise((r) => setTimeout(r, 2500));
      stop = true;
      return bad;
    });
    expect(flashes, 'frames where the destination painted with no canvas').toBe(0);
  });

test('back returns to the source', async ({ page, baseURL }) => {
  await load(page, baseURL);
  await openMenu(page);
  await clickLink(page, 'Contact');
  await expect.poll(() => progress(page), { timeout: 20000 }).toBe(1);

  // Assert the control was actually there. Silently clicking nothing
  // would surface as a progress timeout and read like a morph bug.
  const clickedBack = await page.evaluate(() => {
    const b = document.querySelector('.nod-morph-host button');
    if (!b) return false;
    b.click();
    return true;
  });
  expect(clickedBack, 'no back button in the destination').toBe(true);
  await expect.poll(() => progress(page), { timeout: 20000 }).toBe(0);
  // POLLED, not read once. Who presents is applied by the morph's rAF
  // loop, so it lands a frame AFTER progress reaches 0 — reading it in
  // the same tick as the progress assertion caught the previous frame
  // roughly one run in five.
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('.nod-morph-live').style.display !== 'none'),
    { timeout: 5000 }).toBe(true);
});

test('the mapping survives a breakpoint swap, without a reload',
  async ({ page, baseURL }) => {
    // A responsive nav REPLACES its links when it crosses a breakpoint,
    // so anything wired once is gone. Re-wiring is why this passes.
    await load(page, baseURL);
    await openMenu(page);
    const before = await mapping(page);

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(1200);

    const after = await mapping(page);
    expect(after.length).toBeGreaterThan(0);
    expect(after.filter((m) => /UNWIRED/.test(m)),
      `links lost their wiring after the swap (before: ${before.join(', ')})`).toEqual([]);

    expect(await clickLink(page, 'Services')).toBe(true);
    await expect.poll(() => progress(page), { timeout: 20000 }).toBe(1);
    expect(await heading(page)).toBe('Selected work');
  });

// ── backend policy ───────────────────────────────────────────────────

test('a transition uses SNAPSHOT even where HTML-in-Canvas is available',
  async ({ page, baseURL }) => {
    // The live path moves the host's children into the canvas, where they
    // are fallback content and stop being hit-testable — every control
    // inside the morphed element goes dead. A morph also gains nothing
    // from it: it samples two frozen captures, never the live upload.
    await load(page, baseURL);
    const info = await page.evaluate(async () => {
      const { activeRasterPipelines, isHTMLInCanvasAvailable } =
        await import('../lib/raster-ops.js');
      const host = document.querySelector('.nod-morph-host');
      // force a pipeline to exist
      document.querySelector('.nod-morph-live a').click();
      await new Promise((r) => setTimeout(r, 2500));
      const p = [...activeRasterPipelines()].filter((x) => host.contains(x.canvas))[0];
      return { api: isHTMLInCanvasAvailable(), backend: p ? p.backend : null };
    });
    expect(info.backend).toBe('snapshot');
    // If the trial is not on in this run the assertion above is weaker
    // than intended, so say so rather than passing silently.
    if (!info.api) {
      test.info().annotations.push({ type: 'note',
        description: 'HTML-in-Canvas API absent: snapshot was the only option here.' });
    }
  });

// The controls inside a live pipeline USED to go dead, and this test was
// named for that. They no longer do: the retarget path hit-tests the
// canvas-hosted boxes itself (see live-hit-testing.spec.js). What remains
// true, and is what this test pins, is that live still MOVES the content
// into the canvas — which is why a morph does not opt in by default: it
// samples two frozen stills and gains nothing from a live upload, it pays
// a GPU readback per pointer event, and CSS :hover/:active still follow
// the undisplaced layout because a synthetic event cannot move them.
test('`live: true` opts back in, and moves the content into the canvas',
  async ({ page, baseURL }) => {
    await load(page, baseURL, PAGE_LIVE);
    const info = await page.evaluate(async () => {
      const { activeRasterPipelines, isHTMLInCanvasAvailable } =
        await import('../lib/raster-ops.js');
      const host = document.querySelector('.nod-morph-host');
      document.querySelector('.nod-morph-live a').click();
      await new Promise((r) => setTimeout(r, 2500));
      const p = [...activeRasterPipelines()].filter((x) => host.contains(x.canvas))[0];
      const dest = host.querySelector('div');
      return { api: isHTMLInCanvasAvailable(), backend: p ? p.backend : null,
               contentInsideCanvas: !!(p && dest && p.canvas.contains(dest)) };
    });

    if (info.api) {
      // The opt-in is honoured...
      expect(info.backend).toBe('live');
      // ...and the content really does move into the canvas. Native hit
      // testing cannot reach it there; retargeting is what makes the
      // controls work anyway.
      expect(info.contentInsideCanvas,
        'live moves the content into the canvas — the condition retargeting exists for')
        .toBe(true);
    } else {
      // No API: the pipeline falls back on its own rather than failing.
      expect(info.backend).toBe('snapshot');
    }
  });

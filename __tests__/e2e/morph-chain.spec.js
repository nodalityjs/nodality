// morph-chain.spec.js — C2: a morph node as a navigation graph.
//
// One node, three edges: topnav → work → work-detail → contact. What
// this phase asserts is that a landed state becomes a SOURCE — the
// property that separates a chain from three unrelated morphs.
//
// Verification is by progress, never by DOM presence: the destination is
// inserted into the host BEFORE the two awaited captures, so a hung
// morph leaves a perfectly convincing card in the document. Only the
// pipeline reaching its endpoint means the transition ran.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/morph-chain';

async function load(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForFunction(
    () => !!document.querySelector('.nod-morph-live a[data-nod-morph-to]'),
    null, { timeout: 15000 });
  await page.evaluate(async () => {
    const m = await import('../lib/raster-ops.js');
    const host = () => document.querySelector('.nod-morph-host');
    window.__pipe = () =>
      [...m.activeRasterPipelines()].filter((x) => host().contains(x.canvas)).pop();
    window.__until = async (f, ms) => {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        const v = f(); if (v) return v;
        await new Promise((r) => setTimeout(r, 80));
      }
      return null;
    };
    // Landing is progress reaching 1 AND the timeline settling there —
    // a subsequent hop resets progress, so tests wait on the heading.
    window.__arrived = (text) => window.__until(() => {
      const h = [...document.querySelectorAll('.nod-morph-host h1,.nod-morph-host h2,.nod-morph-host h3')]
        .filter((x) => x.getBoundingClientRect().width > 0)
        .map((x) => x.textContent.trim());
      return h.includes(text) && window.__pipe() && window.__pipe().progress === 1
        ? h : null;
    }, 20000);
  });
}

/**
 * The nav collapses at this viewport; open it so its links lay out.
 *
 * Polled rather than three fixed tries: under full-suite load the bar
 * had not finished its own layout when the third click went out, so the
 * menu stayed shut and the FIRST assertion of the test failed ~2s in —
 * which reads like a morph bug and is really a disclosure that never
 * happened.
 */
const openMenu = (page) => page.evaluate(async () => {
  const live = document.querySelector('.nod-morph-live');
  const laidOut = () => [...live.querySelectorAll('a')]
    .some((a) => a.getBoundingClientRect().width > 0);
  const t0 = performance.now();
  while (!laidOut() && performance.now() - t0 < 10000) {
    const burger = live.querySelector('button, [class*=toggle]');
    if (burger && burger.getBoundingClientRect().width > 0) burger.click();
    await new Promise((r) => setTimeout(r, 250));
  }
  return laidOut();
});

/** Click a control by its text, wherever it currently lives. */
const clickByText = (page, text) => page.evaluate((t) => {
  const all = [...document.querySelectorAll('.nod-morph a, .nod-morph button')];
  const el = all.find((x) => x.textContent.trim().toLowerCase() === t.toLowerCase()
    && x.getBoundingClientRect().width > 0);
  if (!el) return false;
  el.click();
  return true;
}, text);

const visibleHeadings = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.nod-morph h1,.nod-morph h2,.nod-morph h3')]
    .filter((h) => h.getBoundingClientRect().width > 0 &&
                   getComputedStyle(h).visibility !== 'hidden')
    .map((h) => h.textContent.trim()));

test('three hops forward, each landing becoming the next source',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    await openMenu(page);

    // hop 1 — from the nav, by label
    expect(await clickByText(page, 'About')).toBe(true);
    expect(await page.evaluate(() => window.__arrived('Selected work')),
      'hop 1 never landed').toBeTruthy();

    // hop 2 — the landed card is now a source. This is the assertion the
    // whole phase exists for: nothing wired `work` at setup time.
    expect(await clickByText(page, 'Detail'),
      'the landed state exposed no forward trigger').toBe(true);
    expect(await page.evaluate(() => window.__arrived('Project detail')),
      'hop 2 never landed — a landed state is not acting as a source').toBeTruthy();

    // hop 3 — and again, one level deeper, with a per-edge duration
    expect(await clickByText(page, 'Contact')).toBe(true);
    expect(await page.evaluate(() => window.__arrived('Contact')),
      'hop 3 never landed').toBeTruthy();
  });

test('exactly one state is on screen at each landing', async ({ page, baseURL }) => {
  // The failure this prevents is the original "why is everything visible
  // at once": states stacking because nothing removed the one left behind.
  await load(page, baseURL);
  await openMenu(page);

  // POLLED, not read once. Arrival and presentation are two different
  // loops: `__arrived` waits on progress, while who is visible is applied
  // by the morph's own rAF pass on a later frame. Sampling in the same
  // tick caught the outgoing state still on screen — reliably in
  // isolation, intermittently under full-suite load, which is the worst
  // way for a test to be wrong.
  await clickByText(page, 'About');
  await page.evaluate(() => window.__arrived('Selected work'));
  await expect.poll(() => visibleHeadings(page), { timeout: 10000 })
    .toEqual(['Selected work']);

  await clickByText(page, 'Detail');
  await page.evaluate(() => window.__arrived('Project detail'));
  await expect.poll(() => visibleHeadings(page), { timeout: 10000 })
    .toEqual(['Project detail']);
});

test('the back control of a landed state is NOT also a forward trigger',
  async ({ page, baseURL }) => {
    // `work-detail`'s only controls are buttons and its edge has one
    // destination, so any trigger goes there — the exact shape in which
    // the back button would be wired forward as well. One click would
    // then run goTo(contact) AND tl.to(0) together.
    await load(page, baseURL);
    await openMenu(page);
    await clickByText(page, 'About');
    await page.evaluate(() => window.__arrived('Selected work'));
    await clickByText(page, 'Detail');
    await page.evaluate(() => window.__arrived('Project detail'));

    const wiring = await page.evaluate(() =>
      [...document.querySelectorAll('.nod-morph-host button')].map((b) => ({
        text: b.textContent.trim(),
        forward: b.dataset.nodMorphTo || null,
        back: !!b.dataset.nodMorphBack,
      })));

    const back = wiring.find((w) => /back/i.test(w.text));
    expect(back, `no back control found among ${JSON.stringify(wiring)}`).toBeTruthy();
    expect(back.back, 'the back control was not claimed as back').toBe(true);
    expect(back.forward,
      'the back control is ALSO wired as a forward trigger — one click would do both')
      .toBeNull();
  });

test('a state returned to is INKED, not merely present', async ({ page, baseURL }) => {
  // The pipeline suppresses its host's ink for the duration of a
  // transition and used to restore it only at t=1. A single morph never
  // exposed that: its source sits in a separate layer, outside the host,
  // so nothing inside ever had to present at t=0. In a chain the state
  // you return to IS inside the host, so it came back laid out,
  // selectable, and completely invisible — the selection rule being the
  // only thing that repainted it.
  //
  // Geometry and `visibility` both pass in that state, which is why this
  // asserts the computed colour instead.
  await load(page, baseURL);
  await openMenu(page);
  await clickByText(page, 'About');
  expect(await page.evaluate(() => window.__arrived('Selected work'))).toBeTruthy();
  await clickByText(page, 'Detail');
  expect(await page.evaluate(() => window.__arrived('Project detail'))).toBeTruthy();

  // back one step, onto a state that lives inside the raster host
  // Wait for the control, then click. Asserting its presence in the same
  // tick as the landing raced the frame that presents it.
  const clicked = await page.evaluate(() => window.__until(() => {
    const b = [...document.querySelectorAll('.nod-morph button')]
      .find((x) => x.dataset.nodMorphBack && x.getBoundingClientRect().width > 0
                && getComputedStyle(x).visibility !== 'hidden');
    if (!b) return null;
    b.click();
    return true;
  }, 15000));
  expect(clicked, 'no back control became clickable').toBe(true);
  // Landing destroys the pipeline — that IS the handover — so wait for
  // the state to be painted rather than for a progress value that no
  // longer exists by the time it has arrived.
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('.nod-morph h3')]
      .some((h) => h.getBoundingClientRect().width > 0 &&
                   getComputedStyle(h).visibility !== 'hidden')),
    { timeout: 20000 }).toBe(true);

  const ink = await page.evaluate(() => window.__until(() => {
    const h = [...document.querySelectorAll('.nod-morph h3')]
      .filter((x) => x.getBoundingClientRect().width > 0 &&
                     getComputedStyle(x).visibility !== 'hidden');
    if (!h.length) return null;
    return h.map((x) => ({ text: x.textContent.trim(),
                           color: getComputedStyle(x).color,
                           opacity: getComputedStyle(x).opacity }));
  }, 6000));

  expect(ink, 'nothing was laid out after going back').toBeTruthy();
  for (const h of ink) {
    expect(h.color, `"${h.text}" came back with transparent ink`)
      .not.toMatch(/rgba\([^)]*,\s*0(\.0+)?\)$/);
    expect(parseFloat(h.opacity), `"${h.text}" came back fully transparent`)
      .toBeGreaterThan(0.05);
  }
});

test('back unwinds the PATH TAKEN, one level per press', async ({ page, baseURL }) => {
  // `back` is history, not an edge. From `work-detail` the graph offers a
  // forward route to `contact`, but going back has to return the way you
  // came. Two levels deep is the case that matters: the live pipeline is
  // only ever the right pair for the LAST hop, so the second reversal has
  // to rebuild — reversed, so the effect plays backwards rather than
  // playing forwards into the past.
  await load(page, baseURL);
  await openMenu(page);

  await clickByText(page, 'About');
  expect(await page.evaluate(() => window.__arrived('Selected work'))).toBeTruthy();
  await clickByText(page, 'Detail');
  expect(await page.evaluate(() => window.__arrived('Project detail'))).toBeTruthy();

  const back = async () => {
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.nod-morph button')]
        .find((x) => x.dataset.nodMorphBack && x.getBoundingClientRect().width > 0
                  && getComputedStyle(x).visibility !== 'hidden');
      if (!b) return false;
      b.click();
      return true;
    });
    expect(clicked, 'no back control was reachable').toBe(true);
    // Wait for the landing, not merely for progress: `current` moves a
    // tick after the endpoint, and pressing inside that tick used to
    // re-target the hop that had just finished.
    await page.waitForTimeout(1200);
  };

  await back();
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('.nod-morph h3')]
      .filter((h) => h.getBoundingClientRect().width > 0 &&
                     getComputedStyle(h).visibility !== 'hidden')
      .map((h) => h.textContent.trim())), { timeout: 15000 })
    .toEqual(['Selected work']);

  await back();
  // …and the second press reaches the root, which lives in a different
  // layer and is display:none while the graph is deeper in — it has to
  // be made measurable to be captured at all.
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('.nod-morph-live').style.display !== 'none'),
    { timeout: 15000 }).toBe(true);
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.nod-morph-live a[data-nod-morph-to]')].length);
  expect(links, 'the source came back without its wiring').toBeGreaterThan(0);
});

test('a rebuilt reversal actually ANIMATES — it does not just arrive',
  async ({ page, baseURL }) => {
    // Every other test here asserts where you end up, and a reversal that
    // skipped its transition entirely satisfied all of them: the state
    // arrived, inked and wired, having simply appeared. Two causes, both
    // real — the previous pipeline was never destroyed, so its canvas
    // stayed in the host presenting a stale frame with the new one
    // stacked behind it; and the root, being in a display:none layer,
    // measured 0x0 unless made measurable first.
    //
    // So this samples the middle. Intermediate progress is the only
    // evidence that a shader ran rather than a swap happening.
    await load(page, baseURL);
    await openMenu(page);
    await clickByText(page, 'About');
    expect(await page.evaluate(() => window.__arrived('Selected work'))).toBeTruthy();
    await clickByText(page, 'Detail');
    expect(await page.evaluate(() => window.__arrived('Project detail'))).toBeTruthy();

    const trace = await page.evaluate(async () => {
      const samples = [];
      let stop = false;
      (function poll() {
        if (stop) return;
        const p = window.__pipe();
        const cv = document.querySelector('.nod-morph-host canvas');
        if (p) samples.push({ t: p.progress,
          canvasUp: !!cv && (cv.style.visibility || 'visible') === 'visible' });
        requestAnimationFrame(poll);
      })();
      const b = [...document.querySelectorAll('.nod-morph button')]
        .find((x) => x.dataset.nodMorphBack && x.getBoundingClientRect().width > 0);
      if (b) b.click();
      await new Promise((r) => setTimeout(r, 2500));
      stop = true;
      return samples;
    });

    const midFlight = trace.filter((s) => s.t > 0.05 && s.t < 0.95);
    expect(midFlight.length,
      'progress never took an intermediate value — the state was swapped, not morphed')
      .toBeGreaterThan(3);
    expect(midFlight.some((s) => s.canvasUp),
      'the canvas never presented during the reversal').toBe(true);
  });

test('a landed state re-wires after a breakpoint swap', async ({ page, baseURL }) => {
  // Every state that can be a source gets its own observer, not just the
  // root: a chain can be resized while several levels deep.
  await load(page, baseURL);
  await openMenu(page);
  await clickByText(page, 'About');
  expect(await page.evaluate(() => window.__arrived('Selected work'))).toBeTruthy();

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(800);

  expect(await clickByText(page, 'Detail'),
    'the landed state lost its trigger across the swap').toBe(true);
  expect(await page.evaluate(() => window.__arrived('Project detail'))).toBeTruthy();
});

test('the single-hop form still behaves exactly as before',
  async ({ page, baseURL }) => {
    // The C1 gate, kept as a standing assertion: a node written without
    // `chain` is one edge internally, and must be indistinguishable.
    await page.goto(`${baseURL}/public/two-arrays`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
    await page.waitForFunction(
      () => !!document.querySelector('.nod-morph-live a'), null, { timeout: 15000 });
    const progress = await page.evaluate(async () => {
      const m = await import('../lib/raster-ops.js');
      const host = document.querySelector('.nod-morph-host');
      document.querySelector('.nod-morph-live a').click();
      const t0 = performance.now();
      while (performance.now() - t0 < 20000) {
        const p = [...m.activeRasterPipelines()].filter((x) => host.contains(x.canvas)).pop();
        if (p && p.progress === 1) return 1;
        await new Promise((r) => setTimeout(r, 80));
      }
      return null;
    });
    expect(progress).toBe(1);
  });

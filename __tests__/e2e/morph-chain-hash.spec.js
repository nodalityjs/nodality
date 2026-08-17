// morph-chain-hash.spec.js — a chain whose ids are written in selector form.
//
// A morph names an element IDENTIFIER, not a selector: resolution is
// `getElementById` plus a positional fallback against `E`. So "#work"
// used to resolve to nothing, and the failure was a console warning and a
// page that simply never morphed — the worst shape of failure, because
// the validator was meanwhile ACCEPTING "#work" and reporting ok.
//
// Both spellings are now reduced by `bareId` before anything is resolved.
// The fixture mixes them across edges deliberately, so this spec is also
// the regression test for the keying hazard: states are keyed by the id
// string, so `to: "#work"` on one edge and `from: "work"` on the next must
// collapse to ONE key or edge two starts from a state nothing landed on.
//
// Verified by progress, never by DOM presence: the destination is
// inserted into the host BEFORE the awaited captures, so a hung morph
// leaves an entirely convincing card in the document.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/morph-chain-hash';

async function load(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  // The wiring itself is the first assertion in disguise: no link carries
  // `data-nod-morph-to` unless the "#topnav" source and its "#work"
  // destinations all resolved.
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
    window.__arrived = (text) => window.__until(() => {
      const h = [...document.querySelectorAll('.nod-morph-host h1,.nod-morph-host h2,.nod-morph-host h3')]
        .filter((x) => x.getBoundingClientRect().width > 0)
        .map((x) => x.textContent.trim());
      return h.includes(text) && window.__pipe() && window.__pipe().progress === 1
        ? h : null;
    }, 20000);
  });
}

/** The nav collapses at this viewport; open it so its links lay out. */
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

const clickByText = (page, text) => page.evaluate((t) => {
  const all = [...document.querySelectorAll('.nod-morph a, .nod-morph button')];
  const el = all.find((x) => x.textContent.trim().toLowerCase() === t.toLowerCase()
    && x.getBoundingClientRect().width > 0);
  if (!el) return false;
  el.click();
  return true;
}, text);

test('ids written "#id" resolve, and mixed spellings are one state',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect(await openMenu(page), 'the nav never laid out its links').toBe(true);

    // hop 1 — source and destinations all in selector form
    expect(await clickByText(page, 'About')).toBe(true);
    expect(await page.evaluate(() => window.__arrived('Selected work')),
      'hop 1 never landed — "#topnav" -> "#work" did not resolve').toBeTruthy();

    // hop 2 — edge two's source is written BARE while edge one wrote it
    // with a "#". Landing here is the proof that the two spellings were
    // keyed as one state rather than two.
    expect(await clickByText(page, 'Detail'),
      'the landed state exposed no forward trigger: "#work" and "work" were keyed apart')
      .toBe(true);
    expect(await page.evaluate(() => window.__arrived('Project detail')),
      'hop 2 never landed').toBeTruthy();

    // hop 3 — and the reverse mix: selector source, bare destination
    expect(await clickByText(page, 'Contact')).toBe(true);
    expect(await page.evaluate(() => window.__arrived('Contact')),
      'hop 3 never landed').toBeTruthy();
  });

test('the resolver reports no failure for either spelling',
  async ({ page, baseURL }) => {
    // The runtime's own signal. `setUpMorph` warns and returns null when a
    // source or destination does not resolve, and the page then looks
    // completely normal — so the absence of that warning is worth
    // asserting directly rather than inferring from the hops above.
    const warnings = [];
    page.on('console', (msg) => {
      if (/could not resolve/i.test(msg.text())) warnings.push(msg.text());
    });
    await load(page, baseURL);
    await openMenu(page);
    expect(warnings, 'the morph reported an unresolved id').toEqual([]);
  });

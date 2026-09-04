// composite-slots.spec.js — which slot each composite reads, and the warning
// that fires when a page uses the other one.
//
// This exists because the contract was written down wrong three times, and
// every wrong version SHIPPED A PAGE THAT RENDERED: content in the unread slot
// is dropped and the placeholder template is emitted, so nothing throws and
// the result looks finished. The library now warns; this spec is what keeps
// the map behind that warning honest.
//
// Asserted against the rendered DOM, never against the map in element-mapper.js
// — a spec that read the same table the code reads would agree with it while
// both were wrong, which is exactly the failure mode being guarded.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/slot-probe.html';

// The measured contract. `grid` is absent from ELEMENT_TYPES and is a legacy
// branch in designer.js that honours neither slot; it is asserted separately
// below so a future change that gives it one is noticed rather than ignored.
const READS = {
  cards: 'items', nav: 'items', sideNav: 'items', table: 'items', ulist: 'items',
  row: 'children', form: 'children', stack: 'children', wrap: 'children',
};

async function probe(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  return {
    rows: await page.evaluate(() => window.__result),
    warnings: await page.evaluate(() => window.__warnings),
  };
}

test('each composite renders content from its slot and no other', async ({ page, baseURL }) => {
  const { rows } = await probe(page, baseURL);

  for (const [type, want] of Object.entries(READS)) {
    const forType = rows.filter((r) => r.type === type);
    const reached = forType.filter((r) => r.reached);

    // At least one payload shape must get through the declared slot. Which
    // shapes are accepted differs per type (link-ish for cards/nav/sideNav,
    // element specs for ulist, either for table) and is not asserted here.
    expect(reached.length, `${type}: no payload reached the page at all`).toBeGreaterThan(0);

    // Nothing may reach through the other slot.
    const wrong = reached.filter((r) => r.slot !== want);
    expect(wrong, `${type} rendered content from the slot it should ignore`).toEqual([]);
    expect(reached.every((r) => r.slot === want)).toBe(true);
  }
});

test('grid honours neither slot, and is not reachable from the schema', async ({ page, baseURL }) => {
  const { rows } = await probe(page, baseURL);
  const grid = rows.filter((r) => r.type === 'grid');
  expect(grid.length).toBeGreaterThan(0);
  expect(grid.filter((r) => r.reached)).toEqual([]);

  // ...and the mapper rejects it outright, which is what "not reachable from
  // the schema" means in practice: an agent reading get_schema never sees the
  // type, and writing it anyway fails loudly rather than rendering nothing.
  //
  // Asserted IN THE PAGE. The obvious version — importing element-mapper.js
  // here — resolves to nothing under this CommonJS spec file, and the `.catch`
  // that made it survive turned the whole assertion into a silent skip: green,
  // and testing air. Same failure this file exists to catch.
  const verdict = await page.evaluate(async () => {
    const m = await import('../lib/element-mapper.js');
    const Mapper = m.ElementMapper || m.default;
    if (!Mapper || typeof Mapper.mapType !== 'function') return 'NO_MAPPER';
    try { Mapper.mapType({ el: { type: 'grid' } }); return 'RETURNED'; }
    catch (e) { return 'THREW: ' + e.message; }
  });
  expect(verdict, 'element-mapper did not export a usable ElementMapper').not.toBe('NO_MAPPER');
  // If grid ever becomes a real mapper type it needs a documented slot and an
  // entry in CONTENT_SLOT; failing here is the prompt to add both.
  expect(verdict).toContain('THREW');
  expect(verdict).toContain('Unknown element type "grid"');
});

test('using the wrong slot warns, naming the type, the id and the fix', async ({ page, baseURL }) => {
  const { warnings } = await probe(page, baseURL);
  const slotWarnings = warnings.filter((w) => w.includes('carries content in'));

  for (const [type, want] of Object.entries(READS)) {
    const other = want === 'items' ? 'children' : 'items';
    const hit = slotWarnings.find((w) => w.includes(`"${type}"`) && w.includes(`"${other}"`));
    expect(hit, `no warning for ${type} given content in ${other}`).toBeTruthy();
    expect(hit).toContain(`e-${type}-${other}`);   // the offending element's id
    expect(hit).toContain(`Move it to "${want}"`); // and what to do about it
  }
});

test('a composite that fills its own slot is not warned about', async ({ page, baseURL }) => {
  // The warning fires only when the correct slot is EMPTY. A page supplying
  // both slots is doing nothing wrong and must stay quiet, or the signal is
  // noise and gets tuned out — which would cost more than it saves.
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });

  const noisy = await page.evaluate(async () => {
    const seen = [];
    const real = console.warn.bind(console);
    console.warn = (...a) => { seen.push(a.join(' ')); real(...a); };
    const { Des } = await import('../lib/designer.js');
    const host = document.createElement('div');
    host.id = 'both-slots';
    document.body.appendChild(host);
    new Des().nodes([]).add([{
      id: 'e-cards-both', type: 'cards',
      items: [{ title: 'A', link: '#a' }],
      children: [{ type: 'p', text: 'also here' }],
    }]).set({ mount: '#both-slots', code: false });
    return seen.filter((w) => w.includes('carries content in'));
  });

  expect(noisy).toEqual([]);
});

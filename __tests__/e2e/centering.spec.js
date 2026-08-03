const { test, expect } = require('@playwright/test');

/**
 * `center` is the only way to centre an element's children.
 *
 * It replaced six overlapping methods: toCenter(), toCenter("both"),
 * flexc(), toCol(), centerColumn and simpleCenter(). flexc() was
 * byte-identical to toCenter() and toCol() to toCenter("both") — the same
 * behaviour under four names, with the remaining two differing by one
 * property each.
 *
 * The interesting property is axis-awareness. The old methods hardcoded
 * flex-direction: column, so justify-content always meant "vertical". In a
 * row it means horizontal. Asserting both directions is the point: a
 * fixed-direction implementation passes the column cases and fails here.
 *
 * Centring the element ITSELF in its parent is `mar: "center"`, covered by
 * spacing.spec.js. The two were easy to confuse, which is why the old
 * names are gone.
 */

const CASES = [
  'col-both', 'col-x', 'col-y', 'col-bothkw',
  'row-x', 'row-y', 'row-both',
  'grid-both', 'grid-x',
  'gone-simple', 'gone-flexc', 'gone-column', 'baseline',
];

async function styles(page, baseURL) {
  await page.goto(`${baseURL}/public/centering.html`);
  await page.waitForFunction(() => window.__ready === true);

  const names = await page.evaluate(() => window.__cases);
  expect(names, 'fixture and spec disagree on the case list').toEqual(CASES);

  return page.evaluate(() => {
    const out = {};
    const kids = [...document.querySelector('#mount').children];
    window.__cases.forEach((name, i) => {
      const cs = getComputedStyle(kids[i]);
      out[name] = {
        display: cs.display,
        dir: cs.flexDirection,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
        justifyItems: cs.justifyItems,
        alignContent: cs.alignContent,
      };
    });
    return out;
  });
}

test.describe('center', () => {
  test('a column centres on the axis you ask for', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    // column is the default direction; main axis is vertical
    expect(s['col-both'].display).toBe('flex');
    expect(s['col-both'].dir).toBe('column');
    expect(s['col-both'].justifyContent).toBe('center');
    expect(s['col-both'].alignItems).toBe('center');

    // "y" is the main axis in a column -> justify-content only
    expect(s['col-y'].justifyContent).toBe('center');
    expect(s['col-y'].alignItems).not.toBe('center');

    // "x" is the cross axis in a column -> align-items only
    expect(s['col-x'].alignItems).toBe('center');
    expect(s['col-x'].justifyContent).not.toBe('center');

    // "both" is accepted as a synonym for true
    expect(s['col-bothkw']).toEqual(s['col-both']);
  });

  test('a row swaps which property owns which axis', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    expect(s['row-x'].dir).toBe('row');

    // in a row the main axis is horizontal, so "x" is justify-content --
    // the reverse of the column case above
    expect(s['row-x'].justifyContent).toBe('center');
    expect(s['row-x'].alignItems).not.toBe('center');

    expect(s['row-y'].alignItems).toBe('center');
    expect(s['row-y'].justifyContent).not.toBe('center');

    expect(s['row-both'].justifyContent).toBe('center');
    expect(s['row-both'].alignItems).toBe('center');
  });

  test('a grid centres without being turned into a flexbox', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    expect(s['grid-both'].display).toBe('grid');
    expect(s['grid-both'].justifyItems).toBe('center');
    expect(s['grid-both'].alignItems).toBe('center');

    expect(s['grid-x'].justifyItems).toBe('center');
    expect(s['grid-x'].alignItems).not.toBe('center');
  });

  test('the removed options are inert and say so', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    for (const c of ['gone-simple', 'gone-flexc', 'gone-column']) {
      expect(s[c], `${c} still centres`).toEqual(s['baseline']);
    }

    const notices = (await page.evaluate(() => window.__notices)).join('\n');
    expect(notices).toContain('`simpleCenter` is deprecated');
    expect(notices).toContain('`flexCenter` is deprecated');
    expect(notices).toContain('`centerColumn` is deprecated');
    expect(notices).toContain('center: true');
  });

  test('center is inherited, and means the same on every component', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/public/centering.html`);
    await page.waitForFunction(() => window.__ready === true);

    const [row, text] = await page.evaluate(() =>
      [...document.querySelector('#inherited').children].map(el => {
        const cs = getComputedStyle(el);
        return { justifyContent: cs.justifyContent, alignItems: cs.alignItems,
                 marginLeft: el.style.marginLeft };
      }));

    // FlexRow had no working center() of its own; it inherits one now.
    expect(row.justifyContent).toBe('center');
    expect(row.alignItems).toBe('center');

    // Text's `center` used to set auto margins -- it centred the element
    // ITSELF, the opposite meaning. It must not do that any more.
    expect(text.marginLeft).not.toBe('auto');
    const notices = (await page.evaluate(() => window.__notices)).join('\n');
    expect(notices).toContain('center on Text');
  });
});

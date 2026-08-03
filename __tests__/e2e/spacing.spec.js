const { test, expect } = require('@playwright/test');

/**
 * `mar` and `pad` are the only methods that write margin and padding.
 *
 * Every competing option has been removed: arrayMargin, arrayPadding,
 * arrpad, paddings, multipad, multimargin and Text's `padding`. Only
 * `mboth` survives, because it is in use; it means mar: "center".
 *
 * This suite exists because there was no spacing coverage at all, and
 * the removed options had drifted so far apart that arrayMargin alone
 * had six different implementations across seven files.
 *
 * Measures computed style, not the option object, so it fails if the
 * translation produces CSS the browser rejects. That was the real bug in
 * the old code: `marginBottom = arr` stringified an array into invalid
 * CSS the browser silently dropped, so the call did nothing and no test
 * would have noticed.
 */

const CASES = [
  'mar-all', 'mar-sides', 'mar-combined', 'mar-string', 'mar-center', 'mar-auto',
  'pad-all', 'pad-combined', 'pad-text',
  'mboth', 'mboth-eq', 'pad-border', 'pad-noborder',
  'gone-arrayMargin', 'gone-arrayPadding', 'gone-arrpad', 'gone-paddings',
  'gone-multipad', 'gone-multimargin', 'gone-textpadding',
  'tf-baseline', 'text-baseline',
];

/** Computed margin/padding for every rendered case, keyed by case name. */
async function boxes(page, baseURL) {
  await page.goto(`${baseURL}/public/spacing.html`);
  await page.waitForFunction(() => window.__ready === true);

  const names = await page.evaluate(() => window.__cases);
  expect(names, 'fixture and spec disagree on the case list').toEqual(CASES);

  return page.evaluate(() => {
    const out = {};
    const kids = [...document.querySelector('#mount').children];
    window.__cases.forEach((name, i) => {
      const cs = getComputedStyle(kids[i]);
      out[name] = {
        margin: [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft],
        padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
        // marginLeft/Right resolve to a used pixel value when set to auto,
        // so the keyword itself has to be read off the inline style.
        inlineMargin: [kids[i].style.marginLeft, kids[i].style.marginRight],
      };
    });
    return out;
  });
}

test.describe('spacing', () => {
  test('mar and pad implement the documented spec', async ({ page, baseURL }) => {
    const b = await boxes(page, baseURL);

    // a bare number is px
    expect(b['mar-all'].margin).toEqual(['40px', '40px', '40px', '40px']);
    expect(b['pad-all'].padding).toEqual(['40px', '40px', '40px', '40px']);

    // one object per side
    expect(b['mar-sides'].margin).toEqual(['14px', '30px', '14px', '30px']);

    // keys combine: {tb: 12} is top and bottom
    expect(b['mar-combined'].margin).toEqual(['12px', '0px', '12px', '0px']);
    expect(b['pad-combined'].padding).toEqual(['0px', '20px', '0px', '20px']);

    // strings pass through untouched
    expect(b['mar-string'].margin).toEqual(['32px', '32px', '32px', '32px']);
    expect(b['pad-text'].padding[3]).not.toBe('0px');

    // "center" and {lr: "auto"} both centre horizontally
    expect(b['mar-center'].inlineMargin).toEqual(['auto', 'auto']);
    expect(b['mar-auto'].inlineMargin).toEqual(['auto', 'auto']);
    expect(b['mar-center'].margin[0]).toBe('0px');
  });

  test('mboth still centres, and says it is deprecated', async ({ page, baseURL }) => {
    const b = await boxes(page, baseURL);
    expect(b['mboth'].inlineMargin).toEqual(['auto', 'auto']);
    expect(b['mboth'].margin).toEqual(b['mboth-eq'].margin);

    const notices = await page.evaluate(() => window.__deprecations);
    expect(notices.join('\n')).toContain('`mboth` is deprecated');
    expect(notices.join('\n')).toContain('mar: "center"');
  });

  test('border does not touch padding', async ({ page, baseURL }) => {
    const b = await boxes(page, baseURL);
    // border() used to hardcode padding: 0.25em, which ran after pad()
    // and silently replaced 40px with 4px.
    expect(b['pad-border'].padding).toEqual(['40px', '40px', '40px', '40px']);
    expect(b['pad-border'].padding).toEqual(b['pad-noborder'].padding);
  });

  test('the removed options are inert', async ({ page, baseURL }) => {
    const b = await boxes(page, baseURL);

    // Wrapper has no spacing of its own, so these must be flat zero.
    for (const c of ['gone-arrayMargin', 'gone-arrpad', 'gone-paddings',
                     'gone-multipad', 'gone-multimargin']) {
      expect(b[c].margin, `${c} still sets margin`).toEqual(['0px', '0px', '0px', '0px']);
      expect(b[c].padding, `${c} still sets padding`).toEqual(['0px', '0px', '0px', '0px']);
    }

    // TextField and Text carry spacing of their own, so the assertion is
    // that the removed option adds nothing on top of a bare instance.
    expect(b['gone-arrayPadding'].padding).toEqual(b['tf-baseline'].padding);
    expect(b['gone-textpadding'].padding).toEqual(b['text-baseline'].padding);
  });
});

/**
 * The Designer's code export. toCode() round-trips the options object,
 * so the guarantee worth testing is that re-running the exported code
 * produces the same spacing.
 */
test.describe('spacing codegen', () => {
  async function trips(page, baseURL) {
    await page.goto(`${baseURL}/public/spacing.html`);
    await page.waitForFunction(() => window.__ready === true);
    return page.evaluate(() => window.__roundTrip);
  }

  test('exported code reproduces the spacing it was generated from', async ({ page, baseURL }) => {
    const t = await trips(page, baseURL);
    for (const [name, r] of Object.entries(t)) {
      expect(r.rebuilt, `${name} did not survive the code export:\n${r.code}`).toBe(r.original);
      expect(r.original, `${name} rendered nothing to begin with`)
        .not.toMatch(/^(0px ){8}\s*$/);
    }
  });
});

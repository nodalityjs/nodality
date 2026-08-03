const { test, expect } = require('@playwright/test');

/**
 * The chainable style setters: color, background, radius, dimensions.
 *
 * The *options* were never the problem — they route through Animator's
 * styleMap and behave the same on every component. The chainable methods are
 * where the duplication lives: an audit found `color()` reimplemented 12 times
 * with 8 distinct bodies, `background()` split between the shorthand and
 * `backgroundColor`, and `round()`/`radius()` doing the same job under two
 * names across 10 copies.
 *
 * Two of those copies were outright bugs — `Circle.color()` and
 * `Polygon.color()` set the background, so `color:` and `background:` did the
 * same thing and neither could set text colour. Nothing caught it because
 * nothing tested these methods at all.
 *
 * Measures computed style, so a setter writing the wrong property or the wrong
 * node fails here rather than silently rendering something else.
 */

const CASES = [
  'color-wrapper', 'color-text', 'color-link', 'color-circle', 'color-polygon',
  'bg-wrapper', 'bg-card', 'bg-link', 'bg-circle',
  'bg-gradient-wrapper', 'bg-gradient-card',
  'radius-card-num', 'radius-card-str', 'radius-tf-num', 'radius-link-num', 'radius-circle',
  'round-card', 'round-link',
  'dims-wrapper', 'size-wrapper',
  'pad4-wrapper', 'pad4-text', 'pad4-ulist', 'mar4-wrapper', 'mar4-tf',
];

async function styles(page, baseURL) {
  await page.goto(`${baseURL}/public/styles.html`);
  await page.waitForFunction(() => window.__ready === true);

  const names = await page.evaluate(() => window.__cases);
  expect(names, 'fixture and spec disagree on the case list').toEqual(CASES);

  return page.evaluate(() => {
    const out = {};
    const kids = [...document.querySelector('#mount').children];
    window.__cases.forEach((name, i) => {
      const el = kids[i], cs = getComputedStyle(el);
      out[name] = {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        borderRadius: cs.borderTopLeftRadius,
        width: cs.width,
        height: cs.height,
        padding: { paddingLeft: cs.paddingLeft, paddingTop: cs.paddingTop,
                   paddingRight: cs.paddingRight, paddingBottom: cs.paddingBottom },
        margin: { marginLeft: cs.marginLeft, marginTop: cs.marginTop,
                  marginRight: cs.marginRight, marginBottom: cs.marginBottom },
      };
    });
    return out;
  });
}

test.describe('style setters', () => {
  test('color() means text colour on every component', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    for (const c of ['color-wrapper', 'color-text', 'color-link', 'color-circle', 'color-polygon']) {
      expect(s[c].color, `${c} color`).toBe('rgb(1, 2, 3)');
      // Circle and Polygon used to write the background here instead.
      expect(s[c].backgroundColor, `${c} must not tint the background`).not.toBe('rgb(1, 2, 3)');
    }
  });

  test('background() paints the background, not the text', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    for (const c of ['bg-wrapper', 'bg-card', 'bg-link', 'bg-circle']) {
      expect(s[c].backgroundColor, `${c} background`).toBe('rgb(4, 5, 6)');
      expect(s[c].color, `${c} must not recolour the text`).not.toBe('rgb(4, 5, 6)');
    }
  });

  test('background() clears an earlier gradient consistently', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    // The shorthand resets background-image; backgroundColor leaves it. Both
    // components must agree, or a gradient survives on one and not the other.
    expect(s['bg-gradient-card'].backgroundImage)
      .toBe(s['bg-gradient-wrapper'].backgroundImage);
  });

  test('radius() treats a number as px and a string verbatim', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    for (const c of ['radius-card-num', 'radius-tf-num', 'radius-link-num', 'radius-circle']) {
      // A bare number used to be written straight to borderRadius on Link,
      // which is invalid CSS the browser discards.
      expect(s[c].borderRadius, `${c} must be 12px`).toBe('12px');
    }
    expect(s['radius-card-str'].borderRadius).not.toBe('0px');
  });

  test('round() is a deprecated alias of radius()', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    expect(s['round-card'].borderRadius).toBe(s['radius-card-num'].borderRadius);
    // round() on Link used to ignore its argument and hardcode 0.5rem.
    expect(s['round-link'].borderRadius).toBe('12px');

    const notices = (await page.evaluate(() => window.__notices)).join('\n');
    expect(notices).toContain('`round()` is deprecated');
  });

  test('dimensions() replaced size(), which still works and warns', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);

    expect(s['dims-wrapper'].width).toBe('120px');
    expect(s['dims-wrapper'].height).toBe('40px');
    // The alias must produce exactly the same box.
    expect(s['size-wrapper'].width).toBe(s['dims-wrapper'].width);
    expect(s['size-wrapper'].height).toBe(s['dims-wrapper'].height);

    const notices = (await page.evaluate(() => window.__notices)).join('\n');
    expect(notices).toContain('size() on this component');
  });

  test('pad() places all four sides identically on every component', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);
    const expected = { paddingLeft: '1px', paddingTop: '2px', paddingRight: '3px', paddingBottom: '4px' };

    // The removed padding() took (L, T, R, B) on most components but
    // (T, L, R, B) on Ulist — the first two arguments silently swapped.
    for (const c of ['pad4-wrapper', 'pad4-text', 'pad4-ulist']) {
      expect(s[c].padding, `${c}`).toEqual(expected);
    }
  });

  test('mar() sets all four sides on every component', async ({ page, baseURL }) => {
    const s = await styles(page, baseURL);
    const expected = { marginLeft: '1px', marginTop: '2px', marginRight: '3px', marginBottom: '4px' };

    // The removed margin() on TextField assigned marginLeft twice, never set
    // marginRight, and appended "px" to a value that already had a unit.
    for (const c of ['mar4-wrapper', 'mar4-tf']) {
      expect(s[c].margin, `${c}`).toEqual(expected);
    }
  });

  test('padding()/margin() are gone; pad()/mar() are the only spacing API', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/public/styles.html`);
    await page.waitForFunction(() => window.__ready === true);
    const removed = await page.evaluate(() => window.__removed);

    for (const c of removed) {
      expect(c.padding, `${c.component}.padding must not exist`).toBe('undefined');
      expect(c.margin, `${c.component}.margin must not exist`).toBe('undefined');
      expect(c.pad, `${c.component}.pad`).toBe('function');
      expect(c.mar, `${c.component}.mar`).toBe('function');
    }
  });
});

// raster-interaction.spec.js — phase I3 of INTERACTION-IMPL-SPEC.
//
// The overlay canvas is pointer-events:none and the real DOM stays where
// layout put it — in snapshot mode the host keeps its box with its ink
// made transparent, in live mode the subtree sits inside the canvas and
// the browser lays it out normally. Either way the PIXELS move and the
// hit targets do not, so a displaced link is clickable where it is not
// drawn.
//
// Measured on this fixture: LEFT spans x 34-334, RIGHT spans 354-654. A
// click at x=504 is inside RIGHT's box, but sourceAt reports the content
// there came from x=305 — inside LEFT. So the click belongs to LEFT.
//
// The negative control matters more than the positive one here: the same
// chain with `interactive: false` must send that click to RIGHT. Without
// it, the DoD test could pass for reasons having nothing to do with
// retargeting.
//
// NOT covered, and it cannot be from here: CSS :hover and :active are
// computed by the browser from the real pointer position over the real
// box, and a synthetic MouseEvent does not move them. JS handlers
// retarget; CSS pseudo-classes still follow the undisplaced layout.
// Focus and keyboard were never wrong — they never went through
// coordinates.

const { test, expect } = require('@playwright/test');
const PAGE = '/public/rasterOps.html';

async function setup(page, baseURL, chain) {
  await page.goto(`${baseURL}${PAGE}#ops=${chain}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const R = document.querySelector('[id="#right"]');
    const b = R.getBoundingClientRect();
    return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
  });
}

test('DoD: clicking where a link is DRAWN activates that link', async ({ page, baseURL }) => {
  const { cx, cy } = await setup(page, baseURL, 'displaced');
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(120);
  const hits = await page.evaluate(() => window.__hits);
  // The cursor is over RIGHT's DOM box, but LEFT's pixels are drawn there.
  expect(hits).toEqual(['#left']);
});

test('negative control: without retargeting the same click hits the wrong link',
  async ({ page, baseURL }) => {
    // Same chain, same coordinates, `interactive: false`. This is the bug
    // I3 fixes, reproduced on demand — without it the test above could
    // pass for reasons unrelated to retargeting.
    const { cx, cy } = await setup(page, baseURL, 'displacedInert');
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(120);
    const hits = await page.evaluate(() => window.__hits);
    expect(hits).toEqual(['#right']);
  });

test('an undisplaced chain is left entirely alone', async ({ page, baseURL }) => {
  // No warp: the browser's own hit-testing is already correct and must
  // not be second-guessed.
  await page.goto(`${baseURL}${PAGE}#ops=halftone`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const errs = await page.evaluate(() => window.__errors || []);
  expect(errs).toEqual([]);
});

test('retargeting does not recurse or double-fire', async ({ page, baseURL }) => {
  const { cx, cy } = await setup(page, baseURL, 'displaced');
  await page.mouse.click(cx, cy);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(150);
  const hits = await page.evaluate(() => window.__hits);
  // Two clicks, two activations — not four, and not an infinite loop.
  expect(hits).toEqual(['#left', '#left']);
});

// ── I3b / I3c: the two things the field audit showed we lacked ───────
//
// Auditing Canvas UI's 33 engines turned up two effects (Bend, HexFloat)
// that retarget events — and they did two things this did not: move FOCUS
// to the retargeted element, and mirror hover so CSS can follow the drawn
// position. Both are fixed here; the audit is in INTERACTION-IMPL-SPEC.

test('I3b: focus follows the click to the element that was drawn there',
  async ({ page, baseURL }) => {
    const { cx, cy } = await setup(page, baseURL, 'displaced');
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(150);
    const focused = await page.evaluate(() => document.activeElement &&
      (document.activeElement.id || document.activeElement.tagName));
    // Clicking over RIGHT's box, on LEFT's pixels: focus belongs to LEFT.
    // Without this the picture, the click and the focus ring disagree.
    expect(focused).toBe('#left');
  });

test('I3c: hover mirroring is OPT-IN, and off by default', async ({ page, baseURL }) => {
  // Writing the attribute is a DOM mutation, and "an effect never touches
  // the host subtree" is this library's headline property — asserted with
  // a MutationObserver elsewhere in this suite. So it cannot be a default.
  const { cx, cy } = await setup(page, baseURL, 'displaced');
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(150);
  const marked = await page.evaluate(() =>
    document.querySelectorAll('[data-nodality-hover]').length);
  expect(marked).toBe(0);
});

test('I3c: with hoverAttr the drawn element is marked, and unmarked on leave',
  async ({ page, baseURL }) => {
    await page.goto(`${baseURL}${PAGE}#ops=displacedHover`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => {
      const R = document.querySelector('[id="#right"]');
      const b = R.getBoundingClientRect();
      return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, top: b.top };
    });
    await page.mouse.move(box.cx, box.cy);
    await page.waitForTimeout(150);
    const marked = await page.evaluate(() =>
      [...document.querySelectorAll('[data-nodality-hover]')]
        .map((n) => n.id || n.tagName));
    // The pointer is over RIGHT's box; LEFT is drawn there, so LEFT is
    // what a :hover rule should light up.
    expect(marked).toContain('#left');
    expect(marked).not.toContain('#right');

    // Leaving must clear it, or the highlight sticks forever.
    await page.mouse.move(5, 5);
    await page.waitForTimeout(200);
    const after = await page.evaluate(() =>
      document.querySelectorAll('[data-nodality-hover]').length);
    expect(after).toBe(0);
  });

const { test, expect } = require('@playwright/test');
const { execFile } = require('node:child_process');
const path = require('node:path');

// nodality/responsive in a real browser: measure a page, solve where each
// group's wide arrangement stops fitting, emit `arrange` nodes, and check that
// the page then switches exactly there and no longer overflows. The work runs
// in helpers/responsive-runner.mjs (see its header for why it is a process).

const RUNNER = path.join(__dirname, 'helpers', 'responsive-runner.mjs');
const FIXTURE = path.join(__dirname, 'helpers', 'responsive-fixture.json');

const run = (baseURL) => new Promise((resolve, reject) => {
  execFile(process.execPath, [RUNNER, baseURL, FIXTURE], { maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
    if (err) reject(new Error(`${err.message}\n${stderr}`));
    else resolve(JSON.parse(stdout));
  });
});

test('solved breakpoints switch at the measured pixel and remove the overflow', async ({ baseURL }) => {
  test.setTimeout(300_000);
  const r = await run(baseURL);
  const byId = Object.fromEntries(r.report.map((g) => [g.id, g]));

  for (const id of ['top', 'hero', 'features', 'grid']) {
    expect(byId[id], `group ${id} was measured`).toBeTruthy();
    expect(byId[id].intervals.length, `group ${id} has a narrow interval`).toBeGreaterThan(0);
  }
  expect(Object.keys(r.exact).sort(), 'a row and the cards switch inside 320–1920').toEqual(['features', 'grid']);
  for (const [id, e] of Object.entries(r.exact)) {
    expect(e.atHi, `${id} is a column at ${e.hi}px`).toBe('column');
    expect(e.above, `${id} is a row at ${e.hi + 1}px`).toBe('row');
  }
  expect(byId.grid.intervals[0][1], 'the cards’ built-in 700px switch is replaced').not.toBe(700);
  expect(byId.top.intervals[0][1] + 1, 'the nav’s built-in 1200px switch is replaced').not.toBe(1200);
  expect(r.overflowAsAuthored.length, 'the fixture overflows as authored').toBeGreaterThan(0);
  // What still overflows must be a width where no arrangement fits: a member
  // wider than its group, which the report names as infeasible.
  const infeasible = (w) => r.report.some((g) => (g.infeasible || []).some(([lo, hi]) => w >= lo && w <= hi));
  const unexplained = r.overflowSynthesized.filter((w) => !infeasible(w));
  expect(unexplained, `overflow at ${unexplained.join(', ')} not explained by an infeasible member`).toEqual([]);
  expect(r.overflowSynthesized.length, 'synthesis removes most of the overflow').toBeLessThan(r.overflowAsAuthored.length);
});

// agent-surface.spec.js — W2: the derived surface, made callable.
//
// Driven through the registry's own `getTools()` / `executeTool()`, not
// by calling into the adapter: registration IS the thing under test, and
// a spec that reached past it would pass on a surface no agent could
// ever see.
//
// Navigation is verified by the LANDED VIEW, never by an executeTool
// promise resolving — the destination is in the document before the
// transition runs, so "the call returned" proves nothing about whether
// the morph happened.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/agent-surface';

async function load(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForFunction(
    () => document.modelContext.getTools().length > 0, null, { timeout: 15000 });
}

const tools = (page) => page.evaluate(() => document.modelContext.getTools());
const call = (page, name, args) => page.evaluate(
  ([n, a]) => document.modelContext.executeTool(n, a), [name, args || {}]);

/** The heading of whichever view is actually painted. */
const visibleHeading = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#stage h3')]
    .filter((h) => h.getBoundingClientRect().width > 0 &&
                   getComputedStyle(h).visibility !== 'hidden' &&
                   getComputedStyle(h).opacity !== '0')
    .map((h) => h.textContent.trim()));

test('the surface registers exactly what the pair declares', async ({ page, baseURL }) => {
  await load(page, baseURL);
  const names = (await tools(page)).map((t) => t.name).sort();
  expect(names).toEqual(
    ['go_back', 'navigate', 'read_view', 'submit_contact-form'].sort());
});

test('the UNLISTED form is not exposed', async ({ page, baseURL }) => {
  // The page carries a second form the node does not name. A derived
  // submit tool is an agent ACTING; nothing about that is inferred.
  await load(page, baseURL);
  const names = (await tools(page)).map((t) => t.name);
  expect(names.some((n) => n.includes('newsletter'))).toBe(false);
});

test('navigate moves the interface and read_view reports where it landed',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    const res = await call(page, 'navigate', { destination: 'work' });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    expect(res.view).toBe('work');

    // the interface really moved, not just the return value
    await expect.poll(() => visibleHeading(page), { timeout: 10000 })
      .toEqual(['Selected work']);

    const read = await call(page, 'read_view');
    expect(read.text).toContain('Selected work');
    expect(read.actions).toContain('Aurora');
  });

test('a destination unreachable FROM HERE is refused constructively',
  async ({ page, baseURL }) => {
    // `aurora` is in the graph and in the enum, but only reachable from
    // `work`. Reachability is a property of where the graph IS, so the
    // schema cannot express it and the runtime has to answer — with the
    // set that is reachable, not with a boolean.
    await load(page, baseURL);
    const res = await call(page, 'navigate', { destination: 'aurora' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('UNREACHABLE_FROM_HERE');
    expect(res.valid).toContain('work');
    await expect.poll(() => visibleHeading(page), { timeout: 5000 }).toEqual(['Studio']);
  });

test('an unknown view names the views that exist', async ({ page, baseURL }) => {
  await load(page, baseURL);
  const res = await call(page, 'navigate', { destination: 'nope' });
  expect(res.ok).toBe(false);
  expect(res.code).toBe('UNKNOWN_VIEW');
  expect(res.valid).toEqual(expect.arrayContaining(['home', 'work', 'aurora', 'contact']));
});

test('go_back unwinds the path actually taken', async ({ page, baseURL }) => {
  await load(page, baseURL);
  expect((await call(page, 'navigate', { destination: 'work' })).ok).toBe(true);
  await expect.poll(() => visibleHeading(page), { timeout: 10000 }).toEqual(['Selected work']);
  expect((await call(page, 'navigate', { destination: 'aurora' })).ok).toBe(true);
  await expect.poll(() => visibleHeading(page), { timeout: 10000 }).toEqual(['Aurora']);

  // aurora offers no forward edge; back must return the way we came
  await call(page, 'go_back');
  await expect.poll(() => visibleHeading(page), { timeout: 15000 }).toEqual(['Selected work']);
  await call(page, 'go_back');
  await expect.poll(() => visibleHeading(page), { timeout: 15000 }).toEqual(['Studio']);
});

test('an agent cannot corrupt the state machine by interrupting',
  async ({ page, baseURL }) => {
    // Two navigations issued without awaiting the first. The controller's
    // rule is that the state pointer moves only on completion, so the
    // page must end up in ONE coherent view, not spliced between two.
    await load(page, baseURL);
    await page.evaluate(() => {
      document.modelContext.executeTool('navigate', { destination: 'work' });
      document.modelContext.executeTool('navigate', { destination: 'contact' });
    });
    await page.waitForTimeout(2500);
    const heads = await visibleHeading(page);
    expect(heads.length, `spliced views: ${JSON.stringify(heads)}`).toBe(1);
    expect(['Studio', 'Selected work', 'Contact']).toContain(heads[0]);
  });

test('submit fills through the form and reports what it sent',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect((await call(page, 'navigate', { destination: 'contact' })).ok).toBe(true);
    await expect.poll(() => visibleHeading(page), { timeout: 10000 }).toEqual(['Contact']);

    const res = await call(page, 'submit_contact-form', {
      name: 'Ada Lovelace', email: 'ada@example.com', topic: 'Sales', optin: true,
    });
    expect(res.ok, JSON.stringify(res)).toBe(true);

    const sent = await page.evaluate(() => window.__submissions);
    expect(sent.length).toBe(1);
    expect(sent[0].form).toBe('contact-form');
    expect(sent[0].data.name).toBe('Ada Lovelace');
    expect(sent[0].data.email).toBe('ada@example.com');
  });

test('a missing required field reports the field, and nothing is sent',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    await call(page, 'navigate', { destination: 'contact' });
    await expect.poll(() => visibleHeading(page), { timeout: 10000 }).toEqual(['Contact']);

    const res = await call(page, 'submit_contact-form', { name: 'Ada' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('MISSING_REQUIRED');
    expect(res.got).toEqual(['email']);
    expect(await page.evaluate(() => window.__submissions.length)).toBe(0);
  });

test('the form carries the spec\'s own annotation attributes', async ({ page, baseURL }) => {
  // The derived path and the standard's declarative path describe one
  // surface: we stamp the forms we derive from, so a browser that
  // implements only the annotations still gets the same tool.
  //
  // Navigated to first because an unvisited morph state is DETACHED —
  // the form is stamped where the controller holds it, and this also
  // asserts the attributes survive being inserted by the transition.
  await load(page, baseURL);
  await call(page, 'navigate', { destination: 'contact' });
  await expect.poll(() => visibleHeading(page), { timeout: 10000 }).toEqual(['Contact']);
  const attrs = await page.evaluate(() => {
    const f = document.querySelector('#contact-form');
    const el = f.tagName === 'FORM' ? f : f.querySelector('form');
    return { name: el.getAttribute('toolname'), desc: el.getAttribute('tooldescription') };
  });
  expect(attrs.name).toBe('submit_contact-form');
  expect(attrs.desc).toBeTruthy();

  const un = await page.evaluate(() => {
    const f = document.querySelector('#newsletter-form');
    const el = f.tagName === 'FORM' ? f : f.querySelector('form');
    return el.getAttribute('toolname');
  });
  expect(un, 'an unlisted form was annotated').toBeNull();
});

test('the manifest is declared IN the document, needing no API', async ({ page, baseURL }) => {
  // The half that survives whatever the spec does next: a crawler or an
  // agent deciding whether to visit reads capability without executing
  // anything and without document.modelContext existing at all.
  await load(page, baseURL);
  const m = await page.evaluate(() =>
    JSON.parse(document.getElementById('nodality-agent-manifest').textContent));
  expect(m.spec).toBe('2026-07-21');
  expect(m.views.root).toBe('home');
  expect(m.views.states).toEqual(expect.arrayContaining(['home', 'work', 'aurora', 'contact']));
  expect(m.tools.map((t) => t.name).sort())
    .toEqual((await tools(page)).map((t) => t.name).sort());
  for (const t of m.tools) expect(t.kind).toBeUndefined();
});

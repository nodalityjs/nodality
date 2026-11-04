// agent-surface-labelinput.spec.js — two defects the M6 agent study found.
//
// 1. A derived submit over `labelInput` fields reported `ok: true` and sent
//    the form EMPTY: the field's id is on a wrapper div, the value was set
//    on the div, and the read-back checked that same div. Asserted here by
//    what the form actually carried, never by the tool's own report.
// 2. With `back: true`, the first unclaimed button in a view became the
//    back control – a form's submit button when the form came first.
// 3. A submit that never happened reported `ok: true`, twice over: from a view
//    other than the form's (morph keeps other views out of the document, and
//    `requestSubmit` on a disconnected form does nothing), and with a value
//    the form's own validation stopped. Five of five Haiku agents told the
//    user the signup had worked.

const { test, expect } = require('@playwright/test');

const PAGE = '/public/agent-surface-labelinput';

async function load(page, baseURL) {
  await page.goto(`${baseURL}${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForFunction(
    () => document.modelContext.getTools().length > 0, null, { timeout: 15000 });
}

const call = (page, name, args) => page.evaluate(
  ([n, a]) => document.modelContext.executeTool(n, a), [name, args || {}]);
const view = (page) => page.evaluate(() => document.modelContext.executeTool('read_view', {}))
  .then((r) => r.view);

test('submit over labelInput fields sends the values, not an empty form',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect((await call(page, 'navigate', { destination: 'plans' })).ok).toBe(true);

    const res = await call(page, 'submit_signup',
      { 'nl-name': 'Jana Nováková', 'nl-email': 'jana@example.cz' });
    expect(res.ok, JSON.stringify(res)).toBe(true);

    const sent = await page.evaluate(() => window.__submissions);
    expect(sent.length).toBe(1);
    expect(sent[0].form).toBe('signup');
    expect(sent[0].fields).toEqual({ Name: 'Jana Nováková', Email: 'jana@example.cz' });
    // and the visible controls hold the values too
    expect(await page.getByRole('textbox', { name: 'Name' }).inputValue()).toBe('Jana Nováková');
  });

test('a form\'s submit button is never claimed as the back control',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect((await call(page, 'navigate', { destination: 'plans' })).ok).toBe(true);

    const flags = await page.evaluate(() => ({
      submit: document.getElementById('nl-send').dataset.nodMorphBack || null,
      back: [...document.querySelectorAll('button')]
        .filter((b) => b.dataset.nodMorphBack).map((b) => b.textContent.trim()),
    }));
    expect(flags.submit).toBeNull();
    expect(flags.back).toEqual(['← back']);

    // Clicking Subscribe submits and stays on the view.
    await page.getByRole('textbox', { name: 'Name' }).fill('Petr');
    await page.getByRole('textbox', { name: 'Email' }).fill('petr@example.cz');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await page.waitForTimeout(800);
    expect((await page.evaluate(() => window.__submissions)).length).toBe(1);
    expect(await view(page)).toBe('plans');

    // The card's own back button still goes back.
    await page.getByRole('button', { name: '← back' }).click();
    await expect.poll(() => view(page), { timeout: 10000 }).toBe('home');
  });

test('a form on another view is refused, not reported as sent, and says where it is',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect(await view(page)).toBe('home');

    const res = await call(page, 'submit_signup',
      { 'nl-name': 'Jana Nováková', 'nl-email': 'jana@example.cz' });
    expect(res.ok, JSON.stringify(res)).toBe(false);
    expect(res.code).toBe('FORM_NOT_IN_VIEW');
    expect(res.valid).toEqual(['plans']);
    expect(await page.evaluate(() => window.__submissions)).toEqual([]);
    expect(await view(page)).toBe('home');

    // The refusal is repairable in one step.
    expect((await call(page, 'navigate', { destination: res.valid[0] })).ok).toBe(true);
    const again = await call(page, 'submit_signup',
      { 'nl-name': 'Jana Nováková', 'nl-email': 'jana@example.cz' });
    expect(again.ok, JSON.stringify(again)).toBe(true);
    const sent = await page.evaluate(() => window.__submissions);
    expect(sent.length).toBe(1);
    expect(sent[0].fields).toEqual({ Name: 'Jana Nováková', Email: 'jana@example.cz' });
  });

test('a value the form\'s own validation stops is refused, and names the field',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect((await call(page, 'navigate', { destination: 'plans' })).ok).toBe(true);

    const res = await call(page, 'submit_signup',
      { 'nl-name': 'Jana', 'nl-email': 'not-an-address' });
    expect(res.ok, JSON.stringify(res)).toBe(false);
    expect(res.code).toBe('NOT_SUBMITTED');
    expect(res.submitted).toBeNull();
    expect(res.valid.map((v) => v.field)).toEqual(['nl-email']);
    expect(await page.evaluate(() => window.__submissions)).toEqual([]);
  });

test('labelInput renders its inputType and required, so the form can enforce them',
  async ({ page, baseURL }) => {
    await load(page, baseURL);
    expect((await call(page, 'navigate', { destination: 'plans' })).ok).toBe(true);

    const email = page.locator('#nl-email input');
    await expect(email).toHaveAttribute('type', 'email');
    await expect(page.locator('#nl-name input')).toHaveAttribute('required', '');
    // Still found by role and label: an email input is a textbox.
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();

    // A person is held to the same constraints as an agent.
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__submissions)).toEqual([]);

    await page.getByRole('textbox', { name: 'Name' }).fill('Petr');
    await email.fill('not-an-address');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__submissions)).toEqual([]);

    await email.fill('petr@example.cz');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect.poll(() => page.evaluate(() => window.__submissions.length)).toBe(1);
  });

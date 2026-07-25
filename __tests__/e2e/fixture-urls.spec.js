const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Guards against fixture URLs that only resolve on a case-insensitive
 * filesystem.
 *
 * macOS matches `keyset.html` against a file actually named
 * `keySet.html`, so a mistyped URL passes every local run and then 404s
 * the moment the suite runs on Linux CI, where the page loads empty and
 * the failure reads as "element(s) not found" -- nowhere near the real
 * cause. That is exactly what happened to keyset.spec.js and
 * sidebar.spec.js, and it cost a release.
 *
 * No browser is used here, so Playwright runs this in Node.
 */

const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const E2E_DIR = __dirname;

// Exact-case listing of everything servable from public/. fs.existsSync
// is useless for this: on macOS it is itself case-insensitive and would
// happily confirm the broken name.
const listing = new Set(fs.readdirSync(PUBLIC_DIR));

/** Resolve a /public/<ref> the way a case-sensitive server would. */
function resolveExact(ref) {
  if (listing.has(ref)) return ref;
  // Extensionless refs rely on clean-URL resolution to <name>.html.
  if (!ref.includes('.') && listing.has(`${ref}.html`)) return `${ref}.html`;
  return null;
}

/** What it would have matched on a case-insensitive filesystem. */
function resolveIgnoringCase(ref) {
  const want = ref.includes('.') ? ref : `${ref}.html`;
  return [...listing].find((f) => f.toLowerCase() === want.toLowerCase()) || null;
}

function refsIn(spec) {
  const src = fs.readFileSync(path.join(E2E_DIR, spec), 'utf8');
  const out = new Set();
  const re = /\/public\/([A-Za-z0-9_.-]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return [...out];
}

test.describe('e2e fixture URLs resolve case-sensitively', () => {
  test('the checker is genuinely case-sensitive', () => {
    // Without this the whole suite could be silently vacuous on macOS.
    const sample = [...listing].find((f) => /[A-Z]/.test(f) && f.endsWith('.html'));
    test.skip(!sample, 'no mixed-case fixture available to prove it with');
    const miscased = sample.toLowerCase();
    expect(sample).not.toBe(miscased);
    expect(resolveExact(miscased)).toBeNull();
    expect(resolveIgnoringCase(miscased)).toBe(sample);
  });

  const specs = fs.readdirSync(E2E_DIR).filter((f) => f.endsWith('.js'));
  for (const spec of specs) {
    test(`${spec} references only files that exist exactly`, () => {
      const broken = refsIn(spec)
        .filter((ref) => resolveExact(ref) === null)
        .map((ref) => {
          const near = resolveIgnoringCase(ref);
          return near
            ? `'/public/${ref}' -> no such file; did you mean '${near}'? ` +
              '(resolves on macOS, 404s on Linux CI)'
            : `'/public/${ref}' -> no such file`;
        });
      expect(broken).toEqual([]);
    });
  }
});

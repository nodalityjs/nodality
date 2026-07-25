// __tests__/jest/fixture-urls.test.js

/**
 * Guards against fixture URLs that only resolve on a case-insensitive
 * filesystem.
 *
 * macOS matches `keyset.html` against a file actually named
 * `keySet.html`, so a mistyped URL passes every local run and then 404s
 * the moment the suite runs on Linux CI — where the page loads empty and
 * the failure reads as "element(s) not found", pointing nowhere near the
 * real cause. That is exactly what happened to keyset.spec.js and
 * sidebar.spec.js, and it cost a release.
 *
 * The check must therefore compare against an exact directory listing.
 * fs.existsSync is useless here: on macOS it is itself case-insensitive
 * and would happily confirm the broken name.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const E2E_DIR = path.join(ROOT, '__tests__/e2e');

// Exact-case listing of everything servable from public/.
const listing = new Set(fs.readdirSync(PUBLIC_DIR));

/**
 * Resolve a /public/<something> reference the way a case-sensitive
 * static server would. Returns the exact filename, or null.
 */
function resolveExact(ref) {
  if (listing.has(ref)) return ref;
  // Extensionless references rely on clean-URL resolution to <name>.html.
  if (!ref.includes('.') && listing.has(`${ref}.html`)) return `${ref}.html`;
  return null;
}

/** What the name would have been on a case-insensitive filesystem. */
function resolveIgnoringCase(ref) {
  const want = ref.includes('.') ? ref : `${ref}.html`;
  return [...listing].find((f) => f.toLowerCase() === want.toLowerCase()) || null;
}

const specs = fs.readdirSync(E2E_DIR).filter((f) => f.endsWith('.js'));

function refsIn(spec) {
  const src = fs.readFileSync(path.join(E2E_DIR, spec), 'utf8');
  const out = new Set();
  const re = /\/public\/([A-Za-z0-9_.-]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return [...out];
}

describe('e2e fixture URLs resolve case-sensitively', () => {
  test('the checker is genuinely case-sensitive', () => {
    // Without this, the whole suite could be silently vacuous on macOS.
    const sample = [...listing].find((f) => /[A-Z]/.test(f) && f.endsWith('.html'));
    if (!sample) return; // no mixed-case fixture to prove it with
    const miscased = sample.toLowerCase();
    expect(sample).not.toBe(miscased);
    expect(resolveExact(miscased)).toBeNull();
    expect(resolveIgnoringCase(miscased)).toBe(sample);
  });

  test.each(specs)('%s references only files that exist exactly', (spec) => {
    const broken = refsIn(spec)
      .filter((ref) => resolveExact(ref) === null)
      .map((ref) => {
        const near = resolveIgnoringCase(ref);
        return near
          ? `'/public/${ref}' -> no such file; did you mean '${near}'? ` +
            '(this resolves on macOS but 404s on Linux CI)'
          : `'/public/${ref}' -> no such file`;
      });

    expect(broken).toEqual([]);
  });
});

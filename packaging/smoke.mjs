#!/usr/bin/env node
/**
 * Smoke-test the PACKED tarball, not the source tree.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Playwright suite resolves `../layout/*` and `../lib/*` inside this
 * repo, so it never touches package.json's `main`, `exports`, `bin` or
 * `files`. Every one of those can be wrong while the whole suite is green.
 *
 * That is not hypothetical. `main` and `exports["."].require` both pointed
 * at `./dist/index.js`, but the build emits `dist/index.cjs.js` — a file
 * named index.js has never existed. `require("nodality")` therefore failed
 * with MODULE_NOT_FOUND for every CommonJS consumer, across releases, and
 * nothing in CI could see it.
 *
 * Run against a directory that has already `npm install`ed the tarball:
 *
 *     node packaging/smoke.mjs /tmp/pack-fixture
 *
 * Exits non-zero on the first failure so it can gate publishing.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const fixture = resolve(process.argv[2] || ".");
const pkgDir = join(fixture, "node_modules", "nodality");
const fail = [];
const ok = m => console.log(`  ok    ${m}`);
const bad = m => { console.log(`  FAIL  ${m}`); fail.push(m); };

if (!existsSync(pkgDir)) {
  console.error(`nodality is not installed in ${fixture}`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
console.log(`\nnodality ${pkg.version} — packaged smoke test\n`);

// 1. Every path package.json advertises must be IN the tarball. This is
//    the check that would have caught the index.js/index.cjs.js mismatch.
const advertised = new Set();
if (pkg.main) advertised.add(pkg.main);
if (pkg.module) advertised.add(pkg.module);
if (pkg.types) advertised.add(pkg.types);
for (const v of Object.values(pkg.exports ?? {})) {
  if (typeof v === "string") advertised.add(v);
  else for (const t of Object.values(v)) if (typeof t === "string") advertised.add(t);
}
for (const b of Object.values(typeof pkg.bin === "string" ? { _: pkg.bin } : pkg.bin ?? {})) {
  advertised.add(b);
}
for (const rel of [...advertised].sort()) {
  const clean = rel.replace(/^\.\//, "");
  // Subpath PATTERNS ("./examples/*": "./examples/*.js") are exports too,
  // and `*` is a wildcard — never a filename. existsSync on the literal
  // string can only ever fail, which reported a correctly-packed
  // directory as missing and aborted the release. Resolve the pattern:
  // the contract is that at least one file matches it.
  if (clean.includes("*")) {
    const dir = join(pkgDir, dirname(clean));
    const rx = new RegExp("^" + basename(clean)
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*") + "$");
    let hits = [];
    try { hits = readdirSync(dir).filter((f) => rx.test(f)); } catch (e) { hits = []; }
    hits.length
      ? ok(`declared pattern matches ${hits.length} file(s): ${rel}`)
      : bad(`declared pattern matches NOTHING in tarball: ${rel}`);
    continue;
  }
  existsSync(join(pkgDir, clean))
    ? ok(`declared path present: ${rel}`)
    : bad(`declared path MISSING from tarball: ${rel}`);
}

// 2. Import the Node-facing subpaths by PACKAGE NAME, which is the only
//    way the exports map is actually exercised.
//
//    "nodality" itself is in this list as of phase P1. It used to be
//    excluded with the note that the browser build "touches `window` at
//    module scope, so importing it in bare Node would fail by design" —
//    which was true, and was the single most expensive thing in the
//    library: every consumer running vitest or jest in its default Node
//    environment died at the import line. Twelve unguarded module-scope
//    assignments later, it imports anywhere, and the entry point every
//    user actually writes is now covered here rather than exempted.
//
//    "nodality/morph" is the pure morph core, whose entire contract is
//    that it loads without a DOM — the one subpath most worth importing.
const nodeSubpaths = [
  "nodality",
  "nodality/ssg", "nodality/ssg-site", "nodality/seo", "nodality/data",
  "nodality/morph", "nodality/presets",
  // NOT "nodality/inspect": it is a DOM dev tool. It has no module-scope
  // DOM access (P1's rule still applies) but importing it here would
  // prove nothing this list is for.
];
for (const spec of nodeSubpaths) {
  try {
    const url = import.meta.resolve
      ? await import.meta.resolve(spec, pathToFileURL(join(fixture, "index.js")))
      : spec;
    const m = await import(url);
    Object.keys(m).length > 0
      ? ok(`${spec} imports and exports ${Object.keys(m).length} name(s)`)
      : bad(`${spec} imported but exported nothing`);
  } catch (e) {
    bad(`${spec} — ${e.code ?? ""} ${e.message.split("\n")[0]}`);
  }
}

// 3. The CLI. Every consumer project builds with `npx nodality prerender`
//    and `npx nodality stage`, so a broken bin breaks all of them at once.
try {
  const out = execFileSync(process.execPath, [join(pkgDir, pkg.bin.nodality)], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  /nodality prerender/.test(out) ? ok("bin prints usage") : bad("bin ran but printed no usage");

} catch (e) {
  const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  /nodality prerender/.test(out) ? ok("bin prints usage") : bad(`bin failed — ${e.message.split("\n")[0]}`);
}

// 4a. The bin's SUBCOMMANDS, not just its usage line.
//
// `npx nodality schema` shipped broken and stayed broken: schema.json and
// scripts/generate-schema.mjs were both outside `files`, so the subcommand
// died with MODULE_NOT_FOUND for every consumer while passing every test in
// the repo, where the paths resolve. Printing usage proved the bin loads; it
// proved nothing about whether the bin can do anything. This runs the
// subcommand that carries Stage 2's whole deliverable.
try {
  const schemaOut = execFileSync(
    process.execPath, [join(pkgDir, pkg.bin.nodality), "schema", "cards"],
    { encoding: "utf8", timeout: 30000 });
  const parsed = JSON.parse(schemaOut);
  parsed?.params?.some((x) => x.name === "items")
    ? ok("bin: `nodality schema cards` returns the type's parameters")
    : bad("bin: `nodality schema cards` ran but did not describe the type");
  } catch (e) {
    bad(`bin: \`nodality schema cards\` failed \u2014 ${String(e.message).split("\n")[0]}`);
  }

console.log();
if (fail.length) {
  console.error(`${fail.length} packaging check(s) failed.\n`);
  process.exit(1);
}
console.log("All packaging checks passed.\n");

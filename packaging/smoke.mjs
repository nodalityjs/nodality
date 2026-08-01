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
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
  existsSync(join(pkgDir, rel.replace(/^\.\//, "")))
    ? ok(`declared path present: ${rel}`)
    : bad(`declared path MISSING from tarball: ${rel}`);
}

// 2. Import the Node-facing subpaths by PACKAGE NAME, which is the only
//    way the exports map is actually exercised. The "." entry is a browser
//    build that touches `window` at module scope, so it is checked for
//    resolution above rather than executed here — importing it in bare
//    Node would fail by design, not because packaging is broken.
const nodeSubpaths = ["nodality/ssg", "nodality/ssg-site", "nodality/seo", "nodality/data"];
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

console.log();
if (fail.length) {
  console.error(`${fail.length} packaging check(s) failed.\n`);
  process.exit(1);
}
console.log("All packaging checks passed.\n");

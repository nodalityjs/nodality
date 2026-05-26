/*!
 * nodality/data — runtime/SSG-aware data loader
 *
 * `loadJson(name, opts?)` resolves JSON in whichever environment the
 * page entry is currently executing:
 *
 *   • Browser  → relative `fetch("./<name>")` from the page's URL.
 *   • Node     → ESM JSON import from `../<name>` relative to this
 *                module (i.e. from the project's `upload/` directory).
 *
 * The two paths differ because under SSG (nodality prerender + jsdom)
 * there is no dev server to fetch from — fetches silently fail and
 * the page ships an empty mount. The ESM import path reads the JSON
 * straight off disk, embedding the data into the prerendered HTML so
 * crawlers see real content.
 *
 * Usage in a page entry:
 *
 *   import { loadJson } from "nodality/data";
 *   const products = await loadJson("products.json");
 *
 * Conventions:
 *   • At runtime the file must live next to the page HTML (so
 *     `./products.json` resolves under the deployed origin).
 *   • At build time the file must live in `upload/` (the project's
 *     `uploadDir`) — which is the same place. Single source of truth.
 *
 * `fallback` is an opt-in escape hatch: pass `{ fallback: [] }` to
 * return the supplied value instead of throwing when the file is
 * missing. Useful for "team.json doesn't exist yet" stub pages.
 */

const IS_NODE = typeof process !== "undefined" && !!process.versions?.node;

// `nodeImport` is a Function-constructor dynamic import that webpack
// CAN'T statically analyse — neither nodality's own webpack build nor
// any consumer's webpack tries to resolve "node:fs" / "node:path" at
// bundle time. The string flows through `new Function`, which is an
// indirection webpack treats as runtime-only. `webpackIgnore` alone
// wasn't enough: the comment is dropped during nodality's bundle and
// consumer bundlers re-scan the produced code without it. (Browsers
// never reach this code because of the IS_NODE guard below.)
const nodeImport = typeof Function !== "undefined"
  ? new Function("s", "return import(s)")
  : null;

export async function loadJson(name, { fallback = undefined } = {}) {
  try {
    if (IS_NODE && nodeImport) {
      const fs = await nodeImport("node:fs");
      const path = await nodeImport("node:path");
      const cwd = process.cwd();
      // Look for the file under `upload/` first (the canonical
      // create-nodality layout), then plain `<name>` at project
      // root as a fallback for non-conventional projects.
      for (const rel of [path.join("upload", name), name]) {
        const abs = path.resolve(cwd, rel);
        if (fs.existsSync(abs)) {
          return JSON.parse(fs.readFileSync(abs, "utf8"));
        }
      }
      throw new Error(`loadJson: ${name} not found (tried ./upload/${name} and ./${name})`);
    }
    const res = await fetch(`./${name}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (fallback !== undefined) {
      // Soft fail — caller asked for a fallback rather than a throw.
      if (typeof console !== "undefined") {
        console.warn(`[loadJson] ${name} failed (${err?.message ?? err}) — using fallback`);
      }
      return fallback;
    }
    throw err;
  }
}

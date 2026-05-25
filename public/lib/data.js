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

export async function loadJson(name, { fallback = undefined } = {}) {
  try {
    if (IS_NODE) {
      // ESM JSON imports require the `with { type: "json" }` attribute.
      // The path is interpreted relative to THIS file's URL, so the
      // page entry's `upload/pages/` location implicitly resolves to
      // `upload/<name>`. Consumers don't need to think about it.
      const mod = await import(`./../../upload/${name}`, { with: { type: "json" } })
        .catch(async () => {
          // Fall back to a relative-from-cwd resolution for projects
          // that don't follow the `upload/` convention. Same shape;
          // process.cwd() is the project root at prerender time.
          const fs = await import("node:fs");
          const path = await import("node:path");
          const cwd = process.cwd();
          // Try upload/<name> then plain <name>.
          for (const rel of [path.join("upload", name), name]) {
            const abs = path.resolve(cwd, rel);
            if (fs.existsSync(abs)) {
              return { default: JSON.parse(fs.readFileSync(abs, "utf8")) };
            }
          }
          throw new Error(`loadJson: ${name} not found (tried ./upload/${name} and ./${name})`);
        });
      return mod.default ?? mod;
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

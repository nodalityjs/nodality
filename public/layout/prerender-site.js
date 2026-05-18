// ════════════════════════════════════════════════════════════════════
// Nodality — full-site SSG batch renderer
// ════════════════════════════════════════════════════════════════════
//
// Higher-level wrapper around `prerender()` that handles the
// concerns every multi-page / multi-locale Nodality static site has:
//
//   • Multi-locale process isolation (one Node subprocess per locale
//     so ESM module-cache doesn't leak the wrong `t` across runs)
//   • Per-locale output directories (default at root, others under
//     /<locale>/)
//   • Head-path rewrite for non-root locales (./script.js → ../script.js)
//   • Body asset-path absolutization so `./assets/foo.jpg` works at
//     any URL depth (becomes `/assets/foo.jpg`)
//   • Per-page canonical + hreflang alternates + <html lang> injection
//   • Sitemap.xml regeneration with hreflang entries
//   • Mobile-first viewport during render (mobile users get no flicker)
//   • Hydration handoff (clear-mount script before runtime scripts)
//
// Consumers provide a small config object and call `prerenderSite()`.
// Everything site-specific (page list, locale list, origin) lives in
// the config; everything generic stays in this module.
//
// ─── Minimal consumer usage ────────────────────────────────────────
//
//   // scripts/prerender.mjs in the consumer project:
//
//   import { prerenderSite } from "nodality/ssg-site";
//   import path from "node:path";
//   import { fileURLToPath } from "node:url";
//
//   await prerenderSite({
//     origin: "https://example.com",
//     uploadDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../upload"),
//     defaultLocale: "en",
//     locales: ["en", "de", "fr"],
//     pages: [
//       { html: "index.html",   entry: "app.js" },
//       { html: "about.html",   entry: "about.js" },
//     ],
//   });
//
// ─── Optional config keys ──────────────────────────────────────────
//
//   viewport       { width, height }   default { 390, 844 } (mobile-first)
//   mount          CSS selector        default "#mount"
//   sitemap        boolean             default true (writes sitemap.xml)
//   xDefaultLocale string              default = defaultLocale
//   assetPrefixes  string[]            default ["assets/", "dist/", "badge-",
//                                               "apple-touch-icon", "favicon."]
//   localStorageKey string             default "h7lang"
//
// ─── Process model ─────────────────────────────────────────────────
//
// `prerenderSite()` distinguishes parent vs child runs by env var
// `NODALITY_SSG_LOCALE`. When called without it, it spawns a Node
// subprocess per locale (each child runs the SAME script with the
// locale set in env). When the env var is present, the call renders
// just that one locale to its output dir.
//
// This isolation is required because each page's entry script imports
// `./lang.js`, which calls `detectLang()` at module evaluation. ESM
// module cache would otherwise pin the first-imported locale across
// the whole process.

import { prerender } from "./prerender.js";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ENV_LOCALE = "NODALITY_SSG_LOCALE";
const ENV_CONFIG = "NODALITY_SSG_CONFIG";

const DEFAULT_ASSET_PREFIXES = [
  "assets/",
  "dist/",
  "badge-",
  "apple-touch-icon",
  "favicon\\.",
];

/**
 * Render an entire static site across N locales.
 *
 * @param {object} config
 * @param {string} config.origin            — Public origin, e.g. "https://example.com"
 * @param {string} config.uploadDir         — Absolute path to the directory containing
 *                                            the template HTML + entry .js files. Output
 *                                            files are written under it (default locale
 *                                            at the root, others under /<locale>/).
 * @param {string} config.defaultLocale     — The locale code whose pages live at the
 *                                            root of uploadDir. All other locales get a
 *                                            same-named subdir.
 * @param {string[]} config.locales         — All locale codes to render. Must include
 *                                            `defaultLocale`.
 * @param {Array<{html:string,entry:string}>} config.pages
 *                                          — Each page's public HTML file (used as
 *                                            template) and the JS entry script that
 *                                            builds it.
 * @param {{width:number,height:number}} [config.viewport={width:390,height:844}]
 * @param {string} [config.mount="#mount"]
 * @param {boolean} [config.sitemap=true]
 * @param {string} [config.xDefaultLocale]  — defaults to config.defaultLocale
 * @param {string[]} [config.assetPrefixes] — Path prefixes that should be rewritten
 *                                            absolute (so they resolve at site root
 *                                            regardless of locale subdir depth).
 * @param {string} [config.localStorageKey="h7lang"]
 *
 * @returns {Promise<void>}
 */
export async function prerenderSite(config) {
  validateConfig(config);

  // Child mode? Render exactly one locale and exit.
  const childLocale = process.env[ENV_LOCALE];
  if (childLocale) {
    return runChild(config, childLocale);
  }

  // Parent mode — fan out one subprocess per locale, sequentially
  // (parallel would scramble console output and risk thrashing CPU).
  const startedAt = Date.now();
  console.log(`🌍 Prerendering ${config.locales.length} locales × ${config.pages.length} pages…`);
  console.log();

  let failures = 0;
  for (const locale of config.locales) {
    console.log(`── ${locale} ${"─".repeat(60 - locale.length - 3)}`);
    const ok = await runLocaleSubprocess(locale);
    if (!ok) failures++;
    console.log();
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (failures > 0) {
    console.error(`❌ Prerender finished with ${failures}/${config.locales.length} failures in ${elapsed}s`);
    throw new Error(`prerenderSite: ${failures} locale(s) failed`);
  }
  console.log(`✅ Prerender done in ${elapsed}s — ${config.locales.length} locales × ${config.pages.length} pages`);

  if (config.sitemap !== false) {
    await writeSitemap(config);
    console.log(`✅ Sitemap regenerated — ${config.pages.length * config.locales.length} URLs`);
  }
}

function validateConfig(config) {
  const required = ["origin", "uploadDir", "defaultLocale", "locales", "pages"];
  for (const k of required) {
    if (!config[k]) throw new Error(`prerenderSite: config.${k} is required`);
  }
  if (!Array.isArray(config.locales) || config.locales.length === 0) {
    throw new Error("prerenderSite: config.locales must be a non-empty array");
  }
  if (!config.locales.includes(config.defaultLocale)) {
    throw new Error(`prerenderSite: config.defaultLocale "${config.defaultLocale}" not in config.locales`);
  }
  if (!Array.isArray(config.pages) || config.pages.length === 0) {
    throw new Error("prerenderSite: config.pages must be a non-empty array");
  }
  for (const p of config.pages) {
    if (!p.html || !p.entry) {
      throw new Error("prerenderSite: each page needs { html, entry }");
    }
  }
}

/**
 * Spawn a Node subprocess running the SAME script the parent did,
 * with NODALITY_SSG_LOCALE set so the child enters child-mode.
 */
function runLocaleSubprocess(locale) {
  return new Promise((resolve) => {
    // process.argv[1] is the entry script of the parent — typically
    // the consumer's `scripts/prerender.mjs`. Re-invoke it so the
    // child has the same imports + same config call.
    const entry = process.argv[1];
    if (!entry) {
      console.error("prerenderSite: cannot determine entry script for subprocess");
      resolve(false);
      return;
    }
    const child = spawn(process.execPath, [entry], {
      cwd: process.cwd(),
      env: { ...process.env, [ENV_LOCALE]: locale },
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", (err) => {
      console.error(`subprocess for ${locale} failed to start: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Render one locale. Reads each page's template, runs the entry
 * script in jsdom via `prerender()`, post-processes the output to
 * absolutize asset paths, and writes the file.
 */
async function runChild(config, locale) {
  const {
    origin,
    uploadDir,
    defaultLocale,
    pages,
    mount = "#mount",
    viewport = { width: 390, height: 844 },
    assetPrefixes = DEFAULT_ASSET_PREFIXES,
    localStorageKey = "h7lang",
  } = config;

  const isSubdir = locale !== defaultLocale;
  const localeDir = isSubdir ? path.join(uploadDir, locale) : uploadDir;
  await fs.mkdir(localeDir, { recursive: true });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `nodality-ssg-${locale}-`));
  const stamp = Date.now();

  // Asset-path rewrite regex (only for non-default locales). The
  // lookbehind `(?<!\.)` is critical — without it the `./` in
  // `../assets/` would match and silently re-break head paths.
  const assetRewriteRe = new RegExp(
    `(?<!\\.)\\.\\/(?=(?:${assetPrefixes.join("|")}))`,
    "g"
  );

  try {
    for (const page of pages) {
      const srcHtml   = path.join(uploadDir, page.html);
      const entryPath = path.join(uploadDir, page.entry);
      const outPath   = path.join(localeDir, page.html);

      try {
        await fs.access(entryPath);
      } catch {
        console.warn(`  ⚠️  ${page.html} skipped — entry ${page.entry} not found`);
        continue;
      }

      // Build a clean template from the live HTML — strip prior
      // prerender output from #mount, rewrite head asset paths
      // (./xxx → ../xxx) for non-default locales.
      const tmplPath = path.join(tmpDir, page.html);
      await fs.writeFile(tmplPath, await buildCleanTemplate(srcHtml, isSubdir, mount));

      process.stdout.write(`  ${page.html.padEnd(22)} `);

      try {
        const result = await prerender({
          template: tmplPath,
          output:   outPath,
          mount,
          locale,
          localStorageKey,
          viewport,
          url: urlFor(config, locale, page.html),
          htmlLang:   locale,
          canonical:  urlFor(config, locale, page.html),
          alternates: alternatesFor(config, page.html),
          build: async () => {
            const importUrl = `${pathToFileURL(entryPath).href}?t=${stamp}-${page.entry}`;
            await import(importUrl);
          },
        });

        // Post-process body asset paths only for non-default locales.
        if (isSubdir) {
          let html = await fs.readFile(outPath, "utf8");
          const before = html.length;
          html = html.replace(assetRewriteRe, "/");
          if (html.length !== before) {
            await fs.writeFile(outPath, html, "utf8");
          }
        }

        console.log(`→ ${path.relative(uploadDir, outPath).padEnd(40)} ${(result.bytes / 1024).toFixed(1).padStart(6)} KB`);
      } catch (err) {
        console.log(`✘ FAILED`);
        console.error(`     ${err.message}`);
      }
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Read the live HTML at `htmlPath`, strip everything inside the
 * mount container, and (for non-default locales) rewrite head
 * <script src>/<link href>/importmap paths from `./` to `../` so
 * they resolve one directory up from the locale's subdir.
 */
async function buildCleanTemplate(htmlPath, isSubdir, mount) {
  // Lazy import jsdom so this module can be loaded in environments
  // that haven't installed it (same pattern as prerender.js).
  const { JSDOM } = await import("jsdom");
  const live = await fs.readFile(htmlPath, "utf8");
  const dom = new JSDOM(live);
  const doc = dom.window.document;

  // Empty the mount so prerender starts fresh (idempotent re-runs).
  const mountEl = doc.querySelector(mount);
  if (mountEl) mountEl.innerHTML = "";

  if (isSubdir) {
    for (const el of doc.querySelectorAll('script[src^="./"]')) {
      el.setAttribute("src", "../" + el.getAttribute("src").slice(2));
    }
    for (const el of doc.querySelectorAll('link[href^="./"]')) {
      el.setAttribute("href", "../" + el.getAttribute("href").slice(2));
    }
    for (const im of doc.querySelectorAll('script[type="importmap"]')) {
      const text = im.textContent || "";
      im.textContent = text.replace(/"\.\//g, '"../');
    }
  }

  const cleaned = dom.serialize();
  dom.window.close();
  return cleaned;
}

/** URL for a (locale, page) pair under this site's origin. */
function urlFor(config, locale, page) {
  const slash = locale === config.defaultLocale ? "" : `${locale}/`;
  const tail = page === "index.html" ? slash : `${slash}${page}`;
  return `${config.origin}/${tail}`;
}

/** hreflang alternates for one page (all locales + x-default). */
function alternatesFor(config, page) {
  const xDefault = config.xDefaultLocale || config.defaultLocale;
  const alts = config.locales.map((l) => ({ hreflang: l, href: urlFor(config, l, page) }));
  alts.push({ hreflang: "x-default", href: urlFor(config, xDefault, page) });
  return alts;
}

/** Write the sitemap.xml covering every (locale, page) URL. */
async function writeSitemap(config) {
  const now = new Date().toISOString().slice(0, 10);
  const entries = [];
  for (const page of config.pages) {
    for (const locale of config.locales) {
      const loc = urlFor(config, locale, page.html);
      const alts = alternatesFor(config, page.html);
      const altLines = alts
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
        .join("\n");
      const priority = page.html === "index.html" ? "1.0"
        : (page.html === "privacy.html" || page.html === "delete-account.html") ? "0.4"
        : "0.8";
      const changefreq = (page.html === "privacy.html" || page.html === "delete-account.html")
        ? "yearly" : "monthly";
      entries.push(
        `  <url>\n` +
        `    <loc>${loc}</loc>\n` +
        `    <lastmod>${now}</lastmod>\n` +
        `    <changefreq>${changefreq}</changefreq>\n` +
        `    <priority>${priority}</priority>\n` +
        altLines + "\n" +
        `  </url>`
      );
    }
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.join("\n") + "\n" +
    `</urlset>\n`;
  await fs.writeFile(path.join(config.uploadDir, "sitemap.xml"), xml, "utf8");
}

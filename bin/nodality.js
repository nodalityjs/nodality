#!/usr/bin/env node
// bin/nodality.js — `npx nodality <command>` CLI entry shipped with
// the nodality package. Today the only subcommand is `prerender`,
// which walks the consumer's `upload/` directory, pairs each
// `<name>.html` with `pages/<name>.js` (or `<name>.js` for flat
// layouts), and renders the resulting tree to static HTML in place.
//
// Why this lives in the nodality package rather than in a separate
// `nodality-cli`:
//   • Single install (`npm i nodality`) gives you the engine AND the
//     runner — same pattern as next, vite, astro, prisma.
//   • The CLI and the engine ship together so version drift between
//     them is impossible.
//   • Consumer scripts wrap this in `npm run prerender`, but
//     `npx nodality prerender` also works without any wiring.
//
// Configuration lives in the consumer's `nodality.config.json`:
//
//   {
//     "origin":        "https://example.com",
//     "uploadDir":     "upload",
//     "defaultLocale": "cs",
//     "locales":       ["cs", "en", ...],
//     "pages":         [{ "html": "index.html", "entry": "app.js" }, ...]
//     "tolerateAsyncErrors": true
//   }
//
// Anything omitted falls back to sensible defaults (single-locale,
// upload/, auto-discovered page list). CLI flags override the file.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prerenderSite } from "../layout/prerender-site.js";
import { prerender } from "../layout/prerender.js";

// ─── Usage ──────────────────────────────────────────────────────

function showUsage() {
  console.log(`Usage:
  nodality prerender [flags]                  # SSG: render upload/*.html in place
  nodality compile [src/<file>.js] [flags]    # Emit Designer output as a companion file
  nodality fanout                             # Generate per-item pages from JSON (reads
                                              # the \`fanout\` block in nodality.config.json;
                                              # runs automatically before \`prerender\`)
  nodality help

Compile flags:
  --out=<path>              Override output path (defaults to upload/pages/<name>.designer.js)
  --stdout                  Print imperative code to stdout instead of writing a file

Prerender flags (all optional; fall through to nodality.config.json, then defaults):
  --origin=<url>            Public origin, e.g. https://example.com (required if no config)
  --upload=<path>           Upload directory (default: ./upload)
  --default-locale=<code>   Default locale code for multi-locale builds
  --locales=<a,b,c>         Comma-separated locale list
  --tolerate-async          Install uncaught/unhandledRejection handlers so a single page's
                            late throw (from a deferred animation/fetch timer) doesn't abort
                            the whole batch — useful for sites with span-animation entries.
  --verbose                 Print every console.log() emitted by the library during render.
                            Default is quiet — only progress lines, page sizes, and the
                            final summary are shown. Use this when debugging.

Examples:
  nodality prerender
  nodality prerender --origin=https://example.com --tolerate-async
  nodality prerender --verbose
`);
  process.exit(1);
}

/**
 * Install a stdout filter that hides the library's internal debug
 * chatter (OGA, MBO, BRIS, APPENDED-, 0P, TAGS SET, date stamps, raw
 * object dumps, "Appending brand:" lines, etc.) during prerender.
 * Progress banners from `prerenderSite` (page-name lines, `→ … KB`,
 * `✅ Prerender done`) and our own `[nodality] …` banner pass through
 * unmodified.
 *
 * Bypassed with --verbose (or NODALITY_VERBOSE=1) when you need the
 * full chatter to debug a render that silently goes wrong.
 *
 * We hook process.stdout.write (not console.log) because the library
 * has 100+ scattered console.log calls across 30 files, AND because
 * jsdom's virtual console forwards differently than expected, AND
 * because some output uses process.stdout.write directly. Filtering
 * at the byte stream catches every path uniformly.
 */
function installLogFilter() {
  const origWrite = process.stdout.write.bind(process.stdout);

  // Strict whitelist: only lines matching one of these patterns
  // survive. Everything else (dev markers, object dumps, stack traces
  // from page scripts, HTML fragments leaking out of jsdom, media-
  // query strings, date stamps, …) is dropped.
  const ALLOW = [
    /^\[nodality\]/,                       // our CLI banner
    /^🌍/,                                  // prerenderSite progress banner
    /^✅/, /^❌/, /^⚠/,                       // status emojis
    /^── /,                                 // locale separators
    /^  [a-z0-9\-]+\.html\s/,              // page progress: "  index.html ..."
    /^→ /,                                  // result lines
    /^$/,                                   // blank lines (preserve spacing)
  ];

  function shouldDropLine(line) {
    for (const rx of ALLOW) if (rx.test(line)) return false;
    return true;
  }

  // Buffer partial lines so we can decide on line boundaries.
  let buf = "";

  process.stdout.write = function (chunk, encoding, cb) {
    const s = typeof chunk === "string" ? chunk : chunk?.toString?.(encoding || "utf8") ?? "";
    buf += s;

    let out = "";
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!shouldDropLine(line)) out += line + "\n";
    }

    // A trailing buffer with no newline is a progress write like
    // `  index.html             ` from prerender-site.js. Pass it
    // through so the user sees progress before the line completes.
    // We only do this when the buffered fragment passes the page-
    // progress check; otherwise hold until newline.
    if (buf && /^  [a-z0-9\-]+\.html\s/.test(buf)) {
      out += buf;
      buf = "";
    }

    if (out) origWrite(out, encoding, cb);
    else if (cb) cb();
    return true;
  };
}

// ─── Flag parsing — minimal, no deps ────────────────────────────

function parseFlags(argv) {
  const flags = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) flags[arg.slice(2)] = true;
    else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return flags;
}

// ─── Config file loader ─────────────────────────────────────────

function loadConfigFile(cwd) {
  const p = path.join(cwd, "nodality.config.json");
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`[nodality] Failed to parse ${p}: ${e.message}`);
    process.exit(1);
  }
}

// ─── Fanout (data-driven page expansion) ────────────────────────

/**
 * Generate one HTML + entry-script pair per item in a JSON dataset.
 * The classic use case is a "detail" template that takes a query
 * parameter at runtime (`/detail.html?id=helix`) and the SEO problem
 * that crawlers see an empty mount for every product. Fanout reads
 * the data once at build time, walks an array within it, and writes
 * a per-item static page that the prerender step then turns into
 * fully populated HTML.
 *
 * Configured in `nodality.config.json`:
 *
 *   "fanout": [
 *     {
 *       "template": "detail.html",
 *       "data":     "products.json",
 *       "items":    "categories[].products",  // dot path with [] for flatMap
 *       "id":       "id",                     // field on each item
 *       "title":    "SLS3 — {name}",          // {name} = item.name, {id} etc.
 *       "entry":    "pages/detail.js",        // exported renderDetailPage(id)
 *       "bodyAttr": "data-product-id"         // attr on <body> for the id
 *     }
 *   ]
 *
 * Output:
 *   • `upload/<basename>-<id>.html` — clone of the template, with
 *     `<title>` substituted and `<body data-...="<id>">`.
 *   • `upload/pages/<basename>-<id>.js` — thin wrapper that imports
 *     the entry's exported renderer and invokes it with this id.
 *
 * Stale outputs from a previous run (orphaned products etc.) are
 * cleaned up before regenerating. The expansion runs once at the
 * start of `nodality prerender` whenever the config has a `fanout`
 * block; you can also invoke it standalone via `nodality fanout`.
 */
function runFanout(cwd, uploadDir, fanoutConfig) {
  if (!Array.isArray(fanoutConfig) || fanoutConfig.length === 0) return 0;

  let totalWrote = 0;
  for (const spec of fanoutConfig) {
    const {
      template, data, items, id = "id", title, entry,
      bodyAttr = "data-product-id",
      // ─── Auto-injected JSON-LD per item (1.0.168+) ─────────
      // When `jsonLdType` is set, fanout emits a
      // `<script type="application/ld+json" data-seo="1">` block per
      // generated HTML with the right schema.org type and fields
      // mapped from each item. Saves projects from importing
      // nodality/seo and calling productJsonLd() by hand inside the
      // page entry — useful because the page entry runs LATE (after
      // the static HTML is already served) so crawlers that don't
      // execute JS miss any client-injected structured data.
      jsonLdType,        // e.g. "Product" | "Article"
      jsonLdFields,      // map of schema-key → dot-path on item (e.g. { name: "name", image: "images.0", sku: "id" })
      jsonLdExtra,       // static fields to add verbatim (e.g. { brand: { "@type": "Brand", name: "SLS3" }, priceCurrency: "CZK" })
    } = spec;
    if (!template || !data) {
      console.warn(`[nodality] fanout: skipping spec without template/data`);
      continue;
    }

    const tplPath = path.join(uploadDir, template);
    const dataPath = path.join(uploadDir, data);
    if (!fs.existsSync(tplPath)) {
      console.error(`[nodality] fanout: template missing: ${template}`);
      process.exit(1);
    }
    if (!fs.existsSync(dataPath)) {
      console.error(`[nodality] fanout: data missing: ${data}`);
      process.exit(1);
    }

    const json = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const list = resolveItemsPath(json, items ?? "");
    if (!Array.isArray(list) || list.length === 0) {
      console.warn(`[nodality] fanout: ${data} produced no items at path "${items}"`);
      continue;
    }

    const templateHtml = fs.readFileSync(tplPath, "utf8");
    const base = path.basename(template, ".html");
    const pagesDir = path.join(uploadDir, "pages");
    fs.mkdirSync(pagesDir, { recursive: true });

    // Clean stale outputs from a previous run so removing an item
    // also removes its page. Match by prefix; original template
    // (e.g. `detail.html` itself) is never touched.
    for (const f of fs.readdirSync(uploadDir)) {
      if (new RegExp(`^${escapeRegex(base)}-.+\\.html$`).test(f)) {
        fs.unlinkSync(path.join(uploadDir, f));
      }
    }
    for (const f of fs.readdirSync(pagesDir)) {
      if (new RegExp(`^${escapeRegex(base)}-.+\\.js$`).test(f)) {
        fs.unlinkSync(path.join(pagesDir, f));
      }
    }

    // Discover the entry file to mirror per-item if not given.
    const entryRel = entry ?? `pages/${base}.js`;
    const entryFull = path.join(uploadDir, entryRel);
    if (!fs.existsSync(entryFull)) {
      console.error(`[nodality] fanout: entry script missing: ${entryRel}`);
      process.exit(1);
    }
    const entryBase = path.basename(entryRel, ".js");
    const entryDir = path.dirname(entryRel);

    let wrote = 0;
    for (const item of list) {
      const itemId = item?.[id];
      if (!itemId || !/^[A-Za-z0-9][A-Za-z0-9-_]*$/.test(String(itemId))) {
        console.warn(`[nodality] fanout: skipping item with bad ${id}: ${JSON.stringify(itemId)}`);
        continue;
      }

      // HTML: rewrite <title>, inject body data-attr, point script src
      // at the per-item entry.
      const resolvedTitle = title
        ? interpolate(title, item)
        : String(item?.name ?? itemId);
      const escTitle = escapeHtml(resolvedTitle);

      let html = templateHtml
        .replace(/<title>[^<]*<\/title>/i, `<title>${escTitle}</title>`)
        .replace(/<body(\s[^>]*)?>/i, (_, attrs = "") => {
          const cleaned = (attrs ?? "").replace(
            new RegExp(`\\s+${escapeRegex(bodyAttr)}="[^"]*"`),
            "",
          );
          return `<body${cleaned} ${bodyAttr}="${itemId}">`;
        });

      // Rewrite the original `<script src=".../pages/<entryBase>.js">`
      // to point at the per-item wrapper.
      const srcRx = new RegExp(
        `(<script[^>]*src=")([^"]*\\/?)${escapeRegex(entryBase)}\\.js("[^>]*>)`,
        "i",
      );
      html = html.replace(srcRx, `$1$2${entryBase}-${itemId}.js$3`);

      // Auto-injected JSON-LD per item, if the spec asked for it.
      // Inserted inside <head> (before </head>) so crawlers see it
      // without executing the page entry — critical for Bing /
      // social-card scrapers / non-Google crawlers that don't run JS.
      if (jsonLdType && jsonLdFields) {
        const ld = buildItemJsonLd(jsonLdType, jsonLdFields, jsonLdExtra, item);
        const tag = `<script type="application/ld+json" data-seo="1">${
          JSON.stringify(ld)
        }</script>`;
        html = html.replace(/<\/head>/i, `${tag}\n</head>`);
      }

      fs.writeFileSync(path.join(uploadDir, `${base}-${itemId}.html`), html);

      // JS wrapper. The user's entry must export an async function
      // named `renderDetailPage` (or, generically, the camelCase
      // form of the basename + "Page"). We call it with the id.
      const fnName = entryBase
        .split(/[-_]/)
        .map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1)))
        .join("") + "Page"; // detail → renderDetailPage? No — detailPage
      // To minimise convention surprises, default to the underscored
      // `render<Pascal>Page` form too. Try both: the wrapper imports
      // whichever the entry exports.
      const pascal = entryBase
        .split(/[-_]/)
        .map((p) => p[0].toUpperCase() + p.slice(1))
        .join("");
      const wrapperBody = `// Auto-generated by \`nodality fanout\`.
// Per-item entry — invokes the renderer in ${entryRel}
// with this item's id baked in.
import * as mod from "./${path.basename(entryRel)}";

const fn = mod.render${pascal}Page ?? mod.${fnName} ?? mod.default;
if (typeof fn !== "function") {
  throw new Error(
    "[fanout] ${entryRel} must export render${pascal}Page(id) " +
      "(or a default async function). nodality fanout could not find one.",
  );
}
await fn(${JSON.stringify(String(itemId))});
`;
      fs.writeFileSync(
        path.join(pagesDir, `${entryBase}-${itemId}.js`),
        wrapperBody,
      );
      wrote++;
    }

    console.log(`[nodality] fanout: ${template} × ${data} → ${wrote} page(s)`);
    totalWrote += wrote;
  }
  return totalWrote;
}

/**
 * Look up a dot/bracket path on a single item, e.g. "images.0" or
 * "sizing.sizes.0.range". Returns undefined for missing branches.
 * Used by fanout's per-item JSON-LD field mapper.
 */
function getByPath(obj, path) {
  if (obj == null || !path) return undefined;
  const parts = String(path).split(".");
  let acc = obj;
  for (const p of parts) {
    if (acc == null) return undefined;
    acc = acc[p];
  }
  return acc;
}

/**
 * Build a schema.org JSON-LD object for one fanout item. `fields`
 * maps schema-key → dot-path on the item; `extra` is merged in
 * verbatim (static fields like brand, priceCurrency, "@context").
 */
function buildItemJsonLd(type, fields, extra, item) {
  const out = { "@context": "https://schema.org", "@type": type };
  for (const [key, fieldPath] of Object.entries(fields || {})) {
    const v = getByPath(item, fieldPath);
    if (v !== undefined && v !== null && v !== "") out[key] = v;
  }
  if (extra && typeof extra === "object") {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

/** Resolve a dot-path with `[]` segments to an array of items. */
function resolveItemsPath(data, path) {
  if (!path) return Array.isArray(data) ? data : [];
  const tokens = path.split(/\.|(\[\])/).filter(Boolean);
  let acc = data;
  for (const tok of tokens) {
    if (tok === "[]") {
      if (!Array.isArray(acc)) return [];
      continue;
    }
    if (Array.isArray(acc)) {
      acc = acc.flatMap((x) => (x != null ? [x[tok]] : [])).filter((x) => x != null);
      // After accessing a field through an array, the result is an
      // array of values (possibly nested). Don't auto-flatten — the
      // user can put another `[]` after if they want.
    } else if (acc != null) {
      acc = acc[tok];
    } else {
      return [];
    }
  }
  return Array.isArray(acc) ? acc.flat(Infinity).filter((x) => x != null) : [];
}

/** Replace `{field}` in a template with item[field]. */
function interpolate(template, item) {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const v = key.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), item);
    return v == null ? "" : String(v);
  });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&#39;",
  );
}

// ─── Page auto-discovery ────────────────────────────────────────

/**
 * Pair each upload/<name>.html with its entry script. Supports both
 * common layouts:
 *   • Flat: `upload/app.js`, `upload/o-konceptu.js` at uploadDir root
 *   • Nested: `upload/pages/index.js`, `upload/pages/products.js`
 *
 * HTMLs with no matching entry are skipped with a warning. Irregular
 * pairs (e.g. `index.html → app.js`) can be declared explicitly via
 * the `pages` key in nodality.config.json, which bypasses discovery.
 */
function discoverPages(uploadDir) {
  if (!fs.existsSync(uploadDir)) {
    console.error(`[nodality] uploadDir not found: ${uploadDir}`);
    process.exit(1);
  }
  const htmls = fs
    .readdirSync(uploadDir)
    .filter((f) => f.endsWith(".html"))
    .sort();

  const pages = [];
  for (const html of htmls) {
    const base = path.basename(html, ".html");
    const candidates = [path.join("pages", `${base}.js`), `${base}.js`];
    let entry = null;
    for (const c of candidates) {
      if (fs.existsSync(path.join(uploadDir, c))) {
        entry = c;
        break;
      }
    }
    if (entry) pages.push({ html, entry });
    else console.warn(`[nodality] ⚠ ${html} skipped — no pages/${base}.js or ${base}.js`);
  }

  if (pages.length === 0) {
    console.error(`[nodality] No HTML/entry pairs found under ${uploadDir}.`);
    process.exit(1);
  }
  return pages;
}

// ─── prerender subcommand ──────────────────────────────────────

async function runPrerender(rawArgs) {
  const cwd = process.cwd();
  const flags = parseFlags(rawArgs);
  const fileConfig = loadConfigFile(cwd);

  // Flag > config file > default.
  const origin = flags.origin || fileConfig.origin || null;
  const uploadDir = path.resolve(cwd, flags.upload || fileConfig.uploadDir || "upload");
  const defaultLocale = flags["default-locale"] || fileConfig.defaultLocale || null;
  const locales =
    (flags.locales && flags.locales.split(",").map((s) => s.trim())) ||
    fileConfig.locales ||
    null;
  const tolerateAsync =
    flags["tolerate-async"] === true ||
    flags["tolerate-async"] === "true" ||
    fileConfig.tolerateAsyncErrors === true;

  // Quiet by default; --verbose or NODALITY_VERBOSE=1 turns the
  // library's internal chatter back on. Only install the filter once
  // (the multi-locale fanout re-enters this function in the parent
  // process for the no-locales path, but on the child path
  // NODALITY_SSG_LOCALE is set and we still want the filter on).
  const verbose =
    flags.verbose === true ||
    flags.verbose === "true" ||
    process.env.NODALITY_VERBOSE === "1" ||
    fileConfig.verbose === true;
  if (!verbose) installLogFilter();

  if (!origin) {
    console.error(`[nodality] --origin not given and no "origin" in nodality.config.json.`);
    process.exit(1);
  }

  if (tolerateAsync) {
    // Some Nodality animation ops schedule setTimeout callbacks that
    // fire AFTER prerender has serialized the page. When those throw
    // (jsdom realm closed, etc.) a Node default-handler would kill
    // the whole process mid-batch. Demote to warnings so the loop
    // keeps going — same pattern the hand-written prerender.mjs
    // files used in sls3-2025/2026.
    process.on("uncaughtException", (e) =>
      console.warn(`⚠  uncaughtException:  ${e.message}`),
    );
    process.on("unhandledRejection", (e) =>
      console.warn(`⚠  unhandledRejection: ${e?.message ?? e}`),
    );
  }

  // Data-driven page fanout. When the config declares a `fanout`
  // block (per-product detail pages, per-article blog entries, etc.),
  // expand it BEFORE auto-discovery so the generated HTMLs are picked
  // up alongside the hand-written ones. Subprocess child renders skip
  // fanout — the parent already wrote the files and re-running inside
  // each locale would just thrash them.
  if (!process.env.NODALITY_SSG_LOCALE && Array.isArray(fileConfig.fanout)) {
    runFanout(cwd, uploadDir, fileConfig.fanout);
  }

  // Explicit `pages` from config wins over auto-discovery. The
  // discovery rules (pages/<base>.js, <base>.js) can't infer
  // irregular pairs like h7-nodality's `index.html → app.js`; for
  // those projects the user lists pairs in nodality.config.json.
  const pages =
    Array.isArray(fileConfig.pages) && fileConfig.pages.length
      ? fileConfig.pages
      : discoverPages(uploadDir);

  // Only the PARENT process prints the banner. In multi-locale fanout
  // each locale runs in a child subprocess that re-enters this same
  // script with NODALITY_SSG_LOCALE set; suppressing the banner there
  // keeps output clean (the parent already prints `── cs ──` separators).
  if (!process.env.NODALITY_SSG_LOCALE) {
    console.log(
      `[nodality] Prerender ${pages.length} page(s) @ ${origin}` +
        (defaultLocale ? ` (default: ${defaultLocale})` : " (single-locale, untagged)"),
    );
  }

  const config = { origin, uploadDir, pages };
  if (defaultLocale) config.defaultLocale = defaultLocale;
  if (locales) config.locales = locales;

  await prerenderSite(config);
}

// ─── compile subcommand ────────────────────────────────────────

/**
 * Run the Designer (`src/<name>.js`) in jsdom and emit the imperative
 * code it would have shown in the `code: true` on-page panel into a
 * companion file `upload/pages/<name>.designer.js` (non-destructive —
 * the canonical `upload/pages/<name>.js` is never touched).
 *
 * Developer workflow:
 *   1. Sketch in `src/app.js` using the declarative Designer API.
 *   2. `nodality compile`  →  emits `upload/pages/index.designer.js`
 *      containing `new Text(...).set({...}).render("#mount")` etc.
 *   3. Diff the .designer.js against your canonical
 *      `upload/pages/index.js`; copy/cherry-pick what you want;
 *      refine by hand. The .designer.js is throwaway — regenerate
 *      whenever you sketch new pieces in src/.
 *
 * Flags:
 *   --out=<path>   write to this file instead of the default companion
 *                  (use this when you want to overwrite the canonical
 *                  file; you own the risk)
 *   --stdout       print the imperative code to stdout instead of
 *                  writing a file (pipe into pbcopy, etc.)
 *
 * Mechanism: sets `globalThis.NODALITY_EMIT = true` before importing
 * the Designer entry. `Des.set()` short-circuits when this flag is
 * present, stashing `this.code` into `globalThis.__NODALITY_EMITTED__`
 * instead of evaluating it. We then format and emit that array.
 */
async function runCompile(rawArgs) {
  const cwd = process.cwd();
  const flags = parseFlags(rawArgs);
  const positionals = rawArgs.filter((a) => !a.startsWith("--"));

  const srcRel = positionals[0] || "src/app.js";
  const srcAbs = path.resolve(cwd, srcRel);
  if (!fs.existsSync(srcAbs)) {
    console.error(`[nodality] compile: source not found: ${srcRel}`);
    process.exit(1);
  }

  const base = path.basename(srcAbs, ".js");
  const pageName = base === "app" ? "index" : base;
  const defaultOut = path.join(cwd, "upload", "pages", `${pageName}.designer.js`);
  const outAbs = flags.out ? path.resolve(cwd, flags.out) : defaultOut;
  const toStdout = flags.stdout === true || flags.stdout === "true";

  // Reuse the full prerender machinery — it already installs every
  // browser shim the Designer's add() pipeline touches (IntersectionObserver,
  // matchMedia, rAF, Element.animate, innerWidth/Height, …). We write
  // throwaway template + output files into a temp dir; the only thing
  // we actually want is the side effect of __NODALITY_EMITTED__ being
  // populated when `Des.set()` short-circuits under NODALITY_EMIT.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodality-compile-"));
  const tmplPath = path.join(tmpDir, "template.html");
  const outPath = path.join(tmpDir, "out.html");
  fs.writeFileSync(
    tmplPath,
    `<!DOCTYPE html><html><body><div id="mount"></div></body></html>`,
  );

  globalThis.NODALITY_EMIT = true;
  globalThis.__NODALITY_EMITTED__ = null;

  try {
    await prerender({
      template: tmplPath,
      output: outPath,
      mount: "#mount",
      build: async () => {
        await import(`file://${srcAbs}?t=${Date.now()}`);
      },
    });
  } catch (e) {
    // Designer-emit mode is purely a code-capture pass; if prerender's
    // own serialize step throws because we short-circuited the render,
    // that's fine as long as we captured something.
    if (!globalThis.__NODALITY_EMITTED__) {
      console.error(`[nodality] compile: failed to load ${srcRel}: ${e.message}`);
      process.exit(1);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    globalThis.NODALITY_EMIT = false;
  }

  const emitted = globalThis.__NODALITY_EMITTED__;
  if (!emitted || !Array.isArray(emitted) || emitted.length === 0) {
    console.error(
      `[nodality] compile: ${srcRel} did not produce Designer output. ` +
        `Make sure it ends with \`new Des().nodes(...).add(...).set({ mount: "#mount" })\`.`,
    );
    process.exit(1);
  }

  // Wrap captured code strings into a standalone module.
  const body = emitted
    .map((line) => line.trim().replace(/;\s*$/, ""))
    .map((line) => `${line};`)
    .join("\n\n");

  // Derive the import list from the actual class names used in the
  // emitted statements rather than dumping a hardcoded superset.
  // nodality only exports a known subset of class names; importing a
  // non-exported name (e.g. `Form`, `Polygon`) trips ESM's named-export
  // verification at parse time and breaks the file.
  const NODALITY_EXPORTS = new Set([
    "ElementMapper", "Animator",
    "Text", "Image", "Link", "FlexRow", "UINavBar",
    "Free", "NAudio", "Progress", "Center", "Code",
    "Stack", "Wrapper", "Svg", "MetaAdder", "Table",
    "Dropdown", "Modal", "TextField", "Card", "Wrap",
    "FlexGrid", "ZoomCard", "CustomDivRenderer", "SideBar",
    "SideNav", "SimpleBar", "DesktopBar", "MobileBar",
    "Switcher", "Spacer", "HScroller", "Checkbox", "Base",
    "FilePickera", "Picker", "Range", "RadioGroup", "DataList",
    "Button", "Des", "LinkStyler", "CardGen", "KeyframeAnim",
    "TransformAnim", "Stacker", "ScrollVideo", "Theme",
    "AreaSwitcher", "Video", "UList", "Slider",
    "Polygon", "Circle", "FloatingInput", "Form",
  ]);
  const used = new Set();
  for (const line of emitted) {
    for (const m of line.matchAll(/\bnew\s+([A-Z]\w*)/g)) {
      if (NODALITY_EXPORTS.has(m[1])) used.add(m[1]);
    }
  }
  const importList = [...used].sort().join(", ") || "Text";

  const out = `// Auto-emitted by \`nodality compile\` from ${srcRel}.
// This is the imperative form the Designer would have shown in the
// \`code: true\` panel. It is a throwaway artifact — diff it against
// your canonical upload/pages/${pageName}.js, copy what you want,
// then refine by hand. Re-run \`nodality compile\` whenever you
// sketch new pieces in ${srcRel}.

import { ${importList} } from "nodality";

${body}
`;

  if (toStdout) {
    process.stdout.write(out);
    return;
  }

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, out);
  const rel = path.relative(cwd, outAbs);
  console.log(`[nodality] compile: emitted ${emitted.length} statement(s) → ${rel}`);
  if (!flags.out) {
    const canonical = path.join("upload", "pages", `${pageName}.js`);
    console.log(`[nodality]   diff against your canonical ${canonical} and cherry-pick.`);
  }
}

// ─── fanout subcommand (standalone) ────────────────────────────

/**
 * Run the fanout expansion standalone (without prerender) — useful
 * for debugging the generated files before kicking off a full SSG.
 * Reads the `fanout` block from nodality.config.json.
 */
async function runFanoutStandalone(rawArgs) {
  const cwd = process.cwd();
  const flags = parseFlags(rawArgs);
  const fileConfig = loadConfigFile(cwd);
  const uploadDir = path.resolve(cwd, flags.upload || fileConfig.uploadDir || "upload");

  if (!Array.isArray(fileConfig.fanout) || fileConfig.fanout.length === 0) {
    console.error(`[nodality] fanout: no \`fanout\` block in nodality.config.json`);
    process.exit(1);
  }
  const wrote = runFanout(cwd, uploadDir, fileConfig.fanout);
  if (wrote === 0) {
    console.warn(`[nodality] fanout: 0 page(s) generated — check config & data`);
  }
}

// ─── Dispatch ──────────────────────────────────────────────────

async function main() {
  // Subprocess-mode shortcut. `prerenderSite` parallelises locales
  // by spawning `process.argv[1]` (this script) as a child with the
  // NODALITY_SSG_LOCALE env var set but NO CLI args. Without this
  // branch the child would hit showUsage() and exit, killing every
  // locale's render. Re-enter the prerender directly when the env
  // var is present.
  if (process.env.NODALITY_SSG_LOCALE !== undefined) {
    await runPrerender([]);
    return;
  }

  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    showUsage();
  } else if (command === "prerender") {
    await runPrerender(rest);
  } else if (command === "compile") {
    await runCompile(rest);
  } else if (command === "fanout") {
    await runFanoutStandalone(rest);
  } else {
    console.error(`[nodality] Unknown command: ${command}`);
    showUsage();
  }
}

main().catch((err) => {
  console.error(`[nodality] ${err?.message ?? err}`);
  process.exit(1);
});

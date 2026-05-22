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
import path from "node:path";
import { prerenderSite } from "../layout/prerender-site.js";

// ─── Usage ──────────────────────────────────────────────────────

function showUsage() {
  console.log(`Usage:
  nodality prerender [flags]                  # SSG: render upload/*.html in place
  nodality help

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

// ─── SSG bootstrap ──────────────────────────────────────────────

/**
 * On first run, derive the upload/ structure from the project's root
 * files so a freshly scaffolded project can prerender without manual
 * setup. For each `src/<name>.js` we generate `upload/pages/<name>.js`
 * (verbatim copy) and an `upload/<name>.html` whose importmap points
 * at `./lib.bundle.js` and whose `<script src>` points at the page
 * entry. The first src file (alphabetically) is also written as
 * `upload/index.html` when no explicit index entry exists, so the
 * dev server has a default landing page.
 *
 * If the user has already populated upload/ themselves, we touch
 * nothing. Bootstrap only runs when upload/ is missing OR contains
 * no .html files.
 */
function bootstrapUpload(cwd, uploadDir) {
  const srcDir = path.join(cwd, "src");
  if (!fs.existsSync(srcDir)) return false;

  const srcFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith(".js"));
  if (srcFiles.length === 0) return false;

  fs.mkdirSync(uploadDir, { recursive: true });
  const pagesDir = path.join(uploadDir, "pages");
  fs.mkdirSync(pagesDir, { recursive: true });

  const projectName = path.basename(cwd);
  let wrote = 0;
  for (const srcFile of srcFiles) {
    const base = path.basename(srcFile, ".js");
    // Convention: src/app.js → upload/index.html + upload/pages/index.js.
    // All others: src/<name>.js → upload/<name>.html + upload/pages/<name>.js.
    const pageName = base === "app" ? "index" : base;

    const entryPath = path.join(pagesDir, `${pageName}.js`);
    if (!fs.existsSync(entryPath)) {
      // `code: true` toggles Nodality's on-page <pre>/<code> dev panel,
      // which is useful while writing src/ but should be off in the
      // SSG output. Rewrite when cloning into upload/pages/.
      const srcContent = fs.readFileSync(path.join(srcDir, srcFile), "utf8");
      const ssgContent = srcContent.replace(/code:\s*true/g, "code: false");
      fs.writeFileSync(entryPath, ssgContent);
      wrote++;
    }

    const htmlPath = path.join(uploadDir, `${pageName}.html`);
    if (!fs.existsSync(htmlPath)) {
      fs.writeFileSync(htmlPath, renderUploadHtml(projectName, pageName));
      wrote++;
    }
  }

  if (wrote > 0) {
    console.log(`[nodality] Bootstrapped upload/ from src/ (${wrote} file(s) written)`);
  }

  if (!fs.existsSync(path.join(uploadDir, "lib.bundle.js"))) {
    console.warn(
      `[nodality] ⚠ upload/lib.bundle.js missing — run \`npm run build\` first ` +
        `so the prerendered HTML can load the library bundle at runtime.`,
    );
  }
  return true;
}

function renderUploadHtml(projectName, pageName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  <script type="importmap">
  {
    "imports": {
      "nodality": "./lib.bundle.js"
    }
  }
  </script>
</head>
<body>
  <div id="mount"></div>
  <script type="module" src="./pages/${pageName}.js"></script>
</body>
</html>
`;
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

  // First-run bootstrap: if upload/ is missing or has no HTML pages
  // yet, derive it from the project's src/ + root index.html. This is
  // what create-nodality projects rely on so the scaffolder doesn't
  // have to ship duplicate copies of source files. No-op if upload/
  // is already populated.
  const needsBootstrap =
    !fs.existsSync(uploadDir) ||
    fs.readdirSync(uploadDir).filter((f) => f.endsWith(".html")).length === 0;
  if (needsBootstrap) bootstrapUpload(cwd, uploadDir);

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
  } else {
    console.error(`[nodality] Unknown command: ${command}`);
    showUsage();
  }
}

main().catch((err) => {
  console.error(`[nodality] ${err?.message ?? err}`);
  process.exit(1);
});

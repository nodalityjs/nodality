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

  const out = `// Auto-emitted by \`nodality compile\` from ${srcRel}.
// This is the imperative form the Designer would have shown in the
// \`code: true\` panel. It is a throwaway artifact — diff it against
// your canonical upload/pages/${pageName}.js, copy what you want,
// then refine by hand. Re-run \`nodality compile\` whenever you
// sketch new pieces in ${srcRel}.

import {
  Text, Image, Link, FlexRow, FlexGrid, Wrapper, Center, Stack,
  Card, ZoomCard, Switcher, MobileBar, DesktopBar, SideNav, UINavBar,
  Dropdown, Modal, Table, Spacer, HScroller, Polygon, Circle, UList,
  Free, Audio, Progress, Code, MetaAdder, TextField,
  FloatingInput, Range, RadioGroup, Picker, FilePickera, DataList,
  Base, Form, Button, Slider, Video, Checkbox,
} from "nodality";

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
  } else {
    console.error(`[nodality] Unknown command: ${command}`);
    showUsage();
  }
}

main().catch((err) => {
  console.error(`[nodality] ${err?.message ?? err}`);
  process.exit(1);
});

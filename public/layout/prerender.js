// ════════════════════════════════════════════════════════════════════
// Nodality — static-site prerender helper
// ════════════════════════════════════════════════════════════════════
//
// Adds the ability to capture the HTML produced by Nodality primitives
// and write it to a file at BUILD TIME, without changing any other
// library file or the runtime mount path. The caller's existing
// `app.js` (or per-page script) keeps mounting dynamically in the
// browser — this module just runs the same builder once in Node,
// inside a jsdom-simulated DOM, and saves the resulting HTML so
// crawlers / AI bots / social-unfurl bots see the rendered page
// before any JavaScript executes.
//
// ─── Why this exists ────────────────────────────────────────────────
// Nodality apps construct the DOM imperatively in the browser
// (`new Text().set({...}).render("#mount")`). That works for users
// but leaves the raw HTML body essentially empty — `<div id="mount">
// </div>` plus a script tag. Most AI crawlers (GPTBot, ClaudeBot,
// PerplexityBot, CCBot) and every social-unfurl bot (Slack, LinkedIn,
// WhatsApp, iMessage, X) don't execute JavaScript, so they see nothing.
// Pre-rendering the same builder in Node gives those crawlers the
// real content. Users still get the JS-hydrated experience on top.
//
// ─── Design constraint ──────────────────────────────────────────────
// This file is the ONLY new module in the library; index.js,
// package.json, webpack.config.js, and every existing primitive are
// untouched. The caller is expected to import from this file path
// directly, e.g.:
//
//   import { prerender } from "nodality/layout/prerender.js";
//
// If the caller wants to add a top-level export later, that's a
// one-line addition to `index.js` they can make on their own.
//
// ─── Usage ──────────────────────────────────────────────────────────
//
//   import { prerender } from "nodality/layout/prerender.js";
//
//   await prerender({
//     template: "./page-template.html",     // HTML shell (head + empty body)
//     mount:    "#mount",                    // selector inside the template
//     locale:   "de",                        // optional: pre-seeded into localStorage
//     url:      "https://h7active.com/",     // jsdom base URL (used for relative paths)
//     build:    async (window) => {
//       // Runs inside the jsdom-simulated browser. `window.document`,
//       // `window.localStorage`, etc. are available globally for the
//       // duration of the call. Import or invoke your page builder
//       // here; it can use Nodality primitives exactly as in the
//       // browser.
//       await import("./app.js");
//     },
//     output:   "./upload/de/index.html",    // file to write
//   });
//
// The function spins up jsdom, runs your builder, captures the full
// `<!DOCTYPE html>…</html>` document (preserving the template's
// <head>, the <script> tags pointing at runtime JS, AND the now-
// populated body), and writes it to `output`. When the live browser
// later loads that file, the runtime `app.js` still executes and
// remounts — the navigation, dropdowns, language switcher, scroll
// handlers, etc. all continue to work dynamically.
//
// ─── Peer dependency ────────────────────────────────────────────────
// `jsdom` is imported only by this file. It's listed as an optional
// peer dependency so the browser bundle stays small. Callers using
// prerender must `npm install jsdom` in their build environment.

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Render a Nodality-built page to a static HTML file.
 *
 * @param {object} opts
 * @param {string} opts.template — Path to the HTML shell file. Must contain
 *   `<head>` and an empty mount container (e.g. `<div id="mount"></div>`).
 * @param {string} [opts.mount="#mount"] — CSS selector for the mount point
 *   inside the template. The function verifies it exists before running
 *   the builder; missing selector throws (catches typos early).
 * @param {string} [opts.locale] — If set, written to `window.localStorage`
 *   under the key `h7lang` before the builder runs. Lets locale-aware
 *   builders (e.g. those calling `detectLang()`) produce the correct
 *   translation without further plumbing.
 * @param {string} [opts.localStorageKey="h7lang"] — Override the
 *   localStorage key used for the locale handshake if your app uses a
 *   different name.
 * @param {string} [opts.url="http://localhost/"] — Base URL for the jsdom
 *   window. Affects `window.location`, relative-URL resolution, and the
 *   `Document.URL` your code may read.
 * @param {{ width?: number, height?: number }} [opts.viewport={width:390,height:844}]
 *   — Simulated viewport dimensions. Drives `window.innerWidth`,
 *   `window.innerHeight`, and the response of `window.matchMedia()`
 *   to viewport queries like `(min-width: 768px)`. Default is mobile
 *   (iPhone 12-ish: 390×844) so JS-driven responsive layouts (e.g.
 *   `Switcher({ breakpoints })`) emit the MOBILE variant during SSG.
 *   That's the "mobile-first" pattern — phones see the right layout
 *   immediately, desktop users see the mobile layout briefly until
 *   JS rehydrates with the desktop variant.
 * @param {(window: Window) => (void | Promise<void>)} opts.build —
 *   Async function that runs inside the simulated browser. Receives the
 *   jsdom `window` object. Should construct the page via Nodality
 *   primitives and call `.render(mount)`. Awaited so dynamic imports
 *   and async setup complete before serialization.
 * @param {string} opts.output — Path where the rendered HTML is written.
 *   Parent directories are created automatically.
 *
 * @returns {Promise<{ bytes: number, output: string }>} — Resolves once
 *   the file is on disk. `bytes` is the rendered document size.
 */
export async function prerender({
  template,
  mount = "#mount",
  locale,
  localStorageKey = "h7lang",
  url = "http://localhost/",
  viewport = { width: 390, height: 844 },
  build,
  output,
}) {
  if (!template) throw new Error("prerender: `template` is required");
  if (!output)   throw new Error("prerender: `output` is required");
  if (typeof build !== "function") {
    throw new Error("prerender: `build` must be an async function");
  }

  // Lazy import jsdom so this file can be imported in environments that
  // don't have it installed (it's a peer dep). The error message is
  // explicit because the default "Cannot find package 'jsdom'" stack
  // trace is opaque to users who haven't seen it before.
  let JSDOM;
  try {
    ({ JSDOM } = await import("jsdom"));
  } catch (err) {
    throw new Error(
      "prerender: jsdom is required at build time. " +
        "Install it in the consuming project: `npm install --save-dev jsdom`. " +
        "Original error: " + err.message
    );
  }

  // Read the HTML shell. Use absolute path resolution so relative
  // `template` arguments (the common case from a build script) work
  // regardless of process.cwd().
  const templatePath = path.resolve(template);
  const html = await fs.readFile(templatePath, "utf8");

  // ─── jsdom setup ─────────────────────────────────────────────────
  //
  // `runScripts: "outside-only"` is the critical flag: it gives the
  // window a working JS execution context (so `new Text()` etc. work
  // inside the builder) BUT does NOT auto-execute `<script>` tags
  // from the template. We deliberately don't want the template's
  // `<script src="./app.js">` to run inside jsdom — paths there are
  // production-relative and would 404; instead the caller's `build`
  // function imports the same modules through Node's module system,
  // which resolves them correctly.
  //
  // `pretendToBeVisual: true` enables requestAnimationFrame and a few
  // related visual APIs. Cheap and prevents subtle "rAF is not a
  // function" errors from libraries that schedule layout work.
  const dom = new JSDOM(html, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });

  const { window } = dom;

  // Optional locale seed — written before any global proxying so the
  // builder sees it as soon as the proxy is in place.
  if (locale) {
    window.localStorage.setItem(localStorageKey, locale);
  }

  // ─── Browser API shims jsdom doesn't ship ───────────────────────
  //
  // These are no-ops; their job is to prevent ReferenceErrors when
  // the builder constructs objects that reference observation APIs.
  // Real observation isn't meaningful at build time (no scrolling,
  // no resizing, no layout) and SSG doesn't need it.
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // Simulated viewport. jsdom's defaults are 1024×768 — we override
  // with the caller-provided (or default mobile) dimensions so JS-
  // driven responsive layouts pick the right variant during SSG.
  //
  // `innerWidth` / `innerHeight` are read by code like
  // `Switcher.choose()` that compares `window.innerWidth` against
  // each breakpoint's `at` value. They must be defined as values
  // (not getters) so subsequent assignments don't throw.
  const vw = (viewport && Number(viewport.width))  || 390;
  const vh = (viewport && Number(viewport.height)) || 844;
  try {
    Object.defineProperty(window, "innerWidth", { value: vw, configurable: true, writable: true });
    Object.defineProperty(window, "innerHeight", { value: vh, configurable: true, writable: true });
    Object.defineProperty(window, "outerWidth",  { value: vw, configurable: true, writable: true });
    Object.defineProperty(window, "outerHeight", { value: vh, configurable: true, writable: true });
  } catch {
    // jsdom version that freezes these — fall back to direct assignment.
    try { window.innerWidth  = vw; window.innerHeight = vh; } catch {}
  }

  // Replace jsdom's matchMedia (which returns matches:false for every
  // query) with a viewport-aware shim that resolves CSS `(min-width:
  // N)` / `(max-width: N)` against the simulated width. This lets
  // matchMedia-driven responsive code (and Nodality's Switcher
  // matchMedia path) pick the right branch during SSG.
  //
  // We override unconditionally — jsdom's default is too permissive
  // for our purposes since it answers `false` for every viewport
  // query, defeating the mobile-first goal.
  window.matchMedia = (query) => {
    let matches = false;
    if (typeof query === "string" && query.includes("width")) {
      // Parse a single "(min-width: 768px)" or "(max-width: 768px)"
      // clause. Multi-clause queries (commas, `and`) fall through to
      // false — Nodality's breakpoint code doesn't emit those.
      const min = query.match(/min-width:\s*(\d+)\s*px/i);
      const max = query.match(/max-width:\s*(\d+)\s*px/i);
      if (min && !max) matches = vw >= Number(min[1]);
      else if (max && !min) matches = vw <= Number(max[1]);
      // Both present (range) or other → leave as false.
    }
    return {
      matches,
      media: query || "",
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    };
  };
  // Some libraries probe these for code-splitting / analytics. Stub
  // them as harmless no-ops so the builder doesn't crash; the live
  // browser still uses the real implementations.
  if (!window.fetch) {
    window.fetch = () =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => "" });
  }
  if (!window.dataLayer) window.dataLayer = [];
  if (!window.gtag)      window.gtag = () => {};

  // ─── Global proxying ────────────────────────────────────────────
  //
  // Nodality primitives reach for `document`, `window`, etc. as bare
  // globals — they were written for the browser, where those are
  // already present. To run them in Node we hoist the jsdom-provided
  // versions onto `globalThis` for the duration of the build call.
  //
  // We snapshot any prior values and restore them in the `finally`
  // block so the parent process isn't polluted between successive
  // prerender() invocations (e.g. a build loop over all locales).
  const PROXIED = [
    "window", "document", "localStorage", "sessionStorage", "navigator",
    "location", "HTMLElement", "Element", "Node", "DocumentFragment",
    "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "PointerEvent",
    "IntersectionObserver", "ResizeObserver", "matchMedia",
    "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle",
    "fetch", "dataLayer", "gtag",
  ];
  // Some Node versions (22+) make certain globals — most notably
  // `navigator` — getter-only on `globalThis`, which means a plain
  // assignment (`globalThis.navigator = window.navigator`) throws
  // "Cannot set property navigator of #<Object> which has only a
  // getter". Inspect the property descriptor and skip read-only
  // ones — the live browser's native object is fine to leave alone
  // since jsdom provides its own copy on `window` that the builder
  // can reach via `window.navigator`. Same defensive check for any
  // other future getter-only globals Node may add.
  // Rather than try to detect every read-only global ahead of time
  // (descriptors differ subtly between data and accessor properties,
  // and Node's set keeps evolving), just attempt each assignment in
  // a try/catch and remember which ones actually took. The finally
  // block only restores the successful ones, preventing the same
  // throw on cleanup.
  const originalGlobals = {};
  const assigned = new Set();
  for (const key of PROXIED) {
    if (!(key in window)) continue;
    try {
      if (key in globalThis) originalGlobals[key] = globalThis[key];
      globalThis[key] = window[key];
      assigned.add(key);
    } catch {
      // Read-only built-in (e.g. Node 22+ `navigator`). The builder
      // can still reach the jsdom copy via `window.<key>`.
    }
  }

  try {
    // Sanity-check the mount point exists. Catches the common typo of
    // changing the mount selector in the template without updating it
    // here (or vice versa). Without this guard the builder runs but
    // silently writes nothing useful.
    if (mount && !window.document.querySelector(mount)) {
      throw new Error(
        `prerender: mount selector "${mount}" not found in template "${templatePath}". ` +
        `Check that the template's <body> contains <div id="${mount.replace(/^#/, "")}"></div>.`
      );
    }

    // Run the builder. Errors propagate so the caller knows the
    // page didn't render — better than writing a half-built file.
    await build(window);

    // Drain the microtask queue so any queued promise.then handlers
    // (e.g. dynamic imports inside the builder, fetch().then chains)
    // finish before we serialize. jsdom's macrotask scheduling means
    // setTimeout(0) callbacks may NOT fire — builders that rely on
    // those won't have their output captured. Keep builders sync or
    // promise-based for full coverage.
    await new Promise((resolve) => setImmediate(resolve));

    // Serialize the full document. `dom.serialize()` returns
    // `<!DOCTYPE html><html>...</html>` including the template's
    // head + the now-populated body. The runtime <script> tags from
    // the template are preserved verbatim, so the live browser will
    // re-execute app.js and re-mount on top of the static DOM.
    const rendered = dom.serialize();

    // Ensure the output directory exists. Writing to a path like
    // `./upload/de/index.html` would otherwise fail if `de/` doesn't
    // exist yet.
    const outputPath = path.resolve(output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, rendered, "utf8");

    return { bytes: rendered.length, output: outputPath };
  } finally {
    // Restore globalThis to its pre-call state. Critical when the
    // caller runs prerender() in a loop — without this, the second
    // invocation would inherit the FIRST jsdom's window, which has
    // already been closed.
    //
    // We only restore keys we successfully wrote in the first place
    // (`assigned`). Anything Node refused to let us assign is still
    // its original built-in, so there's nothing to roll back. Each
    // restore is also try/catch-guarded for the same reason — if
    // Node tightened the descriptor between begin and end of build
    // (unlikely but cheap to defend against), we want cleanup to
    // continue rather than throw out of the finally block.
    for (const key of assigned) {
      try {
        if (key in originalGlobals) {
          globalThis[key] = originalGlobals[key];
        } else {
          delete globalThis[key];
        }
      } catch {
        // Skip — restoration is best-effort.
      }
    }
    // Release jsdom's internal resources (timers, parser state).
    // Without this the Node process can keep ticking long after
    // the build script "finishes" because jsdom's setInterval
    // callbacks are still alive.
    window.close();
  }
}

/**
 * Convenience wrapper: prerender the same page once per locale and
 * write each rendered file to a different output path.
 *
 * @param {object} opts — Same as `prerender()`, but `output` is a
 *   function `(locale) => string` and `locale` is a list.
 * @param {string[]} opts.locales — Locale codes to render, e.g.
 *   `["cs", "en", "sk", "de", "fr"]`. Each value is passed to both
 *   the builder (via localStorage) and the `outputFor(locale)` fn.
 * @param {(locale: string) => string} opts.outputFor — Returns the
 *   destination path for each locale.
 *
 * @returns {Promise<Array<{ locale: string, bytes: number, output: string }>>}
 */
export async function prerenderEachLocale({
  template,
  mount,
  url,
  locales,
  outputFor,
  build,
  localStorageKey,
}) {
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new Error("prerenderEachLocale: `locales` must be a non-empty array");
  }
  if (typeof outputFor !== "function") {
    throw new Error("prerenderEachLocale: `outputFor` must be (locale) => string");
  }

  const results = [];
  for (const locale of locales) {
    const result = await prerender({
      template,
      mount,
      url,
      locale,
      localStorageKey,
      build,
      output: outputFor(locale),
    });
    results.push({ locale, ...result });
  }
  return results;
}

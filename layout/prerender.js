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
  htmlLang,
  canonical,
  alternates,
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
    // jsdom doesn't implement `visualViewport`. Nodality's animator
    // reads `window.visualViewport.width` when registering responsive
    // animation queries, so it crashes ("reading 'width' of undefined")
    // without this shim. A static object matching the simulated
    // viewport is enough — there's no pinch-zoom during SSG.
    if (!window.visualViewport) {
      Object.defineProperty(window, "visualViewport", {
        value: { width: vw, height: vh, scale: 1, offsetLeft: 0, offsetTop: 0,
                 addEventListener: () => {}, removeEventListener: () => {} },
        configurable: true, writable: true,
      });
    }
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
    "IntersectionObserver", "ResizeObserver", "matchMedia", "visualViewport",
    "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle",
    "fetch", "dataLayer", "gtag",
    "DOMParser", "XMLSerializer", "Range", "NodeFilter",
    // Deliberately NOT shimming the browser `Image` / `HTMLImageElement`
    // / `SVGElement` constructors — Nodality exports its own `Image`
    // class and `nodality/_globals.js` writes it to `globalThis`. The
    // browser-constructor copies would clobber it and break every
    // `new Image().set(…)` call in the entries.
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

    // ─── Cleanup pass: dedupe styles + strip body noise ─────────────
    //
    // Nodality's components have render-time side effects that
    // accumulate during the prerender build:
    //
    //   • Each section calling .render("#mount") injects its own
    //     <style> tag into <head>. The same `.hiw-card` block ends
    //     up duplicated once per section that uses those classes.
    //
    //   • Dropdown.render() appends its floating panel
    //     (`this.contentWrap`) directly to `document.body`, OUTSIDE
    //     `#mount`. Each render call appends another copy. With
    //     Switcher rendering both mobile + desktop variants, plus
    //     repeated render() invocations across the build, you can
    //     end up with 10+ identical hidden dropdowns.
    //
    //   • Modal components do the same thing — fixed-position
    //     overlays appended to body.
    //
    // None of this duplication is needed in the static output. The
    // crawler-relevant content all lives INSIDE #mount. The floating
    // panels are JS-driven UI that the browser recreates fresh when
    // the runtime clear-mount script fires + app.js re-renders.
    //
    // So: dedupe <style> tags by text content and remove every
    // body child that isn't #mount. Cuts the prerender output
    // roughly in half without changing what's visible to crawlers
    // or to real users.

    // Dedupe identical <style> tags. Keep the first occurrence,
    // remove subsequent ones with the same textContent.
    {
      const seen = new Set();
      for (const style of window.document.head.querySelectorAll("style")) {
        const key = style.textContent || "";
        if (seen.has(key)) {
          style.remove();
        } else {
          seen.add(key);
        }
      }
    }

    // Strip every body child except #mount (or whichever element
    // matches the `mount` selector) and the runtime <script> tags.
    // Floating dropdowns, modals, tooltips, etc. — all appended to
    // body by their respective render()s — get evicted here.
    if (mount) {
      const mountEl = window.document.querySelector(mount);
      const body = window.document.body;
      const keepers = new Set();
      if (mountEl) keepers.add(mountEl);
      // Keep all <script> tags so the runtime entries (app.js,
      // cookie-consent.js, the clear-mount inline) survive.
      for (const s of body.querySelectorAll(":scope > script")) keepers.add(s);
      // Keep GTM noscript iframe + any other <noscript> fallbacks.
      for (const n of body.querySelectorAll(":scope > noscript")) keepers.add(n);
      // Remove every direct child that wasn't whitelisted.
      for (const child of Array.from(body.children)) {
        if (!keepers.has(child)) child.remove();
      }
    }

    // ─── SEO head injection ─────────────────────────────────────────
    //
    // Inject per-locale `<html lang>`, `<link rel="canonical">`, and
    // `<link rel="alternate" hreflang>` tags so search engines and
    // social-share crawlers can attribute each prerendered file to
    // its correct language and prevent duplicate-content rank
    // collapse across locales.
    //
    // Doing this at the library level (rather than the consumer
    // template) keeps every SSG site that uses `nodality/ssg`
    // SEO-complete without each consumer reinventing the boilerplate.

    if (htmlLang) {
      window.document.documentElement.setAttribute("lang", htmlLang);
    }

    if (canonical) {
      // Remove any prior <link rel="canonical"> from the template so
      // we don't end up with two competing canonicals after re-runs.
      const prior = window.document.head.querySelector('link[rel="canonical"]');
      if (prior) prior.remove();
      const link = window.document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", canonical);
      window.document.head.appendChild(link);
    }

    if (Array.isArray(alternates) && alternates.length > 0) {
      // Strip prior hreflang alternates so successive prerender runs
      // produce byte-identical output (idempotent build).
      for (const el of window.document.head.querySelectorAll('link[rel="alternate"][hreflang]')) {
        el.remove();
      }
      for (const alt of alternates) {
        if (!alt || !alt.hreflang || !alt.href) continue;
        const link = window.document.createElement("link");
        link.setAttribute("rel", "alternate");
        link.setAttribute("hreflang", alt.hreflang);
        link.setAttribute("href", alt.href);
        window.document.head.appendChild(link);
      }
    }

    // ─── Hydration handoff ──────────────────────────────────────────
    //
    // The runtime <script> tags from the template still load in the
    // live browser — they're how interactivity (dropdowns, animations,
    // language switching) reaches the user. But Nodality's `render()`
    // primitive APPENDS to the mount target rather than replacing it.
    // That means without intervention, the browser would parse the
    // prerendered DOM (visible), then app.js would run and append a
    // SECOND copy of every section beneath it. The user sees the
    // page rendered twice, stacked.
    //
    // Fix: inject a tiny inline `<script>` right BEFORE the first
    // runtime module script. The inline script empties the mount
    // container so app.js starts with a clean slate. Bots that don't
    // execute JS still see the prerendered content (SEO + social
    // preview win preserved). Users with JS see the prerendered
    // content as instant-paint, then a sub-frame later the inline
    // script clears mount and app.js rebuilds — visually a brief
    // flicker, no duplication.
    //
    // Why not just have app.js clear mount itself: nodality has no
    // hook for "before first render" and the page entry scripts in
    // every consumer would each need the same boilerplate. Doing it
    // here, once, keeps consumers untouched.
    if (mount) {
      const expectedClearBody =
        `(function(){var m=document.querySelector(${JSON.stringify(mount)});if(m)m.innerHTML='';})();`;

      // Remove any pre-existing clear-mount scripts (left over from
      // a prior prerender run that read this same file as its
      // template). Without this, each successive build adds another
      // copy and the inline script section bloats.
      for (const s of window.document.querySelectorAll("body > script:not([src]):not([type])")) {
        if (s.textContent === expectedClearBody) s.remove();
      }

      const firstRuntimeScript = window.document.querySelector(
        'body script[type="module"][src], body script[src][type="module"]'
      );
      if (firstRuntimeScript) {
        const clearScript = window.document.createElement("script");
        // Inline (not type="module") so it executes synchronously,
        // before any module scripts begin loading. Module scripts
        // are always deferred, so the clear runs in the right order
        // regardless of where it sits in the DOM relative to them.
        clearScript.textContent = expectedClearBody;
        firstRuntimeScript.parentNode.insertBefore(clearScript, firstRuntimeScript);
      }
    }

    // Serialize the full document. `dom.serialize()` returns
    // `<!DOCTYPE html><html>...</html>` including the template's
    // head + the now-populated body PLUS the hydration-clear script
    // we injected above.
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

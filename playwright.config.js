// THE config. `playwright test` runs from the repo root and resolves this
// file; `scripts/generatePlaywright.js` writes a second one that nothing
// reads (see its header) — edit this.
//
// Port 3001 is fixed rather than searched for. On CI the runner is clean so
// it is always free; locally `reuseExistingServer` means an already-running
// `npx serve . -l 3001` is reused instead of collided with. If 3001 is
// occupied by something that is NOT this server, change it here.
module.exports = {
        testDir: './__tests__/e2e',
        timeout: 30000,

        // Retries and workers, CI only.
        //
        // This suite has a residual flake rate of a few percent across
        // ~300 tests: measured over repeated full runs, raster-probe,
        // transition-timeline and transition-pass have each failed once
        // and passed on re-run. Most involve WebGL timing or screenshot
        // equality, which is exactly the class that gets worse on slower
        // hardware with a software rasteriser.
        //
        // ONE of the three is now root-caused and fixed, and it was not a
        // timing sensitivity at all — transition-timeline's continuity
        // assertion was self-inconsistent. It discarded frames slower than
        // 50ms as stalls, then held the survivors to a step budget of 0.2,
        // while 50ms of legitimate easing is 0.375; any frame past 26.7ms
        // near the midpoint failed while animating correctly. It now judges
        // every pair against `easing'max / duration`, which is analytic and
        // scales with the gap. Measured 0/24 failures under the contention
        // that reproduced it at 1/12. The remaining two are still unexplained
        // and should not be assumed to be the same kind of thing.
        //
        // That matters more than usual here because `npm run test` guards
        // TWO gates: onlyPublish.sh runs it before tagging, and the
        // workflow runs it again on the tag push, with publish depending
        // on it. A flake at the first gate costs a re-run; a flake at the
        // second lands AFTER the version bump and tag are pushed, leaving
        // a tag in the repo with nothing published and a manual unwind
        // (git tag -d / git reset --soft HEAD~1).
        //
        // Retries are deliberately CI-only. Locally a flake should stay
        // visible and get root-caused — the last one turned out to be a
        // real race between a progress assertion and the frame that
        // applies it, and retries would have hidden it. Playwright still
        // reports a retried test as "flaky" rather than silently green,
        // so CI keeps telling you the rate rather than burying it.
        retries: process.env.CI ? 2 : 0,

        // One worker on CI. Every flake seen so far appeared only under
        // parallel load; ubuntu-latest has few cores, so the default
        // (half of them) buys little and costs contention. Local runs keep
        // the default.
        workers: process.env.CI ? 1 : undefined,
        webServer: {
          command: "npx serve . -l 3001",
          port: 3001,
          reuseExistingServer: !process.env.CI,
        },
        use: {
          baseURL: "http://localhost:3001",
          headless: true,
          viewport: { width: 700, height: 800 },
          launchOptions: {
            // Turns on the HTML-in-Canvas origin trial in Playwright's
            // bundled Chromium (the same thing
            // chrome://flags/#canvas-draw-element does in a normal
            // browser, which does NOT reach Playwright). Without it the
            // raster spec can only ever exercise the snapshot fallback
            // and its live-backend tests skip. Harmless for every other
            // spec: it only exposes texElementImage2D and
            // ctx.drawElement.
            args: ["--enable-blink-features=CanvasDrawElement"],
          },
        },
      };
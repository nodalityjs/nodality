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
        // This suite had a residual failure rate of a few percent across
        // ~300 tests, attributed here for a long time to "WebGL timing or
        // screenshot equality — the class that gets worse on slower hardware
        // with a software rasteriser". Three tests were named: raster-probe,
        // transition-timeline and transition-pass.
        //
        // That attribution was wrong, and expensively so: it explained the
        // failures without examining them, so nothing was fixed for as long
        // as it was believed. All three were investigated on 31 August 2026.
        // TWO WERE TEST BUGS, and neither involved WebGL timing.
        //
        //   transition-timeline — a self-inconsistent assertion. It discarded
        //   frames slower than 50ms as stalls, then held the survivors to a
        //   step budget of 0.2, while 50ms of legitimate easing is 0.375. Any
        //   frame past 26.7ms near the easing midpoint failed while animating
        //   perfectly. It now judges every pair against `easing'max /
        //   duration`, which is analytic, scales with the gap, and needs no
        //   filter — so the long-gap pairs it used to discard, where a real
        //   restart could hide, are judged too. 0/24 under the contention that
        //   reproduced it at 1/12.
        //
        //   raster-probe — a fixed-sleep race. It slept 260ms per op and then
        //   called `sourceAt`, which returns null until the first draw and
        //   documents that it "reports not ready rather than guessing".
        //   Measured time-to-first-draw across the registry is 80–480ms, so
        //   the budget sat INSIDE the requirement rather than above it, and
        //   which op lost was random: a release run failed on `blobs`, two
        //   back-to-back local runs on `halftone` and then on nothing. It now
        //   polls the condition, which is also faster when the machine is
        //   quiet. 8/8 under six-way contention.
        //
        // The third and a fourth are NOT test bugs, and are recorded so the
        // next person does not re-open them:
        //
        //   raster-ops "a failing test takes the else branch" — timed out at
        //   30s during a release. It exercises `resolveSwitches`, which is
        //   pure logic with no rendering at all, so no shader timing is
        //   involved. The time went on page setup while macOS storage
        //   indexing held the machine at load 23 and the whole suite ran 3.4m
        //   against its usual 1.6m. Environmental.
        //
        //   transition-pass — NOT REPRODUCED. 112 adversarial runs, including
        //   12 workers against six CPU hogs, all green. It carries the same
        //   structural smell as raster-probe — a 300ms hedge after `__ready`
        //   — but measurement kills the theory: the pipeline is usable 0ms
        //   after `__ready`, because the fixture builds it synchronously
        //   first. The sleep is wasted time, not margin. Its historical
        //   failure has no known cause, and that is a weaker statement than
        //   "it is fine" on purpose.
        //
        // The lesson worth keeping: a plausible category ("WebGL timing") is
        // not a diagnosis, and writing one down stops people looking. Measure
        // what the test needs against what it allows before believing the
        // machine is at fault.
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
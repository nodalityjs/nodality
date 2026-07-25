module.exports = {
        testDir: './__tests__/e2e',
        timeout: 30000,
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
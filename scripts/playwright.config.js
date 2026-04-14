module.exports = {
        testDir: './__tests__/e2e',
        timeout: 30000,
        webServer: {
          command: "npx serve . -l 3000",
          port: 3000,
          reuseExistingServer: !process.env.CI,
        },
        use: {
          baseURL: "http://localhost:3000",
          headless: true,
          viewport: { width: 700, height: 800 },
        },
      };
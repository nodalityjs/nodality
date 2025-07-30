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
        },
      };
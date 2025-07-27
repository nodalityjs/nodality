// playwright.config.js
module.exports = {
  testDir: './__tests__/e2e',
  timeout: 30000,
    webServer: {
    command: 'npx serve -l 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI, // speeds up local runs
  },
  use: {
    headless: true,
    viewport: { width: 700, height: 800 },
  },
};

// npx playwright install
// npm run test:playwright
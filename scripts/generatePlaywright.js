// NOT WIRED IN — kept as a manual utility, not part of `npm run test`.
//
// This writes `scripts/playwright.config.js`, and nothing reads it:
// `playwright test` runs from the repo root and resolves the ROOT
// `playwright.config.js`, which is committed and hardcodes port 3001. So
// the free-port search below has never had any effect on a test run, while
// `npm run test` paid for it on every invocation and the presence of two
// config files suggested the generated one was authoritative. Removed from
// the test script in phase P5 (2026-08-12).
//
// The root config is the one to edit. Run this by hand only if you
// genuinely want a generated config on a free port, and point Playwright
// at it explicitly:
//
//     node scripts/generatePlaywright.js
//     npx playwright test --config scripts/playwright.config.js

const fs = require('fs');
const net = require('net');
const path = require('path');

async function findFreePort(preferred = 3000, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferred + i;
    const isFree = await isPortFree(port);
    if (isFree) return port;
  }
  throw new Error('No free port found in range');
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        server.close(() => resolve(true));
      })
      .listen(port);
  });
}

(async () => {
  try {
    const preferredPort = process.env.TEST_PORT ? Number(process.env.TEST_PORT) : 3000;
    const port = await findFreePort(preferredPort);
    const configContent = `
      module.exports = {
        testDir: './__tests__/e2e',
        timeout: 30000,
        webServer: {
          command: "npx serve . -l ${port}",
          port: ${port},
          reuseExistingServer: !process.env.CI,
        },
        use: {
          baseURL: "http://localhost:${port}",
          headless: true,
          viewport: { width: 700, height: 800 },
        },
      };
    `;

    const configPath = path.resolve(__dirname, 'playwright.config.js');
    fs.writeFileSync(configPath, configContent.trim());
    console.log(`Playwright config generated with port ${port} at ${configPath}`);
  } catch (e) {
    console.error('Failed to generate Playwright config:', e);
    process.exit(1);
  }
})();

// node generatePlaywright.js
// OR TEST_PORT=4000 node generatePlaywright.js
// npx playwright test

// after publish NPM RUN TEST
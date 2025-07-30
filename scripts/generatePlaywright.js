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
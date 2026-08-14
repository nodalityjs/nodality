const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

// Get author name only
const author = typeof pkg.author === 'string'
  ? pkg.author.split('<')[0].trim()
  : pkg.author.name;

const header = `/*!
 * ${pkg.name} v${pkg.version}
 * (c) ${(new Date()).getFullYear()} ${author}
 * License: ${pkg.license}
 */
`;

// A `/*! … */` block at the very top of the file — which is NOT the same
// thing as a licence header.
const leadingBannerRegex = /^\/\*![\s\S]*?\*\/\s*/;

// What makes it a licence header: the `License:` line this script writes.
// The old code stripped the leading banner unconditionally, on the
// assumption that a `/*!` block at the top could only be a stale licence.
// `lib/seo.js` and `lib/data.js` both open with a `/*!` DOCUMENTATION
// block, so the first publish deleted them — 27 and 36 lines describing
// the SSG/hydration contract and the loader's browser-vs-Node resolution,
// gone from every published copy, silently, on every release since.
const isLicenceBanner = (banner) => /^\s*\*\s*License:/m.test(banner);

function addOrReplaceHeader(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const banner = content.match(leadingBannerRegex);
  if (banner && isLicenceBanner(banner[0])) {
    content = content.replace(leadingBannerRegex, '');
  }
  fs.writeFileSync(filePath, header + '\n' + content, 'utf8');
}

function walkAndInject(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);

    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`⚠️  Skipped missing: ${fullPath}`);
        return;
      }
      throw err;
    }

    if (stats.isDirectory()) {
      walkAndInject(fullPath);
    } else if (file.endsWith('.js')) {
      addOrReplaceHeader(fullPath);
    }
  });
}

// Run on all relevant directories
['lib', 'layout'].forEach(folder => {
  const target = path.join(__dirname, '..', folder);
  if (fs.existsSync(target)) {
    walkAndInject(target);
  }
});

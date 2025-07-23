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

// Matches a block comment at the top of the file
const licenseHeaderRegex = /^\/\*![\s\S]*?\*\/\s*/;

function addOrReplaceHeader(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (licenseHeaderRegex.test(content)) {
    content = content.replace(licenseHeaderRegex, '');
  }
  fs.writeFileSync(filePath, header + '\n' + content, 'utf8');
  console.log(`🔧 Updated: ${filePath}`);
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

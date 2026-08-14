const path = require('path');

/* =========================
   SHARED SINGLETON MODULES
   =========================

   lib/raster-ops.js owns two module-scoped singletons: the op REGISTRY
   that registerRasterOp() extends, and the ACTIVE set of attached
   pipelines that the inspector reads. Bundling a SECOND copy of the file
   does not duplicate a helper, it duplicates that state.

   Before this, every entry that transitively imports it — index,
   designer, element-mapper, text, animator — inlined its own registry.
   So for a consumer:

     import { Des } from "nodality";                     // bundled, registry A
     import { registerRasterOp } from "nodality/raster";  // source, registry B
     import { inspectRaster } from "nodality/inspect";    // source, registry B

   ...an op registered through `nodality/raster` was accepted and then
   never ran, because the Des doing the rendering consulted registry A.
   The inspector had the mirror-image bug: it listed ACTIVE from B while
   every real pipeline had registered itself in A, so it reported "No
   raster pipelines attached" on a page full of them.

   Both failures are silent, which is exactly the class the op registry's
   validation exists to eliminate — so leaving it to documentation was
   not good enough.

   Marking the file external makes the bundles IMPORT it instead. One
   file on disk, one module instance, one registry, whichever door the
   consumer comes through. Guarded by
   __tests__/unit/bundle-shares-registry.test.mjs (config + artefact) and
   __tests__/e2e/bundle.spec.js (the same, in a browser). */

const fs = require('fs');

// The canonical on-disk path: resolves symlinks and, on case-insensitive
// filesystems (macOS, Windows), the REAL casing.
//
// A plain string compare is not enough. webpack's `context` carries
// whatever casing the invoking path had, and this repo is genuinely
// reached as both .../layout and .../Layout on the machine it is built
// on. `path.resolve` is pure string arithmetic, so those two produce
// paths that differ while naming the same file — the test below would
// fall through, raster-ops would be inlined again, and the only symptom
// would be an op that registers and never runs. Exactly the silent
// failure this external exists to prevent, reintroduced by the fix.
const canonical = (p) => {
  try { return fs.realpathSync.native(p); } catch (e) { return p; }
};

const RASTER_OPS = canonical(path.resolve(__dirname, 'lib/raster-ops.js'));

// Every output lands in dist/, so from an emitted file the source module
// is one level up. `files` in package.json ships lib/, so this resolves
// for consumers as well as in-repo.
const RASTER_OPS_SPECIFIER = '../lib/raster-ops.js';

const externalRasterOps = (type) => function ({ context, request }, callback) {
  if (!request || !/raster-ops(\.js)?$/.test(request)) return callback();
  // Compare the RESOLVED path, so a same-named file elsewhere is not
  // caught by the name test above.
  const abs = path.resolve(context, request);
  const withExt = path.extname(abs) ? abs : `${abs}.js`;
  if (canonical(withExt) !== RASTER_OPS) return callback();
  return callback(null, `${type} ${RASTER_OPS_SPECIFIER}`);
};

/** Emit `import`/`require` for raster-ops instead of inlining it. */
const shareRasterOps = (config, type) => ({
  ...config,
  externals: [externalRasterOps(type)],
});

const createConfig = (
  entry,
  filename,
  libraryTarget,
  libraryName,
  outputModule = false
) => ({
  entry,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename,
    library: libraryName,
    libraryTarget,
    libraryExport: libraryName,
    globalObject: libraryTarget === 'umd' ? 'this' : undefined,
    ...(outputModule && { module: true }),
    // Namespaces runtime GLOBALS (chunk loading) so two webpack builds
    // on one page do not fight. Note this does NOT rename the internal
    // runtime identifiers — `__webpack_module_cache__` and friends keep
    // their names, which is why scripts/namespaceRuntime.mjs exists.
    uniqueName: 'nodality',
  },
  experiments: outputModule ? { outputModule: true } : undefined,
  resolve: {
    extensions: ['.js'],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  mode: 'production',
});

/* =========================
   ENTRY DEFINITIONS
   ========================= */

const entries = [
  // core
  'layout/index',

  // layout
  'layout/animator',
  'layout/text',
  'layout/image',
  'layout/link',
  'layout/flex-row',
  'layout/new-nav-bar',
  'layout/beta-desktop-bar',
  'layout/beta-mobile-bar',
  'layout/multiswitcher',
  'layout/side-bar',
  'layout/side-nav-bar',
  'layout/simple-bar',
  'layout/free',
  'layout/audionew',
  'layout/progress',
  'layout/center',
  'layout/code',
  'layout/stack',
  'layout/container',
  'layout/meta-adder',
  'layout/table',
  'layout/modal-2025',
  'layout/text-field',
  'layout/flex-card',
  'layout/wrap',
  'layout/flex-grid',
  'layout/zoom-card',
  'layout/horizontal-scroller',
  'layout/checkbox',
  'layout/base',
  'layout/button',
  'layout/spacer',
  'layout/video',
  'layout/slider-2025',
  'layout/ulist',

  // form-components
  'layout/form-components/image-picker',
  'layout/form-components/picker',
  'layout/form-components/range',
  'layout/form-components/radio',
  'layout/form-components/data-list',
  'layout/form-components/floating-input',

  // lib
  'lib/element-mapper',
  'lib/designer',
  'lib/link-getter',
  'lib/card-getter',
  'lib/transform-anim',
  'lib/keyframe-animation',
  'lib/stacker',
  'lib/scroll-video',
  'lib/theme',
];

/* =========================
   BUILD GENERATORS
   ========================= */

const esmBuilds = entries.map(entry =>
  shareRasterOps(
    createConfig(
      `./${entry}.js`,
      `${path.basename(entry)}.esm.js`,
      'module',
      undefined,
      true
    ),
    'module'
  )
);

// CJS stays self-contained. lib/raster-ops.js is ESM source in a package
// with no "type": "module", so `require("../lib/raster-ops.js")` from
// dist/ would depend on Node's require(esm) support — a runtime version
// dependency this build has no reason to take on. Nothing observable is
// lost: the subpaths that could disagree with the CJS bundle
// (`nodality/raster`, `nodality/inspect`) are ESM-only, so a require()
// consumer cannot hold a second instance to begin with.
const cjsBuilds = entries.map(entry =>
  createConfig(
    `./${entry}.js`,
    `${path.basename(entry)}.cjs.js`,
    'commonjs2'
  )
);

/* =========================
   UMD / MERGED
   ========================= */

const umdBuilds = [
  createConfig('./layout/index.js', 'bundle.umd.js', 'umd', 'Bundle'),
  createConfig('./layout/index.js', 'finalresult.esm.js', 'module', undefined, true),
];

/* =========================
   EXPORT
   ========================= */

module.exports = [
  ...esmBuilds,
  ...cjsBuilds,
  ...umdBuilds,
];


    // run using
    // webpack --config webpack.config.js
    // or npm run build if you have build script in config.js
    //  npm install -g webpack


  
